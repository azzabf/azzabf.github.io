(() => {
  const mount = document.getElementById("game");

  const levelEl = document.getElementById("level");
  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");
  const msgEl = document.getElementById("message");
  const restartHintEl = document.getElementById("restartHint");
const startScreenEl = document.getElementById("startScreen");
const startModeEl = document.getElementById("startMode");
const startAvatarEl = document.getElementById("startAvatar");
const startBtnEl = document.getElementById("startBtn");

  const setMessage = (text, ms = 0) => {
    if (!text) {
      msgEl.style.display = "none";
      msgEl.textContent = "";
      return;
    }
    msgEl.textContent = text;
    msgEl.style.display = "block";
    if (ms > 0) setTimeout(() => setMessage(""), ms);
  };

  // Scene setup
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 50, 200);

  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );



const texLoader = new THREE.TextureLoader();

function loadImageTexture(path) {
  const t = texLoader.load(path);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.repeat.set(1, 1);
  t.offset.set(0, 0);
  return t;
}


// Box: put the image ONLY on the front face so it’s centered & not duplicated
function makeBoxFrontFaceMaterial(imagePath, fallbackColor = 0x00ff00) {
  const tex = loadImageTexture(imagePath);

  // Order for BoxGeometry materials: +X, -X, +Y, -Y, +Z, -Z
  // Front face is usually +Z in Three’s default UVs.
  const side = new THREE.MeshStandardMaterial({ color: fallbackColor, emissive: 0x001010, emissiveIntensity: 0.2 });
  const front = new THREE.MeshStandardMaterial({
    map: tex,
    color: 0xffffff,
    emissive: 0x001a1a,
    emissiveIntensity: 0.35,
    roughness: 0.65,
    metalness: 0.05
  });

// +X, -X, +Y, -Y, +Z, -Z
return [side, side, side, side, side, front];


}
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  mount.appendChild(renderer.domElement);

// ===== Camera orbit controls (RIGHT mouse drag + wheel zoom) =====
let camYaw = 0;           // left/right
let camPitch = 0.35;      // up/down
let camDist = 14;         // zoom distance
const CAM_TARGET_OFFSET = new THREE.Vector3(0, 1.6, 0);

const CAM_PITCH_MIN = -0.1;
const CAM_PITCH_MAX = 1.2;
const CAM_DIST_MIN = 4;
const CAM_DIST_MAX = 30;

let camDragging = false;
let camLastX = 0, camLastY = 0;

// right click drag rotates camera (keeps left click free for shooting)
renderer.domElement.addEventListener("pointerdown", (e) => {
  if (e.button !== 2) return; // right button only
  camDragging = true;
  camLastX = e.clientX;
  camLastY = e.clientY;
  renderer.domElement.setPointerCapture?.(e.pointerId);
  e.preventDefault();
}, { passive: false });

renderer.domElement.addEventListener("pointerup", (e) => {
  if (e.button !== 2) return;
  camDragging = false;
  renderer.domElement.releasePointerCapture?.(e.pointerId);
}, { passive: true });

// wheel zoom
renderer.domElement.addEventListener("wheel", (e) => {
  e.preventDefault();
  camDist += e.deltaY * 0.01;
  camDist = Math.max(CAM_DIST_MIN, Math.min(CAM_DIST_MAX, camDist));
}, { passive: false });
// ===============================================================



  // Lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(10, 20, 10);
  dirLight.castShadow = true;
  dirLight.shadow.camera.left = -50;
  dirLight.shadow.camera.right = 50;
  dirLight.shadow.camera.top = 50;
  dirLight.shadow.camera.bottom = -50;
  scene.add(dirLight);

  function applyCyberTheme(isFull) {
  if (isFull) {
    scene.background = new THREE.Color(0x040414);
    scene.fog = new THREE.Fog(0x040414, 25, 140);

    // Make lighting neon-ish
    dirLight.intensity = 0.9;
    dirLight.color = new THREE.Color(0x88ffff);

    // Add two colored point lights (once)
    if (!scene.__cyberLightsAdded) {
      const p1 = new THREE.PointLight(0x00ffff, 1.4, 120);
      p1.position.set(10, 18, 8);
      scene.add(p1);

      const p2 = new THREE.PointLight(0xff00ff, 1.2, 120);
      p2.position.set(-12, 16, -6);
      scene.add(p2);

      scene.__cyberLightsAdded = true;
    }
  } else {
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 50, 200);
    dirLight.intensity = 0.8;
    dirLight.color = new THREE.Color(0xffffff);
  }
}

  // Game state
  let currentLevel = 1;
  let currentLives = 3;
  let currentScore = 0;
  let isGameOver = false;
  let gameStarted = false;

  const updateHud = () => {
    levelEl.textContent = String(currentLevel);
    scoreEl.textContent = String(currentScore);
    livesEl.textContent = String(currentLives);
    restartHintEl.style.display = isGameOver ? "block" : "none";
  };

  // Player (will be replaced by avatar system)
  const playerGeometry = new THREE.BoxGeometry(1, 2, 1);
  const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
  const player = new THREE.Mesh(playerGeometry, playerMaterial);
  player.castShadow = true;
  player.position.set(0, 2, 0);
  scene.add(player);

  const playerVelocity = { x: 0, y: 0, z: 0 };
  const gravity = -0.02;
  const jumpPower = 0.5;
  const moveSpeed = 0.15;
  let isGrounded = false;
  let canJump = true;

  // Projectiles
  const projectiles = [];
  const projectileSpeed = 0.8;

  // Input (keyboard)
  const keys = Object.create(null);

  function onKeyDown(e) {
    keys[e.code] = true;
    if (e.code === "Space") e.preventDefault();
  }
  function onKeyUp(e) {
    keys[e.code] = false;
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", () => {
    for (const k in keys) keys[k] = false;
  });

  // ===== Mouse aim shooting (robust pointer events) =====
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let wantsShoot = false;

  function updateMouseFromEvent(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
  }

  renderer.domElement.style.pointerEvents = "auto";
  renderer.domElement.style.cursor = "crosshair";

  renderer.domElement.addEventListener("pointermove", (e) => {
  updateMouseFromEvent(e);

  if (camDragging) {
    const dx = e.clientX - camLastX;
    const dy = e.clientY - camLastY;
    camLastX = e.clientX;
    camLastY = e.clientY;

    const ROT_SPEED = 0.005;
    camYaw   -= dx * ROT_SPEED;
    camPitch -= dy * ROT_SPEED;

    camPitch = Math.max(CAM_PITCH_MIN, Math.min(CAM_PITCH_MAX, camPitch));
  }
}, { passive: true });

  renderer.domElement.addEventListener(
    "pointerdown",
    (e) => {
      if (e.button !== 0) return; // left click only
      updateMouseFromEvent(e);
      wantsShoot = true;
      e.preventDefault();
    },
    { passive: false }
  );

  renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());

  // Platforms
  const platforms = [];
  const createPlatform = (
    x, y, z,
    width, depth,
    color = 0x8b4513,
    moving = false,
    moveRange = 0,
    moveAxis = "x"
  ) => {
    const geometry = new THREE.BoxGeometry(width, 0.5, depth);
    const material = new THREE.MeshStandardMaterial({ color });
    const platform = new THREE.Mesh(geometry, material);
    platform.position.set(x, y, z);
    platform.receiveShadow = true;
    platform.castShadow = true;

    const platformData = {
      mesh: platform,
      width,
      depth,
      moving,
      moveRange,
      moveAxis,
      startPos: { x, y, z },
      direction: 1
    };

    platforms.push(platformData);
    scene.add(platform);
    return platformData;
  };

  // Goal platform
  let goalPlatform = null;

  // Enemies
  const enemies = [];
  const createEnemy = (x, y, z, speed = 0.05) => {
    const geometry = new THREE.SphereGeometry(0.7, 16, 16);
    const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const enemy = new THREE.Mesh(geometry, material);
    enemy.position.set(x, y, z);
    enemy.castShadow = true;

    const enemyData = { mesh: enemy, speed, health: 2 };
    enemies.push(enemyData);
    scene.add(enemy);
    return enemyData;
  };

  // ===== Mode + Character System (Prototype vs Full + animals/things) =====
  let isFullMode = false;
  let avatarIndex = 0;
  const avatars = ["box", "sphere", "cone", "cylinder"];

  function makePatternTexture(bg = "#18ff6a", stripe = "#0a7") {
    const c = document.createElement("canvas");
    c.width = 64; c.height = 64;
    const ctx = c.getContext("2d");

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 64, 64);

    ctx.strokeStyle = stripe;
    ctx.lineWidth = 10;
    for (let i = -64; i <= 128; i += 20) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 64, 64);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1.5, 1.5);
    tex.needsUpdate = true;
    return tex;
  }

  const avatarDefs = {
    box: {
      geo: () => new THREE.BoxGeometry(1, 2, 1),
      color: 0x00ff00,
      tex: () => loadImageTexture("assets/textures/cat.png")
    },
    sphere: {
  geo: () => new THREE.SphereGeometry(1, 18, 18),
  color: 0xff66cc,
  tex: () => {
    const t = loadImageTexture("assets/textures/rat.jpg");
    t.offset.x = 0.25; // try 0.0, 0.25, 0.5, 0.75
    return t;
  }
},
cylinder: {
  geo: () => new THREE.CylinderGeometry(0.8, 0.8, 2, 18),
  color: 0x66ccff,
  tex: () => {
    const t = loadImageTexture("assets/textures/cutiepatootie.jpg");
    t.offset.x = 0.25; // adjust as needed
    return t;
  }}}


  function setPlayerAvatar(type) {
    const def = avatarDefs[type] || avatarDefs.box;

    // Dispose old stuff (prevents memory leaks)
    if (player.geometry) player.geometry.dispose();

    const disposeMat = (m) => {

      if(!m) return;
      if (m.map) m.map.dispose();
      m.dispose();
    };

    if (player.material) {
      if (Array.isArray(player.material)) {
        player.material.forEach(disposeMat);
      } else {
        disposeMat(player.material);
      }
    }

    player.geometry = def.geo();

    if (!isFullMode) {
  // Prototype: flat color, no textures
  player.material = new THREE.MeshStandardMaterial({ color: def.color });
} else {
  // Full: cyber vibe + textures
  if (type === "box") {
    // “Face centered on front” for the human
    player.material = makeBoxFrontFaceMaterial("assets/textures/cat.png", def.color);
  } else {
    // For non-box shapes: just map the image normally
    player.material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: def.tex(),         // (you’ll set these paths per avatar)
      emissive: 0x001a1a,
      emissiveIntensity: 0.35,
      roughness: 0.55,
      metalness: 0.1
    });
  }
}


    player.castShadow = true;
  }

  function applyMode(full) {
  isFullMode = !!full;              // ✅ set the state FIRST
  applyCyberTheme(isFullMode);      // ✅ apply cyber based on the NEW state

  if (isFullMode) {
    for (const p of platforms) {
      p.mesh.material = new THREE.MeshStandardMaterial({
        color: 0x101020,
        emissive: 0x00ffff,
        emissiveIntensity: 0.12,
        roughness: 0.75,
        metalness: 0.15
      });
    }

    for (const e of enemies) {
      e.mesh.material = new THREE.MeshStandardMaterial({
        color: 0x220022,
        emissive: 0xff00ff,
        emissiveIntensity: 0.45,
        roughness: 0.45,
        metalness: 0.25
      });
    }

    if (goalPlatform) {
      goalPlatform.mesh.material = new THREE.MeshStandardMaterial({
        color: 0x000000,
        emissive: 0xffd700,
        emissiveIntensity: 0.85,
        roughness: 0.25,
        metalness: 0.2
      });
    }
  }

  setPlayerAvatar(avatars[avatarIndex]);
}



  if (startBtnEl) {
  startBtnEl.addEventListener("click", () => {
    const chosenMode = startModeEl?.value || "prototype";
    const chosenAvatar = startAvatarEl?.value || "box";

    // set internal avatar + mode
    avatarIndex = Math.max(0, avatars.indexOf(chosenAvatar));
    if (avatarSelectEl) avatarSelectEl.value = chosenAvatar; // keep UI in sync

    const full = chosenMode === "full";
    if (modeToggleEl) modeToggleEl.checked = full;

    applyMode(full);
    setPlayerAvatar(chosenAvatar);

    gameStarted = true;
    if (startScreenEl) startScreenEl.style.display = "none";
  });
}


  // UI wiring
  const modeToggleEl = document.getElementById("modeToggle");
  if (modeToggleEl) {
    modeToggleEl.checked = false;
    modeToggleEl.addEventListener("change", () => applyMode(modeToggleEl.checked));
  }

  const avatarSelectEl = document.getElementById("avatarSelect");
  if (avatarSelectEl) {
    avatarSelectEl.value = avatars[avatarIndex];
    avatarSelectEl.addEventListener("change", () => {
      const idx = avatars.indexOf(avatarSelectEl.value);
      avatarIndex = idx >= 0 ? idx : 0;
      setPlayerAvatar(avatars[avatarIndex]);
    });
  }

  // Press C to cycle characters
  window.addEventListener("keydown", (e) => {
    if (e.code === "KeyC") {
      avatarIndex = (avatarIndex + 1) % avatars.length;
      if (avatarSelectEl) avatarSelectEl.value = avatars[avatarIndex];
      setPlayerAvatar(avatars[avatarIndex]);
    }
  });

  // Initialize Prototype mode
  applyMode(false);

  // Level generation
  function generateLevel(lvl) {
    // Clear existing level
    platforms.forEach(p => scene.remove(p.mesh));
    enemies.forEach(e => scene.remove(e.mesh));
    platforms.length = 0;
    enemies.length = 0;

    if (goalPlatform) {
      scene.remove(goalPlatform.mesh);
      goalPlatform = null;
    }

    // Reset player
    player.position.set(0, 2, 0);
    playerVelocity.x = 0;
    playerVelocity.y = 0;
    playerVelocity.z = 0;

    // Starting platform
    createPlatform(0, 0, 0, 6, 6, 0x228b22);

    const difficulty = lvl;
    const platformCount = 15 + lvl * 3;

    let lastX = 0, lastY = 2, lastZ = 5;

    for (let i = 0; i < platformCount; i++) {
      const gap = 3 + Math.random() * (2 + difficulty * 0.3);
      const heightChange = (Math.random() - 0.3) * (3 + difficulty * 0.5);

      const angle = (Math.random() - 0.5) * 0.5;
      lastX += Math.sin(angle) * gap;
      lastZ += Math.cos(angle) * gap;
      lastY += heightChange;

      const width = 3 + Math.random() * 2 - difficulty * 0.1;
      const depth = 3 + Math.random() * 2 - difficulty * 0.1;

      const isMoving = Math.random() < 0.3 + difficulty * 0.05;
      const moveRange = isMoving ? 3 + Math.random() * 2 : 0;
      const moveAxis = Math.random() < 0.5 ? "x" : "z";

      createPlatform(lastX, lastY, lastZ, width, depth, 0x8b4513, isMoving, moveRange, moveAxis);

      // Add enemies
      if (i > 3 && Math.random() < 0.2 + difficulty * 0.05) {
        createEnemy(lastX, lastY + 0.8, lastZ, 0.03 + difficulty * 0.01);
      }
    }

    // Goal platform
    lastZ += 8;
    lastY += 2;
    const goalGeometry = new THREE.BoxGeometry(5, 0.5, 5);
    const goalMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffd700,
      emissiveIntensity: 0.3
    });
    const goal = new THREE.Mesh(goalGeometry, goalMaterial);
    goal.position.set(lastX, lastY, lastZ);
    goal.receiveShadow = true;
    scene.add(goal);

    goalPlatform = { mesh: goal, width: 5, depth: 5 };

    // keep current avatar/mode after regenerating the level
    setPlayerAvatar(avatars[avatarIndex]);
  }

  generateLevel(currentLevel);
  updateHud();

  // Collision detection
  function checkPlatformCollision() {
    isGrounded = false;

    for (const platform of platforms) {
      const p = platform.mesh;
      const px = player.position.x;
      const py = player.position.y;
      const pz = player.position.z;

      if (
        px > p.position.x - platform.width / 2 && px < p.position.x + platform.width / 2 &&
        pz > p.position.z - platform.depth / 2 && pz < p.position.z + platform.depth / 2 &&
        py - 1 <= p.position.y + 0.25 && py - 1 >= p.position.y - 0.25 &&
        playerVelocity.y <= 0
      ) {
        player.position.y = p.position.y + 1.25;
        playerVelocity.y = 0;
        isGrounded = true;
        canJump = true;
        return true;
      }
    }

    // Goal platform
    if (goalPlatform) {
      const g = goalPlatform.mesh;
      const px = player.position.x;
      const py = player.position.y;
      const pz = player.position.z;

      if (
        px > g.position.x - 2.5 && px < g.position.x + 2.5 &&
        pz > g.position.z - 2.5 && pz < g.position.z + 2.5 &&
        py - 1 <= g.position.y + 0.25 && py - 1 >= g.position.y - 0.25
      ) {
        isGrounded = true;
        canJump = true;

        if (playerVelocity.y <= 0) {
          currentLevel++;
          currentScore += 100 * currentLevel;
          updateHud();
          setMessage(`Level ${currentLevel - 1} Complete!`, 2000);
          generateLevel(currentLevel);
        }
        return true;
      }
    }

    return false;
  }

  function checkEnemyCollision() {
    for (const enemy of enemies) {
      const dist = player.position.distanceTo(enemy.mesh.position);
      if (dist < 1.5) {
        resetPlayer();
        return;
      }
    }
  }

  function resetPlayer() {
    currentLives--;
    if (currentLives <= 0) {
      isGameOver = true;
      setMessage("Game Over! Press R to Restart");
      updateHud();
      return;
    }

    updateHud();
    player.position.set(0, 2, 0);
    playerVelocity.x = 0;
    playerVelocity.y = 0;
    playerVelocity.z = 0;
    setMessage("Life Lost!", 1500);
  }

  // Mouse aim shooting (raycast toward enemy or forward point)
  function shootMouseAim() {
    raycaster.setFromCamera(mouse, camera);

    // shoot at enemy if cursor is on one
    const enemyMeshes = enemies.map(e => e.mesh);
    const hits = raycaster.intersectObjects(enemyMeshes, false);

    const targetPoint = new THREE.Vector3();
    if (hits.length > 0) targetPoint.copy(hits[0].point);
    else {
      targetPoint.copy(raycaster.ray.origin)
        .add(raycaster.ray.direction.clone().multiplyScalar(60));
    }

    const projectileGeometry = new THREE.SphereGeometry(0.2);
    const projectileMaterial = new THREE.MeshStandardMaterial({
      color: 0xffff00,
      emissive: 0xffff00
    });

    const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
    projectile.position.copy(player.position);
    projectile.position.y += 0.9;
    scene.add(projectile);

    const dir = targetPoint.clone().sub(projectile.position).normalize();

    projectiles.push({
      mesh: projectile,
      velocity: dir.multiplyScalar(projectileSpeed)
    });
  }

  let lastShootTime = 0;
  const shootCooldown = 200;

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);

    if (!gameStarted) {
  renderer.render(scene, camera);
  return;
}

    if (isGameOver) {
      if (keys["KeyR"]) {
        currentLevel = 1;
        currentLives = 3;
        currentScore = 0;
        isGameOver = false;
        setMessage("");
        generateLevel(1);
        updateHud();
      }
      renderer.render(scene, camera);
      return;
    }

    // ===== Movement (your current inverted fix) =====
    // (This matches your “W was backwards, A/D swapped” situation)
    const moveX = (keys["KeyA"] ? 1 : 0) - (keys["KeyD"] ? 1 : 0);
    const moveZ = (keys["KeyW"] ? 1 : 0) - (keys["KeyS"] ? 1 : 0);

    const len = Math.hypot(moveX, moveZ);
    const nx = len > 0 ? moveX / len : 0;
    const nz = len > 0 ? moveZ / len : 0;

    player.position.x += nx * moveSpeed;
    player.position.z += nz * moveSpeed;

    // Jump
    if (keys["Space"] && isGrounded && canJump) {
      playerVelocity.y = jumpPower;
      canJump = false;
    }

    // Mouse shooting only
    if (wantsShoot) {
      const now = Date.now();
      if (now - lastShootTime > shootCooldown) {
        shootMouseAim();
        lastShootTime = now;
      }
      wantsShoot = false;
    }

    // Gravity
    playerVelocity.y += gravity;
    player.position.y += playerVelocity.y;

    // Collisions
    checkPlatformCollision();
    checkEnemyCollision();

    // Fall detection
    if (player.position.y < -20) resetPlayer();

    // Moving platforms
    platforms.forEach(platform => {
      if (!platform.moving) return;

      const axis = platform.moveAxis;
      const currentPos = platform.mesh.position[axis];
      const startPos = platform.startPos[axis];

      if (Math.abs(currentPos - startPos) >= platform.moveRange) {
        platform.direction *= -1;
      }
      platform.mesh.position[axis] += platform.direction * 0.02;
    });

    // Enemies chase
    enemies.forEach(enemy => {
      const dir = new THREE.Vector3()
        .subVectors(player.position, enemy.mesh.position)
        .normalize();

      enemy.mesh.position.x += dir.x * enemy.speed;
      enemy.mesh.position.z += dir.z * enemy.speed;
    });

    // Projectiles update + hit detection
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const proj = projectiles[i];
      proj.mesh.position.add(proj.velocity);

      let hit = false;
      for (let j = enemies.length - 1; j >= 0; j--) {
        const enemy = enemies[j];
        if (proj.mesh.position.distanceTo(enemy.mesh.position) < 1) {
          enemy.health--;
          if (enemy.health <= 0) {
            scene.remove(enemy.mesh);
            enemies.splice(j, 1);
            currentScore += 50;
            updateHud();
          }
          hit = true;
          break;
        }
      }

      if (hit || proj.mesh.position.length() > 150) {
        scene.remove(proj.mesh);
        projectiles.splice(i, 1);
      }
    }

    // ===== Camera orbit update (replaces old camera follow) =====
const target = player.position.clone().add(CAM_TARGET_OFFSET);

// spherical orbit around target
const cosPitch = Math.cos(camPitch);
const sinPitch = Math.sin(camPitch);
const cosYaw = Math.cos(camYaw);
const sinYaw = Math.sin(camYaw);

camera.position.set(
  target.x + camDist * cosPitch * sinYaw,
  target.y + camDist * sinPitch,
  target.z + camDist * cosPitch * cosYaw
);

camera.lookAt(target);
// ===========================================================


    renderer.render(scene, camera);
  }

  animate();

  // Resize
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
})();

