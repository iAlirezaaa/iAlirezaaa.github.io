import * as THREE from 'three';

/**
 * Native miniature Greek architecture for the atlas. Geometry uses the scene's
 * palette and helpers so batching, district illumination, shadows, and both
 * renderers continue to share the same models.
 */
export function createGreekArchitecture({
  M, box, cylinder, orb, torus, mesh, platform, steps, flag, brazier,
  spinners, animatedObjects, webgl,
}) {
  const curveSegments = webgl ? 14 : 10;

  function stylobate(parent, width, depth, tiers = 3, x = 0, z = 0) {
    for (let i = 0; i < tiers; i++) {
      box(parent, width - i * 0.27, 0.19, depth - i * 0.27,
        i === 0 ? M.shadow : i === tiers - 1 ? M.light : M.stone,
        x, 0.12 + i * 0.19, z);
    }
    return 0.215 + (tiers - 1) * 0.19;
  }

  // Faceted channels suggest fluting without separate thin groove meshes.
  // The open shaft ends are concealed by the stylobate and capital.
  function flutedShaft(radius, height) {
    const n = webgl ? 16 : 12;
    const positions = [], indices = [];
    for (let ring = 0; ring < 2; ring++) {
      for (let i = 0; i <= n; i++) {
        const angle = i / n * Math.PI * 2;
        const r = radius * (ring ? 0.82 : 1) * (i % 2 ? 0.86 : 1);
        positions.push(Math.cos(angle) * r, ring * height, Math.sin(angle) * r);
      }
    }
    for (let i = 0; i < n; i++) {
      const next = i + n + 1;
      indices.push(i, next, i + 1, next, next + 1, i + 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  function doric(parent, x, z, base, height, radius = 0.22) {
    const capital = radius * 0.85;
    const shaft = height - capital;
    mesh(parent, flutedShaft(radius, shaft), M.stone, x, base, z);
    cylinder(parent, radius * 1.28, radius * 0.82, capital * 0.57,
      M.light, x, base + shaft + capital * 0.285, z, 8);
    box(parent, radius * 2.9, capital * 0.43, radius * 2.9,
      M.light, x, base + height - capital * 0.215, z);
  }

  function entablature(parent, width, depth, y, height = 0.42, decorated = true, x = 0, z = 0) {
    box(parent, width, height, 0.32, M.stone, x, y + height / 2, z + depth / 2 - 0.16);
    box(parent, width, height, 0.32, M.stone, x, y + height / 2, z - depth / 2 + 0.16);
    for (const side of [-1, 1]) {
      box(parent, 0.32, height, depth - 0.3, M.stone, x + side * (width / 2 - 0.16), y + height / 2, z);
    }
    box(parent, width + 0.14, 0.13, depth + 0.14, M.light, x, y + height + 0.065, z);
    box(parent, width + 0.04, 0.07, depth + 0.04, M.trim, x, y + 0.065, z);
    if (decorated) {
      const count = Math.max(3, Math.round(width / 0.72));
      for (const side of [-1, 1]) for (let i = 0; i < count; i++) {
        box(parent, 0.13, height * 0.64, 0.055, M.shadow,
          x - width * 0.42 + i / (count - 1) * width * 0.84,
          y + height * 0.58, z + side * (depth / 2 + 0.025));
      }
    }
    return y + height + 0.13;
  }

  function triangularPrism(width, rise, depth) {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0);
    shape.lineTo(width / 2, 0);
    shape.lineTo(0, rise);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 });
    geometry.translate(0, 0, -depth / 2);
    return geometry;
  }

  function pedimentRoof(parent, width, depth, rise, y, tile = M.roof, x = 0, z = 0, crest = false) {
    mesh(parent, triangularPrism(width, rise, depth), tile, x, y, z);
    box(parent, width + 0.1, 0.12, depth + 0.08, M.light, x, y - 0.02, z);
    const slope = Math.atan2(rise, width / 2);
    const length = Math.hypot(width / 2, rise);
    for (const face of [-1, 1]) {
      mesh(parent, triangularPrism(width - 0.15, rise - 0.04, 0.09), M.stone, x, y + 0.025, z + face * (depth / 2 + 0.025));
      for (const side of [-1, 1]) {
        box(parent, length + 0.08, 0.13, 0.19, M.light,
          x + side * width / 4, y + rise / 2 + 0.065,
          z + face * (depth / 2 + 0.055), [0, 0, -side * slope]);
      }
    }
    box(parent, 0.15, 0.14, depth + 0.12, tile === M.roof ? M.roofEdge : M.trim, x, y + rise + 0.045, z);
    for (const side of [-1, 1]) {
      box(parent, 0.055, 0.045, depth, tile === M.roof ? M.roofEdge : M.slateLight,
        x + side * width * 0.29, y + rise * 0.42 + 0.04, z);
    }
    if (crest) {
      for (const face of [-1, 1]) {
        box(parent, 0.33, 0.12, 0.25, M.light, x, y + rise + 0.13, z + face * depth / 2);
        orb(parent, 0.17, M.light, x, y + rise + 0.31, z + face * depth / 2, [0.7, 1.4, 0.5]);
      }
    }
  }

  function doorway(parent, x, y, z, width, height) {
    box(parent, width, height, 0.08, M.night, x, y + height / 2, z);
    for (const side of [-1, 1]) {
      box(parent, 0.16, height + 0.12, 0.19, M.light, x + side * (width / 2 + 0.08), y + height / 2, z + 0.04);
      box(parent, 0.045, height * 0.79, 0.025, M.window, x + side * (width / 2 - 0.08), y + height * 0.47, z + 0.055);
    }
    box(parent, width + 0.4, 0.21, 0.23, M.light, x, y + height + 0.08, z + 0.035);
    box(parent, width * 0.72, 0.045, 0.15, M.window, x, y + 0.04, z + 0.09);
  }

  function roundBand(parent, inner, outer, height, y, mat = M.light, x = 0, z = 0) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments });
    geometry.rotateX(-Math.PI / 2);
    return mesh(parent, geometry, mat, x, y, z);
  }

  function oliveTree(parent, x, z, base = 0.55, size = 1) {
    cylinder(parent, 0.1 * size, 0.2 * size, 1.6 * size, M.bark, x, base + 0.8 * size, z, 5);
    for (const side of [-1, 1]) {
      box(parent, 0.13 * size, 1.1 * size, 0.14 * size, M.bark,
        x + side * 0.26 * size, base + 1.55 * size, z, [0, 0, -side * 0.52]);
      orb(parent, 0.72 * size, side < 0 ? M.leaf : M.leafLight,
        x + side * 0.48 * size, base + 2.05 * size, z + side * 0.16 * size, [1.15, 0.62, 0.9]);
    }
    orb(parent, 0.78 * size, M.leafLight, x - 0.05 * size, base + 2.48 * size, z - 0.13 * size, [1, 0.56, 0.9]);
  }

  function orient(s, a, angle = Math.PI / 9) {
    const statics = new THREE.Group(), moving = new THREE.Group();
    statics.rotation.y = angle; moving.rotation.y = angle;
    s.add(statics); a.add(moving);
    return [statics, moving];
  }

  function citadel(staticGroup, movingGroup) {
    const [s, a] = orient(staticGroup, movingGroup);
    const floor = stylobate(s, 5.25, 4.8);
    const colBase = floor + 0.02, colHeight = 3.12;
    // A dark, recessed cella leaves a full walkable peristyle visible around it.
    box(s, 2.5, 2.62, 2.55, M.dark, 0, colBase + 1.31, -0.12);
    box(s, 2.62, 0.13, 2.7, M.shadow, 0, colBase + 2.68, -0.12);
    doorway(s, 0, colBase + 0.01, 1.18, 1.05, 2.0);
    for (const z of [-1.77, 1.77]) for (const x of [-2.06, -0.69, 0.69, 2.06]) doric(s, x, z, colBase, colHeight, 0.25);
    for (const x of [-2.06, 2.06]) for (const z of [-0.59, 0.59]) doric(s, x, z, colBase, colHeight, 0.25);
    const roofY = entablature(s, 4.87, 4.22, colBase + colHeight, 0.48);
    pedimentRoof(s, 5.08, 4.4, 0.91, roofY, M.roof, 0, 0, true);
    steps(s, 2.25, 3, 0, 0.1, 2.23);
    brazier(s, a, -1.55, floor, 2.05);
    brazier(s, a, 1.55, floor, 2.05);
    flag(a, 2.29, floor, 1.75, M.roof, true);
  }

  function forge(s, a) {
    const floor = stylobate(s, 4.4, 3.4);
    for (const x of [-1.75, 1.75]) for (const z of [-1.14, 1.14]) doric(s, x, z, floor, 2.05, 0.2);
    const roofY = entablature(s, 4.0, 2.95, floor + 2.05, 0.27, false);
    pedimentRoof(s, 4.18, 3.12, 0.46, roofY, M.slate);
    // Low open workshop and square furnace vent, never a defensive tower.
    box(s, 1.48, 1.4, 1.17, M.dark, -1.03, floor + 0.7, -0.64);
    box(s, 0.93, 0.75, 0.045, M.window, -1.03, floor + 0.53, -0.03);
    for (const x of [-1.64, -0.42]) box(s, 0.19, 1.0, 0.24, M.stone, x, floor + 0.55, 0.08);
    box(s, 1.45, 0.22, 0.32, M.light, -1.03, floor + 1.06, 0.08);
    box(s, 0.68, 2.0, 0.68, M.shadow, -1.03, 2.65, -0.64);
    box(s, 0.87, 0.19, 0.85, M.stone, -1.03, 3.76, -0.64);
    box(s, 0.5, 0.035, 0.5, M.night, -1.03, 3.88, -0.64);
    for (let i = 0; i < 3; i++) box(s, 0.71, 0.045, 0.71, M.dark, -1.03, 2.58 + i * 0.37, -0.64);
    brazier(s, a, -1.03, 0.02, 0.12);
    for (const x of [0.52, 1.52]) box(s, 0.12, 0.75, 0.12, M.wood, x, floor + 0.37, 0.68);
    box(s, 1.55, 0.16, 0.7, M.woodLight, 1.02, floor + 0.83, 0.68);
    box(s, 0.58, 0.15, 0.4, M.iron, 1.0, floor + 1.0, 0.68);
    box(s, 0.36, 0.24, 0.28, M.iron, 1.0, floor + 1.17, 0.68);
    box(s, 0.83, 0.16, 0.36, M.iron, 1.0, floor + 1.37, 0.68);
    box(s, 0.1, 0.72, 0.1, M.woodLight, 1.47, floor + 1.11, 0.85, [0, 0, -0.45]);
    box(s, 0.35, 0.2, 0.23, M.iron, 1.61, floor + 1.42, 0.85, [0, 0, -0.45]);
    for (let i = 0; i < 3; i++) cylinder(s, 0.11, 0.11, 0.65, M.woodLight, 0.04, floor + 0.12 + i * 0.19, 1.27, 5, [0, 0, Math.PI / 2]);
    steps(s, 1.8, 3, 0, 0.1, 1.25);
    flag(a, 1.84, 1.43, -1.0, M.roof, true);
  }

  function archive(staticGroup, movingGroup) {
    const [s, a] = orient(staticGroup, movingGroup, Math.PI / 12);
    const floor = stylobate(s, 5.2, 3.0);
    box(s, 4.48, 1.93, 0.38, M.dark, 0, floor + 0.97, -0.95);
    for (const side of [-1, 1]) box(s, 0.22, 1.93, 1.96, M.stone, side * 2.18, floor + 0.97, -0.12);
    for (const x of [-2.05, -0.69, 0.69, 2.05]) doric(s, x, 1.0, floor, 2.1, 0.2);
    for (const x of [-2.05, 2.05]) doric(s, x, -0.98, floor, 2.1, 0.2);
    const roofY = entablature(s, 4.8, 2.6, floor + 2.1, 0.31);
    pedimentRoof(s, 5.0, 2.82, 0.55, roofY, M.slate);
    doorway(s, 0, floor, -0.73, 0.72, 1.55);
    for (const x of [-1.31, 1.31]) {
      box(s, 0.9, 1.45, 0.13, M.wood, x, floor + 0.81, -0.7);
      for (const y of [0.43, 0.94]) {
        box(s, 0.94, 0.07, 0.34, M.woodLight, x, floor + y, -0.51);
        for (let i = 0; i < 3; i++) cylinder(s, 0.095, 0.095, 0.33, i === 1 ? M.trim : M.bone,
          x - 0.25 + i * 0.25, floor + y + 0.13, -0.5, 6, [Math.PI / 2, 0, 0]);
      }
    }
    box(s, 0.48, 0.64, 0.45, M.stone, 0, floor + 0.32, 1.76);
    box(s, 1.02, 0.12, 0.64, M.shadow, 0, floor + 0.69, 1.76);
    box(s, 0.5, 0.055, 0.57, M.bone, -0.23, floor + 0.79, 1.76, [0, 0, -0.13]);
    box(s, 0.5, 0.055, 0.57, M.bone, 0.23, floor + 0.79, 1.76, [0, 0, 0.13]);
    steps(s, 2.0, 3, 0, 0.1, 1.33);
    flag(a, 2.37, 1.1, -0.7, M.slate, true);
  }

  function oracle(s, a) {
    cylinder(s, 2.57, 2.64, 0.2, M.shadow, 0, 0.14, 0, 16);
    cylinder(s, 2.36, 2.4, 0.18, M.stone, 0, 0.33, 0, 16);
    cylinder(s, 2.11, 2.16, 0.16, M.light, 0, 0.5, 0, 16);
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI / 6 + i / 6 * Math.PI * 2;
      doric(s, Math.cos(angle) * 1.6, Math.sin(angle) * 1.6, 0.58, 2.28, 0.21);
    }
    roundBand(s, 1.36, 1.86, 0.29, 2.86, M.stone);
    roundBand(s, 1.23, 2.0, 0.14, 3.15, M.light);
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI / 6 + i / 6 * Math.PI * 2;
      box(s, 0.16, 0.2, 0.08, M.shadow, Math.cos(angle) * 1.89, 3.02, Math.sin(angle) * 1.89, [0, Math.PI / 2 - angle, 0]);
    }
    cylinder(s, 0.58, 0.77, 0.18, M.shadow, 0, 0.68, 0, 8);
    cylinder(s, 0.34, 0.49, 1.14, M.dark, 0, 1.34, 0, 8);
    cylinder(s, 0.58, 0.35, 0.2, M.light, 0, 2.0, 0, 8);
    orb(s, 0.28, M.window, 0, 2.25, 0, [1, 0.5, 1]);
    cylinder(s, 0.045, 0.065, 1.72, M.trim, 0, 3.13, 0, 6);
    const astronomicalRing = new THREE.Group();
    astronomicalRing.position.set(0, 4.65, 0); a.add(astronomicalRing);
    orb(astronomicalRing, 0.43, M.crystal, 0, 0, 0);
    torus(astronomicalRing, 0.99, 0.05, M.trim, 0, 0, 0, [Math.PI / 2.7, 0, 0.3]);
    torus(astronomicalRing, 0.9, 0.045, M.light, 0, 0, 0, [-0.52, 0.38, 0]);
    torus(astronomicalRing, 0.73, 0.03, M.roof, 0, 0, 0, [0.2, Math.PI / 2, 0]);
    spinners.push({ object: astronomicalRing, speed: 0.21 });
    animatedObjects.push({ object: astronomicalRing, baseY: 4.65, amplitude: 0.055, phase: 0.6 });
    for (const x of [-1.2, 1.2]) {
      cylinder(s, 0.16, 0.26, 0.55, M.stone, x, 0.85, 1.54, 6);
      orb(s, 0.14, M.beacon, x, 1.2, 1.54);
    }
  }

  function seatTier(inner, outer, height) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outer, 0, Math.PI, false);
    shape.absarc(0, 0, inner, Math.PI, 0, true);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments });
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  }

  function theatre(staticGroup, movingGroup) {
    const [s, a] = orient(staticGroup, movingGroup);
    platform(s, 3.34);
    cylinder(s, 1.39, 1.39, 0.06, M.paver, 0, 0.53, 0.42, 18);
    cylinder(s, 0.24, 0.32, 0.21, M.shadow, 0, 0.67, 0.29, 6);
    orb(s, 0.12, M.beacon, 0, 0.86, 0.29, [1.1, 0.6, 1.1]);
    for (let i = 0; i < 4; i++) {
      mesh(s, seatTier(1.38 + i * 0.4, 1.75 + i * 0.4, 0.22 + i * 0.24), i % 2 ? M.light : M.stone, 0, 0.5, 0.42);
    }
    mesh(s, seatTier(3.0, 3.2, 1.27), M.shadow, 0, 0.48, 0.42);
    for (const angle of [Math.PI * 0.23, Math.PI * 0.77]) {
      for (let i = 0; i < 5; i++) {
        const r = 1.42 + i * 0.35;
        box(s, 0.31, 0.09, 0.37, M.light, Math.cos(angle) * r, 0.76 + i * 0.22, 0.42 - Math.sin(angle) * r, [0, angle - Math.PI / 2, 0]);
      }
    }
    for (let i = 0; i <= 6; i++) {
      const angle = i / 6 * Math.PI;
      doric(s, Math.cos(angle) * 3.1, 0.42 - Math.sin(angle) * 3.1, 1.75, 0.87, 0.14);
    }
    box(s, 3.06, 0.18, 0.69, M.stone, 0, 0.62, 1.67);
    for (const x of [-1.29, 1.29]) doric(s, x, 1.67, 0.71, 1.18, 0.16);
    box(s, 2.92, 0.2, 0.45, M.light, 0, 2.0, 1.67);
    for (const x of [-1.0, 1.0]) box(s, 0.37, 0.88, 0.045, M.roof, x, 1.43, 1.69);
    flag(a, 2.73, 0.6, 0.76, M.roof, true);
    steps(s, 1.8, 3, 0, 0.1, 2.05);
  }

  function elysium(s, a) {
    const floor = stylobate(s, 4.8, 3.8);
    box(s, 4.26, 0.07, 3.24, M.ground, 0, floor + 0.035, 0);
    for (const x of [-2.15, 2.15]) {
      box(s, 0.27, 0.52, 3.23, M.stone, x, floor + 0.26, 0);
      box(s, 0.37, 0.1, 3.29, M.light, x, floor + 0.57, 0);
    }
    box(s, 4.38, 0.52, 0.28, M.stone, 0, floor + 0.26, -1.53);
    oliveTree(s, -1.0, -0.45, floor, 1.08);
    for (const x of [0.55, 1.57]) for (const z of [-1.05, 0.13]) doric(s, x, z, floor + 0.08, 2.08, 0.16);
    const roofY = entablature(s, 1.72, 1.8, floor + 2.16, 0.25, false, 1.06, -0.46);
    pedimentRoof(s, 1.88, 1.97, 0.4, roofY, M.slate, 1.06, -0.46);
    box(s, 0.86, 0.77, 0.7, M.stone, 0.05, floor + 0.39, 1.0);
    box(s, 1.08, 0.12, 0.91, M.light, 0.05, floor + 0.83, 1.0);
    cylinder(s, 0.34, 0.19, 0.18, M.shadow, 0.05, floor + 0.98, 1.0, 8);
    orb(s, 0.18, M.window, 0.05, floor + 1.1, 1.0, [1.2, 0.5, 1.2]);
    for (let i = 0; i < 4; i++) {
      const x = -0.72 + i * 0.42;
      const light = orb(a, 0.075, M.beacon, x, 1.75 + i * 0.15, 0.65 + Math.sin(i) * 0.22);
      animatedObjects.push({ object: light, baseY: 1.75 + i * 0.15, amplitude: 0.16, phase: i + 0.7 });
    }
    steps(s, 1.55, 3, 0, 0.1, 1.6);
  }

  function gates(staticGroup, movingGroup) {
    const [s, a] = orient(staticGroup, movingGroup);
    const floor = stylobate(s, 5.05, 3.0);
    for (const x of [-1.13, 1.13]) for (const z of [-0.72, 0.73]) doric(s, x, z, floor, 3.25, 0.23);
    const roofY = entablature(s, 3.04, 2.18, floor + 3.25, 0.4);
    pedimentRoof(s, 3.27, 2.39, 0.52, roofY, M.roof, 0, 0, true);
    for (const side of [-1, 1]) {
      box(s, 0.66, 1.78, 1.43, M.dark, side * 1.97, floor + 0.89, -0.15);
      doric(s, side * 2.1, 0.74, floor, 2.08, 0.17);
      box(s, 1.14, 0.29, 1.89, M.stone, side * 2.0, floor + 2.22, -0.04);
      box(s, 1.25, 0.13, 2.0, M.light, side * 2.0, floor + 2.43, -0.04);
      box(s, 0.045, 2.25, 0.06, M.beacon, side * 0.88, floor + 1.18, -0.55);
    }
    box(s, 1.8, 0.045, 0.06, M.beacon, 0, floor + 2.32, -0.55);
    box(s, 1.78, 0.045, 1.87, M.shadow, 0, floor + 0.03, 0.02);
    for (const side of [-1, 1]) {
      brazier(s, a, side * 2.05, floor, 1.22);
      const light = orb(a, 0.085, M.beacon, side * 0.61, 1.7, -0.03);
      animatedObjects.push({ object: light, baseY: 1.7, amplitude: 0.19, phase: side + 1.2 });
    }
    steps(s, 1.8, 3, 0, 0.1, 1.3);
  }

  function waystation(type, s) {
    if (type === 'lantern') {
      const floor = stylobate(s, 1.9, 1.9);
      doric(s, 0, 0, floor, 2.1, 0.27);
      cylinder(s, 0.5, 0.26, 0.22, M.shadow, 0, floor + 2.21, 0, 8);
      orb(s, 0.28, M.beacon, 0, floor + 2.54, 0, [0.7, 1.25, 0.7]);
      box(s, 0.61, 0.51, 0.1, M.trim, 0, floor + 1.17, 0.24);
      box(s, 0.39, 0.055, 0.12, M.dark, 0, floor + 1.2, 0.3);
    } else if (type === 'garden') {
      const floor = stylobate(s, 2.2, 2.2);
      box(s, 1.65, 0.09, 1.65, M.ground, 0, floor + 0.04, 0);
      oliveTree(s, -0.16, -0.18, floor, 0.8);
      for (const x of [-0.47, 0.47]) box(s, 0.18, 0.39, 0.3, M.stone, x, floor + 0.19, 0.77);
      box(s, 1.27, 0.12, 0.43, M.light, 0, floor + 0.45, 0.77);
      for (const x of [-0.78, 0.78]) orb(s, 0.12, M.crystal, x, floor + 0.2, -0.56);
    } else if (type === 'watchtower') {
      const floor = stylobate(s, 2.23, 2.08);
      box(s, 0.91, 2.3, 0.69, M.dark, 0, floor + 1.15, -0.26);
      doorway(s, 0, floor + 0.07, 0.12, 0.52, 1.55);
      for (const x of [-0.66, 0.66]) for (const z of [-0.58, 0.63]) doric(s, x, z, floor, 2.63, 0.18);
      const roofY = entablature(s, 1.88, 1.76, floor + 2.63, 0.28, false);
      pedimentRoof(s, 2.1, 1.94, 0.44, roofY, M.roof, 0, 0, true);
    }
  }

  return { citadel, forge, archive, oracle, theatre, elysium, gates, waystation };
}
