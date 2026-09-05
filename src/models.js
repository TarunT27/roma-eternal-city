import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// The whole kit shares geometry and materials. Completed buildings are merged by
// material, and their variants are cloned with shared GPU buffers around the city.
const M = {
  stone: new THREE.MeshStandardMaterial({ color: '#decdaa', roughness: .92 }),
  light: new THREE.MeshStandardMaterial({ color: '#f0dfbb', roughness: .9 }),
  shade: new THREE.MeshStandardMaterial({ color: '#ad9875', roughness: 1 }),
  stucco: new THREE.MeshStandardMaterial({ color: '#ddc39a', roughness: .96 }),
  ochre: new THREE.MeshStandardMaterial({ color: '#cdb183', roughness: .96 }),
  rose: new THREE.MeshStandardMaterial({ color: '#c59b7a', roughness: .96 }),
  roof: new THREE.MeshStandardMaterial({ color: '#b96540', roughness: .94 }),
  roofLight: new THREE.MeshStandardMaterial({ color: '#ca7b50', roughness: .94 }),
  roofDark: new THREE.MeshStandardMaterial({ color: '#985034', roughness: .94 }),
  dark: new THREE.MeshStandardMaterial({ color: '#3d382c', roughness: 1 }),
  wood: new THREE.MeshStandardMaterial({ color: '#715239', roughness: .96 }),
  red: new THREE.MeshStandardMaterial({ color: '#974c36', roughness: .91, side: THREE.DoubleSide }),
  linen: new THREE.MeshStandardMaterial({ color: '#e5cda0', roughness: .95, side: THREE.DoubleSide }),
  soil: new THREE.MeshStandardMaterial({ color: '#776647', roughness: 1 }),
  green: new THREE.MeshStandardMaterial({ color: '#626e38', roughness: 1, flatShading: true }),
  greenDark: new THREE.MeshStandardMaterial({ color: '#3e5433', roughness: 1, flatShading: true }),
  greenLight: new THREE.MeshStandardMaterial({ color: '#79814a', roughness: 1, flatShading: true }),
  grain: new THREE.MeshStandardMaterial({ color: '#b5aa60', roughness: 1 }),
  water: new THREE.MeshStandardMaterial({ color: '#509596', roughness: .23, metalness: .15 }),
  fruit: new THREE.MeshStandardMaterial({ color: '#b68d48', roughness: .8 }),
};

const geometryCache = new Map();
const buildingCache = new Map();
const treeCache = new Map();
let colosseumTemplate;
const aquaCache = new Map();
const cached = (key, create) => {
  if (!geometryCache.has(key)) geometryCache.set(key, create());
  return geometryCache.get(key);
};
const boxGeo = cached('box', () => new THREE.BoxGeometry(1, 1, 1));
const sphereGeo = cached('sphere', () => new THREE.IcosahedronGeometry(1, 1));
const cylinder = (top = 1, bottom = 1, segments = 10) => cached(`cy:${top}:${bottom}:${segments}`, () => new THREE.CylinderGeometry(top, bottom, 1, segments));
const coneGeo = cached('cone', () => new THREE.ConeGeometry(1, 1, 9));
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const mat4 = new THREE.Matrix4();
const v = new THREE.Vector3();
const s = new THREE.Vector3();

function builder(name) {
  const batches = new Map();
  function add(geo, material, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0]) {
    const key = typeof material === 'string' ? material : 'stone';
    if (!batches.has(key)) batches.set(key, []);
    const part = geo.index ? geo.toNonIndexed() : geo.clone();
    q.setFromEuler(e.set(...rotation));
    mat4.compose(v.set(...position), q, s.set(...scale));
    part.applyMatrix4(mat4);
    // Normal/position/uv form the same attribute layout for every primitive.
    if (!part.getAttribute('uv')) part.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(part.getAttribute('position').count * 2), 2));
    batches.get(key).push(part);
  }
  return {
    add,
    box: (x, y, z, w, h, d, material = 'stone', rotation = [0, 0, 0]) => add(boxGeo, material, [x, y, z], [w, h, d], rotation),
    cyl: (x, y, z, r, h, material = 'stone', top = 1, rotation = [0, 0, 0], segments = 10) => add(cylinder(top, 1, segments), material, [x, y, z], [r, h, r], rotation),
    ball: (x, y, z, rx, ry, rz, material) => add(sphereGeo, material, [x, y, z], [rx, ry, rz]),
    finish() {
      const group = new THREE.Group();
      group.name = name;
      for (const [key, parts] of batches) {
        const merged = mergeGeometries(parts, false);
        parts.forEach(g => g.dispose());
        if (!merged) continue;
        merged.computeBoundingSphere();
        const mesh = new THREE.Mesh(merged, M[key]);
        mesh.castShadow = key !== 'water';
        mesh.receiveShadow = true;
        mesh.name = `${name}-${key}`;
        group.add(mesh);
      }
      return group;
    },
  };
}

function random(seed) {
  let state = (Math.floor(Number(seed) || 1) * 2654435761) >>> 0;
  return () => { state = (1664525 * state + 1013904223) >>> 0; return state / 4294967296; };
}

function gableGeo() {
  return cached('gable', () => {
    const outline = new THREE.Shape();
    outline.moveTo(-.5, 0);
    outline.lineTo(.5, 0);
    outline.lineTo(0, 1);
    outline.closePath();
    const geo = new THREE.ExtrudeGeometry(outline, { depth: 1, steps: 1, bevelEnabled: false });
    geo.translate(0, 0, -.5);
    return geo;
  });
}

function roof(b, x, y, z, w, d, height = .65, turn = false) {
  b.add(gableGeo(), 'roof', [x, y, z], [w, height, d], [0, turn ? Math.PI / 2 : 0, 0]);
  // Raised barrel-tile ridges break up every roof plane at game scale.
  const num = Math.max(3, Math.round(d / .32));
  const rot = turn ? Math.PI / 2 : 0;
  for (let i = 0; i <= num; i++) {
    const localZ = -.5 * d + i * d / num;
    for (const side of [-1, 1]) {
      const localX = side * w * .25;
      const px = x + localX * Math.cos(rot) + localZ * Math.sin(rot);
      const pz = z - localX * Math.sin(rot) + localZ * Math.cos(rot);
      const angle = -side * Math.atan2(height, w / 2);
      b.box(px, y + height * .5 + .016, pz, Math.hypot(w / 2, height), .033, .038, 'roofLight', [0, rot, angle]);
    }
  }
  b.box(x, y + height + .025, z, turn ? d + .08 : .105, .1, turn ? .105 : d + .08, 'roofDark');
}

function column(b, x, z, bottom, h = 2.3, r = .12) {
  b.box(x, bottom + .07, z, r * 3, .14, r * 3, 'light');
  b.cyl(x, bottom + .21, z, r * 1.18, .17, 'light');
  b.cyl(x, bottom + h / 2 + .12, z, r, h - .42, 'light', .86, [0, 0, 0], 10);
  b.cyl(x, bottom + h - .17, z, r * 1.2, .13, 'light');
  b.box(x, bottom + h - .04, z, r * 3.1, .15, r * 3.1, 'light');
}

function doorway(b, x, y, z, width = .64, height = 1.22, turn = 0) {
  const key = 'door-arch';
  const geo = cached(key, () => {
    const sh = new THREE.Shape();
    sh.moveTo(-.5, 0); sh.lineTo(.5, 0); sh.lineTo(.5, .72);
    sh.absellipse(0, .72, .5, .28, 0, Math.PI, false, 0);
    sh.lineTo(-.5, 0);
    return new THREE.ShapeGeometry(sh, 8);
  });
  b.add(geo, 'dark', [x, y, z], [width, height, 1], [0, turn, 0]);
}

function windowRow(b, x, z, y, count, spacing, turn = 0) {
  for (let i = 0; i < count; i++) {
    const dx = (i - (count - 1) / 2) * spacing;
    const px = x + dx * Math.cos(turn), pz = z - dx * Math.sin(turn);
    b.box(px, y, pz, .32, .48, .036, 'dark', [0, turn, 0]);
    b.box(px, y - .29, pz, .42, .08, .13, 'light', [0, turn, 0]);
  }
}

function pot(b, x, y, z, greenery = false) {
  b.cyl(x, y + .2, z, .19, .38, 'roof', .7);
  b.cyl(x, y + .39, z, .16, .06, 'roofLight');
  if (greenery) b.ball(x, y + .53, z, .29, .27, .28, 'green');
}

function domus(seed) {
  const b = builder('domus');
  const rng = random(seed);
  const wall = ['stucco', 'ochre', 'rose'][seed % 3];
  b.box(0, .12, 0, 5.95, .24, 5.55, 'shade');
  b.box(0, .27, 0, 5.7, .12, 5.3, 'stone');
  // An actual three-sided residence with a visible columned atrium.
  b.box(-2.02, 1.23, 0, 1.3, 1.8, 4.8, wall);
  b.box(2.02, 1.23, 0, 1.3, 1.8, 4.8, wall);
  b.box(0, 1.38, 1.78, 3.1, 2.1, 1.35, wall);
  roof(b, -2.02, 2.14, 0, 1.56, 5.1, .52);
  roof(b, 2.02, 2.14, 0, 1.56, 5.1, .52);
  roof(b, 0, 2.43, 1.78, 1.61, 4.1, .57, true);
  b.box(0, .35, -.3, 2.55, .06, 2.45, 'light');
  b.box(0, .37, -.35, 1.2, .06, 1.48, 'water');
  for (const sx of [-1, 1]) {
    b.box(sx * .69, .43, -.35, .12, .18, 1.66, 'light');
    for (const z of [-1.55, -.25, 1]) column(b, sx * 1.13, z, .33, 1.62, .083);
    b.box(sx * 1.13, 2.0, -.3, .22, .16, 2.9, 'light');
  }
  for (const z of [-1.16, .46]) b.box(0, .43, z, 1.48, .18, .12, 'light');
  // A low street wall preserves the atrium view from the overhead camera.
  b.box(-1.73, .73, -2.45, 1.85, .8, .22, wall);
  b.box(1.73, .73, -2.45, 1.85, .8, .22, wall);
  b.box(0, .41, -2.73, 1.65, .17, .55, 'light');
  doorway(b, -2.02, .35, -2.408, .64, 1.24, Math.PI);
  doorway(b, 2.02, .35, -2.408, .64, 1.24, Math.PI);
  doorway(b, 0, .34, 1.094, .75, 1.48, Math.PI);
  windowRow(b, -2.69, -.1, 1.54, 3, 1.2, -Math.PI / 2);
  windowRow(b, 2.69, -.1, 1.54, 3, 1.2, Math.PI / 2);
  pot(b, -.75, .35, 1.0, true); pot(b, .75, .35, 1.0, true);
  if (rng() > .35) b.box(2.0, 2.62, 1.24, .37, .74, .35, 'ochre');
  return b.finish();
}

function farm(seed) {
  const b = builder('farm');
  const rng = random(seed);
  b.box(0, .08, 0, 6.05, .16, 5.8, 'shade');
  b.box(-.5, .17, -.45, 4.75, .06, 4.4, 'soil');
  for (let row = 0; row < 7; row++) {
    const x = -2.49 + row * .65;
    b.box(x, .23, -.5, .36, .13, 3.76, 'ochre');
    for (let n = 0; n < 10; n++) {
      const z = -2.18 + n * .38;
      const h = .23 + rng() * .25;
      b.add(coneGeo, row % 3 === 0 ? 'grain' : 'greenLight', [x, .29 + h / 2, z], [.17, h, .2]);
    }
  }
  b.box(1.83, .94, 1.8, 1.85, 1.52, 1.63, 'ochre');
  roof(b, 1.83, 1.7, 1.8, 2.13, 1.93, .68);
  doorway(b, 1.83, .17, .978, .64, 1.1, Math.PI);
  windowRow(b, 2.762, 1.81, 1.18, 1, 1, Math.PI / 2);
  // Fine split-rail boundary with an opening at the farm entrance.
  for (const z of [-2.83, 2.83]) {
    for (let x = -2.9; x <= 2.95; x += .72) b.box(x, .49, z, .075, .68, .075, 'wood');
    for (const y of [.42, .69]) b.box(0, y, z, 5.85, .057, .07, 'wood');
  }
  for (const x of [-2.92, 2.92]) {
    for (let z = -2.13; z <= 2.3; z += .72) b.box(x, .49, z, .075, .68, .075, 'wood');
    for (const y of [.42, .69]) b.box(x, y, 0, .07, .057, 5.62, 'wood');
  }
  for (let i = 0; i < 3; i++) b.cyl(-2.12 + i * .56, .44, 2.28, .24, .53, 'grain');
  return b.finish();
}

function market(seed) {
  const b = builder('market');
  b.box(0, .11, 0, 6.1, .22, 5.8, 'shade');
  b.box(0, .25, 0, 5.9, .08, 5.6, 'stone');
  b.box(0, 1.32, 1.57, 5.4, 2.06, 1.57, seed % 2 ? 'ochre' : 'stucco');
  roof(b, 0, 2.36, 1.57, 1.94, 5.76, .7, true);
  for (const x of [-1.83, 0, 1.83]) {
    doorway(b, x, .3, .776, .91, 1.45, Math.PI);
    const fabric = x === 0 ? 'linen' : 'red';
    for (const sx of [-.65, .65]) b.cyl(x + sx, 1.13, -1.78, .045, 1.69, 'wood');
    b.box(x, 1.89, -.56, 1.47, .055, 2.62, fabric, [-.13, 0, 0]);
    b.box(x, 1.7, -1.85, 1.47, .24, .048, fabric);
    b.box(x, .69, -1.26, 1.34, .79, .65, 'wood');
    b.box(x, 1.12, -1.26, 1.44, .11, .76, 'ochre');
    for (let n = 0; n < 7; n++) b.ball(x - .48 + (n % 4) * .31, 1.23, -1.41 + Math.floor(n / 4) * .27, .105, .105, .105, x < 0 ? 'greenLight' : 'fruit');
  }
  pot(b, -2.58, .29, -2.03); pot(b, 2.58, .29, -2.03);
  b.box(0, .35, -2.58, 5.4, .14, .46, 'light');
  return b.finish();
}

function barrelVaultGeo() {
  return cached('barrel', () => {
    const shape = new THREE.Shape();
    shape.moveTo(-1, 0);
    shape.absarc(0, 0, 1, Math.PI, 0, true);
    shape.lineTo(-1, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 1, steps: 1, bevelEnabled: false, curveSegments: 14 });
    geo.translate(0, 0, -.5);
    return geo;
  });
}

function baths() {
  const b = builder('baths');
  b.box(0, .12, 0, 6.15, .24, 5.95, 'shade');
  b.box(0, .31, 0, 5.95, .14, 5.75, 'light');
  b.box(0, 1.53, 1.3, 3.0, 2.3, 2.7, 'stucco');
  b.add(barrelVaultGeo(), 'roof', [0, 2.67, 1.3], [1.63, 1.32, 2.9]);
  for (const z of [.08, .72, 1.36, 2, 2.6]) {
    const rib = cached('vault-rib', () => new THREE.TorusGeometry(1, .024, 3, 16, Math.PI));
    b.add(rib, 'roofLight', [0, 2.67, z], [1.65, 1.34, 1]);
  }
  for (const side of [-1, 1]) {
    b.box(side * 2.04, 1.3, .25, .94, 1.85, 4.63, 'stone');
    roof(b, side * 2.04, 2.24, .25, 1.23, 4.93, .46);
    for (const z of [-1.55, -.48, .58, 1.65]) column(b, side * 1.49, z, .38, 1.83, .09);
    windowRow(b, side * 2.52, .15, 1.48, 4, 1.04, side * Math.PI / 2);
  }
  b.box(0, .42, -1.47, 2.67, .08, 1.72, 'shade');
  b.box(0, .47, -1.47, 2.28, .04, 1.35, 'water');
  for (const side of [-1, 1]) {
    b.box(side * 1.22, .53, -1.47, .16, .16, 1.66, 'light');
    b.box(0, .53, -1.47 + side * .76, 2.6, .16, .16, 'light');
  }
  doorway(b, 0, .38, -.066, .83, 1.77, Math.PI);
  b.box(0, .25, -3.02, 3.1, .23, .25, 'stone');
  pot(b, -2.7, .38, -2.48, true); pot(b, 2.7, .38, -2.48, true);
  return b.finish();
}

function temple() {
  const b = builder('temple');
  b.box(0, .11, 0, 6.15, .22, 6.1, 'shade');
  b.box(0, .28, 0, 5.87, .18, 5.86, 'stone');
  b.box(0, .45, 0, 5.6, .18, 5.59, 'light');
  b.box(0, .62, 0, 5.33, .18, 5.32, 'stone');
  b.box(0, 1.95, .26, 2.78, 2.5, 3.18, 'stucco');
  for (const z of [-2.2, 2.2]) {
    for (let i = 0; i < 6; i++) column(b, -2.12 + i * .848, z, .72, 2.8, .138);
  }
  for (const x of [-2.12, 2.12]) {
    for (const z of [-1.1, 0, 1.1]) column(b, x, z, .72, 2.8, .138);
  }
  b.box(0, 3.55, 0, 4.81, .25, 5.03, 'light');
  b.box(0, 3.76, 0, 4.96, .18, 5.17, 'stone');
  // Pediment is a triangular stone face below a separate terracotta gable roof.
  b.add(gableGeo(), 'light', [0, 3.84, 0], [4.96, .94, 5.17]);
  roof(b, 0, 3.91, 0, 5.24, 5.48, 1.04);
  for (const z of [-2.609, 2.609]) {
    b.add(gableGeo(), 'shade', [0, 3.96, z], [3.77, .57, .015]);
    b.cyl(0, 4.17, z + (z < 0 ? -.035 : .035), .17, .06, 'light', 1, [Math.PI / 2, 0, 0], 14);
  }
  for (let i = 0; i < 14; i++) {
    for (const z of [-2.57, 2.57]) b.box(-2.32 + i * .357, 3.74, z, .105, .13, .105, 'shade');
  }
  doorway(b, 0, .72, -1.339, .95, 2.08, Math.PI);
  b.box(0, .77, -1.38, 1.3, .14, .36, 'light');
  return b.finish();
}

export function createBuilding(type, seed = 1) {
  const variant = Math.abs(Math.floor(Number(seed) || 0)) % 6;
  const key = `${type}:${variant}`;
  if (!buildingCache.has(key)) {
    const factories = { domus, farm, market, baths, temple };
    const model = (factories[type] || domus)(variant);
    model.userData.buildingType = type;
    buildingCache.set(key, model);
  }
  return buildingCache.get(key).clone();
}

// A wall with an arch opening which reaches the baseline. This is a real
// silhouette cutout, allowing the view and sunlight through every arcade.
function archPanel(width, height, opening, spring, depth) {
  const key = `arch:${width}:${height}:${opening}:${spring}:${depth}`;
  return cached(key, () => {
    const sh = new THREE.Shape();
    const half = opening / 2;
    sh.moveTo(-width / 2, 0);
    sh.lineTo(-half, 0);
    sh.lineTo(-half, spring);
    sh.absarc(0, spring, half, Math.PI, 0, true);
    sh.lineTo(half, 0);
    sh.lineTo(width / 2, 0);
    sh.lineTo(width / 2, height);
    sh.lineTo(-width / 2, height);
    sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth, steps: 1, bevelEnabled: false, curveSegments: 7 });
    geo.translate(0, 0, -depth / 2);
    return geo;
  });
}

function ellipticalRing(a, c, inset, height) {
  return cached(`ring:${a}:${c}:${inset}:${height}`, () => {
    const sh = new THREE.Shape();
    sh.absellipse(0, 0, a, c, 0, Math.PI * 2, false, 0);
    const hole = new THREE.Path();
    hole.absellipse(0, 0, a - inset, c - inset, 0, Math.PI * 2, true, 0);
    sh.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: height, steps: 1, bevelEnabled: false, curveSegments: 60 });
    geo.rotateX(-Math.PI / 2);
    return geo;
  });
}

export function createColosseum() {
  if (colosseumTemplate) return colosseumTemplate.clone();
  const b = builder('colosseum');
  const major = 11, minor = 8.5, segments = 48;
  b.add(ellipticalRing(11.43, 8.93, 2.83, .32), 'shade', [0, 0, 0]);
  b.add(ellipticalRing(11.2, 8.7, .95, .2), 'light', [0, .32, 0]);
  b.cyl(0, .1, 0, 1, .2, 'soil', 1, [0, 0, 0], 64);
  // The oval arena and concentric ascending cavea remain open to the sky.
  const arena = cached('arena-ellipse', () => {
    const g = new THREE.CircleGeometry(1, 64); g.rotateX(-Math.PI / 2); return g;
  });
  b.add(arena, 'ochre', [0, .22, 0], [6.0, 1, 3.75]);
  b.add(ellipticalRing(6.15, 3.9, .17, .8), 'stone', [0, .22, 0]);
  for (let i = 0; i < 12; i++) {
    b.add(ellipticalRing(6.46 + i * .29, 4.21 + i * .29, .34, .23), i % 3 === 0 ? 'light' : 'stone', [0, .82 + i * .36, 0]);
  }
  // Radial aisles divide the stone seating banks.
  for (let i = 0; i < 16; i++) {
    const theta = i / 16 * Math.PI * 2;
    for (let j = 0; j < 12; j++) {
      const x = (6.26 + j * .29) * Math.cos(theta), z = (4.02 + j * .29) * Math.sin(theta);
      b.box(x, .85 + j * .36, z, .16, .045, .4, 'shade', [0, -theta, 0]);
    }
  }
  for (let tier = 0; tier < 3; tier++) {
    const aa = major - tier * .1, cc = minor - tier * .1;
    const base = .53 + tier * 2.22;
    for (let i = 0; i < segments; i++) {
      const theta = (i + .5) / segments * Math.PI * 2;
      const tx = -aa * Math.sin(theta), tz = cc * Math.cos(theta);
      const angle = Math.atan2(-tz, tx);
      const width = Math.sqrt(tx * tx + tz * tz) * Math.PI * 2 / segments + .055;
      const panel = archPanel(width, 2.08, width * .65, 1.09, .56);
      b.add(panel, tier === 1 ? 'stone' : 'light', [aa * Math.cos(theta), base, cc * Math.sin(theta)], [1, 1, 1], [0, angle, 0]);
      const boundary = i / segments * Math.PI * 2;
      const x = (aa + .34) * Math.cos(boundary), z = (cc + .34) * Math.sin(boundary);
      column(b, x, z, base, 2.03, tier === 0 ? .135 : .116);
    }
    b.add(ellipticalRing(aa + .42, cc + .42, .95, .18), 'light', [0, base + 2.07, 0]);
    b.add(ellipticalRing(aa + .29, cc + .29, .83, .09), 'shade', [0, base + 2.23, 0]);
  }
  // Solid attic with shallow niches, cornices and wooden velarium masts.
  b.add(ellipticalRing(10.9, 8.4, .62, .98), 'stone', [0, 7.22, 0]);
  b.add(ellipticalRing(11.04, 8.54, .84, .16), 'light', [0, 8.12, 0]);
  for (let i = 0; i < 48; i++) {
    const theta = (i + .5) / 48 * Math.PI * 2;
    const angle = Math.atan2(-8.4 * Math.cos(theta), -10.9 * Math.sin(theta));
    b.box(10.945 * Math.cos(theta), 7.72, 8.445 * Math.sin(theta), .26, .43, .042, 'shade', [0, angle, 0]);
    if (i % 2 === 0) b.cyl(10.64 * Math.cos(theta), 8.45, 8.14 * Math.sin(theta), .042, .92, 'wood', .8);
  }
  colosseumTemplate = b.finish();
  colosseumTemplate.userData.landmark = 'Colosseum';
  return colosseumTemplate.clone();
}

export function createAqueduct(length = 64) {
  const count = Math.max(2, Math.round(length / 5));
  const actualLength = count * 5;
  if (aquaCache.has(count)) return aquaCache.get(count).clone();
  const b = builder('aqueduct');
  const panel = archPanel(5.035, 6.74, 3.65, 3.72, 1.22);
  for (let i = 0; i < count; i++) {
    const x = -actualLength / 2 + 2.5 + i * 5;
    b.add(panel, 'stone', [x, .16, 0]);
    const pierX = x - 2.5;
    b.box(pierX, .16, 0, 1.74, .32, 1.9, 'shade');
    b.box(pierX, 3.83, 0, 1.46, .2, 1.5, 'light');
    // Alternating voussoirs trace the curved openings.
    for (let n = 0; n < 11; n++) {
      const angle = (n + .5) * Math.PI / 11;
      for (const z of [-.64, .64]) {
        b.box(x + Math.cos(angle) * 1.98, 3.88 + Math.sin(angle) * 1.98, z, .3, .37, .085, n % 2 === 0 ? 'light' : 'shade', [0, 0, angle - Math.PI / 2]);
      }
    }
  }
  b.box(actualLength / 2, .16, 0, 1.74, .32, 1.9, 'shade');
  b.box(0, 6.89, 0, actualLength + .3, .22, 1.68, 'light');
  b.box(0, 7.12, 0, actualLength + .1, .26, 1.35, 'stone');
  b.box(0, 7.31, 0, actualLength, .055, .7, 'water');
  for (const z of [-.57, .57]) {
    b.box(0, 7.49, z, actualLength + .1, .58, .28, 'stone');
    b.box(0, 7.82, z, actualLength + .29, .13, .39, 'light');
  }
  const model = b.finish();
  model.userData.landmark = 'Aqueduct';
  aquaCache.set(count, model);
  return model.clone();
}

export function createTree(kind = 'pine', seed = 1) {
  const variant = Math.abs(Math.floor(Number(seed) || 0)) % 8;
  const key = `${kind}:${variant}`;
  if (treeCache.has(key)) return treeCache.get(key).clone();
  const rng = random(variant + 14);
  const b = builder(kind);
  if (kind === 'cypress') {
    const height = 3.6 + rng() * 1.7;
    b.cyl(0, .7, 0, .11, 1.4, 'wood', .6);
    b.add(coneGeo, 'greenDark', [0, height * .52, 0], [.55, height * .94, .55]);
    b.add(coneGeo, 'green', [.04, height * .61, -.04], [.42, height * .78, .43]);
  } else {
    const height = 3.7 + rng() * 1.2;
    const spread = 1.45 + rng() * .5;
    b.cyl(0, height * .43, 0, .13, height * .86, 'wood', .55, [.035, 0, -.06]);
    for (let i = 0; i < 4; i++) {
      const angle = i / 4 * Math.PI * 2 + variant;
      b.cyl(Math.cos(angle) * .33, height * .76, Math.sin(angle) * .33, .061, 1.19, 'wood', .5, [Math.cos(angle) * .64, 0, -Math.sin(angle) * .64]);
    }
    b.ball(0, height * .92, 0, spread, .65, spread * .89, 'greenDark');
    for (let i = 0; i < 5; i++) {
      const angle = i / 5 * Math.PI * 2;
      const radius = spread * .45;
      b.ball(Math.cos(angle) * radius, height + rng() * .18, Math.sin(angle) * radius, spread * .63, .52 + rng() * .15, spread * .62, i % 3 === 0 ? 'greenLight' : 'green');
    }
    b.ball(.08, height + .17, .07, spread * .68, .52, spread * .64, 'green');
  }
  const model = b.finish();
  treeCache.set(key, model);
  return model.clone();
}
