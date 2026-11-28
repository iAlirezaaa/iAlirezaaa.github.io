/**
 * Native, renderer-independent River Styx. All motion is derived from absolute
 * elapsed seconds. The returned scene-level roots can be hidden for a static
 * SVG pass and mirrored into an animated projection; the ferry's oar is its
 * only independently animated child, so mirror that child transform as well.
 */
export function createStyxRiver({ THREE, scene, M, mesh, box, cylinder, batch, webgl = true }) {
  const TAU = Math.PI * 2;
  const waterLevel = -2.25;
  const riverLabelPosition = [0, -2.05, 21];
  const motionRoots = [];
  const RX = 21.3, RZ = 18.8, EXPONENT = 0.68;
  const ROUTE_SEGMENTS = 384;
  const SPIRIT_SCALE = 1.45;
  const signedPower = (value, power) => Math.sign(value) * Math.abs(value) ** power;

  const waterInk = new THREE.MeshBasicMaterial({ color: '#161514', side: THREE.DoubleSide });
  const coastInk = new THREE.MeshBasicMaterial({ color: '#25221f', side: THREE.DoubleSide });
  const outerBank = new THREE.MeshBasicMaterial({ color: '#413b34', side: THREE.DoubleSide });
  const waterCharcoal = new THREE.MeshBasicMaterial({ color: '#302b26', side: THREE.DoubleSide });
  const waterChannel = new THREE.MeshBasicMaterial({ color: '#201e1b', side: THREE.DoubleSide });
  const currentBone = new THREE.MeshBasicMaterial({ color: '#c8bdad', transparent: true, opacity: 0.36, depthWrite: false, side: THREE.DoubleSide });
  const faintCurrent = new THREE.MeshBasicMaterial({ color: '#a99b89', transparent: true, opacity: 0.23, depthWrite: false, side: THREE.DoubleSide });
  const vermilion = new THREE.MeshBasicMaterial({ color: '#EF4B32', transparent: true, opacity: 0.64, depthWrite: false, side: THREE.DoubleSide });
  const shroudBone = M.bone.clone();
  Object.assign(shroudBone, { transparent: true, opacity: webgl ? 0.88 : 0.94, depthWrite: true, side: THREE.DoubleSide, flatShading: true });
  const shroudFold = M.bone.clone();
  shroudFold.color.set('#b9aa98');
  Object.assign(shroudFold, { transparent: true, opacity: 0.86, side: THREE.DoubleSide, flatShading: true });
  const faceInk = new THREE.MeshBasicMaterial({ color: '#131211', side: THREE.DoubleSide });
  const spiritEyes = new THREE.MeshBasicMaterial({ color: '#eee4d6', side: THREE.DoubleSide });
  const hullTrim = M.woodLight.clone();
  hullTrim.color.set('#8b7d6c');
  const lanternBone = new THREE.MeshBasicMaterial({ color: '#E6D9C7' });

  function point(angle, lane = 0, rx = RX, rz = RZ, exponent = EXPONENT) {
    const ux = signedPower(Math.cos(angle), exponent);
    const uz = signedPower(Math.sin(angle), exponent);
    // The same restrained winding shapes the banks, currents and travel path.
    // Its 0.36-unit bound retains the existing camera framing and shoreline.
    const winding = Math.sin(angle * 3 + 0.42) * 0.26 + Math.sin(angle * 5 - 1.10) * 0.10;
    return {
      x: (rx + lane + winding) * ux,
      z: (rz + lane + winding) * uz,
      ux, uz,
    };
  }

  function geometry(positions, indices) {
    const result = new THREE.BufferGeometry();
    result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    result.setIndex(indices);
    result.computeVertexNormals();
    return result;
  }

  function ringGeometry(inner, outer, y, start = 0, end = TAU, segments = 144) {
    const positions = [], indices = [];
    for (let i = 0; i <= segments; i++) {
      const angle = start + (end - start) * i / segments;
      const a = point(angle, inner.lane || 0, inner.rx || RX, inner.rz || RZ, inner.exponent || EXPONENT);
      const b = point(angle, outer.lane || 0, outer.rx || RX, outer.rz || RZ, outer.exponent || EXPONENT);
      positions.push(a.x, y, a.z, b.x, y, b.z);
      if (i < segments) {
        const p = i * 2;
        indices.push(p, p + 2, p + 1, p + 1, p + 2, p + 3);
      }
    }
    return geometry(positions, indices);
  }

  function finishStatic(group, order) {
    batch(group);
    group.traverse((object) => {
      if (!object.isMesh) return;
      object.renderOrder = order;
      object.castShadow = false;
      object.receiveShadow = false;
    });
  }

  function addBand(name, inner, outer, y, material, order) {
    const group = new THREE.Group();
    group.name = name;
    scene.add(group);
    mesh(group, ringGeometry(inner, outer, y), material);
    finishStatic(group, order);
    return group;
  }

  // The inner wash reaches the existing island cliffs. The broad outer ribbon
  // stays inside x ±24.28 / z ±21.78 and reads separately from the old sea plane.
  addBand('styx-inner-wash', { rx: 17.0, rz: 15.0, exponent: 0.57 }, { lane: -1.25 }, waterLevel - 0.04, coastInk, -4.95);
  addBand('styx-outer-bank', { lane: 2.08 }, { lane: 2.62 }, waterLevel - 0.025, outerBank, -4.91);
  addBand('styx-ink-water', { lane: -2.15 }, { lane: 2.15 }, waterLevel, waterInk, -4.88);
  addBand('styx-charcoal-current', { lane: -1.62 }, { lane: -0.30 }, waterLevel + 0.008, waterCharcoal, -4.84);
  addBand('styx-deep-channel', { lane: 0.12 }, { lane: 1.10 }, waterLevel + 0.014, waterChannel, -4.81);

  const staticCurrents = new THREE.Group();
  staticCurrents.name = 'styx-current-ribbons';
  scene.add(staticCurrents);
  const ribbonArcs = [
    [0.04, 0.32, 1.46, 0.035], [0.57, 0.93, -1.12, 0.043],
    [1.18, 1.48, 0.58, 0.035], [1.83, 2.10, 1.32, 0.035],
    [2.42, 2.75, -0.82, 0.040], [3.28, 3.58, 1.44, 0.030],
    [4.14, 4.52, -0.74, 0.038], [5.18, 5.50, 0.60, 0.032],
  ];
  for (const [start, end, lane, width] of ribbonArcs) {
    mesh(staticCurrents, ringGeometry({ lane: lane - width / 2 }, { lane: lane + width / 2 }, waterLevel + 0.025, start, end, 13), currentBone);
  }
  for (const [start, lane] of [[0.30, -1.65], [1.68, 1.72], [4.80, -1.50]]) {
    mesh(staticCurrents, ringGeometry({ lane: lane - 0.022 }, { lane: lane + 0.022 }, waterLevel + 0.029, start, start + 0.07, 5), vermilion);
  }
  finishStatic(staticCurrents, -4.70);

  // Arc-length sampling keeps speed calm near the flatter superellipse sides.
  const route = [];
  let routeLength = 0;
  for (let i = 0; i <= ROUTE_SEGMENTS; i++) {
    const p = point(i / ROUTE_SEGMENTS * TAU);
    if (i) routeLength += Math.hypot(p.x - route[i - 1].x, p.z - route[i - 1].z);
    route.push({ ...p, distance: routeLength });
  }
  for (let i = 0; i <= ROUTE_SEGMENTS; i++) {
    const previous = route[(i + ROUTE_SEGMENTS - 1) % ROUTE_SEGMENTS];
    const next = route[(i + 1) % ROUTE_SEGMENTS];
    const length = Math.hypot(next.x - previous.x, next.z - previous.z);
    route[i].dx = (next.x - previous.x) / length;
    route[i].dz = (next.z - previous.z) / length;
  }
  function distanceAt(angle) {
    const fraction = ((angle % TAU + TAU) % TAU) / TAU * ROUTE_SEGMENTS;
    const index = Math.floor(fraction);
    return THREE.MathUtils.lerp(route[index].distance, route[index + 1].distance, fraction - index);
  }
  function sample(distance, lane, out) {
    const d = ((distance % routeLength) + routeLength) % routeLength;
    let low = 0, high = ROUTE_SEGMENTS;
    while (high - low > 1) {
      const middle = (low + high) >> 1;
      if (route[middle].distance <= d) low = middle;
      else high = middle;
    }
    const a = route[low], b = route[high];
    const t = (d - a.distance) / (b.distance - a.distance);
    out.x = THREE.MathUtils.lerp(a.x, b.x, t) + lane * THREE.MathUtils.lerp(a.ux, b.ux, t);
    out.z = THREE.MathUtils.lerp(a.z, b.z, t) + lane * THREE.MathUtils.lerp(a.uz, b.uz, t);
    out.yaw = Math.atan2(THREE.MathUtils.lerp(a.dx, b.dx, t), THREE.MathUtils.lerp(a.dz, b.dz, t));
    return out;
  }

  function motionRoot(name, radius, height, kind) {
    const group = new THREE.Group();
    group.name = name;
    group.userData.motionRadius = radius;
    group.userData.motionHeight = height;
    group.userData.motionKind = kind;
    scene.add(group);
    motionRoots.push(group);
    return group;
  }

  // Sixty triangles describe a continuous pointed hood and tapered trailing
  // robe. Hollow faces, tiny eyes and split side folds bring each spirit to 80.
  function shroudGeometry() {
    const rings = [
      [0.06, 0.045, 0.045, -0.22], [0.38, 0.23, 0.17, -0.10],
      [1.00, 0.34, 0.24, 0], [1.30, 0.28, 0.235, 0], [1.53, 0.18, 0.17, -0.02],
    ];
    const positions = [], indices = [];
    for (const [y, rx, rz, z] of rings) {
      for (let i = 0; i < 6; i++) {
        const angle = i / 6 * TAU + Math.PI / 6;
        positions.push(Math.cos(angle) * rx, y, z + Math.sin(angle) * rz);
      }
    }
    for (let ring = 0; ring < rings.length - 1; ring++) for (let i = 0; i < 6; i++) {
      const a = ring * 6 + i, b = ring * 6 + (i + 1) % 6;
      indices.push(a, a + 6, b, b, a + 6, b + 6);
    }
    const bottom = positions.length / 3;
    positions.push(0, 0.015, -0.25, 0, 1.67, -0.025);
    for (let i = 0; i < 6; i++) {
      indices.push(bottom, i, (i + 1) % 6);
      indices.push(bottom + 1, 24 + (i + 1) % 6, 24 + i);
    }
    return geometry(positions, indices);
  }

  const spirits = [];
  const startingAngles = [-0.33, -0.10, 0.10, 0.63, 0.83, 1.03, 1.22, 1.42, 1.63, 1.83, 2.02, 2.21];
  const facing = Math.atan2(32, 39);
  for (let i = 0; i < startingAngles.length; i++) {
    const root = motionRoot(`styx-spirit-${i + 1}`, 0.62 * SPIRIT_SCALE, 1.85 * SPIRIT_SCALE, 'spirit');
    mesh(root, shroudGeometry(), shroudBone);
    const face = mesh(root, new THREE.CircleGeometry(0.17, 8), faceInk, 0, 1.255, 0.248);
    face.scale.set(0.88, 1.16, 1);
    for (const x of [-0.052, 0.052]) mesh(root, new THREE.CircleGeometry(0.017, 4), spiritEyes, x, 1.28, 0.253);
    for (const side of [-1, 1]) {
      mesh(root, geometry([
        side * 0.27, 0.99, 0.03, side * 0.37, 0.66, -0.035,
        side * 0.16, 0.17, -0.26, side * 0.16, 0.72, 0.08,
      ], [0, 1, 2, 0, 2, 3]), shroudFold);
    }
    // Bake the readability increase into the whole model before batching.
    // Bounds grow once here; the root retains only individual size variation,
    // which the vector occlusion helper already applies to motionRadius.
    for (const child of root.children) {
      child.position.multiplyScalar(SPIRIT_SCALE);
      child.scale.multiplyScalar(SPIRIT_SCALE);
    }
    batch(root); // Only root transforms animate; no consumed mesh references.
    const size = [0.86, 0.94, 1.00, 0.90][i % 4];
    root.scale.setScalar(size);
    root.traverse((object) => { if (object.isMesh) { object.castShadow = false; object.receiveShadow = false; } });
    spirits.push({ root, start: distanceAt(startingAngles[i]), lane: [-0.84, 0.63, -0.15, 1.08][i % 4], speed: (0.26 + i % 4 * 0.035) * 1.3, weavePeriod: 11 + i % 4 * 0.65, phase: i * 1.618 });
  }

  const ferry = motionRoot('styx-charon-ferry', 2.15, 2.25, 'ferry');
  const body = new THREE.Group();
  body.name = 'styx-ferry-static-body';
  ferry.add(body);
  const outline = [[0, 1.70], [0.54, 1.00], [0.63, -0.78], [0, -1.60], [-0.63, -0.78], [-0.54, 1.00]];
  const hullPositions = [], hullIndices = [];
  for (const [x, z] of outline) hullPositions.push(x * 0.76, -0.07, z * 0.88);
  for (const [x, z] of outline) hullPositions.push(x, 0.31, z);
  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    hullIndices.push(i, next, i + 6, next, next + 6, i + 6);
  }
  for (let i = 1; i < 5; i++) hullIndices.push(0, i + 1, i, 6, i + 6, i + 7);
  mesh(body, geometry(hullPositions, hullIndices), M.night);
  const deckPositions = outline.flatMap(([x, z]) => [x * 0.90, 0.323, z * 0.92]);
  mesh(body, geometry(deckPositions, [0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5]), M.wood);
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    box(body, 0.075, 0.095, Math.hypot(dx, dz), hullTrim, (a[0] + b[0]) / 2, 0.35, (a[1] + b[1]) / 2, [0, Math.atan2(dx, dz), 0]);
  }
  for (const z of [-0.84, 0.40]) box(body, 0.96, 0.09, 0.20, M.woodLight, 0, 0.39, z);
  mesh(body, geometry([-0.095, 0.405, 1.09, 0.095, 0.405, 1.09, 0.075, 0.405, 1.43, -0.075, 0.405, 1.43], [0, 1, 2, 0, 2, 3]), vermilion);

  const ferryman = mesh(body, shroudGeometry(), M.night, 0.02, 0.34, -0.40);
  ferryman.scale.set(0.87, 1.04, 0.84);
  const charonFace = mesh(body, new THREE.CircleGeometry(0.095, 8), hullTrim, 0.02, 1.645, -0.194);
  charonFace.scale.y = 1.23;
  box(body, 0.15, 0.12, 0.48, M.night, 0.22, 1.14, -0.16, [0, -0.30, -0.36]);
  cylinder(body, 0.025, 0.035, 1.41, M.iron, -0.42, 1.045, 0.85, 4);
  box(body, 0.26, 0.035, 0.04, M.iron, -0.53, 1.73, 0.85);
  cylinder(body, 0.13, 0.13, 0.31, lanternBone, -0.64, 1.44, 0.85, 4);
  cylinder(body, 0, 0.21, 0.15, M.night, -0.64, 1.67, 0.85, 4);
  cylinder(body, 0.18, 0.08, 0.11, M.night, -0.64, 1.23, 0.85, 4);
  batch(body);

  // Add the live oar only after batching the body. Its group survives batching
  // its own static geometry; update() never retains disposed mesh references.
  const oar = new THREE.Group();
  oar.name = 'styx-charon-stroking-oar';
  oar.userData.dynamic = true;
  oar.position.set(0.32, 1.05, -0.30);
  ferry.add(oar);
  const oarEnd = new THREE.Vector3(1.45, -1.02, 0.20);
  const oarDirection = oarEnd.clone().normalize();
  const shaft = cylinder(oar, 0.025, 0.035, oarEnd.length(), M.woodLight, oarEnd.x / 2, oarEnd.y / 2, oarEnd.z / 2, 4);
  shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), oarDirection);
  const blade = box(oar, 0.18, 0.42, 0.075, hullTrim, oarEnd.x, oarEnd.y, oarEnd.z);
  blade.quaternion.copy(shaft.quaternion);
  batch(oar);

  function streakGeometry(length, width, bend = 0.12) {
    return geometry([
      -width / 2, 0, -length / 2, width / 2, 0, -length / 2,
      bend - width / 2, 0, 0, bend + width / 2, 0, 0,
      -width / 2, 0, length / 2, width / 2, 0, length / 2,
    ], [0, 2, 1, 1, 2, 3, 2, 4, 3, 3, 4, 5]);
  }
  const wake = motionRoot('styx-charon-wake', 1.15, 0.05, 'current');
  for (const side of [-1, 1]) {
    const line = mesh(wake, streakGeometry(1.78, 0.028, side * 0.08), faintCurrent, side * 0.32, 0, 0);
    line.rotation.y = side * -0.18;
  }
  finishStatic(wake, -4.55);

  const currents = [];
  for (let i = 0; i < 8; i++) {
    const root = motionRoot(`styx-drifting-current-${i + 1}`, 1.10, 0.05, 'current');
    mesh(root, streakGeometry(1.1 + i % 3 * 0.35, 0.025 + i % 2 * 0.008), i % 3 ? faintCurrent : currentBone);
    finishStatic(root, -4.60);
    currents.push({ root, start: routeLength * (i / 8 + 0.035), lane: i % 2 ? 1.68 : -1.42, speed: 0.48 + i % 3 * 0.055 });
  }

  // Begin in the open foreground channel, clear of the jetty silhouette.
  const ferryStart = distanceAt(0.62);
  const ferrySpeed = 0.15;
  const position = { x: 0, z: 0, yaw: 0 };
  function update(elapsedTime) {
    const time = Number.isFinite(elapsedTime) ? Math.max(0, elapsedTime) : 0;
    for (const spirit of spirits) {
      const weave = Math.sin(time * TAU / spirit.weavePeriod + spirit.phase * 1.17) * 0.25;
      sample(spirit.start + time * spirit.speed, spirit.lane + weave, position);
      spirit.root.position.set(position.x, waterLevel + 0.15 + Math.sin(time * 1.05 + spirit.phase) * 0.065, position.z);
      spirit.root.rotation.set(Math.sin(time * 0.66 + spirit.phase) * 0.035, facing + Math.sin(time * 0.37 + spirit.phase) * 0.20, Math.sin(time * 0.81 + spirit.phase) * 0.045);
    }
    sample(ferryStart + time * ferrySpeed, 0.20, position);
    ferry.position.set(position.x, waterLevel + 0.055 + Math.sin(time * 0.85) * 0.035, position.z);
    ferry.rotation.set(Math.sin(time * 0.73) * 0.018, position.yaw, Math.sin(time * 0.93) * 0.027);
    oar.rotation.y = Math.sin(time * 1.32) * 0.30;
    oar.rotation.z = Math.sin(time * 1.32 + 0.55) * 0.085;
    sample(ferryStart + time * ferrySpeed - 2.05, 0.20, position);
    wake.position.set(position.x, waterLevel + 0.038, position.z);
    wake.rotation.y = position.yaw;
    wake.scale.z = 1 + Math.sin(time * 1.32) * 0.075;
    for (const current of currents) {
      sample(current.start + time * current.speed, current.lane, position);
      current.root.position.set(position.x, waterLevel + 0.034, position.z);
      current.root.rotation.y = position.yaw;
    }
  }
  update(0);
  return { motionRoots, update, waterLevel, riverLabelPosition };
}
