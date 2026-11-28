import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SVGRenderer } from 'three/addons/renderers/SVGRenderer.js';
import { createGreekArchitecture } from './greek-architecture.js';
import { createStyxRiver } from './styx-river.js';
import { createVectorMotionLayer } from './vector-motion.js';

// All architecture is native, selectable 3D geometry. No scene-sized image plane.
// Vermilion is HADES's approved accent. These supporting stone/ink neutrals
// follow the public Neutral Atlas references, with shading for native geometry.
const BRAND = Object.freeze({ vermilion: '#EF4B32', dark: '#131211', bone: '#E6D9C7', charcoal: '#292723', warmInk: '#F2EDE5' });
const LOCATIONS = {
  citadel: [0, -1, 6.7, 3.7],
  forge: [-8, 4, 4.8, 2.9],
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

export function createRealmScene({ canvas, onSelect, onHover, onReady, onError, onLabels, motion, onMotionChange } = {}) {
  if (!canvas) throw new Error('A canvas is required to render Hades Realm.');
  const rng = randomSource();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = window.matchMedia('(max-width: 700px)');
  let motionOverride = typeof motion === 'boolean' ? motion : null;
  const motionActive = () => motionOverride ?? !reducedMotion.matches;
  let motionTime = 1.5, lastMotionTick = null, lastMotionRender = -Infinity;
  let vectorMotion = null;
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
  const occluders = [];
  scene.background = new THREE.Color(BRAND.dark);
  scene.fog = new THREE.Fog(BRAND.dark, 72, 128);
  const camera = new THREE.OrthographicCamera(-25, 25, 20, -20, 0.1, 200);
  const cameraTarget = new THREE.Vector3(0, 0.2, 0);
  const initialCamera = new THREE.Vector3(32, 35, 39);
  const mobileCamera = new THREE.Vector3(28, 43, 34);
  let framingMode = null;
  camera.position.copy(cameraTarget).add(initialCamera);
  camera.lookAt(cameraTarget);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(cameraTarget);
  controls.enableDamping = webgl && motionActive();
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
  const hemi = new THREE.HemisphereLight(BRAND.warmInk, BRAND.charcoal, 2.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(BRAND.warmInk, webgl ? 3.2 : 0.88);
  sun.position.set(-17, 31, 16);
  sun.castShadow = webgl;
  sun.shadow.mapSize.set(mobile.matches ? 1024 : 2048, mobile.matches ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: 0.5, far: 85 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.normalBias = 0.045;
  sun.shadow.bias = -0.00025;
  sun.shadow.radius = 3;
  scene.add(sun);
  const rim = new THREE.DirectionalLight('#c4bdb5', webgl ? 1.2 : 0.3);
  rim.position.set(13, 14, -20);
  scene.add(rim);
  // SVGRenderer uses ambient/directional lighting; hemisphere and tone mapping
  // are WebGL features. Match their soft fill without overexposing the stone.
  const vectorAmbient = !webgl ? new THREE.AmbientLight('#a59d92') : null;
  if (vectorAmbient) scene.add(vectorAmbient);

  const materials = new Map();
  function material(color, extra = {}) {
    const key = color + JSON.stringify(extra);
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.93, flatShading: true, ...extra }));
    return materials.get(key);
  }
  const M = {
    stone: material(BRAND.bone), light: material(BRAND.warmInk), shadow: material('#93897d'), dark: material(BRAND.charcoal),
    roof: material(BRAND.vermilion), roofEdge: material('#f27662'), roofDark: material('#963b2f'),
    slate: material('#393633'), slateLight: material('#857d73'), trim: material('#c6baaa', { metalness: 0.16, roughness: 0.65 }),
    wood: material('#49413a'), woodLight: material('#847365'), bark: material('#575047'),
    leaf: material(BRAND.charcoal), leafLight: material('#514b44'), leafDeep: material('#1e1d1b'), ground: material('#5b544a'),
    iron: material('#302e2a', { metalness: 0.38, roughness: 0.65 }), soil: material('#5a5149'), paver: material('#a69a8b'),
    obsidian: material('#46413b'), crystal: material(BRAND.warmInk, { emissive: BRAND.bone, emissiveIntensity: 0.35 }),
    window: material(BRAND.warmInk, { emissive: BRAND.bone, emissiveIntensity: 0.55 }),
    flame: material(BRAND.vermilion, { emissive: BRAND.vermilion, emissiveIntensity: 1.2 }),
    flameCore: material(BRAND.warmInk, { emissive: BRAND.bone, emissiveIntensity: 0.85 }),
    beacon: material(BRAND.warmInk, { emissive: BRAND.bone, emissiveIntensity: 0.65 }),
    route: material(BRAND.vermilion, { emissive: BRAND.vermilion, emissiveIntensity: 0.45 }),
    night: material(BRAND.dark), eye: material(BRAND.dark), bone: material(BRAND.bone),
  };
  const exploredIds = new Set();
  const districtLightSources = new Set([M.window, M.beacon, M.crystal]);

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

  function steps(parent, width, n, x, y, z, mat = M.light) {
    for (let i = 0; i < n; i++) box(parent, width, (n - i) * 0.16, 0.38, mat, x, y + (n - i) * 0.08, z + i * 0.35);
  }

  const flags = [], fires = [], spinners = [], animatedObjects = [];
  function flag(parent, x, y, z, color = M.roof, small = false) {
    const poleHeight = small ? 1.2 : 1.75;
    cylinder(parent, 0.035, 0.045, poleHeight, M.trim, x, y + poleHeight / 2, z, 6);
    orb(parent, 0.085, M.trim, x, y + poleHeight + 0.03, z);
    const geometry = new THREE.PlaneGeometry(small ? 0.62 : 0.92, small ? 0.4 : 0.61, 6, 2);
    geometry.translate(small ? 0.31 : 0.46, 0, 0);
    const bannerMat = color.clone(); bannerMat.side = THREE.DoubleSide;
    const banner = mesh(parent, geometry, bannerMat, x, y + poleHeight - 0.28, z);
    flags.push({ banner, origin: new Float32Array(geometry.attributes.position.array), phase: rng() * 5 });
    return banner;
  }

  function brazier(staticGroup, moving, x, y, z) {
    cylinder(staticGroup, 0.2, 0.27, 0.14, M.trim, x, y + 0.08, z, 6);
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

  const greek = createGreekArchitecture({ M, box, cylinder, orb, torus, mesh, platform, steps, flag, brazier, spinners, animatedObjects, webgl });

  function tree(parent, x, z, size = 1, kind = 0, y = 0) {
    const group = new THREE.Group(); parent.add(group); group.position.set(x, y, z); group.scale.setScalar(size);
    cylinder(group, 0.08, 0.13, 1.0, M.bark, 0, 0.52, 0, 5);
    if (kind) {
      orb(group, 0.8, M.leafLight, 0, 1.6, 0, [1.2, 0.7, 1]);
      orb(group, 0.55, M.leaf, 0.35, 1.83, -0.1, [1.2, 0.7, 1]);
    } else {
      // Tall Mediterranean cypresses frame the colonnades.
      orb(group, 0.58, M.leafDeep, 0, 1.7, 0, [0.8, 2.1, 0.8]);
      orb(group, 0.38, M.leaf, 0, 2.52, 0, [0.75, 1.8, 0.75]);
    }
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
    color.set(['#46413b', '#4b4640', '#403c36', '#514a43'][i % 4]);
    for (let j = 0; j < 3; j++) topColors.push(color.r, color.g, color.b);
    const bottomA = new THREE.Vector3(a.x * 0.84, -3.2 - rng() * 1.6, a.z * 0.84);
    const bottomB = new THREE.Vector3(b.x * 0.84, -3.4 - rng() * 1.4, b.z * 0.84);
    cliffPositions.push(...a.toArray(), ...b.toArray(), ...bottomA.toArray(), ...b.toArray(), ...bottomB.toArray(), ...bottomA.toArray());
    color.set([BRAND.charcoal, '#34312d', '#3c3731', '#24221f'][i % 4]);
    for (let j = 0; j < 6; j++) cliffColors.push(color.r, color.g, color.b);
  }
  for (const [positions, colors, roughness] of [[topPositions, topColors, 1], [cliffPositions, cliffColors, 0.97]]) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const object = mesh(scene, geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness, flatShading: true, side: THREE.DoubleSide }));
    object.receiveShadow = true;
    occluders.push(object);
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
    fragmentShader: `varying vec3 vWorld; uniform float time; uniform float daylight; void main(){float a=sin(vWorld.x*.62+vWorld.z*.31+time*.5);float b=sin(vWorld.z*1.4-vWorld.x*.28-time*.4);float rip=pow(max(0.,sin(a*3.+b*1.5)),18.);vec3 deep=mix(vec3(.085,.078,.070),vec3(.20,.18,.16),daylight);vec3 c=deep+vec3(.018,.016,.014)*a+vec3(.12,.105,.088)*rip*.45;float edge=smoothstep(28.,85.,length(vWorld.xz));c=mix(c,mix(vec3(.056,.052,.048),vec3(.18,.165,.15),daylight),edge);gl_FragColor=vec4(c,1.);}`,
  }) : new THREE.MeshBasicMaterial({ color: '#1c1a17' }));
  water.rotation.x = -Math.PI / 2; water.position.y = -2.25; scene.add(water);
  if (!webgl) water.renderOrder = -5;
  // A district route lights only after its content has been explored.
  // The neutral paving stays readable before discovery.
  const routeGroups = new Map();
  function pathTo(id, x, z) {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.12, 0), new THREE.Vector3(x * 0.45 + (z < 0 ? 0.7 : -0.6), 0.12, z * 0.5), new THREE.Vector3(x, 0.12, z)]);
    const route = new THREE.Group(); route.visible = false; scene.add(route); routeGroups.set(id, route);
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
      if (i % 2 === 0 && i / n > 0.2) {
        const marker = box(route, 0.14, 0.045, 0.46, M.route, point.x - tangent.z * 0.57, 0.24, point.z + tangent.x * 0.57);
        marker.rotation.y = Math.atan2(tangent.x, tangent.z);
        marker.castShadow = false;
      }
    }
    batch(route);
  }
  Object.entries(LOCATIONS).filter(([id]) => id !== 'citadel').forEach(([id, [x, z]]) => pathTo(id, x, z));

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
    orb(terrain, size, i % 4 ? M.leafLight : M.shadow, x, size * 0.6, z, [1.5, 0.7, 1]);
    if (i % 7 === 0) {
      for (let j = 0; j < 3; j++) cylinder(terrain, 0, 0.055, 0.26, M.trim, x + j * 0.12, 0.25, z + j * 0.1, 4);
    }
  }

  // An open stoa and worn Doric columns replace the old fortified skyline.
  for (const side of [-1, 1]) {
    const colonnade = new THREE.Group(); terrain.add(colonnade);
    colonnade.position.set(side * 8.8, 0, -12.65);
    box(colonnade, 7.3, 0.24, 1.28, M.shadow, 0, 0.18, 0);
    box(colonnade, 7.05, 0.15, 1.1, M.stone, 0, 0.37, 0);
    for (const x of [-3, -1.5, 0, 1.5, 3]) {
      cylinder(colonnade, 0.13, 0.19, 1.35, M.stone, x, 1.1, 0, 8);
      cylinder(colonnade, 0.21, 0.16, 0.14, M.light, x, 1.83, 0, 8);
      box(colonnade, 0.48, 0.12, 0.48, M.light, x, 1.96, 0);
    }
    box(colonnade, 6.8, 0.3, 0.58, M.stone, 0, 2.17, 0);
    box(colonnade, 7.03, 0.12, 0.75, M.light, 0, 2.37, 0);
    for (let x = -3; x <= 3; x += 0.75) box(colonnade, 0.13, 0.19, 0.03, M.shadow, x, 2.2, 0.31);
  }
  for (const [x, z, h] of [[-14, 7, 1.35], [-13, 9.3, 0.8], [13, -10.4, 1.75]]) {
    box(terrain, 0.9, 0.2, 0.9, M.shadow, x, 0.2, z);
    cylinder(terrain, 0.24, 0.31, h, M.stone, x, 0.3 + h / 2, z, 8);
    box(terrain, 0.65, 0.15, 0.65, M.light, x, 0.34 + h, z);
  }

  // Charon's jetty is anchored to the island edge; the ferry floats in the Styx below.
  for (let i = 0; i < 9; i++) box(terrain, 0.36, 0.14, 1.45, i % 3 ? M.wood : M.woodLight, 15.3 + i * 0.37, -0.5 - i * 0.13, 8);
  for (const x of [15.2, 17.0, 18.4]) for (const z of [7.35, 8.65]) cylinder(terrain, 0.09, 0.11, 2.5, M.wood, x, -1.15, z, 6);
  box(terrain, 3.6, 0.09, 0.1, M.woodLight, 16.8, -0.17, 7.3, [0, 0, -0.26]);
  batch(terrain);

  occluders.push(terrain);
  const river = createStyxRiver({ THREE, scene, M, mesh, box, cylinder, orb, batch, webgl });

  const landmarkGroups = new Map(), upgradeGroups = new Map(), hitTargets = [], plotTypes = new Map();
  const hitMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
  function illuminateDistrict(entry, explored) {
    for (const light of entry.illumination || []) {
      light.material.color.copy(light.color).multiplyScalar(explored ? 1 : 0.63);
      light.material.emissive.copy(light.emissive).multiplyScalar(explored ? 1 : 0.065);
      light.material.emissiveIntensity = explored ? light.intensity * 1.2 : 0.12;
    }
  }
  function bindDistrictLighting(entry, id) {
    for (const light of entry.illumination || []) light.material.dispose();
    const localMaterials = new Map();
    for (const container of [entry.statics, entry.moving]) container.traverse((object) => {
      if (!object.isMesh || !districtLightSources.has(object.material)) return;
      const source = object.material;
      if (!localMaterials.has(source)) localMaterials.set(source, { material: source.clone(), color: source.color.clone(), emissive: source.emissive.clone(), intensity: source.emissiveIntensity });
      object.material = localMaterials.get(source).material;
    });
    entry.illumination = [...localMaterials.values()];
    illuminateDistrict(entry, exploredIds.has(id));
  }
  function addLandmark(id, builder) {
    const [x, z, height, radius] = LOCATIONS[id];
    const group = new THREE.Group(); group.position.set(x, 0, z); scene.add(group);
    const statics = new THREE.Group(), moving = new THREE.Group(); group.add(statics, moving);
    builder(statics, moving);
    batch(statics);
    occluders.push(statics);
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, Math.max(2, height - 1), 8), hitMaterial);
    hit.position.y = Math.max(2, height - 1) / 2; hit.userData.id = id; group.add(hit); hitTargets.push(hit);
    const upgrades = new THREE.Group(); group.add(upgrades); upgradeGroups.set(id, upgrades);
    const entry = { group, statics, moving, hit, height, radius, level: 1 };
    landmarkGroups.set(id, entry);
    bindDistrictLighting(entry, id);
  }
  addLandmark('citadel', greek.citadel); addLandmark('forge', greek.forge); addLandmark('archive', greek.archive);
  addLandmark('oracle', greek.oracle); addLandmark('theatre', greek.theatre); addLandmark('elysium', greek.elysium); addLandmark('gates', greek.gates);

  function plotModel(s, _moving) {
    cylinder(s, 1.45, 1.58, 0.18, M.shadow, 0, 0.15, 0, 8);
    cylinder(s, 1.37, 1.4, 0.07, M.soil, 0, 0.28, 0, 8);
    for (const x of [-0.95, 0.95]) for (const z of [-0.95, 0.95]) {
      box(s, 0.14, 0.62, 0.14, M.wood, x, 0.51, z);
      box(s, 0.29, 0.09, 0.29, M.trim, x, 0.85, z);
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
      if (safeType) { greek.waystation(safeType, landmark.statics); landmark.height = safeType === 'watchtower' ? 5.2 : 4.3; }
      else { plotModel(landmark.statics); landmark.height = 1.3; }
      batch(landmark.statics);
      bindDistrictLighting(landmark, id);
      landmark.hit.scale.y = safeType ? 2.2 : 1;
      landmark.hit.position.y = safeType ? 2.2 : 1;
      emitLabels();
    }
    if (changed) invalidate();
  }
  function setLevels(levels = {}) {
    // Compatibility API: stages now represent opening/discovering content.
    // The caller supplies activity; no resource or purchase state exists here.
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
          cylinder(g, 0.17, 0.25, 0.7, M.trim, side * (landmark.radius - 0.18), 0.86, 0, 6);
          orb(g, 0.21, M.beacon, side * (landmark.radius - 0.18), 1.32, 0);
        }
        const ring = torus(g, landmark.radius - 0.18, 0.035, M.trim, 0, 0.54, 0, [-Math.PI / 2, 0, Math.PI / 8]); ring.scale.y = 0.98;
      }
      if (level >= 3) {
        for (let i = 0; i < 3; i++) {
          const crystal = mesh(g, new THREE.OctahedronGeometry(0.3), M.crystal, -0.6 + i * 0.6, 1.1 + (i === 1 ? 0.2 : 0), -landmark.radius + 0.12);
          crystal.scale.set(0.65, 1.4, 0.65);
        }
        cylinder(g, 0.1, 0.17, 1.35, M.trim, landmark.radius - 0.3, 1.2, 0.65, 6);
        box(g, 0.65, 0.45, 0.08, M.roof, landmark.radius + 0.01, 1.65, 0.65);
      }
      batch(g);
    }
    if (changed) invalidate();
  }

  function setExplored(ids = []) {
    const values = typeof ids === 'string' ? [ids] : ids?.[Symbol.iterator] ? [...ids] : [];
    const next = new Set(values.filter((id) => landmarkGroups.has(id)));
    if (next.size === exploredIds.size && [...next].every((id) => exploredIds.has(id))) return;
    exploredIds.clear();
    next.forEach((id) => exploredIds.add(id));
    for (const [id, route] of routeGroups) route.visible = exploredIds.has(id);
    for (const [id, entry] of landmarkGroups) illuminateDistrict(entry, exploredIds.has(id));
    invalidate();
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
    fragmentShader: 'varying float a;void main(){float d=length(gl_PointCoord-.5);float alpha=(1.-smoothstep(.1,.5,d))*a*.27;gl_FragColor=vec4(.62,.59,.55,alpha);}',
  });
  const smoke = new THREE.Points(smokeGeometry, smokeMaterial); smoke.frustumCulled = false; scene.add(smoke);
  smoke.visible = webgl;

  const motionRoots = [...river.motionRoots, ...[...landmarkGroups.values()].map((entry) => entry.moving).filter((group) => group.children.length)];
  if (!webgl) vectorMotion = createVectorMotionLayer({ scene, camera, canvas, roots: motionRoots, occluders });

  const selectedMaterial = new THREE.MeshBasicMaterial({ color: BRAND.vermilion, transparent: true, opacity: 0.88, depthWrite: false, side: THREE.DoubleSide });
  const hoverMaterial = new THREE.MeshBasicMaterial({ color: BRAND.warmInk, transparent: true, opacity: 0.52, depthWrite: false, side: THREE.DoubleSide });
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
    scene.background.set(day ? '#4d4842' : BRAND.dark);
    scene.fog.color.copy(scene.background);
    hemi.intensity = day ? 2.6 : 2.1;
    sun.intensity = webgl ? (day ? 3.6 : 3.2) : (day ? 1.0 : 0.88);
    sun.color.set(day ? '#fffaf2' : BRAND.warmInk);
    rim.intensity = webgl ? (day ? 0.95 : 1.2) : (day ? 0.25 : 0.3);
    renderer.toneMappingExposure = day ? 1.28 : 1.2;
    waterUniforms.daylight.value = day ? 1 : 0;
    if (vectorAmbient) vectorAmbient.color.set(day ? '#b8aea1' : '#a59d92');
    if (!webgl) water.material.color.set(day ? '#403a34' : '#1c1a17');
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
    // Icon-sized touch targets get a little breathing room on narrow stages.
    // Keep the six destinations and journey entrance closest to their anchors;
    // move secondary waystation labels only when another target would cover them.
    if (mobile.matches) {
      const placed = [];
      const offsets = [[0, 0]];
      for (const distance of [24, 44, 64]) for (const [x, y] of [[0, -1], [1, 0], [-1, 0], [0, 1], [1, -1], [-1, -1], [1, 1], [-1, 1]]) offsets.push([x * distance, y * distance]);
      for (const label of labels) {
        if (!label.visible) continue;
        for (const [dx, dy] of offsets) {
          const x = label.x + dx, y = label.y + dy;
          if (x < 23 || x > width - 23 || y < 23 || y > height - 23) continue;
          if (placed.some((other) => Math.abs(x - other.x) < 44 && Math.abs(y - other.y) < 44)) continue;
          label.x = x; label.y = y; break;
        }
        placed.push(label);
      }
    }
    if (river.riverLabelPosition) {
      projection.fromArray(river.riverLabelPosition).project(camera);
      labels.push({ id: 'river-styx', x: (projection.x * 0.5 + 0.5) * width, y: (-projection.y * 0.5 + 0.5) * height, visible: projection.z > -1 && projection.z < 1 && Math.abs(projection.x) < 0.94 && Math.abs(projection.y) < 0.95 });
    }
    onLabels(labels);
  }
  function setDefaultPose() {
    controls.target.copy(cameraTarget);
    camera.position.copy(controls.target).add(framingMode === 'mobile' ? mobileCamera : initialCamera);
    camera.zoom = 1;
  }
  function resize() {
    if (destroyed) return;
    const rectangle = canvas.getBoundingClientRect();
    width = Math.max(1, rectangle.width); height = Math.max(1, rectangle.height);
    const aspect = width / height;
    const nextMode = !mobile.matches ? 'desktop' : aspect > 1.1 ? 'compact' : 'mobile';
    // A tall mobile stage shows more of the ground plane; the short view above
    // a reading sheet uses the lower angle and fits the full island vertically.
    const vertical = Math.max(nextMode === 'compact' ? 35 : nextMode === 'mobile' ? 38 : 42, 54 / aspect);
    camera.left = -vertical * aspect / 2; camera.right = vertical * aspect / 2; camera.top = vertical / 2; camera.bottom = -vertical / 2;
    if (nextMode !== framingMode) {
      framingMode = nextMode;
      setDefaultPose();
      controls.update();
    }
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    vectorMotion?.setSize(width, height);
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
    setDefaultPose();
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
      renderMilliseconds: Math.round(renderMilliseconds), staticPose: !motionActive(),
      motion: motionActive(), souls: 12, vectorMotion: vectorMotion?.getInfo(),
      buildings: landmarkGroups.size, exploredCount: exploredIds.size, theme, framingMode, reducedMotion: reducedMotion.matches,
    };
  }

  let lastLabelFrame = 0;
  function updateMotion(time) {
    waterUniforms.time.value = time;
    river.update(time);
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
    for (let i = 0; i < smokeCount; i++) {
      const age = ((time * 0.22 + i / smokeCount) % 1);
      smokePosition[i * 3] = -9.03 + Math.sin(age * 5 + i * 2) * 0.2 + age * 0.8;
      smokePosition[i * 3 + 1] = 4.0 + age * 3.1;
      smokePosition[i * 3 + 2] = 3.36 + Math.cos(age * 6 + i) * 0.18;
      smokeAlpha[i] = (1 - age) * 0.75;
    }
    smokeGeometry.attributes.position.needsUpdate = true; smokeGeometry.attributes.opacity.needsUpdate = true;
    if (selectedRing.visible) selectedMaterial.opacity = 0.72 + Math.sin(time * 2) * 0.12;
  }
  function animate(now) {
    frame = 0;
    if (destroyed || paused || document.hidden) return;
    updatingFrame = true;
    controls.update();
    const clampedX = THREE.MathUtils.clamp(controls.target.x, -13, 13);
    const clampedZ = THREE.MathUtils.clamp(controls.target.z, -13, 13);
    camera.position.x += clampedX - controls.target.x;
    camera.position.z += clampedZ - controls.target.z;
    controls.target.x = clampedX; controls.target.z = clampedZ; controls.target.y = 0.2;
    camera.lookAt(controls.target);
    const moving = motionActive();
    const staticDue = dirty || !ready;
    // Reproject the full city only when its view/state changes. The small native
    // motion scene animates independently, using the very same camera snapshot.
    if (!webgl && ((staticDue && now - lastSvgRender < 80) || (!staticDue && moving && now - lastMotionRender < 1000 / 15))) {
      updatingFrame = false; frame = requestAnimationFrame(animate); return;
    }
    if (!staticDue && !moving) { updatingFrame = false; lastMotionTick = null; return; }
    if (moving && lastMotionTick !== null) motionTime += Math.min(0.15, Math.max(0, (now - lastMotionTick) / 1000));
    lastMotionTick = moving ? now : null;
    updateMotion(motionTime);
    const renderStart = performance.now();
    try {
      if (webgl) renderer.render(scene, camera);
      else {
        if (staticDue) {
          const visibility = motionRoots.map((root) => root.visible);
          motionRoots.forEach((root) => { root.visible = false; });
          try { renderer.render(scene, camera); }
          finally { motionRoots.forEach((root, index) => { root.visible = visibility[index]; }); }
          lastSvgRender = now;
        }
        vectorMotion.render();
      }
    } catch (error) {
      updatingFrame = false; paused = true; onError?.(error); return;
    }
    renderMilliseconds = performance.now() - renderStart;
    lastMotionRender = now; dirty = false;
    if (staticDue || (webgl && now - lastLabelFrame > 80) || !ready) { emitLabels(); lastLabelFrame = now; }
    if (!ready) { ready = true; onReady?.(getInfo()); }
    updatingFrame = false;
    if (moving || dirty) frame = requestAnimationFrame(animate);
  }
  function start() { if (!destroyed && !paused && !document.hidden && !frame) frame = requestAnimationFrame(animate); }
  function setPaused(value) {
    paused = Boolean(value); lastMotionTick = null;
    if (paused && frame) { cancelAnimationFrame(frame); frame = 0; } else start();
  }
  function refreshMotion() {
    const enabled = motionActive();
    controls.enableDamping = webgl && enabled;
    lastMotionTick = null;
    canvas.dataset.motion = enabled ? 'playing' : 'paused';
    onMotionChange?.(enabled);
    invalidate();
  }
  function setMotion(value) { motionOverride = typeof value === 'boolean' ? value : null; refreshMotion(); }
  function visibilityChange() {
    lastMotionTick = null;
    if (document.hidden) { if (frame) cancelAnimationFrame(frame); frame = 0; } else start();
  }
  reducedMotion.addEventListener('change', refreshMotion);
  document.addEventListener('visibilitychange', visibilityChange);
  function contextLost(event) { event.preventDefault(); setPaused(true); onError?.(new Error('The 3D graphics context was interrupted. Reload to return to the village; all portals remain available.')); }
  if (webgl) canvas.addEventListener('webglcontextlost', contextLost);
  initialized = true;
  refreshMotion();
  start();

  function destroy() {
    destroyed = true; if (frame) cancelAnimationFrame(frame);
    controls.removeEventListener('change', invalidate);
    controls.dispose(); resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', visibilityChange);
    reducedMotion.removeEventListener('change', refreshMotion);
    vectorMotion?.destroy();
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
    delete canvas.dataset.motion;
  }
  return { select, setLevels, setExplored, setBuilt, setTheme, zoom, resetCamera, setPaused, setMotion, destroy, getInfo };
}
