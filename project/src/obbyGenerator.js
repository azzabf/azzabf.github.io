// src/obbyGenerator.js
// MORE platforms + smoother difficulty ramp, using editable blueprints.
// Drop-in replacement for your current src/obbyGenerator.js

import { Mob } from "./mob.js";

/**
 * PLATFORM SPEC:
 * { x, y, z, w, d, goal?, behavior? }
 * behavior:
 *  { type: "moveX"|"moveZ"|"moveY", amplitude, speed, baseX/baseZ/baseY }
 */

// ---------- Helpers to make "MORE MORE MORE" fast ----------
function stairPath({
  start = { x: 0, y: 0, z: 10 },
  steps = 10,
  dz = -4.0,
  dy = 0.35,
  xWiggle = 1.2,
  size = { w: 4.2, d: 4.2 },
  thinEvery = 0, // e.g. 3 => every 3rd platform is thin
  thinSize = { w: 2.0, d: 5.0 },
}) {
  const arr = [];
  for (let i = 0; i < steps; i++) {
    const x = start.x + Math.sin(i * 0.9) * xWiggle;
    const y = start.y + i * dy;
    const z = start.z + i * dz;

    const thin = thinEvery > 0 && i > 0 && i % thinEvery === 0;
    arr.push({
      x, y, z,
      w: thin ? thinSize.w : size.w,
      d: thin ? thinSize.d : size.d,
    });
  }
  return arr;
}

function addGoal(platforms, atIndex = -1, goalSizeBoost = 1.25) {
  if (!platforms.length) return platforms;
  const idx = atIndex < 0 ? platforms.length - 1 : Math.min(atIndex, platforms.length - 1);
  platforms[idx] = {
    ...platforms[idx],
    w: platforms[idx].w * goalSizeBoost,
    d: platforms[idx].d * goalSizeBoost,
    goal: true,
  };
  return platforms;
}

function movingEvery(platforms, every = 4, type = "moveX", amplitude = 2.5, speed = 1.4) {
  // add gentle movement to every Nth platform (excluding start + goal)
  for (let i = 1; i < platforms.length - 1; i++) {
    if (every > 0 && i % every === 0) {
      const p = platforms[i];
      if (type === "moveX") {
        p.behavior = { type: "moveX", amplitude, speed, baseX: p.x };
      } else if (type === "moveZ") {
        p.behavior = { type: "moveZ", amplitude, speed, baseZ: p.z };
      } else if (type === "moveY") {
        p.behavior = { type: "moveY", amplitude, speed, baseY: p.y };
      }
    }
  }
  return platforms;
}

// ---------- LEVEL BLUEPRINTS (NOW: LOTS MORE PLATFORMS) ----------
const LEVEL_LAYOUTS = [
  // LEVEL 0 — long friendly staircase (12 platforms)
  addGoal(stairPath({
    start: { x: 0, y: 0, z: 10 },
    steps: 12,
    dz: -3.4,
    dy: 0.78,
    xWiggle: 1.2,
    size: { w: 5.2, d: 5.2 },
  })),

  // LEVEL 1 — longer + introduces movement (14 platforms, move every 5th)
  (() => {
    const p = stairPath({
      start: { x: 0, y: 0, z: 10 },
      steps: 14,
      dz: -3.5,
      dy: 0.30,
      xWiggle: 1.4,
      size: { w: 4.6, d: 4.6 },
      thinEvery: 0,
    });
    movingEvery(p, 5, "moveX", 3.0, 1.25);
    return addGoal(p);
  })(),

  // LEVEL 2 — precision course (16 platforms, thin every 3rd)
  addGoal(stairPath({
    start: { x: 0, y: 0, z: 10 },
    steps: 16,
    dz: -3.6,
    dy: 0.34,
    xWiggle: 2.3,
    size: { w: 3.4, d: 3.8 },
    thinEvery: 3,
    thinSize: { w: 2.0, d: 5.2 },
  })),

  // LEVEL 3 — thin + moving mix (18 platforms, move every 4th; some moveZ)
  (() => {
    const p = stairPath({
      start: { x: 0, y: 0, z: 10 },
      steps: 18,
      dz: -3.7,
      dy: 0.36,
      xWiggle: 2.8,
      size: { w: 3.0, d: 3.4 },
      thinEvery: 2,
      thinSize: { w: 1.9, d: 5.0 },
    });
    movingEvery(p, 4, "moveX", 2.8, 1.55);
    movingEvery(p, 6, "moveZ", 2.2, 1.25);
    return addGoal(p);
  })(),

  // LEVEL 4 — tall climb (20 platforms, more vertical, some moveY)
  (() => {
    const p = stairPath({
      start: { x: 0, y: 0, z: 10 },
      steps: 20,
      dz: -3.5,
      dy: 0.45,      // taller
      xWiggle: 2.2,
      size: { w: 3.0, d: 3.0 },
      thinEvery: 4,
      thinSize: { w: 2.0, d: 4.2 },
    });
    movingEvery(p, 5, "moveX", 2.4, 1.6);
    movingEvery(p, 7, "moveY", 0.35, 1.8);
    return addGoal(p);
  })(),

  // LEVEL 5 — “gauntlet” (22 platforms, tight + lots of movement)
  (() => {
    const p = stairPath({
      start: { x: 0, y: 0, z: 10 },
      steps: 22,
      dz: -3.6,
      dy: 0.42,
      xWiggle: 3.4,
      size: { w: 2.7, d: 3.0 },
      thinEvery: 2,
      thinSize: { w: 1.8, d: 4.6 },
    });
    movingEvery(p, 3, "moveX", 2.6, 1.9);
    movingEvery(p, 4, "moveZ", 2.0, 1.6);
    movingEvery(p, 7, "moveY", 0.45, 2.1);
    return addGoal(p);
  })(),
];

// ---------- MOB SPAWNS per level (scaled up as levels increase) ----------
const MOB_SPAWNS = [
  // L0
  [
    { pos: [0, 0.9, 2], opts: { speed: 2.2, aggroRadius: 10, chaseDelay: 1.2 } },
    { pos: [1, 2.0, -8], opts: { speed: 2.5, aggroRadius: 10, chaseDelay: 1.5 } },
  ],
  // L1
  [
    { pos: [0, 1.2, 1], opts: { speed: 2.6, aggroRadius: 11, chaseDelay: 1.0 } },
    { pos: [-1.5, 2.3, -6], opts: { speed: 2.9, aggroRadius: 12, chaseDelay: 1.2 } },
    { pos: [1.5, 3.2, -12], opts: { speed: 3.1, aggroRadius: 12, chaseDelay: 1.5 } },
  ],
  // L2
  [
    { pos: [1.8, 1.2, 3], opts: { speed: 3.0, aggroRadius: 12, chaseDelay: 0.9 } },
    { pos: [-1.8, 2.3, -4], opts: { speed: 3.3, aggroRadius: 13, chaseDelay: 1.1 } },
    { pos: [0, 3.3, -10], opts: { speed: 3.5, aggroRadius: 13, chaseDelay: 1.3 } },
    { pos: [0.8, 4.0, -18], opts: { speed: 3.7, aggroRadius: 14, chaseDelay: 1.5 } },
  ],
  // L3
  [
    { pos: [0, 1.2, 4], opts: { speed: 3.4, aggroRadius: 13, chaseDelay: 0.8 } },
    { pos: [2.2, 2.6, -2], opts: { speed: 3.8, aggroRadius: 14, chaseDelay: 1.0 } },
    { pos: [-2.2, 3.8, -8], opts: { speed: 4.1, aggroRadius: 14, chaseDelay: 1.2 } },
    { pos: [0, 5.0, -16], opts: { speed: 4.3, aggroRadius: 15, chaseDelay: 1.4 } },
  ],
  // L4
  [
    { pos: [0, 1.2, 4], opts: { speed: 3.8, aggroRadius: 14, chaseDelay: 0.7 } },
    { pos: [-2.0, 3.0, -2], opts: { speed: 4.1, aggroRadius: 15, chaseDelay: 0.9 } },
    { pos: [2.0, 4.6, -10], opts: { speed: 4.4, aggroRadius: 15, chaseDelay: 1.1 } },
    { pos: [0, 6.5, -18], opts: { speed: 4.7, aggroRadius: 16, chaseDelay: 1.3 } },
    { pos: [0, 8.0, -26], opts: { speed: 5.0, aggroRadius: 16, chaseDelay: 1.5 } },
  ],
  // L5
  [
    { pos: [0, 1.2, 4], opts: { speed: 4.2, aggroRadius: 15, chaseDelay: 0.6 } },
    { pos: [2.6, 2.8, -1], opts: { speed: 4.6, aggroRadius: 16, chaseDelay: 0.8 } },
    { pos: [-2.6, 4.2, -7], opts: { speed: 5.0, aggroRadius: 16, chaseDelay: 1.0 } },
    { pos: [0, 5.8, -13], opts: { speed: 5.3, aggroRadius: 17, chaseDelay: 1.1 } },
    { pos: [2.0, 7.2, -19], opts: { speed: 5.6, aggroRadius: 17, chaseDelay: 1.3 } },
    { pos: [-2.0, 8.6, -25], opts: { speed: 6.0, aggroRadius: 18, chaseDelay: 1.5 } },
  ],
];

export function createLevel(levelIndex, scene, isPrototype, platforms, mobs, MobClass = Mob) {
  const idx = ((levelIndex % LEVEL_LAYOUTS.length) + LEVEL_LAYOUTS.length) % LEVEL_LAYOUTS.length;
  const layout = LEVEL_LAYOUTS[idx];

  let goalPlatform = null;

  for (const spec of layout) {
    const p = createPlatform(
      spec.x, spec.y, spec.z,
      spec.w, spec.d,
      scene, isPrototype,
      platforms,
      spec.behavior || null
    );
    if (spec.goal) goalPlatform = p;
  }

  if (goalPlatform) {
    addGoalFlag(goalPlatform.mesh.position, scene);
    scene.userData.goalPlatform = goalPlatform;
  } else {
    scene.userData.goalPlatform = null;
  }

  const spawns = MOB_SPAWNS[idx] || [];
  for (const s of spawns) {
    mobs.push(new MobClass(new THREE.Vector3(...s.pos), s.opts || {}, scene));
  }
}

export function clearLevel(scene, platforms, mobs, projectiles) {
  platforms.forEach(p => scene.remove(p.mesh));
  platforms.length = 0;

  mobs.forEach(m => m.destroy());
  mobs.length = 0;

  projectiles.forEach(p => scene.remove(p.mesh));
  projectiles.length = 0;

  if (scene.userData.goalFlag) {
    scene.remove(scene.userData.goalFlag);
    scene.userData.goalFlag = null;
  }
  scene.userData.goalPlatform = null;
}

export function updatePlatforms(platforms, delta) {
  const t = performance.now() * 0.001;

  for (const p of platforms) {
    if (p.behavior) {
      const b = p.behavior;

      if (b.type === "moveX") {
        p.mesh.position.x =
          (b.baseX ?? p.mesh.position.x) +
          Math.sin(t * b.speed + p.timeOffset) * b.amplitude;
      } else if (b.type === "moveZ") {
        p.mesh.position.z =
          (b.baseZ ?? p.mesh.position.z) +
          Math.sin(t * b.speed + p.timeOffset) * b.amplitude;
      } else if (b.type === "moveY") {
        p.mesh.position.y =
          (b.baseY ?? p.mesh.position.y) +
          Math.sin(t * b.speed + p.timeOffset) * b.amplitude;
      }
    }

    p.boundingBox.setFromObject(p.mesh);
  }
}

function createPlatform(x, y, z, width, depth, scene, isPrototype, platforms, behavior = null) {
  const geom = new THREE.BoxGeometry(width, 0.5, depth);
  const matPrototype = new THREE.MeshStandardMaterial({ color: 0xcccccc });
  const matFull = new THREE.MeshStandardMaterial({
    color: 0x00aaff,
    emissive: 0x002244,
    metalness: 0.4,
    roughness: 0.4,
  });

  const mesh = new THREE.Mesh(geom, isPrototype ? matPrototype : matFull);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const platform = {
    mesh,
    boundingBox: new THREE.Box3().setFromObject(mesh),
    matPrototype,
    matFull,
    behavior,
    timeOffset: Math.random() * Math.PI * 2,
  };

  platforms.push(platform);
  return platform;
}

function addGoalFlag(position, scene) {
  const flagGeom = new THREE.BoxGeometry(0.2, 3, 0.2);
  const flagMat = new THREE.MeshStandardMaterial({ color: 0xffff00 });
  const flag = new THREE.Mesh(flagGeom, flagMat);
  flag.position.copy(position);
  flag.position.y += 2;
  scene.add(flag);
  scene.userData.goalFlag = flag;
}
