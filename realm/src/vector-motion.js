import * as THREE from 'three';
import { SVGRenderer } from 'three/addons/renderers/SVGRenderer.js';

// A small, transparent projection of native moving models. The caller owns
// animation timing, static-scene rendering, and every shared geometry/material.
export function createVectorMotionLayer({ scene, camera, canvas, roots = [], occluders = [] } = {}) {
  if (!scene?.isObject3D || !camera?.isCamera || !canvas?.parentNode) {
    throw new Error('The vector motion layer needs a scene, camera, and attached canvas.');
  }

  const renderer = new SVGRenderer();
  renderer.setQuality('low');
  renderer.setPrecision(1);
  renderer.overdraw = 0.2;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const element = renderer.domElement;
  element.classList.add('realm-motion-renderer');
  element.setAttribute('aria-hidden', 'true');
  element.setAttribute('focusable', 'false');
  Object.assign(element.style, {
    position: 'absolute', inset: '0', width: '100%', height: '100%',
    display: 'block', pointerEvents: 'none', backgroundColor: 'transparent',
  });
  canvas.parentNode.insertBefore(element, canvas);

  const projectionScene = new THREE.Scene();
  projectionScene.background = null;
  const dynamicSources = new WeakSet();
  const geometryBounds = new WeakMap();
  const occluderCache = new WeakMap();
  const nativeRoots = [...new Set(roots.filter((root) => root?.isObject3D))];
  const nativeOccluders = [...new Set(occluders.filter((root) => root?.isObject3D))];
  const rootSet = new Set(nativeRoots);
  const records = [];
  const lights = [];
  let destroyed = false, width = 1, height = 1, frameCount = 0;
  let cameraRevision = 0, occluderRevision = 0, rayTests = 0;
  let renderMilliseconds = 0, visibleRoots = 0, visibleMeshes = 0;
  let occludedRoots = 0, occludedMeshes = 0;
  const lastCamera = new THREE.Matrix4(), lastProjection = new THREE.Matrix4();
  const activeOccluders = [], previousOccluders = [], candidates = [], intersections = [];
  const seenOccluders = new Set();
  const raycaster = new THREE.Raycaster();
  const projected = new THREE.Vector3(), worldPoint = new THREE.Vector3();
  const rayOffset = new THREE.Vector3(), boxPoint = new THREE.Vector3();
  const center = new THREE.Vector3(), halfSize = new THREE.Vector3();
  const right = new THREE.Vector3(), up = new THREE.Vector3(), forward = new THREE.Vector3();
  const transformedBox = new THREE.Box3();

  function ancestorsVisible(object) {
    for (let ancestor = object; ancestor; ancestor = ancestor.parent) {
      if (!ancestor.visible) return false;
    }
    return true;
  }

  function materialVisible(material) {
    if (Array.isArray(material)) return material.some(materialVisible);
    return !!material && material.visible !== false && material.opacity !== 0 && material.colorWrite !== false;
  }

  function ensureBounds(geometry) {
    const position = geometry?.getAttribute('position');
    if (!position) return null;
    let entry = geometryBounds.get(geometry);
    if (!entry || entry.position !== position || entry.version !== position.version || !geometry.boundingBox || !geometry.boundingSphere) {
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      entry = { position, version: position.version };
      geometryBounds.set(geometry, entry);
    }
    return entry;
  }

  function cloneHierarchy(source, record, parentPair = null) {
    const clone = source.clone(false);
    clone.matrixAutoUpdate = false;
    clone.matrixWorldAutoUpdate = false;
    const pair = {
      source, clone, parentPair, sourceVisible: true,
      visibility: { cameraRevision: -1, occluderRevision: -1, matrix: new THREE.Matrix4(), geometry: null, version: -1, blocked: false },
    };
    record.pairs.push(pair);
    if (source.isMesh) record.meshes.push(pair);
    dynamicSources.add(source);
    for (const child of source.children) clone.add(cloneHierarchy(child, record, pair));
    return clone;
  }

  for (const source of nativeRoots) {
    // Nested supplied roots already belong to their ancestor's single clone.
    let nested = false;
    for (let parent = source.parent; parent; parent = parent.parent) if (rootSet.has(parent)) { nested = true; break; }
    if (nested) continue;
    const record = { source, clone: null, pairs: [], meshes: [], bounds: new THREE.Box3() };
    record.clone = cloneHierarchy(source, record);
    records.push(record);
    projectionScene.add(record.clone);
  }

  scene.traverse((source) => {
    if (!source.isAmbientLight && !source.isDirectionalLight) return;
    const clone = source.isDirectionalLight ? new THREE.DirectionalLight() : new THREE.AmbientLight();
    clone.matrixAutoUpdate = false;
    clone.matrixWorldAutoUpdate = false;
    if (clone.isDirectionalLight) {
      clone.target.matrixAutoUpdate = false;
      clone.target.matrixWorldAutoUpdate = false;
    }
    lights.push({ source, clone });
    projectionScene.add(clone);
  });

  function syncModels() {
    for (const record of records) for (const pair of record.pairs) {
      const { source, clone, parentPair } = pair;
      pair.sourceVisible = source.visible && (parentPair ? parentPair.sourceVisible : ancestorsVisible(source.parent));
      clone.visible = pair.sourceVisible;
      clone.position.copy(source.position);
      clone.quaternion.copy(source.quaternion);
      clone.scale.copy(source.scale);
      clone.matrix.copy(parentPair ? source.matrix : source.matrixWorld);
      clone.matrixWorld.copy(source.matrixWorld);
      clone.renderOrder = source.renderOrder;
      clone.frustumCulled = source.frustumCulled;
      if (source.geometry) clone.geometry = source.geometry;
      if (source.material) clone.material = source.material;
    }
    for (const { source, clone } of lights) {
      clone.visible = ancestorsVisible(source);
      clone.color.copy(source.color);
      clone.intensity = source.intensity;
      clone.matrix.copy(source.matrixWorld);
      clone.matrixWorld.copy(source.matrixWorld);
      if (clone.isDirectionalLight) {
        source.target.updateWorldMatrix(true, false);
        clone.target.matrix.copy(source.target.matrixWorld);
        clone.target.matrixWorld.copy(source.target.matrixWorld);
      }
    }
  }

  function collectOccluders(object) {
    if (!object.visible || dynamicSources.has(object)) return;
    if (object.isMesh && materialVisible(object.material) && !seenOccluders.has(object)) {
      if (ensureBounds(object.geometry)) { activeOccluders.push(object); seenOccluders.add(object); }
    }
    for (const child of object.children) collectOccluders(child);
  }

  function updateOccluders() {
    activeOccluders.length = 0;
    seenOccluders.clear();
    for (const root of nativeOccluders) if (ancestorsVisible(root.parent)) collectOccluders(root);
    let changed = activeOccluders.length !== previousOccluders.length;
    for (let i = 0; i < activeOccluders.length; i++) {
      const object = activeOccluders[i];
      if (object !== previousOccluders[i]) changed = true;
      const bounds = geometryBounds.get(object.geometry);
      let entry = occluderCache.get(object);
      if (!entry) {
        entry = { matrix: new THREE.Matrix4(), geometry: null, version: -1, cameraRevision: -1 };
        occluderCache.set(object, entry);
      }
      const geometryChanged = entry.geometry !== object.geometry || entry.version !== bounds.version || entry.position !== bounds.position;
      const transformChanged = !entry.matrix.equals(object.matrixWorld);
      if (geometryChanged || transformChanged) changed = true;
      if (geometryChanged || transformChanged || entry.cameraRevision !== cameraRevision) {
        entry.minX = entry.minY = Infinity;
        entry.maxX = entry.maxY = -Infinity;
        const box = object.geometry.boundingBox;
        for (let corner = 0; corner < 8; corner++) {
          boxPoint.set(corner & 1 ? box.max.x : box.min.x, corner & 2 ? box.max.y : box.min.y, corner & 4 ? box.max.z : box.min.z);
          boxPoint.applyMatrix4(object.matrixWorld).project(camera);
          entry.minX = Math.min(entry.minX, boxPoint.x); entry.maxX = Math.max(entry.maxX, boxPoint.x);
          entry.minY = Math.min(entry.minY, boxPoint.y); entry.maxY = Math.max(entry.maxY, boxPoint.y);
        }
        entry.matrix.copy(object.matrixWorld);
        entry.geometry = object.geometry; entry.position = bounds.position; entry.version = bounds.version;
        entry.cameraRevision = cameraRevision;
      }
    }
    previousOccluders.length = activeOccluders.length;
    for (let i = 0; i < activeOccluders.length; i++) previousOccluders[i] = activeOccluders[i];
    if (changed) occluderRevision++;
  }

  function pointOccluded(point) {
    projected.copy(point).project(camera);
    candidates.length = 0;
    const paddingX = 1 / width, paddingY = 1 / height;
    for (const object of activeOccluders) {
      const bounds = occluderCache.get(object);
      if (projected.x >= bounds.minX - paddingX && projected.x <= bounds.maxX + paddingX && projected.y >= bounds.minY - paddingY && projected.y <= bounds.maxY + paddingY) candidates.push(object);
    }
    if (!candidates.length) return false;
    // setFromCamera handles orthographic ray origins correctly; a ray from
    // camera.position directly to the object would give incorrect visibility.
    raycaster.setFromCamera(projected, camera);
    const distance = rayOffset.copy(point).sub(raycaster.ray.origin).dot(raycaster.ray.direction);
    if (distance <= 0.04) return false;
    raycaster.near = 0;
    raycaster.far = distance - 0.04;
    intersections.length = 0;
    rayTests++;
    raycaster.intersectObjects(candidates, false, intersections);
    return intersections.length > 0;
  }

  function rootOccluded(record) {
    record.bounds.makeEmpty();
    for (const { source, sourceVisible } of record.meshes) {
      if (!sourceVisible || !materialVisible(source.material) || !ensureBounds(source.geometry)) continue;
      transformedBox.copy(source.geometry.boundingBox).applyMatrix4(source.matrixWorld);
      record.bounds.union(transformedBox);
    }
    if (record.bounds.isEmpty()) return false;
    record.bounds.getCenter(center);
    record.bounds.getSize(halfSize).multiplyScalar(0.5);
    // motionRadius selects whole-model occlusion; the actual transformed bounds
    // determine its probes. Inflating both axes by a ferry's radius would test
    // empty water/air well outside its silhouette and hide it beside the shore.
    const margin = 0.04;
    const halfWidth = Math.abs(right.x) * halfSize.x + Math.abs(right.y) * halfSize.y + Math.abs(right.z) * halfSize.z + margin;
    const halfHeight = Math.abs(up.x) * halfSize.x + Math.abs(up.y) * halfSize.y + Math.abs(up.z) * halfSize.z + margin;
    const halfDepth = Math.abs(forward.x) * halfSize.x + Math.abs(forward.y) * halfSize.y + Math.abs(forward.z) * halfSize.z;
    // Testing the far side of the bounding volume is intentionally conservative:
    // a partially hidden ferry disappears instead of painting through a cliff.
    center.addScaledVector(forward, halfDepth);
    if (pointOccluded(center)) return true;
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) {
      if (x === 0 && y === 0) continue;
      worldPoint.copy(center).addScaledVector(right, x * halfWidth).addScaledVector(up, y * halfHeight);
      if (pointOccluded(worldPoint)) return true;
    }
    return false;
  }

  function meshOccluded(pair) {
    const { source, visibility } = pair;
    const bounds = ensureBounds(source.geometry);
    if (!bounds) return false;
    if (visibility.cameraRevision !== cameraRevision || visibility.occluderRevision !== occluderRevision || visibility.geometry !== source.geometry || visibility.position !== bounds.position || visibility.version !== bounds.version || !visibility.matrix.equals(source.matrixWorld)) {
      worldPoint.copy(source.geometry.boundingSphere.center).applyMatrix4(source.matrixWorld);
      visibility.blocked = pointOccluded(worldPoint);
      visibility.cameraRevision = cameraRevision; visibility.occluderRevision = occluderRevision;
      visibility.geometry = source.geometry; visibility.position = bounds.position; visibility.version = bounds.version;
      visibility.matrix.copy(source.matrixWorld);
    }
    return visibility.blocked;
  }

  function setSize(nextWidth, nextHeight) {
    if (destroyed) return;
    const requestedWidth = Number(nextWidth), requestedHeight = Number(nextHeight);
    width = Number.isFinite(requestedWidth) ? Math.max(1, requestedWidth) : 1;
    height = Number.isFinite(requestedHeight) ? Math.max(1, requestedHeight) : 1;
    renderer.setSize(width, height);
    element.style.width = `${width}px`; element.style.height = `${height}px`;
  }

  function render() {
    if (destroyed) return;
    const started = performance.now();
    rayTests = visibleRoots = visibleMeshes = occludedRoots = occludedMeshes = 0;
    scene.updateMatrixWorld(true);
    camera.updateWorldMatrix(true, false);
    if (!frameCount || !lastCamera.equals(camera.matrixWorld) || !lastProjection.equals(camera.projectionMatrix)) {
      lastCamera.copy(camera.matrixWorld); lastProjection.copy(camera.projectionMatrix); cameraRevision++;
    }
    right.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    up.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
    forward.setFromMatrixColumn(camera.matrixWorld, 2).normalize().negate();
    syncModels();
    updateOccluders();
    for (const record of records) {
      if (!record.clone.visible) continue;
      const radius = Number(record.source.userData.motionRadius);
      if (Number.isFinite(radius) && radius > 0) {
        if (rootOccluded(record)) { record.clone.visible = false; occludedRoots++; continue; }
      } else {
        for (const pair of record.meshes) {
          if (pair.sourceVisible && materialVisible(pair.source.material) && meshOccluded(pair)) {
            pair.clone.visible = false; occludedMeshes++;
          }
        }
      }
      visibleRoots++;
      for (const pair of record.meshes) if (pair.clone.visible && materialVisible(pair.clone.material)) visibleMeshes++;
    }
    try {
      renderer.render(projectionScene, camera);
      frameCount++;
    } finally {
      // SVGRenderer.clear() writes an opaque background even for a null scene.
      element.style.backgroundColor = 'transparent';
      renderMilliseconds = performance.now() - started;
    }
  }

  function getInfo() {
    return {
      renderer: 'svg-motion', frames: frameCount, roots: records.length,
      visibleRoots, visibleMeshes, occludedRoots, occludedMeshes,
      occluders: activeOccluders.length, rayTests,
      drawCalls: element.childElementCount, triangles: renderer.info.render.faces,
      renderMilliseconds: Math.round(renderMilliseconds * 10) / 10, destroyed,
    };
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    element.remove();
    projectionScene.clear();
    renderer.dispose?.();
    // Geometry and materials are shared with the native scene and must survive.
    records.length = lights.length = nativeRoots.length = nativeOccluders.length = 0;
    activeOccluders.length = previousOccluders.length = candidates.length = intersections.length = 0;
    rootSet.clear(); seenOccluders.clear();
  }

  return { element, setSize, render, destroy, getInfo };
}
