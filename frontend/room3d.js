import * as THREE from 'three';

// Lightweight, original furnished 3D apartment. Built from primitives so it
// loads quickly on Android and needs no third-party model download or license.
export function buildRiyaRoom(scene) {
  const room = new THREE.Group();
  room.name = 'RIYA_3D_APARTMENT';

  const mat = (color, roughness = 0.82, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const floorMat = mat('#b88762');
  const wallMat = mat('#eadfd2');
  const accentMat = mat('#b8a0a0');
  const darkWood = mat('#654638');
  const wood = mat('#9a6b4e');
  const cream = mat('#f0e6d9');
  const sofaMat = mat('#687c83');
  const cushionMat = mat('#d7c2ae');
  const metal = mat('#343b43', 0.42, 0.55);
  const glass = new THREE.MeshStandardMaterial({
    color: '#9ec8d8', roughness: 0.18, metalness: 0.12,
    transparent: true, opacity: 0.42
  });

  function box(name, size, position, material, parent = room, radius = 0) {
    let geometry;
    if (radius > 0) {
      geometry = new THREE.BoxGeometry(...size);
    } else {
      geometry = new THREE.BoxGeometry(...size);
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function cylinder(name, r1, r2, height, position, material, parent = room) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, height, 16), material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  // Open-front room shell: floor, back wall and two side walls.
  const floor = box('walkable-room-floor', [5.8, 0.16, 5.2], [0, -0.1, -0.55], floorMat);
  floor.userData.walkable = true;
  box('back-wall', [5.8, 3.3, 0.14], [0, 1.55, -3.12], wallMat);
  box('left-wall', [0.14, 3.3, 5.2], [-2.9, 1.55, -0.55], wallMat);
  box('right-wall', [0.14, 3.3, 5.2], [2.9, 1.55, -0.55], wallMat);
  box('feature-wall-panel', [2.65, 1.8, 0.035], [0, 1.75, -3.035], accentMat);

  // Warm wood skirting and a framed window on the back wall.
  box('back-skirt', [5.7, 0.12, 0.08], [0, 0.02, -3.015], darkWood);
  box('window-frame', [1.65, 1.25, 0.1], [-1.75, 2.0, -3.0], darkWood);
  box('window-glass', [1.48, 1.08, 0.035], [-1.75, 2.0, -2.93], glass);
  box('window-mullion-v', [0.045, 1.08, 0.04], [-1.75, 2.0, -2.89], cream);
  box('window-mullion-h', [1.48, 0.045, 0.04], [-1.75, 2.0, -2.89], cream);
  box('window-sill', [1.85, 0.1, 0.2], [-1.75, 1.34, -2.9], wood);

  // Sofa: base, back, arms and two seat/back cushions.
  box('sofa-base', [1.8, 0.38, 0.78], [-1.45, 0.28, -1.72], sofaMat);
  box('sofa-back', [1.8, 0.85, 0.22], [-1.45, 0.78, -2.08], sofaMat);
  box('sofa-left-arm', [0.22, 0.62, 0.82], [-2.24, 0.55, -1.72], sofaMat);
  box('sofa-right-arm', [0.22, 0.62, 0.82], [-0.66, 0.55, -1.72], sofaMat);
  box('sofa-seat-cushion', [1.35, 0.16, 0.62], [-1.45, 0.53, -1.62], cushionMat);
  box('sofa-back-cushion', [1.35, 0.48, 0.12], [-1.45, 0.9, -1.94], cushionMat);

  // Coffee table in front of the sofa.
  box('coffee-table-top', [1.45, 0.12, 0.72], [0.05, 0.48, -1.35], darkWood);
  for (const x of [-0.55, 0.65]) for (const z of [-1.62, -1.08]) {
    box('coffee-table-leg', [0.075, 0.43, 0.075], [x, 0.22, z], metal);
  }
  cylinder('decorative-vase', 0.12, 0.17, 0.34, [0.05, 0.7, -1.35], cream);

  // TV console and flat screen along the right wall.
  box('tv-console', [1.7, 0.34, 0.42], [1.95, 0.24, -2.52], darkWood);
  box('television', [1.45, 0.88, 0.1], [1.95, 1.0, -2.72], metal);
  box('tv-screen', [1.34, 0.76, 0.025], [1.95, 1.0, -2.655], mat('#17232d', 0.22));

  // Tall bookshelf with shelves and a few books.
  box('bookcase', [0.62, 2.0, 0.28], [2.48, 1.0, -0.65], darkWood);
  for (const y of [0.28, 0.78, 1.28, 1.78]) {
    box('bookcase-shelf', [0.66, 0.06, 0.34], [2.48, y, -0.62], wood);
  }
  const bookColors = ['#b75f52', '#d2ad68', '#6f8792', '#d7c7ae'];
  for (let i = 0; i < 4; i++) {
    box('book', [0.11, 0.34 + (i % 2) * 0.08, 0.16],
      [2.28 + i * 0.13, 0.5 + (i % 2) * 0.04, -0.59], mat(bookColors[i]));
  }

  // Floor lamp, shade and warm point light.
  cylinder('lamp-base', 0.25, 0.25, 0.07, [1.72, 0.03, 0.2], metal);
  cylinder('lamp-pole', 0.035, 0.035, 1.55, [1.72, 0.82, 0.2], metal);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.34, 0.42, 20), cream);
  shade.position.set(1.72, 1.78, 0.2);
  shade.castShadow = true;
  room.add(shade);
  const lamp = new THREE.PointLight('#ffd7a1', 1.1, 3.2);
  lamp.position.set(1.72, 1.65, 0.2);
  room.add(lamp);

  // Indoor plant in a ceramic pot.
  cylinder('plant-pot', 0.2, 0.15, 0.34, [-2.35, 0.16, 0.25], cream);
  const stem = cylinder('plant-stem', 0.025, 0.025, 0.72, [-2.35, 0.68, 0.25], mat('#49634b'));
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), mat('#557b58'));
    const a = i * Math.PI * 2 / 7;
    leaf.position.set(-2.35 + Math.cos(a) * 0.2, 0.83 + (i % 3) * 0.12, 0.25 + Math.sin(a) * 0.2);
    leaf.scale.set(0.55, 1.25, 0.45);
    leaf.rotation.z = -Math.cos(a) * 0.5;
    room.add(leaf);
  }

  // Soft area-style fill lighting using hemisphere + broad point lights.
  scene.add(room);
  scene.background = new THREE.Color('#b8c6ce');
  scene.fog = new THREE.Fog('#b8c6ce', 9, 18);
  scene.add(new THREE.HemisphereLight('#fff2df', '#6b574b', 1.25));
  const key = new THREE.DirectionalLight('#fff0dc', 1.5);
  key.position.set(-3, 6, 4);
  key.castShadow = false;
  scene.add(key);
  return { group: room, floor };
}
