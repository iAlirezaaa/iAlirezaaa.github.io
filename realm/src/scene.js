import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SVGRenderer } from 'three/addons/renderers/SVGRenderer.js';

// All architecture is native, selectable 3D geometry. No scene-sized image plane.
const LOCATIONS = {
  citadel: [0, -1, 6.7, 3.7],
  forge: [-8, 4, 5.6, 2.9],
  archive: [-7, -7, 4.9, 3.1],
  oracle: [4, -8, 6.4, 2.8],
  theatre: [-1, 9, 3.7, 3.6],
  elysium: [9, 5, 5.1, 3.2],
  gates: [10, -3, 5.9, 3],
  'plot-a': [-11, -1, 1.3, 1.8],
  'plot-b': [5, 11, 1.3, 1.8],
  'plot-c': [0, -12, 1.3, 1.8],
};

function randomSource(seed = 91) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function createRealmScene({ canvas, onSelect, onHover, onReady, onError, onLabels } = {}) {
  if (!canvas) throw new Error('A canvas is required to render Hades Realm.');
  const rng = randomSource();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = window.matchMedia('(max-width: 700px)');
  let renderer, webgl = true, fallbackElement = null, initialized = false;
  let width = 1, height = 1, destroyed = false, paused = false, frame = 0, ready = false;
  let dirty = true, lastSvgRender = -Infinity, renderMilliseconds = 0, updatingFrame = false;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, mobile.matches ? 1.25 : 1.5);
  function invalidate() { dirty = true; if (initialized && !updatingFrame) start(); }
  try {
    const options = { antialias: true, alpha: false, powerPreference: 'high-performance' };
    const context = canvas.getContext('webgl2', options);
    if (!context) throw new Error('WebGL 2 is unavailable in this browser.');
    renderer = new THREE.WebGLRenderer({ canvas, context, ...options });
  } catch (webglError) {
    // The same cameras, meshes and controls work without a graphics context.
    // This renderer projects the native scene; it is not a static illustration.
    webgl = false;
    try {
      renderer = new SVGRenderer();
      renderer.setQuality('low');
      renderer.setPrecision(1);
      renderer.overdraw = 0.35;
      fallbackElement = renderer.domElement;
      fallbackElement.classList.add('realm-svg-renderer');
      fallbackElement.setAttribute('aria-hidden', 'true');
      fallbackElement.setAttribute('focusable', 'false');
      Object.assign(fallbackElement.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', display: 'block' });
      if (!canvas.parentNode) throw new Error('The village canvas needs a visible container.');
      canvas.parentNode.insertBefore(fallbackElement, canvas);
      canvas.style.background = 'transparent';
    } catch (fallbackError) {
      fallbackElement?.remove();
      onError?.(fallbackError);
      throw fallbackError;
    }
  }
  canvas.dataset.renderer = webgl ? 'webgl' : 'svg';
  renderer.setPixelRatio(pixelRatio);
  if (webgl) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#123138');
  scene.fog = new THREE.Fog('#123138', 72, 128);
  const camera = new THREE.OrthographicCamera(-25, 25, 20, -20, 0.1, 200);
  const cameraTarget = new THREE.Vector3(-2.6, 0.2, 2.6);
  const initialCamera = new THREE.Vector3(32, 35, 39);
  camera.position.copy(cameraTarget).add(initialCamera);
  camera.lookAt(cameraTarget);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(cameraTarget);
  controls.enableDamping = webgl;
  controls.dampingFactor = 0.085;
  controls.screenSpacePanning = false;
  controls.minPolarAngle = Math.PI * 0.19;
  controls.maxPolarAngle = Math.PI * 0.39;
  controls.minZoom = 0.6;
  controls.maxZoom = 2.4;
  controls.rotateSpeed = 0.55;
  controls.panSpeed = 0.7;
  controls.zoomSpeed = 0.75;
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  controls.addEventListener('change', invalidate);
  canvas.style.touchAction = 'none';
  const hemi = new THREE.HemisphereLight('#c2dfdf', '#334c35', 2.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffe0ac', webgl ? 3.2 : 0.88);
  sun.position.set(-17, 31, 16);
  sun.castShadow = webgl;
  sun.shadow.mapSize.set(mobile.matches ? 1024 : 2048, mobile.matches ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: 0.5, far: 85 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.normalBias = 0.045;
  sun.shadow.bias = -0.00025;
  sun.shadow.radius = 3;
  scene.add(sun);
  const rim = new THREE.DirectionalLight('#81c7e5', webgl ? 1.2 : 0.3);
  rim.position.set(13, 14, -20);
  scene.add(rim);
  // SVGRenderer uses ambient/directional lighting; hemisphere and tone mapping
  // are WebGL features. Match their soft fill without overexposing the stone.
  const vectorAmbient = !webgl ? new THREE.AmbientLight('#8a9c94') : null;
  if (vectorAmbient) scene.add(vectorAmbient);

  const materials = new Map();
  function material(color, extra = {}) {
    const key = color + JSON.stringify(extra);
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.93, flatShading: true, ...extra }));
    return materials.get(key);
  }
  const M = {
    stone: material('#b4b09a'), light: material('#e3d4ae'), shadow: material('#757d71'), dark: material('#384c4b'),
    roof: material('#bb4732'), roofEdge: material('#ef7450'), roofDark: material('#863e32'),
    slate: material('#3a7875'), slateLight: material('#73a59a'), gold: material('#d4a455', { metalness: 0.32, roughness: 0.56 }),
    wood: material('#77553d'), woodLight: material('#b48758'), bark: material('#4a4935'),
    green: material('#39795a'), greenLight: material('#70a26c'), greenDeep: material('#205f50'), moss: material('#628564'),
    iron: material('#344749', { metalness: 0.38, roughness: 0.65 }), soil: material('#857650'), paver: material('#c2b48b'),
    purple: material('#8465b5'), violet: material('#b99ce4', { emissive: '#8a58b7', emissiveIntensity: 0.4 }),
    window: material('#ffca6c', { emissive: '#ff9d35', emissiveIntensity: 0.8 }),
    flame: material('#ff9b39', { emissive: '#ff6c17', emissiveIntensity: 1.8 }),
    flameCore: material('#ffefb8', { emissive: '#ffbc5b', emissiveIntensity: 1.2 }),
    cyan: material('#89e4ce', { emissive: '#49bcb0', emissiveIntensity: 0.8 }),
    night: material('#1a2d32'), eye: material('#192b30'), bone: material('#eee2bc'),
  };

  function mesh(parent, geometry, mat, x = 0, y = 0, z = 0, rotation) {
    const object = new THREE.Mesh(geometry, mat);
    object.position.set(x, y, z);
    if (rotation) object.rotation.set(...rotation);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }
  const box = (p, w, h, d, m, x = 0, y = 0, z = 0, r) => mesh(p, new THREE.BoxGeometry(w, h, d), m, x, y, z, r);
  const cylinder = (p, rt, rb, h, m, x = 0, y = 0, z = 0, segments = 8, r) => mesh(p, new THREE.CylinderGeometry(rt, rb, h, webgl ? segments : Math.min(segments, 6)), m, x, y, z, r);
  const orb = (p, radius, m, x = 0, y = 0, z = 0, scale) => {
    const o = mesh(p, webgl ? new THREE.DodecahedronGeometry(radius, 0) : new THREE.IcosahedronGeometry(radius, 0), m, x, y, z);
    if (scale) o.scale.set(...scale);
    return o;
  };
  const torus = (p, radius, tube, m, x = 0, y = 0, z = 0, rotation, arc = Math.PI * 2) => mesh(p, new THREE.TorusGeometry(radius, tube, webgl ? 5 : 3, webgl ? 24 : 16, arc), m, x, y, z, rotation);

  // Merge static architecture per material, while animated details stay independent.
  // The clickable hit volume belongs to the landmark, so batching does not affect selection.
  function batch(group) {
    group.updateWorldMatrix(true, true);
    const inverse = group.matrixWorld.clone().invert();
    const buckets = new Map();
    const originals = [];
    group.traverse((item) => {
      if (!item.isMesh || item.userData.dynamic || Array.isArray(item.material)) return;
      let geometry = item.geometry.clone();
      geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, item.matrixWorld));
      if (geometry.index) { const flat = geometry.toNonIndexed(); geometry.dispose(); geometry = flat; }
      if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
      if (!geometry.getAttribute('uv')) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 2), 2));
      for (const name of Object.keys(geometry.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geometry.deleteAttribute(name);
      if (!buckets.has(item.material.uuid)) buckets.set(item.material.uuid, { mat: item.material, geometries: [] });
      buckets.get(item.material.uuid).geometries.push(geometry);
      originals.push(item);
    });
    originals.forEach((item) => { item.removeFromParent(); item.geometry.dispose(); });
    for (const { mat, geometries } of buckets.values()) {
      const combined = mergeGeometries(geometries, false);
      if (combined) mesh(group, combined, mat);
      geometries.forEach((geometry) => geometry.dispose());
    }
  }

  function arch(parent, width, height, depth, mat, x = 0, y = 0, z = 0) {
    const g = new THREE.Group();
    parent.add(g);
    g.position.set(x, y, z);
    const radius = width / 2;
    const pillar = height - radius;
    box(g, 0.26, pillar, depth, mat, -radius, pillar / 2, 0);
    box(g, 0.26, pillar, depth, mat, radius, pillar / 2, 0);
    const shape = new THREE.Shape();
    shape.absarc(0, 0, radius + 0.13, 0, Math.PI, false);
    shape.absarc(0, 0, radius - 0.13, Math.PI, 0, true);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: webgl ? 12 : 7 });
    geometry.translate(0, pillar, -depth / 2);
    mesh(g, geometry, mat);
    return g;
  }

  function roof(parent, width, depth, height, mat, x = 0, y = 0, z = 0) {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0); shape.lineTo(width / 2, 0); shape.lineTo(0, height); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 });
    geometry.translate(0, 0, -depth / 2);
    const g = new THREE.Group(); parent.add(g); g.position.set(x, y, z);
    mesh(g, geometry, mat);
    box(g, width + 0.12, 0.14, depth + 0.1, M.roofDark, 0, 0, 0);
    box(g, 0.18, 0.14, depth + 0.13, M.roofEdge, 0, height + 0.02, 0);
    for (const side of [-1, 1]) for (let i = 1; i <= 4; i++) {
      const f = i / 5;
      box(g, 0.06, 0.045, depth + 0.02, mat === M.roof ? M.roofEdge : M.slateLight, side * width / 2 * f, height * (1 - f) + 0.035, 0);
    }
    return g;
  }

  function steps(parent, width, n, x, y, z, mat = M.light) {
    for (let i = 0; i < n; i++) box(parent, width, (n - i) * 0.16, 0.38, mat, x, y + (n - i) * 0.08, z + i * 0.35);
  }

  function windowFront(parent, x, y, z, width = 0.48, height = 0.75) {
    box(parent, width + 0.18, height + 0.18, 0.12, M.shadow, x, y, z);
    box(parent, width, height, 0.14, M.window, x, y, z + 0.035);
    box(parent, 0.055, height + 0.05, 0.17, M.wood, x, y, z + 0.04);
    box(parent, width + 0.06, 0.055, 0.17, M.wood, x, y, z + 0.04);
  }

  const flags = [], fires = [], spinners = [], wisps = [], animatedObjects = [];
  function flag(parent, x, y, z, color = M.roof, small = false) {
    const poleHeight = small ? 1.2 : 1.75;
    cylinder(parent, 0.035, 0.045, poleHeight, M.gold, x, y + poleHeight / 2, z, 6);
    orb(parent, 0.085, M.gold, x, y + poleHeight + 0.03, z);
    const geometry = new THREE.PlaneGeometry(small ? 0.62 : 0.92, small ? 0.4 : 0.61, 6, 2);
    geometry.translate(small ? 0.31 : 0.46, 0, 0);
    const bannerMat = color.clone(); bannerMat.side = THREE.DoubleSide;
    const banner = mesh(parent, geometry, bannerMat, x, y + poleHeight - 0.28, z);
    flags.push({ banner, origin: new Float32Array(geometry.attributes.position.array), phase: rng() * 5 });
    return banner;
  }

  function brazier(staticGroup, moving, x, y, z) {
    cylinder(staticGroup, 0.2, 0.27, 0.14, M.gold, x, y + 0.08, z, 6);
    cylinder(staticGroup, 0.07, 0.1, 0.65, M.iron, x, y + 0.42, z, 6);
    cylinder(staticGroup, 0.28, 0.12, 0.2, M.iron, x, y + 0.8, z, 7);
    const flame = cylinder(moving, 0, 0.18, 0.65, M.flame, x, y + 1.1, z, 5);
    flame.rotation.z = -0.12;
    const core = cylinder(moving, 0, 0.09, 0.35, M.flameCore, x, y + 1.02, z + 0.04, 5);
    fires.push({ flame, core, baseY: y + 1.1, phase: rng() * 8 });
  }

  function platform(parent, radius = 2.8) {
    cylinder(parent, radius, radius + 0.13, 0.3, M.shadow, 0, 0.18, 0, 8);
    cylinder(parent, radius - 0.08, radius, 0.13, M.light, 0, 0.39, 0, 8);
    cylinder(parent, radius - 0.26, radius - 0.21, 0.05, M.paver, 0, 0.48, 0, 8);
  }

  function citadelModel(s, a) {
    platform(s, 3.5);
    box(s, 4.5, 0.38, 4.1, M.light, 0, 0.69, 0);
    box(s, 4.05, 2.2, 3.75, M.stone, 0, 1.94, 0);
    box(s, 4.19, 0.2, 3.9, M.gold, 0, 2.98, 0);
    box(s, 4.17, 0.17, 3.88, M.light, 0, 1.09, 0);
    roof(s, 4.75, 4.34, 1.55, M.roof, 0, 3.13, 0);
    for (const x of [-2.16, 2.16]) for (const z of [-1.86, 1.86]) {
      cylinder(s, 0.66, 0.77, 2.75, M.shadow, x, 1.85, z, 8);
      cylinder(s, 0.7, 0.65, 0.28, M.light, x, 3.28, z, 8);
      cylinder(s, 0.86, 0.9, 0.16, M.gold, x, 3.45, z, 8);
      cylinder(s, 0, 1.03, 1.35, M.roof, x, 4.17, z, 8);
      cylinder(s, 0.06, 0.1, 0.4, M.gold, x, 4.96, z, 6);
      windowFront(s, x, 2.25, z + 0.62, 0.27, 0.56);
      for (let j = 0; j < 4; j++) box(s, 0.24, 0.18, 0.2, M.stone, x + Math.cos(j * Math.PI / 2) * 0.67, 3.55, z + Math.sin(j * Math.PI / 2) * 0.67);
    }
    box(s, 1.25, 1.75, 0.18, M.night, 0, 1.67, 1.96);
    arch(s, 1.5, 2.1, 0.3, M.light, 0, 0.78, 2.07);
    box(s, 0.08, 1.55, 0.21, M.gold, 0, 1.57, 2.08);
    steps(s, 1.9, 4, 0, 0.12, 2.45);
    windowFront(s, -1.21, 2.03, 1.94, 0.48, 0.71);
    windowFront(s, 1.21, 2.03, 1.94, 0.48, 0.71);
    // Crest and roof ridge shrine.
    box(s, 0.68, 0.73, 0.15, M.gold, 0, 3.58, 1.85, [0, 0, Math.PI / 4]);
    box(s, 0.35, 0.43, 0.18, M.roofDark, 0, 3.58, 1.95, [0, 0, Math.PI / 4]);
    cylinder(s, 0.28, 0.4, 0.36, M.gold, 0, 4.85, -0.3, 8);
    flag(a, 0, 4.83, -0.3);
    brazier(s, a, -1.4, 0.5, 2.6); brazier(s, a, 1.4, 0.5, 2.6);
  }

  function forgeModel(s, a) {
    platform(s, 2.7);
    box(s, 3.55, 1.95, 2.7, M.dark, 0, 1.48, 0);
    box(s, 3.75, 0.25, 2.9, M.shadow, 0, 0.66, 0);
    roof(s, 4.0, 3.17, 1.05, M.roof, 0, 2.48, 0);
    box(s, 0.88, 3.15, 0.9, M.shadow, -1.03, 3.0, -0.64);
    box(s, 1.09, 0.3, 1.08, M.light, -1.03, 4.67, -0.64);
    box(s, 0.66, 0.06, 0.65, M.night, -1.03, 4.85, -0.64);
    for (let i = 0; i < 7; i++) box(s, 0.92, 0.07, 0.94, M.dark, -1.03, 1.5 + i * 0.43, -0.64);
    box(s, 1.45, 1.2, 0.17, M.window, 0, 1.22, 1.4);
    arch(s, 1.62, 1.65, 0.36, M.light, 0, 0.56, 1.52);
    for (const x of [-0.5, 0, 0.5]) cylinder(a, 0, 0.17, 0.78, M.flame, x, 1.1, 1.57, 5);
    box(s, 1.9, 0.18, 0.65, M.iron, 0, 0.58, 1.62);
    windowFront(s, 1.15, 1.67, 1.41, 0.5, 0.65);
    cylinder(s, 0.58, 0.7, 0.6, M.wood, -1.6, 0.83, 1.85, 8);
    box(s, 0.9, 0.2, 0.52, M.iron, -1.6, 1.2, 1.85);
    box(s, 0.42, 0.45, 0.4, M.iron, -1.6, 1.37, 1.85);
    box(s, 1.14, 0.24, 0.58, M.iron, -1.6, 1.65, 1.85);
    cylinder(s, 0, 0.2, 0.55, M.iron, -0.89, 1.65, 1.85, 6, [0, 0, -Math.PI / 2]);
    box(s, 0.13, 0.92, 0.13, M.woodLight, -1.77, 1.67, 2.2, [0, 0, -0.4]);
    box(s, 0.52, 0.26, 0.29, M.shadow, -1.95, 2.08, 2.2, [0, 0, -0.4]);
    for (let i = 0; i < 4; i++) cylinder(s, 0.16, 0.16, 0.9, M.woodLight, 1.78, 0.68 + (i > 1 ? 0.25 : 0), 1.45 + (i % 2) * 0.3, 6, [0, 0, Math.PI / 2]);
    flag(a, 1.58, 2.65, -1.05, M.roof, true);
  }

  function archiveModel(s, a) {
    platform(s, 3.0);
    box(s, 4.15, 0.22, 3.5, M.light, 0, 0.66, 0);
    box(s, 3.65, 1.9, 2.7, M.dark, 0, 1.75, -0.24);
    box(s, 3.83, 0.18, 3.06, M.gold, 0, 2.78, 0);
    for (const x of [-1.5, -0.5, 0.5, 1.5]) {
      cylinder(s, 0.19, 0.23, 1.97, M.light, x, 1.79, 1.23, 8);
      box(s, 0.58, 0.18, 0.56, M.stone, x, 0.86, 1.23);
      box(s, 0.53, 0.16, 0.52, M.gold, x, 2.74, 1.23);
    }
    roof(s, 4.4, 3.75, 1.05, M.slate, 0, 2.92, 0);
    for (const z of [-1.3, -0.4, 0.5]) {
      box(s, 0.22, 2.0, 0.2, M.light, -1.91, 1.8, z);
      box(s, 0.22, 2.0, 0.2, M.light, 1.91, 1.8, z);
    }
    for (const x of [-1.1, 1.1]) {
      box(s, 0.65, 1.3, 0.08, M.wood, x, 1.6, 1.16);
      for (let j = 0; j < 5; j++) box(s, 0.085, 0.52 + (j % 2) * 0.12, 0.16, [M.roof, M.gold, M.slateLight][j % 3], x - 0.22 + j * 0.11, 1.5, 1.26);
      box(s, 0.72, 0.08, 0.25, M.woodLight, x, 1.16, 1.27);
    }
    steps(s, 2.25, 4, 0, 0.1, 1.73);
    cylinder(s, 0.45, 0.57, 0.54, M.stone, 0, 0.89, 2.25, 6);
    box(s, 0.6, 0.09, 0.74, M.bone, -0.26, 1.24, 2.25, [0, 0, -0.18]);
    box(s, 0.6, 0.09, 0.74, M.bone, 0.26, 1.24, 2.25, [0, 0, 0.18]);
    box(s, 0.07, 0.08, 0.77, M.gold, 0, 1.29, 2.25);
    flag(a, -1.7, 3.29, -1, M.slate, true);
  }

  function oracleModel(s, a) {
    platform(s, 2.65);
    cylinder(s, 1.69, 1.95, 0.42, M.shadow, 0, 0.76, 0, 10);
    cylinder(s, 1.36, 1.56, 1.9, M.slate, 0, 1.92, 0, 10);
    cylinder(s, 1.6, 1.6, 0.2, M.gold, 0, 2.92, 0, 10);
    for (let i = 0; i < 6; i++) {
      const angle = i / 6 * Math.PI * 2;
      cylinder(s, 0.13, 0.18, 1.8, M.light, Math.cos(angle) * 1.37, 1.99, Math.sin(angle) * 1.37, 6);
    }
    const dome = mesh(s, new THREE.SphereGeometry(1.58, webgl ? 12 : 8, webgl ? 6 : 4, 0, Math.PI * 2, 0, Math.PI / 2), M.purple, 0, 3.01, 0);
    dome.scale.y = 0.78;
    cylinder(s, 0.47, 0.65, 0.37, M.gold, 0, 4.25, 0, 8);
    const astrolabe = new THREE.Group(); a.add(astrolabe); astrolabe.position.set(0, 4.9, 0);
    orb(astrolabe, 0.66, M.violet, 0, 0, 0, [0.82, 1.2, 0.82]);
    torus(astrolabe, 0.93, 0.055, M.gold, 0, 0, 0, [0.7, 0, 0.5]);
    torus(astrolabe, 0.9, 0.045, M.gold, 0, 0, 0, [-0.7, 0.6, 0]);
    spinners.push({ object: astrolabe, speed: 0.22 });
    arch(s, 0.86, 1.53, 0.2, M.light, 0, 0.9, 1.5);
    box(s, 0.68, 1.21, 0.12, M.night, 0, 1.53, 1.51);
    steps(s, 1.4, 4, 0, 0.11, 1.8);
    for (const x of [-1.94, 1.94]) {
      cylinder(s, 0.36, 0.52, 0.35, M.shadow, x, 0.7, 0.7, 6);
      const crystal = mesh(a, new THREE.OctahedronGeometry(0.62), M.violet, x, 1.4, 0.7);
      crystal.scale.set(0.6, 1.1, 0.6);
      animatedObjects.push({ object: crystal, baseY: 1.4, amplitude: 0.1, phase: x });
    }
  }

  function annularTier(inner, outer, height) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outer, 0, Math.PI, false);
    shape.absarc(0, 0, inner, Math.PI, 0, true);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: webgl ? 18 : 10 });
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  }

  function theatreModel(s, a) {
    platform(s, 3.35);
    cylinder(s, 1.4, 1.4, 0.1, M.roofDark, 0, 0.55, 0.1, 24);
    for (let i = 0; i < 4; i++) {
      mesh(s, annularTier(1.32 + i * 0.39, 1.68 + i * 0.39, 0.27), i % 2 ? M.light : M.stone, 0, 0.53 + i * 0.27, 0.55);
    }
    mesh(s, annularTier(2.9, 3.12, 1.75), M.shadow, 0, 0.48, 0.55);
    for (let i = 0; i <= 8; i++) {
      const angle = i / 8 * Math.PI;
      cylinder(s, 0.16, 0.2, 1.14, M.light, Math.cos(angle) * 3.04, 2.31, 0.55 - Math.sin(angle) * 3.04, 6);
      orb(s, 0.21, M.gold, Math.cos(angle) * 3.04, 2.95, 0.55 - Math.sin(angle) * 3.04);
    }
    box(s, 2.36, 0.23, 0.8, M.woodLight, 0, 0.66, 1.43);
    for (const x of [-1.24, 1.24]) {
      cylinder(s, 0.19, 0.24, 1.55, M.light, x, 1.46, 1.47, 8);
      cylinder(s, 0.24, 0.24, 0.18, M.gold, x, 2.3, 1.47, 8);
    }
    box(s, 2.9, 0.22, 0.51, M.gold, 0, 2.43, 1.47);
    const curtainMaterial = M.roof.clone(); curtainMaterial.side = THREE.DoubleSide;
    for (const side of [-1, 1]) {
      const curtain = mesh(s, new THREE.PlaneGeometry(0.58, 1.28, 4, 1), curtainMaterial, side * 0.91, 1.7, 1.52);
      const pos = curtain.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 22) * 0.06);
      curtain.geometry.computeVertexNormals();
    }
    steps(s, 1.8, 3, 0, 0.08, 2.25);
    flag(a, 2.65, 1.38, 0.2, M.roof, true);
  }

  function tree(parent, x, z, size = 1, kind = 0, y = 0) {
    cylinder(parent, 0.12 * size, 0.21 * size, 1.3 * size, M.bark, x, y + 0.65 * size, z, 5);
    if (kind === 0) {
      for (let j = 0; j < 3; j++) cylinder(parent, 0, (1.03 - j * 0.19) * size, 1.55 * size, [M.greenDeep, M.green, M.greenLight][j], x, y + (1.5 + j * 0.62) * size, z, 6);
    } else {
      orb(parent, 1.1 * size, M.green, x, y + 1.9 * size, z, [1.08, 0.8, 0.9]);
      orb(parent, 0.8 * size, M.greenLight, x - 0.4 * size, y + 2.45 * size, z - 0.1, [1, 0.9, 0.92]);
      orb(parent, 0.76 * size, M.greenDeep, x + 0.6 * size, y + 1.9 * size, z + 0.22 * size);
    }
  }

  function elysiumModel(s, a) {
    platform(s, 3.0);
    cylinder(s, 2.74, 2.74, 0.09, M.moss, 0, 0.55, 0, 12);
    for (const x of [-1.25, 1.25]) {
      cylinder(s, 0.22, 0.32, 2.2, M.light, x, 1.66, 0.9, 8);
      box(s, 0.63, 0.18, 0.58, M.gold, x, 2.85, 0.9);
      orb(s, 0.26, M.greenLight, x, 3.13, 0.9);
    }
    arch(s, 2.5, 2.78, 0.24, M.light, 0, 0.61, 0.9);
    tree(s, 0.2, -0.9, 1.23, 1, 0.57);
    const pondMat = material('#4aaca3', { metalness: 0.13, roughness: 0.3 });
    const pool = cylinder(s, 0.83, 0.83, 0.035, pondMat, 0, 0.63, 1.7, 20); pool.scale.z = 0.53;
    for (let i = 0; i < 8; i++) {
      const angle = i / 8 * Math.PI * 2;
      orb(s, 0.16, M.light, Math.cos(angle) * 0.94, 0.65, 1.7 + Math.sin(angle) * 0.52, [1.3, 0.5, 1]);
    }
    for (const x of [-2, 2]) {
      box(s, 0.55, 0.34, 1.25, M.stone, x, 0.69, -0.6);
      for (let j = 0; j < 4; j++) orb(s, 0.31, j % 2 ? M.greenLight : M.green, x, 1.0, -1.1 + j * 0.33);
    }
    for (let i = 0; i < 5; i++) {
      const flower = orb(a, 0.08, M.cyan, Math.cos(i) * 1.5, 1.7 + i * 0.2, Math.sin(i) * 1.5);
      animatedObjects.push({ object: flower, baseY: 1.7 + i * 0.2, amplitude: 0.19, phase: i });
    }
    steps(s, 1.5, 3, 0, 0.09, 2.38);
  }

  function gatesModel(s, a) {
    platform(s, 2.85);
    for (const x of [-1.75, 1.75]) {
      box(s, 0.95, 0.33, 1.03, M.light, x, 0.66, 0);
      cylinder(s, 0.35, 0.59, 3.4, M.dark, x, 2.48, 0, 4, [0, Math.PI / 4, 0]);
      box(s, 0.66, 0.2, 0.65, M.gold, x, 3.65, 0);
      cylinder(s, 0, 0.5, 0.8, M.gold, x, 4.56, 0, 4, [0, Math.PI / 4, 0]);
      box(s, 0.075, 1.55, 0.1, M.cyan, x, 2.53, 0.48);
    }
    const gate = torus(s, 1.43, 0.22, M.stone, 0, 2.43, 0); gate.scale.y = 1.3;
    const rimGate = torus(s, 1.18, 0.075, M.cyan, 0, 2.43, 0.08); rimGate.scale.y = 1.36;
    const portalMaterial = new THREE.MeshBasicMaterial({ color: '#62cfc0', transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
    const portal = mesh(a, new THREE.CircleGeometry(1.18, webgl ? 32 : 18), portalMaterial, 0, 2.43, 0.02); portal.scale.y = 1.36; portal.castShadow = false;
    const swirl = new THREE.Group(); a.add(swirl); swirl.position.set(0, 2.43, 0.11);
    for (let i = 0; i < 3; i++) {
      const arc = torus(swirl, 0.43 + i * 0.3, 0.018, M.cyan, 0, 0, 0, [0, 0, i * 2], Math.PI * 1.2);
      arc.castShadow = false;
    }
    swirl.scale.y = 1.3;
    spinners.push({ object: swirl, speed: 0.3, axis: 'z' });
    cylinder(s, 0.38, 0.6, 0.2, M.gold, 0, 4.43, 0, 5);
    const crown = mesh(a, new THREE.OctahedronGeometry(0.48), M.cyan, 0, 5.01, 0); crown.scale.y = 1.25;
    animatedObjects.push({ object: crown, baseY: 5.01, amplitude: 0.11, phase: 1.1 });
    steps(s, 2.0, 4, 0, 0.13, 1.65);
    brazier(s, a, -1.85, 0.43, 1.57); brazier(s, a, 1.85, 0.43, 1.57);
  }

  const terrain = new THREE.Group(); scene.add(terrain);
  const perimeter = [];
  for (let i = 0; i < 32; i++) {
    const angle = i / 32 * Math.PI * 2;
    const jitter = 1 + (rng() - 0.5) * 0.07;
    perimeter.push(new THREE.Vector3(Math.sign(Math.cos(angle)) * Math.abs(Math.cos(angle)) ** 0.57 * 16.8 * jitter, 0.06, Math.sign(Math.sin(angle)) * Math.abs(Math.sin(angle)) ** 0.57 * 14.8 * jitter));
  }
  const topPositions = [], topColors = [], cliffPositions = [], cliffColors = [];
  const color = new THREE.Color();
  for (let i = 0; i < perimeter.length; i++) {
    const a = perimeter[i], b = perimeter[(i + 1) % perimeter.length];
    topPositions.push(0, 0.06, 0, b.x, b.y, b.z, a.x, a.y, a.z);
    color.set(['#54825e', '#588362', '#517e5d', '#5b8965'][i % 4]);
    for (let j = 0; j < 3; j++) topColors.push(color.r, color.g, color.b);
    const bottomA = new THREE.Vector3(a.x * 0.84, -3.2 - rng() * 1.6, a.z * 0.84);
    const bottomB = new THREE.Vector3(b.x * 0.84, -3.4 - rng() * 1.4, b.z * 0.84);
    cliffPositions.push(...a.toArray(), ...b.toArray(), ...bottomA.toArray(), ...b.toArray(), ...bottomB.toArray(), ...bottomA.toArray());
    color.set(['#345455', '#3c5c58', '#455f57', '#2d4b50'][i % 4]);
    for (let j = 0; j < 6; j++) cliffColors.push(color.r, color.g, color.b);
  }
  for (const [positions, colors, roughness] of [[topPositions, topColors, 1], [cliffPositions, cliffColors, 0.97]]) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const object = mesh(scene, geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness, flatShading: true, side: THREE.DoubleSide }));
    object.receiveShadow = true;
    // A vector renderer sorts triangles rather than using a depth buffer.
    // Ground is always behind structures, even when its triangles are large.
    if (!webgl) object.renderOrder = positions === topPositions ? -3 : -4;
  }
  // The cut rock lip and larger crags give the island a thick miniature silhouette.
  perimeter.forEach((point, i) => {
    if (i % 2) return;
    const boulder = orb(terrain, 1.1 + rng() * 0.8, i % 4 ? M.dark : M.shadow, point.x * 0.94, -0.62, point.z * 0.94, [1.5, 0.9, 1]);
    boulder.rotation.set(rng(), rng(), rng());
  });

  const waterUniforms = { time: { value: 0 }, daylight: { value: 0 } };
  const water = new THREE.Mesh(new THREE.PlaneGeometry(160, 160, webgl ? 32 : 1, webgl ? 32 : 1), webgl ? new THREE.ShaderMaterial({
    uniforms: waterUniforms,
    vertexShader: `varying vec3 vWorld; uniform float time; void main(){vec3 p=position; p.z += sin(p.x*.23+time*.35)*cos(p.y*.21-time*.2)*.05; vec4 world=modelMatrix*vec4(p,1.); vWorld=world.xyz; gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader: `varying vec3 vWorld; uniform float time; uniform float daylight; void main(){float a=sin(vWorld.x*.62+vWorld.z*.31+time*.5);float b=sin(vWorld.z*1.4-vWorld.x*.28-time*.4);float rip=pow(max(0.,sin(a*3.+b*1.5)),18.);vec3 deep=mix(vec3(.035,.17,.20),vec3(.075,.25,.27),daylight);vec3 c=deep+vec3(.014,.038,.036)*a+vec3(.08,.15,.13)*rip*.45;float edge=smoothstep(28.,85.,length(vWorld.xz));c=mix(c,mix(vec3(.035,.105,.13),vec3(.12,.23,.25),daylight),edge);gl_FragColor=vec4(c,1.);}`,
  }) : new THREE.MeshBasicMaterial({ color: '#123b42' }));
  water.rotation.x = -Math.PI / 2; water.position.y = -2.25; scene.add(water);
  if (!webgl) water.renderOrder = -5;
  for (let i = 0; i < 7; i++) {
    const wave = torus(terrain, 1.4 + i * 0.24, 0.019, M.slateLight, 20, -2.18, 6, [-Math.PI / 2, 0, 0], Math.PI * 1.2);
    wave.scale.x = 1.8; wave.rotation.z = 0.25;
  }

  // Smooth dirt paths are laid before the small stone pavers.
  function pathTo(x, z) {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.12, 0), new THREE.Vector3(x * 0.45 + (z < 0 ? 0.7 : -0.6), 0.12, z * 0.5), new THREE.Vector3(x, 0.12, z)]);
    const positions = [], uvs = [], indices = [];
    for (let i = 0; i <= 28; i++) {
      const f = i / 28, p = curve.getPoint(f), tangent = curve.getTangent(f);
      for (const side of [-1, 1]) { positions.push(p.x - tangent.z * 0.65 * side, p.y, p.z + tangent.x * 0.65 * side); uvs.push(f, side === -1 ? 0 : 1); }
      if (i < 28) { const n = i * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
    mesh(terrain, geometry, M.soil);
    const n = Math.floor(curve.getLength() / 0.72);
    for (let i = 0; i < n; i++) {
      const point = curve.getPoint(i / n), tangent = curve.getTangent(i / n);
      const paver = box(terrain, 0.75 + rng() * 0.2, 0.065, 0.44, i % 5 ? M.paver : M.light, point.x + (rng() - 0.5) * 0.1, 0.17, point.z);
      paver.rotation.y = Math.atan2(tangent.x, tangent.z) + (rng() - 0.5) * 0.1;
    }
  }
  Object.entries(LOCATIONS).filter(([id]) => id !== 'citadel').forEach(([, [x, z]]) => pathTo(x, z));

  // Cypress groves, rounded bushes, small rocks, and flower clusters.
  for (let i = 0; i < 54; i++) {
    const angle = rng() * Math.PI * 2;
    const x = Math.cos(angle) * (12.8 + rng() * 2.6);
    const z = Math.sin(angle) * (12.6 + rng() * 1.3);
    const nearLandmark = Object.values(LOCATIONS).some(([bx, bz, , radius]) => Math.hypot(x - bx, z - bz) < radius + 1.0);
    if (!nearLandmark && !(x > 12 && z > 5 && z < 10)) tree(terrain, x, z, 0.55 + rng() * 0.53, i % 7 === 0 ? 1 : 0);
  }
  for (let i = 0; i < 100; i++) {
    const x = (rng() - 0.5) * 30, z = (rng() - 0.5) * 26;
    if (Object.values(LOCATIONS).some(([bx, bz, , radius]) => Math.hypot(x - bx, z - bz) < radius + 0.5) || Math.hypot(x, z) < 5) continue;
    const size = 0.13 + rng() * 0.23;
    orb(terrain, size, i % 4 ? M.greenLight : M.shadow, x, size * 0.6, z, [1.5, 0.7, 1]);
    if (i % 7 === 0) {
      for (let j = 0; j < 3; j++) cylinder(terrain, 0, 0.055, 0.26, M.gold, x + j * 0.12, 0.25, z + j * 0.1, 4);
    }
  }

  // Low defensive walls, deliberately open at the entrances so buildings remain readable.
  for (let i = 0; i < 10; i++) {
    const x = -12.2 + i * 2.5;
    if (Math.abs(x) < 2.4) continue;
    box(terrain, 2.27, 0.75, 0.52, M.dark, x, 0.48, -12.65);
    box(terrain, 2.4, 0.15, 0.63, M.stone, x, 0.92, -12.65);
    for (let j = 0; j < 4; j++) box(terrain, 0.35, 0.33, 0.6, M.stone, x - 0.9 + j * 0.6, 1.12, -12.65);
  }
  for (const x of [-14.1, 14.1]) {
    cylinder(terrain, 0.6, 0.7, 1.5, M.shadow, x, 0.85, -11.7, 8);
    cylinder(terrain, 0.76, 0.7, 0.21, M.light, x, 1.65, -11.7, 8);
    cylinder(terrain, 0, 0.82, 0.9, M.roof, x, 2.18, -11.7, 8);
  }

  // Charon's jetty is anchored to the island edge; the ferry floats in the Styx below.
  for (let i = 0; i < 9; i++) box(terrain, 0.36, 0.14, 1.45, i % 3 ? M.wood : M.woodLight, 15.3 + i * 0.37, -0.5 - i * 0.13, 8);
  for (const x of [15.2, 17.0, 18.4]) for (const z of [7.35, 8.65]) cylinder(terrain, 0.09, 0.11, 2.5, M.wood, x, -1.15, z, 6);
  box(terrain, 3.6, 0.09, 0.1, M.woodLight, 16.8, -0.17, 7.3, [0, 0, -0.26]);
  batch(terrain);

  const ferry = new THREE.Group(); scene.add(ferry); ferry.position.set(19.3, -1.91, 8.2); ferry.rotation.y = -0.28;
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-1.6, 0); hullShape.lineTo(-0.9, -0.49); hullShape.lineTo(0.9, -0.49); hullShape.lineTo(1.6, 0); hullShape.lineTo(0.9, 0.49); hullShape.lineTo(-0.9, 0.49); hullShape.closePath();
  const hullGeometry = new THREE.ExtrudeGeometry(hullShape, { depth: 0.28, bevelEnabled: true, bevelSize: 0.13, bevelThickness: 0.11, bevelSegments: 1 });
  hullGeometry.rotateX(-Math.PI / 2); mesh(ferry, hullGeometry, M.wood);
  box(ferry, 2.4, 0.07, 0.78, M.dark, 0, 0.35, 0);
  for (const x of [-0.75, 0.45]) box(ferry, 0.14, 0.11, 0.83, M.woodLight, x, 0.43, 0);
  cylinder(ferry, 0.17, 0.36, 0.8, M.night, 0.6, 0.86, 0, 7);
  orb(ferry, 0.23, M.bone, 0.6, 1.41, 0);
  cylinder(ferry, 0.1, 0.31, 0.34, M.dark, 0.6, 1.58, -0.04, 6);
  box(ferry, 0.055, 2.4, 0.055, M.woodLight, 0.15, 0.7, 0.47, [0, 0, -0.28]);
  orb(ferry, 0.1, M.cyan, -1.12, 0.66, 0);
  batch(ferry);

  const landmarkGroups = new Map(), upgradeGroups = new Map(), hitTargets = [], plotTypes = new Map();
  const hitMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
  function addLandmark(id, builder) {
    const [x, z, height, radius] = LOCATIONS[id];
    const group = new THREE.Group(); group.position.set(x, 0, z); scene.add(group);
    const statics = new THREE.Group(), moving = new THREE.Group(); group.add(statics, moving);
    builder(statics, moving);
    batch(statics);
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, Math.max(2, height - 1), 8), hitMaterial);
    hit.position.y = Math.max(2, height - 1) / 2; hit.userData.id = id; group.add(hit); hitTargets.push(hit);
    const upgrades = new THREE.Group(); group.add(upgrades); upgradeGroups.set(id, upgrades);
    landmarkGroups.set(id, { group, statics, moving, hit, height, radius, level: 1 });
  }
  addLandmark('citadel', citadelModel); addLandmark('forge', forgeModel); addLandmark('archive', archiveModel);
  addLandmark('oracle', oracleModel); addLandmark('theatre', theatreModel); addLandmark('elysium', elysiumModel); addLandmark('gates', gatesModel);

  function plotModel(s, _moving) {
    cylinder(s, 1.45, 1.58, 0.18, M.shadow, 0, 0.15, 0, 8);
    cylinder(s, 1.37, 1.4, 0.07, M.soil, 0, 0.28, 0, 8);
    for (const x of [-0.95, 0.95]) for (const z of [-0.95, 0.95]) {
      box(s, 0.14, 0.62, 0.14, M.wood, x, 0.51, z);
      box(s, 0.29, 0.09, 0.29, M.gold, x, 0.85, z);
    }
    box(s, 0.85, 0.055, 0.2, M.light, 0, 0.35, 0);
    box(s, 0.2, 0.055, 0.85, M.light, 0, 0.35, 0);
    for (let i = 0; i < 5; i++) box(s, 0.38, 0.18, 0.25, M.stone, -0.7 + (i % 3) * 0.4, 0.39 + (i > 2 ? 0.18 : 0), -0.6);
  }
  for (const id of ['plot-a', 'plot-b', 'plot-c']) addLandmark(id, plotModel);

  function disposeGroup(group) {
    group.traverse((object) => { if (object.geometry) object.geometry.dispose(); });
    group.clear();
  }
  function builtModel(type, s) {
    if (type === 'lantern') {
      cylinder(s, 1.18, 1.32, 0.2, M.stone, 0, 0.38, 0, 8);
      cylinder(s, 0.24, 0.4, 1.8, M.dark, 0, 1.33, 0, 6);
      cylinder(s, 0.52, 0.32, 0.23, M.gold, 0, 2.33, 0, 6);
      orb(s, 0.42, M.cyan, 0, 2.86, 0, [0.8, 1.25, 0.8]);
      for (let i = 0; i < 4; i++) cylinder(s, 0.035, 0.035, 1.0, M.gold, Math.cos(i * Math.PI / 2) * 0.42, 2.87, Math.sin(i * Math.PI / 2) * 0.42, 4);
      cylinder(s, 0, 0.66, 0.45, M.slate, 0, 3.53, 0, 6);
      orb(s, 0.09, M.gold, 0, 3.83, 0);
    } else if (type === 'garden') {
      cylinder(s, 1.23, 1.32, 0.21, M.light, 0, 0.39, 0, 8);
      cylinder(s, 1.14, 1.14, 0.06, M.moss, 0, 0.53, 0, 8);
      tree(s, -0.1, -0.18, 0.85, 1, 0.55);
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2;
        orb(s, 0.18, M.violet, Math.cos(a), 0.75, Math.sin(a));
      }
    } else if (type === 'watchtower') {
      box(s, 1.6, 0.28, 1.6, M.light, 0, 0.43, 0);
      box(s, 1.12, 2.2, 1.12, M.shadow, 0, 1.61, 0);
      for (const x of [-0.63, 0.63]) for (const z of [-0.63, 0.63]) box(s, 0.17, 2.2, 0.17, M.light, x, 1.64, z);
      box(s, 1.67, 0.23, 1.67, M.gold, 0, 2.84, 0);
      box(s, 1.48, 0.85, 1.48, M.dark, 0, 3.33, 0);
      for (const x of [-0.55, 0.55]) box(s, 0.13, 0.92, 0.14, M.light, x, 3.32, 0.77);
      roof(s, 2.0, 1.95, 0.73, M.roof, 0, 3.81, 0);
      windowFront(s, 0, 1.9, 0.58, 0.32, 0.7);
    }
  }
  function setBuilt(plots = {}) {
    let changed = false;
    for (const id of ['plot-a', 'plot-b', 'plot-c']) {
      const input = plots[id];
      const type = typeof input === 'string' ? input : input?.type;
      const safeType = ['lantern', 'garden', 'watchtower'].includes(type) ? type : null;
      if ((plotTypes.get(id) || null) === safeType) continue;
      changed = true;
      plotTypes.set(id, safeType);
      const landmark = landmarkGroups.get(id);
      disposeGroup(landmark.statics);
      if (safeType) { builtModel(safeType, landmark.statics); landmark.height = safeType === 'watchtower' ? 5.2 : 4.3; }
      else { plotModel(landmark.statics); landmark.height = 1.3; }
      batch(landmark.statics);
      landmark.hit.scale.y = safeType ? 2.2 : 1;
      landmark.hit.position.y = safeType ? 2.2 : 1;
      emitLabels();
    }
    if (changed) invalidate();
  }
  function setLevels(levels = {}) {
    let changed = false;
    for (const [id, landmark] of landmarkGroups) {
      if (id.startsWith('plot-')) continue;
      const requested = Number(levels[id]);
      const level = Number.isFinite(requested) ? THREE.MathUtils.clamp(Math.floor(requested), 1, 3) : 1;
      if (level === landmark.level) continue;
      changed = true;
      landmark.level = level;
      const g = upgradeGroups.get(id); disposeGroup(g);
      if (level >= 2) {
        for (const side of [-1, 1]) {
          cylinder(g, 0.17, 0.25, 0.7, M.gold, side * (landmark.radius - 0.18), 0.86, 0, 6);
          orb(g, 0.21, M.cyan, side * (landmark.radius - 0.18), 1.32, 0);
        }
        const ring = torus(g, landmark.radius - 0.18, 0.035, M.gold, 0, 0.54, 0, [-Math.PI / 2, 0, Math.PI / 8]); ring.scale.y = 0.98;
      }
      if (level >= 3) {
        for (let i = 0; i < 3; i++) {
          const crystal = mesh(g, new THREE.OctahedronGeometry(0.3), M.violet, -0.6 + i * 0.6, 1.1 + (i === 1 ? 0.2 : 0), -landmark.radius + 0.12);
          crystal.scale.set(0.65, 1.4, 0.65);
        }
        cylinder(g, 0.1, 0.17, 1.35, M.gold, landmark.radius - 0.3, 1.2, 0.65, 6);
        box(g, 0.65, 0.45, 0.08, M.roof, landmark.radius + 0.01, 1.65, 0.65);
      }
      batch(g);
    }
    if (changed) invalidate();
  }

  // Gentle smoke from the forge chimney; circular particles are shaded on the GPU.
  const smokeCount = 17;
  const smokePosition = new Float32Array(smokeCount * 3), smokeAlpha = new Float32Array(smokeCount);
  const smokeGeometry = new THREE.BufferGeometry();
  smokeGeometry.setAttribute('position', new THREE.BufferAttribute(smokePosition, 3));
  smokeGeometry.setAttribute('opacity', new THREE.BufferAttribute(smokeAlpha, 1));
  const smokeMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { pointScale: { value: 9 * pixelRatio } },
    vertexShader: 'attribute float opacity; varying float a; uniform float pointScale; void main(){a=opacity;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=pointScale*(2.4-opacity);}',
    fragmentShader: 'varying float a;void main(){float d=length(gl_PointCoord-.5);float alpha=(1.-smoothstep(.1,.5,d))*a*.27;gl_FragColor=vec4(.65,.72,.68,alpha);}',
  });
  const smoke = new THREE.Points(smokeGeometry, smokeMaterial); smoke.frustumCulled = false; scene.add(smoke);
  smoke.visible = webgl;

  const spiritMaterial = material('#a9f0d9', { emissive: '#75c6b1', emissiveIntensity: 0.55 });
  for (let i = 0; i < 13; i++) {
    const spirit = new THREE.Group(); scene.add(spirit);
    orb(spirit, 0.19, spiritMaterial, 0, 0.32, 0, [0.9, 1.08, 0.9]);
    cylinder(spirit, 0.16, 0.06, 0.28, spiritMaterial, 0, 0.08, 0, 7);
    orb(spirit, 0.025, M.eye, -0.065, 0.35, 0.16); orb(spirit, 0.025, M.eye, 0.065, 0.35, 0.16);
    const target = Object.values(LOCATIONS)[1 + i % 6];
    const phase = rng();
    wisps.push({ object: spirit, x: target[0], z: target[1], phase, speed: 0.025 + rng() * 0.015 });
  }

  const selectedMaterial = new THREE.MeshBasicMaterial({ color: '#f2c978', transparent: true, opacity: 0.82, depthWrite: false, side: THREE.DoubleSide });
  const hoverMaterial = new THREE.MeshBasicMaterial({ color: '#a5ead2', transparent: true, opacity: 0.52, depthWrite: false, side: THREE.DoubleSide });
  const selectedRing = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, webgl ? 64 : 36), selectedMaterial);
  const hoverRing = new THREE.Mesh(new THREE.RingGeometry(0.98, 1, webgl ? 64 : 36), hoverMaterial);
  for (const ring of [selectedRing, hoverRing]) { ring.rotation.x = -Math.PI / 2; ring.position.y = 0.58; ring.visible = false; scene.add(ring); }
  let selected = null;
  function select(id) {
    const next = landmarkGroups.has(id) ? id : null;
    if (next === selected) return;
    selected = next;
    selectedRing.visible = !!selected;
    if (selected) {
      const entry = landmarkGroups.get(selected);
      selectedRing.position.set(entry.group.position.x, 0.58, entry.group.position.z);
      selectedRing.scale.setScalar(entry.radius + 0.18);
    }
    hoverRing.visible = !!hovered && hovered !== selected;
    invalidate();
  }

  let theme = 'dusk';
  function setTheme(mode) {
    const next = mode === 'day' ? 'day' : 'dusk';
    if (next === theme) return;
    theme = next;
    const day = theme === 'day';
    scene.background.set(day ? '#31595e' : '#123138');
    scene.fog.color.copy(scene.background);
    hemi.intensity = day ? 2.6 : 2.1;
    sun.intensity = webgl ? (day ? 3.6 : 3.2) : (day ? 1.0 : 0.88);
    sun.color.set(day ? '#fff3ce' : '#ffe0ac');
    rim.intensity = webgl ? (day ? 0.95 : 1.2) : (day ? 0.25 : 0.3);
    renderer.toneMappingExposure = day ? 1.28 : 1.2;
    waterUniforms.daylight.value = day ? 1 : 0;
    if (vectorAmbient) vectorAmbient.color.set(day ? '#a0b0a8' : '#8a9c94');
    if (!webgl) water.material.color.set(day ? '#29545a' : '#123b42');
    invalidate();
  }

  const projection = new THREE.Vector3();
  const worldPosition = new THREE.Vector3();
  function emitLabels() {
    if (!onLabels || destroyed) return;
    camera.updateMatrixWorld();
    const labels = [];
    for (const [id, entry] of landmarkGroups) {
      entry.group.getWorldPosition(worldPosition);
      projection.set(worldPosition.x, entry.height, worldPosition.z).project(camera);
      labels.push({ id, x: (projection.x * 0.5 + 0.5) * width, y: (-projection.y * 0.5 + 0.5) * height, visible: projection.z > -1 && projection.z < 1 && Math.abs(projection.x) < 1.08 && Math.abs(projection.y) < 1.08 });
    }
    onLabels(labels);
  }
  function resize() {
    if (destroyed) return;
    const rectangle = canvas.getBoundingClientRect();
    width = Math.max(1, rectangle.width); height = Math.max(1, rectangle.height);
    const aspect = width / height;
    const vertical = Math.max(38, 43 / aspect);
    camera.left = -vertical * aspect / 2; camera.right = vertical * aspect / 2; camera.top = vertical / 2; camera.bottom = -vertical / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    if (fallbackElement) {
      fallbackElement.style.width = `${width}px`;
      fallbackElement.style.height = `${height}px`;
    }
    emitLabels();
    invalidate();
  }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(canvas);
  resize();

  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  let down = null, hovered = null, dragging = false;
  const pointers = new Set();
  function pick(event) {
    const rectangle = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rectangle.left) / rectangle.width * 2 - 1, -((event.clientY - rectangle.top) / rectangle.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(hitTargets, false)[0]?.object.userData.id || null;
  }
  function hover(id) {
    if (hovered === id) return;
    hovered = id;
    canvas.style.cursor = id ? 'pointer' : (dragging ? 'grabbing' : 'grab');
    hoverRing.visible = !!id && id !== selected;
    if (id) {
      const entry = landmarkGroups.get(id);
      hoverRing.position.set(entry.group.position.x, 0.575, entry.group.position.z);
      hoverRing.scale.setScalar(entry.radius + 0.28);
    }
    onHover?.(id);
    invalidate();
  }
  function pointerDown(event) {
    pointers.add(event.pointerId);
    if (event.button !== 0 || pointers.size > 1) { down = null; dragging = true; return; }
    down = { x: event.clientX, y: event.clientY, id: event.pointerId, when: performance.now() };
    dragging = false;
  }
  function pointerMove(event) {
    if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) >= 7) { dragging = true; hover(null); canvas.style.cursor = 'grabbing'; }
    if (!dragging && event.pointerType !== 'touch') hover(pick(event));
  }
  function pointerUp(event) {
    const click = down && event.pointerId === down.id && !dragging && pointers.size === 1 && Math.hypot(event.clientX - down.x, event.clientY - down.y) < 7;
    pointers.delete(event.pointerId);
    if (click) {
      const id = pick(event);
      if (id) { select(id); onSelect?.(id); }
    }
    down = null;
    if (pointers.size === 0) dragging = false;
    canvas.style.cursor = hovered ? 'pointer' : 'grab';
  }
  function pointerCancel(event) { pointers.delete(event.pointerId); down = null; dragging = false; }
  function pointerLeave() { if (!dragging) hover(null); }
  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', pointerCancel);
  canvas.addEventListener('pointerleave', pointerLeave);
  canvas.style.cursor = 'grab';

  function resetCamera() {
    controls.target.copy(mobile.matches ? new THREE.Vector3(0, 0, 0) : cameraTarget);
    camera.position.copy(controls.target).add(initialCamera);
    camera.zoom = mobile.matches ? 1.4 : 1;
    camera.updateProjectionMatrix(); controls.update(); emitLabels();
    invalidate();
  }
  resetCamera();
  function zoom(delta) {
    camera.zoom = THREE.MathUtils.clamp(camera.zoom * (delta > 0 ? 1.18 : 1 / 1.18), controls.minZoom, controls.maxZoom);
    camera.updateProjectionMatrix(); emitLabels();
    invalidate();
  }
  function getInfo() {
    return {
      webgl, renderer: webgl ? 'webgl' : 'svg', revision: THREE.REVISION,
      drawCalls: webgl ? renderer.info.render.calls : fallbackElement.childElementCount,
      triangles: webgl ? renderer.info.render.triangles : renderer.info.render.faces,
      renderMilliseconds: Math.round(renderMilliseconds), staticPose: !webgl,
      buildings: landmarkGroups.size, theme, reducedMotion: reducedMotion.matches,
    };
  }

  const clockStart = performance.now();
  let lastLabelFrame = 0;
  function animate(now) {
    frame = 0;
    if (destroyed || paused || document.hidden) return;
    updatingFrame = true;
    controls.update();
    const clampedX = THREE.MathUtils.clamp(controls.target.x, -13, 13);
    const clampedZ = THREE.MathUtils.clamp(controls.target.z, -13, 13);
    camera.position.x += clampedX - controls.target.x;
    camera.position.z += clampedZ - controls.target.z;
    controls.target.x = clampedX;
    controls.target.z = clampedZ;
    controls.target.y = 0.2;
    camera.lookAt(controls.target);
    if (!webgl && !dirty) { updatingFrame = false; return; }
    // A full vector projection is only needed after an actual scene change.
    // Coalesce rapid pointer events, with no idle animation/render loop.
    if (!webgl && now - lastSvgRender < 80) {
      updatingFrame = false; frame = requestAnimationFrame(animate); return;
    }
    const time = !webgl || reducedMotion.matches ? 1.5 : (now - clockStart) / 1000;
    waterUniforms.time.value = time;
    for (const { banner, origin, phase } of flags) {
      const attribute = banner.geometry.attributes.position;
      for (let i = 0; i < attribute.count; i++) attribute.setZ(i, Math.sin(time * 2.6 + origin[i * 3] * 5.1 + phase) * 0.12 * origin[i * 3]);
      attribute.needsUpdate = true;
    }
    for (const { flame, core, baseY, phase } of fires) {
      flame.scale.y = 0.88 + Math.sin(time * 8 + phase) * 0.15;
      flame.rotation.z = Math.sin(time * 5 + phase) * 0.1;
      flame.position.y = baseY + Math.sin(time * 7 + phase) * 0.025;
      core.scale.y = 0.95 + Math.sin(time * 9 + phase) * 0.12;
    }
    for (const { object, speed, axis = 'y' } of spinners) object.rotation[axis] = time * speed;
    for (const { object, baseY, amplitude, phase } of animatedObjects) object.position.y = baseY + Math.sin(time * 1.8 + phase) * amplitude;
    ferry.position.y = -1.91 + Math.sin(time * 1.1) * 0.07; ferry.rotation.z = Math.sin(time * 0.9) * 0.035;
    for (let i = 0; i < smokeCount; i++) {
      const age = ((time * 0.22 + i / smokeCount) % 1);
      smokePosition[i * 3] = -9.03 + Math.sin(age * 5 + i * 2) * 0.2 + age * 0.8;
      smokePosition[i * 3 + 1] = 4.95 + age * 3.1;
      smokePosition[i * 3 + 2] = 3.36 + Math.cos(age * 6 + i) * 0.18;
      smokeAlpha[i] = (1 - age) * 0.75;
    }
    smokeGeometry.attributes.position.needsUpdate = true; smokeGeometry.attributes.opacity.needsUpdate = true;
    for (const { object, x, z, phase, speed } of wisps) {
      const f = (time * speed + phase) % 1;
      const amount = 0.18 + (0.5 - Math.cos(f * Math.PI * 2) * 0.5) * 0.62;
      object.position.set(x * amount + Math.sin(f * Math.PI) * 0.3, 0.46 + Math.sin(time * 2.9 + phase * 9) * 0.1, z * amount);
      object.rotation.y = Math.atan2(x, z) + (f > 0.5 ? Math.PI : 0);
    }
    if (selectedRing.visible) selectedMaterial.opacity = 0.72 + Math.sin(time * 2) * 0.12;
    dirty = false;
    const renderStart = performance.now();
    try {
      renderer.render(scene, camera);
    } catch (error) {
      updatingFrame = false; paused = true; onError?.(error); return;
    }
    renderMilliseconds = performance.now() - renderStart;
    if (!webgl) lastSvgRender = now;
    if (!webgl || now - lastLabelFrame > 40 || !ready) { emitLabels(); lastLabelFrame = now; }
    if (!ready) { ready = true; onReady?.(getInfo()); }
    updatingFrame = false;
    if (webgl || dirty) frame = requestAnimationFrame(animate);
  }
  function start() { if (!destroyed && !paused && !document.hidden && !frame) frame = requestAnimationFrame(animate); }
  function setPaused(value) { paused = Boolean(value); if (paused && frame) { cancelAnimationFrame(frame); frame = 0; } else start(); }
  function visibilityChange() { if (document.hidden) { if (frame) cancelAnimationFrame(frame); frame = 0; } else start(); }
  document.addEventListener('visibilitychange', visibilityChange);
  function contextLost(event) { event.preventDefault(); setPaused(true); onError?.(new Error('The 3D graphics context was interrupted. Reload to return to the village; all portals remain available.')); }
  if (webgl) canvas.addEventListener('webglcontextlost', contextLost);
  initialized = true;
  start();

  function destroy() {
    destroyed = true; if (frame) cancelAnimationFrame(frame);
    controls.removeEventListener('change', invalidate);
    controls.dispose(); resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', visibilityChange);
    canvas.removeEventListener('webglcontextlost', contextLost);
    canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointermove', pointerMove); canvas.removeEventListener('pointerup', pointerUp);
    canvas.removeEventListener('pointercancel', pointerCancel); canvas.removeEventListener('pointerleave', pointerLeave);
    const disposedGeometry = new Set(), disposedMaterial = new Set();
    scene.traverse((object) => {
      if (object.geometry && !disposedGeometry.has(object.geometry)) { object.geometry.dispose(); disposedGeometry.add(object.geometry); }
      const list = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
      list.forEach((mat) => { if (!disposedMaterial.has(mat)) { mat.dispose(); disposedMaterial.add(mat); } });
    });
    materials.forEach((mat) => { if (!disposedMaterial.has(mat)) mat.dispose(); });
    renderer.dispose?.();
    fallbackElement?.remove();
    delete canvas.dataset.renderer;
  }
  return { select, setLevels, setBuilt, setTheme, zoom, resetCamera, setPaused, destroy, getInfo };
}
