// ======= GLOBALS =======
let scene, camera, renderer;
let clock;
let player;
let platforms = [];
let mobs = [];
let projectiles = [];
let currentLevel = 0;
let isPrototype = true;
let chosenWeapon = "laser";

let score = 0;

const keys = {
  ArrowLeft: false,
  ArrowRight: false,
  ArrowUp: false,
  ArrowDown: false,
  KeyA: false,
  KeyD: false,
  KeyW: false,
  KeyS: false,
  Space: false,
};

let canJump = false;
let gravity = -25;

// ======= UTILS =======

function setInfo(msg) {
  const info = document.getElementById("info");
  if (info) info.textContent = msg;
}

function setScore(newScore) {
  score = newScore;
  const span = document.getElementById("score");
  if (span) span.textContent = score;
}

// ======= CLASSES =======

class Player {
  constructor() {
    this.speed = 10;
    this.jumpStrength = 12;
    this.velocity = new THREE.Vector3(0, 0, 0);

    // Single shared materials (prototype vs full)
    this.materialPrototype = new THREE.MeshStandardMaterial({ color: 0x00ccff });
    this.materialFull = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x004444,
      metalness: 0.5,
      roughness: 0.2,
    });

    // Build a cool blocky avatar (Roblox-ish)
    this.mesh = new THREE.Group();

    // Body parts (simple proportions)
    const bodyGeom = new THREE.BoxGeometry(1.4, 1.8, 0.7);
    const headGeom = new THREE.BoxGeometry(1.0, 1.0, 1.0);
    const armGeom = new THREE.BoxGeometry(0.4, 1.4, 0.4);
    const legGeom = new THREE.BoxGeometry(0.5, 1.5, 0.5);

    const body = new THREE.Mesh(bodyGeom, this.materialPrototype);
    body.position.set(0, 1.3, 0);
    body.castShadow = true;
    body.receiveShadow = true;

    const head = new THREE.Mesh(headGeom, this.materialPrototype);
    head.position.set(0, 2.5, 0);
    head.castShadow = true;

    // Simple "face" by slightly different color on front (extra mesh)
    const faceGeom = new THREE.PlaneGeometry(0.8, 0.8);
    const faceMat = new THREE.MeshStandardMaterial({
      color: 0xffe0bd,
      metalness: 0,
      roughness: 1,
    });
    const face = new THREE.Mesh(faceGeom, faceMat);
    face.position.set(0, 0, 0.51);
    head.add(face);

    const armL = new THREE.Mesh(armGeom, this.materialPrototype);
    armL.position.set(-0.95, 1.3, 0);
    armL.castShadow = true;

    const armR = new THREE.Mesh(armGeom, this.materialPrototype);
    armR.position.set(0.95, 1.3, 0);
    armR.castShadow = true;

    const legL = new THREE.Mesh(legGeom, this.materialPrototype);
    legL.position.set(-0.4, 0.1, 0);
    legL.castShadow = true;

    const legR = new THREE.Mesh(legGeom, this.materialPrototype);
    legR.position.set(0.4, 0.1, 0);
    legR.castShadow = true;

    this.mesh.add(body, head, armL, armR, legL, legR);
    this.mesh.position.set(0, 0, 10);
    scene.add(this.mesh);

    this.weapon = null;
    this.weaponMesh = null;
  }

  setMode(prototypeMode) {
    // swap materials on all body meshes
    this.mesh.traverse(obj => {
      if (obj.isMesh && obj !== this.weaponMesh) {
        obj.material = prototypeMode
          ? this.materialPrototype
          : this.materialFull;
      }
    });
    // weapon visuals remain with their own colors
  }

  setWeapon(weaponName, weaponLogic) {
    // remove old logic
    this.weapon = weaponLogic;

    // remove old weapon mesh
    if (this.weaponMesh) {
      this.mesh.remove(this.weaponMesh);
      this.weaponMesh = null;
    }

    // create new weapon mesh
    this.weaponMesh = createWeaponMesh(weaponName);
    if (this.weaponMesh) {
      // position weapon in right hand (approx)
      this.weaponMesh.position.set(0.9, 1.3, 0.4);
      this.mesh.add(this.weaponMesh);
    }
  }

  update(delta) {
    // Horizontal movement
    const moveX =
      (keys.KeyD || keys.ArrowRight ? 1 : 0) -
      (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    const moveZ =
      (keys.KeyS || keys.ArrowDown ? 1 : 0) -
      (keys.KeyW || keys.ArrowUp ? 1 : 0);

    const moveDir = new THREE.Vector3(moveX, 0, moveZ);
    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      this.mesh.position.x += moveDir.x * this.speed * delta;
      this.mesh.position.z += moveDir.z * this.speed * delta;
    }

    // Gravity
    this.velocity.y += gravity * delta;
    this.mesh.position.y += this.velocity.y * delta;

    // Collision with platforms (AABB)
    canJump = false;
    const playerBox = new THREE.Box3().setFromObject(this.mesh);

    for (const p of platforms) {
      if (!p.boundingBox) continue;
      if (playerBox.intersectsBox(p.boundingBox)) {
        const platTop = p.boundingBox.max.y;
        const playerHeight = playerBox.max.y - playerBox.min.y;
        this.mesh.position.y = platTop + playerHeight / 2 + 0.01;
        this.velocity.y = 0;
        canJump = true;
      }
    }

    if (this.mesh.position.y < -10) {
      resetLevel("You fell!");
    }
  }

  jump() {
    if (canJump) {
      this.velocity.y = this.jumpStrength;
      canJump = false;
    }
  }

  attack() {
    if (this.weapon) {
      this.weapon.attack();
    }
  }
}

// Scary-ish blocky mob with glowing eyes & horns
class Mob {
  constructor(position) {
    this.materialPrototype = new THREE.MeshStandardMaterial({ color: 0x880000 });
    this.materialFull = new THREE.MeshStandardMaterial({
      color: 0xaa0000,
      emissive: 0x330000,
      metalness: 0.6,
      roughness: 0.4,
    });

    this.mesh = new THREE.Group();

    const bodyGeom = new THREE.BoxGeometry(1.4, 1.8, 1.0);
    const body = new THREE.Mesh(bodyGeom, this.materialPrototype);
    body.castShadow = true;
    body.receiveShadow = true;
    body.position.set(0, 0.9, 0);

    // head
    const headGeom = new THREE.BoxGeometry(1.0, 1.0, 1.0);
    const head = new THREE.Mesh(headGeom, this.materialPrototype);
    head.position.set(0, 2.0, 0);
    head.castShadow = true;

    // glowing eyes
    const eyeGeom = new THREE.BoxGeometry(0.2, 0.2, 0.1);
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      metalness: 0,
      roughness: 0.5,
    });
    const eyeL = new THREE.Mesh(eyeGeom, eyeMat);
    const eyeR = new THREE.Mesh(eyeGeom, eyeMat);
    eyeL.position.set(-0.25, 0.1, 0.51);
    eyeR.position.set(0.25, 0.1, 0.51);
    head.add(eyeL, eyeR);

    // little horns
    const hornGeom = new THREE.BoxGeometry(0.2, 0.4, 0.2);
    const hornMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const hornL = new THREE.Mesh(hornGeom, hornMat);
    const hornR = new THREE.Mesh(hornGeom, hornMat);
    hornL.position.set(-0.3, 0.5, -0.1);
    hornR.position.set(0.3, 0.5, -0.1);
    head.add(hornL, hornR);

    this.mesh.add(body, head);
    this.mesh.position.copy(position);
    this.mesh.castShadow = true;
    scene.add(this.mesh);

    this.speed = 4;
  }

  setMode(prototypeMode) {
    const mat = prototypeMode ? this.materialPrototype : this.materialFull;
    this.mesh.traverse(obj => {
      if (obj.isMesh && obj.material === this.materialPrototype || obj.material === this.materialFull) {
        obj.material = mat;
      }
    });
  }

  update(delta) {
    if (!player) return;
    const dir = new THREE.Vector3()
      .subVectors(player.mesh.position, this.mesh.position);
    dir.y = 0;
    const dist = dir.length();
    if (dist > 0.1) {
      dir.normalize();
      this.mesh.position.addScaledVector(dir, this.speed * delta);
    }

    // slight bobbing
    this.mesh.position.y += Math.sin(performance.now() * 0.005) * 0.002;

    // collision with player
    const mobBox = new THREE.Box3().setFromObject(this.mesh);
    const playerBox = new THREE.Box3().setFromObject(player.mesh);
    if (mobBox.intersectsBox(playerBox)) {
      resetLevel("You were caught by a mob!");
    }
  }

  destroy() {
    scene.remove(this.mesh);
  }
}

// ===== WEAPON VISUALS =====

function createWeaponMesh(type) {
  const group = new THREE.Group();
  let mesh;

  if (type === "laser") {
    // blocky gun
    const bodyGeom = new THREE.BoxGeometry(0.8, 0.4, 1.2);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.7,
      roughness: 0.3,
      emissive: 0x111111,
    });
    mesh = new THREE.Mesh(bodyGeom, bodyMat);
    mesh.position.set(0, 0, 0);
    mesh.castShadow = true;
    group.add(mesh);

    const tipGeom = new THREE.BoxGeometry(0.3, 0.3, 0.6);
    const tipMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00ffff,
      metalness: 0.9,
      roughness: 0.1,
    });
    const tip = new THREE.Mesh(tipGeom, tipMat);
    tip.position.set(0, 0, -0.9);
    group.add(tip);
  } else if (type === "sword") {
    // simple blade + handle
    const bladeGeom = new THREE.BoxGeometry(0.2, 1.6, 0.2);
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xdddddd,
      metalness: 0.9,
      roughness: 0.2,
    });
    const blade = new THREE.Mesh(bladeGeom, bladeMat);
    blade.position.set(0, 0.8, 0);
    blade.castShadow = true;

    const hiltGeom = new THREE.BoxGeometry(0.4, 0.2, 0.3);
    const hiltMat = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.6,
      roughness: 0.3,
    });
    const hilt = new THREE.Mesh(hiltGeom, hiltMat);
    hilt.position.set(0, 0.1, 0);
    hilt.castShadow = true;

    group.add(blade, hilt);
  } else if (type === "orb") {
    // glowing orb in hand
    const orbGeom = new THREE.SphereGeometry(0.4, 12, 12);
    const orbMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff8800,
      metalness: 0.8,
      roughness: 0.3,
    });
    mesh = new THREE.Mesh(orbGeom, orbMat);
    mesh.castShadow = true;
    group.add(mesh);
  }

  return group;
}

// ===== WEAPON LOGIC =====

// 1) Laser: vertical column along -Z
class LaserWeapon {
  constructor(player) {
    this.player = player;
    this.cooldown = 0.25;
    this.lastShotTime = 0;
  }

  attack() {
    const now = performance.now() / 1000;
    if (now - this.lastShotTime < this.cooldown) return;
    this.lastShotTime = now;

    const basePos = this.player.mesh.position.clone();
    const direction = new THREE.Vector3(0, 0, -1);
    const raycaster = new THREE.Raycaster();
    const mobMeshes = mobs.map(m => m.mesh);

    let hitMob = null;

    // multiple heights to hit ground + flying mobs
    const heights = [0.8, 1.6, 2.4, 3.2];
    for (let h of heights) {
      const origin = basePos.clone();
      origin.y = h;
      raycaster.set(origin, direction);
      const intersects = raycaster.intersectObjects(mobMeshes);
      if (intersects.length > 0) {
        hitMob = intersects[0].object;
        break;
      }
    }

    if (hitMob) {
      const mob = mobs.find(m => m.mesh === hitMob);
      if (mob) {
        mob.destroy();
        mobs = mobs.filter(m => m !== mob);
        setInfo("Laser hit a mob!");
        setScore(score + 10);
      }
    }

    // visualize beam
    const originViz = basePos.clone();
    originViz.y = 1.6;
    const lineMat = new THREE.LineBasicMaterial({ color: 0x00ffff });
    const points = [];
    points.push(originViz);
    points.push(originViz.clone().addScaledVector(direction, 20));
    const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(lineGeom, lineMat);
    scene.add(line);
    setTimeout(() => {
      scene.remove(line);
      lineGeom.dispose();
      lineMat.dispose();
    }, 100);
  }
}

// 2) Sword: close range radial slash
class SwordWeapon {
  constructor(player) {
    this.player = player;
    this.cooldown = 0.4;
    this.lastSwingTime = 0;
    this.range = 2.0;
  }

  attack() {
    const now = performance.now() / 1000;
    if (now - this.lastSwingTime < this.cooldown) return;
    this.lastSwingTime = now;

    let killed = 0;
    const pPos = this.player.mesh.position;
    mobs = mobs.filter(m => {
      const dist = m.mesh.position.distanceTo(pPos);
      if (dist <= this.range) {
        m.destroy();
        killed++;
        return false;
      }
      return true;
    });

    if (killed > 0) {
      setInfo(`Sword slash! Killed ${killed} mob(s).`);
      setScore(score + killed * 15);
    } else {
      setInfo("Sword swing missed.");
    }
  }
}

// 3) Orb: thrown projectile that explodes
class OrbWeapon {
  constructor(player) {
    this.player = player;
    this.cooldown = 0.8;
    this.lastThrowTime = 0;
  }

  attack() {
    const now = performance.now() / 1000;
    if (now - this.lastThrowTime < this.cooldown) return;
    this.lastThrowTime = now;

    const geom = new THREE.SphereGeometry(0.3, 10, 10);
    const matPrototype = new THREE.MeshStandardMaterial({ color: 0xffaa00 });
    const matFull = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff6600,
      metalness: 0.7,
      roughness: 0.2,
    });

    const orbMesh = new THREE.Mesh(
      geom,
      isPrototype ? matPrototype : matFull
    );
    const startPos = this.player.mesh.position.clone();
    startPos.y += 1.5;
    orbMesh.position.copy(startPos);
    orbMesh.castShadow = true;
    scene.add(orbMesh);

    const velocity = new THREE.Vector3(0, 0, -15);

    projectiles.push({
      mesh: orbMesh,
      velocity,
      lifetime: 2.0,
      explosionRadius: 2.5,
      matPrototype,
      matFull,
    });
  }
}

// ======= INITIALIZATION =======

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb); // sky

  clock = new THREE.Clock();

  const aspect = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
  camera.position.set(0, 10, 25);
  camera.lookAt(0, 2, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.7);
  hemiLight.position.set(0, 50, 0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
  dirLight.position.set(10, 20, 10);
  dirLight.castShadow = true;
  scene.add(dirLight);

  // ground (just visual)
  const groundGeom = new THREE.PlaneGeometry(200, 200);
  const groundMatPrototype = new THREE.MeshStandardMaterial({
    color: 0xdddddd,
  });
  const groundMatFull = new THREE.MeshStandardMaterial({
    color: 0x999999,
    metalness: 0.3,
    roughness: 0.7,
  });
  const ground = new THREE.Mesh(
    groundGeom,
    isPrototype ? groundMatPrototype : groundMatFull
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2;
  ground.receiveShadow = true;
  scene.add(ground);
  ground.materialPrototype = groundMatPrototype;
  ground.materialFull = groundMatFull;
  scene.userData.ground = ground;

  player = new Player();
  player.setWeapon("laser", new LaserWeapon(player));

  createLevel(currentLevel);
  setupUI();

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("resize", onWindowResize);
  window.addEventListener("click", () => {
    player.attack();
  });

  setScore(0);
  animate();
}

// ======= LEVELS =======

function createPlatform(x, y, z, width = 4, depth = 4, behavior = null) {
  const geom = new THREE.BoxGeometry(width, 0.5, depth);
  const matPrototype = new THREE.MeshStandardMaterial({ color: 0xcccccc });
  const matFull = new THREE.MeshStandardMaterial({
    color: 0x00aaff,
    emissive: 0x002244,
    metalness: 0.4,
    roughness: 0.4,
  });
  const mesh = new THREE.Mesh(
    geom,
    isPrototype ? matPrototype : matFull
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const platform = {
    mesh,
    boundingBox: new THREE.Box3(),
    matPrototype,
    matFull,
    behavior,
    timeOffset: Math.random() * Math.PI * 2,
  };
  platform.boundingBox.setFromObject(mesh);
  platforms.push(platform);
  return platform;
}

function addGoalFlag(position) {
  const flagGeom = new THREE.BoxGeometry(0.2, 3, 0.2);
  const flagMat = new THREE.MeshStandardMaterial({ color: 0xffff00 });
  const flag = new THREE.Mesh(flagGeom, flagMat);
  flag.position.copy(position);
  flag.position.y += 2;
  scene.add(flag);
  scene.userData.goalFlag = flag;
}

function createLevel(levelIndex) {
  clearLevel();

  // start platform under player
  createPlatform(0, 0, 10, 6, 6);

  if (levelIndex === 0) {
    createPlatform(0, 0, 5, 4, 4);
    createPlatform(2, 1, 0, 3, 3);
    createPlatform(-2, 2, -5, 3, 3);
    const goalPlatform = createPlatform(0, 3, -10, 6, 6);

    // Level 0 – mobs are further into the obby & start slower
mobs.push(new Mob(
  new THREE.Vector3(0, 0.9, 0),
  { speed: 2.2, aggroRadius: 10, chaseDelay: 1.2 }
));
mobs.push(new Mob(
  new THREE.Vector3(-2, 2.0, -5),
  { speed: 2.5, aggroRadius: 10, chaseDelay: 1.5 }
));


    addGoalFlag(goalPlatform.mesh.position);
    scene.userData.goalPlatform = goalPlatform;
  } else if (levelIndex === 1) {
    // moving platform level
    createPlatform(0, 0, 5, 4, 4);
    const moving = createPlatform(0, 1.5, 0, 4, 4, {
      type: "moveX",
      amplitude: 3,
      speed: 1.5,
      baseX: 0,
    });
    createPlatform(-3, 2.5, -5, 3, 3);
    const goalPlatform = createPlatform(0, 3.5, -10, 6, 6);

    mobs.push(new Mob(new THREE.Vector3(0, 1.7, 0)));
    mobs.push(new Mob(new THREE.Vector3(-3, 2.7, -5)));
    mobs.push(new Mob(new THREE.Vector3(0, 3.7, -9)));

    addGoalFlag(goalPlatform.mesh.position);
    scene.userData.goalPlatform = goalPlatform;
  } else {
    // loop for now
    currentLevel = 0;
    createLevel(0);
    return;
  }

  setInfo(`Level ${levelIndex + 1} started.`);
}

function clearLevel() {
  platforms.forEach(p => scene.remove(p.mesh));
  platforms = [];

  mobs.forEach(m => m.destroy());
  mobs = [];

  projectiles.forEach(p => scene.remove(p.mesh));
  projectiles = [];

  if (scene.userData.goalFlag) {
    scene.remove(scene.userData.goalFlag);
    scene.userData.goalFlag = null;
  }
  scene.userData.goalPlatform = null;
}

function resetLevel(message) {
  setInfo(message || "Restarting level...");
  player.mesh.position.set(0, 0, 10);
  player.velocity.set(0, 0, 0);
  createLevel(currentLevel);
}

// ======= UPDATERS =======

function updatePlatforms(delta) {
  const t = performance.now() * 0.001;
  for (const p of platforms) {
    if (p.behavior && p.behavior.type === "moveX") {
      p.mesh.position.x =
        p.behavior.baseX +
        Math.sin(t * p.behavior.speed + p.timeOffset) * p.behavior.amplitude;
    }
    p.boundingBox.setFromObject(p.mesh);
  }
}

function updateProjectiles(delta) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const proj = projectiles[i];
    proj.lifetime -= delta;
    proj.mesh.position.addScaledVector(proj.velocity, delta);

    if (proj.lifetime <= 0) {
      const center = proj.mesh.position.clone();
      let killed = 0;
      mobs = mobs.filter(m => {
        const dist = m.mesh.position.distanceTo(center);
        if (dist <= proj.explosionRadius) {
          m.destroy();
          killed++;
          return false;
        }
        return true;
      });
      if (killed > 0) {
        setInfo(`Orb exploded! Killed ${killed} mob(s).`);
        setScore(score + killed * 20);
      }
      scene.remove(proj.mesh);
      projectiles.splice(i, 1);
    }
  }
}

// ======= UI / EVENTS =======

function setupUI() {
  const prototypeBtn = document.getElementById("prototypeBtn");
  const fullBtn = document.getElementById("fullBtn");
  const startLevelBtn = document.getElementById("startLevelBtn");

  prototypeBtn.onclick = () => {
    isPrototype = true;
    prototypeBtn.style.background = "#3c6";
    fullBtn.style.background = "#222";
    switchMode(true);
    setInfo("Prototype mode: primitives, no fancy textures.");
  };

  fullBtn.onclick = () => {
    isPrototype = false;
    fullBtn.style.background = "#3c6";
    prototypeBtn.style.background = "#222";
    switchMode(false);
    setInfo("Full mode: shiny emissive materials (textures later).");
  };

  startLevelBtn.onclick = () => {
    resetLevel("Level restarted.");
  };

  const weaponButtons = document.querySelectorAll("#weaponSelect button");
  weaponButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      weaponButtons.forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      chosenWeapon = btn.dataset.weapon;

      if (chosenWeapon === "laser") {
        player.setWeapon("laser", new LaserWeapon(player));
        setInfo("Laser equipped.");
      } else if (chosenWeapon === "sword") {
        player.setWeapon("sword", new SwordWeapon(player));
        setInfo("Sword equipped.");
      } else if (chosenWeapon === "orb") {
        player.setWeapon("orb", new OrbWeapon(player));
        setInfo("Explosive orb equipped.");
      }
    });
  });

  // Mobile controls
  const btnLeft = document.getElementById("leftBtn");
  const btnRight = document.getElementById("rightBtn");
  const btnForward = document.getElementById("forwardBtn");
  const btnBackward = document.getElementById("backwardBtn");
  const btnJump = document.getElementById("jumpBtn");

  function bindMobile(btn, keyCode) {
    btn.addEventListener("pointerdown", () => {
      keys[keyCode] = true;
    });
    btn.addEventListener("pointerup", () => {
      keys[keyCode] = false;
    });
    btn.addEventListener("pointerleave", () => {
      keys[keyCode] = false;
    });
  }

  bindMobile(btnLeft, "KeyA");
  bindMobile(btnRight, "KeyD");
  bindMobile(btnForward, "KeyW");
  bindMobile(btnBackward, "KeyS");
  btnJump.addEventListener("pointerdown", () => {
    player.jump();
  });
}

function switchMode(prototypeMode) {
  player.setMode(prototypeMode);

  platforms.forEach(p => {
    p.mesh.material = prototypeMode ? p.matPrototype : p.matFull;
  });

  mobs.forEach(m => m.setMode(prototypeMode));

  const ground = scene.userData.ground;
  if (ground) {
    ground.material = prototypeMode
      ? ground.materialPrototype
      : ground.materialFull;
  }

  projectiles.forEach(pr => {
    pr.mesh.material = prototypeMode ? pr.matPrototype : pr.matFull;
  });
}

function onKeyDown(e) {
  if (keys.hasOwnProperty(e.code)) {
    keys[e.code] = true;
  }
  if (e.code === "Space") {
    player.jump();
  }
  if (e.code === "KeyF") {
    player.attack();
  }
}

function onKeyUp(e) {
  if (keys.hasOwnProperty(e.code)) {
    keys[e.code] = false;
  }
}

function onWindowResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

// ======= MAIN LOOP =======

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  updatePlatforms(delta);
  updateProjectiles(delta);

  if (player) {
    player.update(delta);
  }

  for (const m of mobs) {
    m.update(delta);
  }

  // camera follow
  if (player) {
    const targetPos = player.mesh.position.clone().add(new THREE.Vector3(0, 10, 15));
    camera.position.lerp(targetPos, 0.1);
    camera.lookAt(player.mesh.position);
  }

  // goal check
  if (scene.userData.goalPlatform && player) {
    const playerBox = new THREE.Box3().setFromObject(player.mesh);
    const goalBox = scene.userData.goalPlatform.boundingBox;
    if (goalBox && playerBox.intersectsBox(goalBox)) {
      setInfo("Goal reached! Next level + bonus score.");
      setScore(score + 50);
      currentLevel++;
      player.mesh.position.set(0, 0, 10);
      player.velocity.set(0, 0, 0);
      createLevel(currentLevel);
    }
  }

  renderer.render(scene, camera);
}

// Start
init();

