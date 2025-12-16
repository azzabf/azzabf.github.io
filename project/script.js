(() => {
  const mount = document.getElementById("game");

  const levelEl = document.getElementById("level");
  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");
  const msgEl = document.getElementById("message");
  const restartHintEl = document.getElementById("restartHint");

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

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  mount.appendChild(renderer.domElement);

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

  // Game state
  let currentLevel = 1;
  let currentLives = 3;
  let currentScore = 0;
  let isGameOver = false;

  const updateHud = () => {
    levelEl.textContent = String(currentLevel);
    scoreEl.textContent = String(currentScore);
    livesEl.textContent = String(currentLives);
    restartHintEl.style.display = isGameOver ? "block" : "none";
  };

  // Player
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

  // Input (FIXED WASD using event.code)
  const keys = Object.create(null);

  function onKeyDown(e) {
    keys[e.code] = true;

    // Prevent page scrolling with space
    if (e.code === "Space") e.preventDefault();
  }

  function onKeyUp(e) {
    keys[e.code] = false;
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // Fix “stuck keys” when tab loses focus
  window.addEventListener("blur", () => {
    for (const k in keys) keys[k] = false;
  });

  // ===== Mouse aim shooting =====
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let wantsShoot = false;

function updateMouseFromEvent(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
}

renderer.domElement.addEventListener("mousemove", (e) => {
  updateMouseFromEvent(e);
});

renderer.domElement.addEventListener("mousedown", (e) => {
  // left click only
  if (e.button !== 0) return;
  updateMouseFromEvent(e);
  wantsShoot = true;

  // prevent text selection / dragging
  e.preventDefault();
});


  // Platforms
  const platforms = [];
  const createPlatform = (x, y, z, width, depth, color = 0x8b4513, moving = false, moveRange = 0, moveAxis = "x") => {
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

    // Check goal platform
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

  function shootMouseAim() {
  // 1) Build a ray from camera through mouse
  raycaster.setFromCamera(mouse, camera);

  // 2) Try to hit an enemy first (best feel)
  const enemyMeshes = enemies.map(e => e.mesh);
  const enemyHits = raycaster.intersectObjects(enemyMeshes, false);

  // 3) If you clicked an enemy, shoot at that hit point
  //    Otherwise shoot along the ray to a point in space
  const targetPoint = new THREE.Vector3();
  if (enemyHits.length > 0) {
    targetPoint.copy(enemyHits[0].point);
  } else {
    // fallback: shoot 60 units out along ray
    targetPoint.copy(raycaster.ray.origin)
      .add(raycaster.ray.direction.clone().multiplyScalar(60));
  }

  // 4) Spawn projectile
  const projectileGeometry = new THREE.SphereGeometry(0.2);
  const projectileMaterial = new THREE.MeshStandardMaterial({
    color: 0xffff00,
    emissive: 0xffff00
  });
  const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);

  projectile.position.copy(player.position);
  projectile.position.y += 0.9; // chest-height
  scene.add(projectile);

  // 5) Velocity toward target
  const dir = targetPoint.clone().sub(projectile.position).normalize();

  projectiles.push({
    mesh: projectile,
    velocity: dir.multiplyScalar(projectileSpeed)
  });
}


  let lastShootTime = 0;
  const shootCooldown = 300;

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);

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



// ===== Movement (FORCE FIX: invert both axes) =====

// Flip X so A = left, D = right (your current behavior is mirrored)
const moveX = (keys["KeyA"] ? 1 : 0) - (keys["KeyD"] ? 1 : 0);

// Flip Z so W = forward, S = backward (your current behavior is mirrored)
const moveZ = (keys["KeyW"] ? 1 : 0) - (keys["KeyS"] ? 1 : 0);

// Normalize so diagonals aren't faster
const len = Math.hypot(moveX, moveZ);
const nx = len > 0 ? moveX / len : 0;
const nz = len > 0 ? moveZ / len : 0;

// Apply movement
player.position.x += nx * moveSpeed;
player.position.z += nz * moveSpeed;




    // Jump (Space)
    if (keys["Space"] && isGrounded && canJump) {
      playerVelocity.y = jumpPower;
      canJump = false;
    }

  // Shooting (mouse click)
if (wantsShoot) {
  const now = Date.now();
  if (now - lastShootTime > shootCooldown) {
    shootMouseAim();
    lastShootTime = now;
  }
  wantsShoot = false; // consume the click
}


    // Apply gravity
    playerVelocity.y += gravity;

    // Update player position
    
    player.position.y += playerVelocity.y;
    

    // Collisions
    checkPlatformCollision();
    checkEnemyCollision();

    // Fall detection
    if (player.position.y < -20) resetPlayer();

    // Moving platforms
    platforms.forEach(platform => {
      if (!platform.moving) return;

      const axis = platform.moveAxis; // "x" or "z"
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

    // Projectiles
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

      if (hit || proj.mesh.position.length() > 100) {
        scene.remove(proj.mesh);
        projectiles.splice(i, 1);
      }
    }

    // Camera follow
    const cameraOffset = new THREE.Vector3(0, 8, -12);
    const targetCamPos = player.position.clone().add(cameraOffset);
    camera.position.lerp(targetCamPos, 0.1);
    camera.lookAt(
  player.position.x,
  player.position.y + 2,
  player.position.z
);

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
