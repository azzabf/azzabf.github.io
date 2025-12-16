// src/weapon.js

export function createWeaponMesh(type) {
  const group = new THREE.Group();

  if (type === "laser") {
    const bodyGeom = new THREE.BoxGeometry(0.8, 0.4, 1.2);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.7,
      roughness: 0.3,
      emissive: 0x111111,
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.castShadow = true;
    group.add(body);

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
    const orbGeom = new THREE.SphereGeometry(0.4, 12, 12);
    const orbMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff8800,
      metalness: 0.8,
      roughness: 0.3,
    });
    const orb = new THREE.Mesh(orbGeom, orbMat);
    orb.castShadow = true;
    group.add(orb);
  }

  return group;
}

// ===== WEAPON LOGIC CLASSES =====

export class LaserWeapon {
  constructor(player, mobs, scene, setInfo, addScore) {
    this.player = player;
    this.mobs = mobs;
    this.scene = scene;
    this.setInfo = setInfo;
    this.addScore = addScore;
    this.cooldown = 0.25;
    this.lastShotTime = 0;
  }

  attack() {
    const now = performance.now() / 1000;
    if (now - this.lastShotTime < this.cooldown) return;
    this.lastShotTime = now;

    const basePos = this.player.mesh.position.clone();
    const direction = new THREE.Vector3();
const playerPos = this.player.mesh.position.clone();

let closestMob = null;
let closestDist = Infinity;

for (const m of this.mobs) {
  const toMob = m.mesh.position.clone().sub(playerPos);
  toMob.y = 0; // ignore vertical difference
  const d = toMob.length();
  if (d < closestDist) {
    closestDist = d;
    closestMob = m;
    direction.copy(toMob.normalize());
  }
}

if (!closestMob) return;


    const raycaster = new THREE.Raycaster();
    const mobGroups = this.mobs.map(m => m.mesh); // each mob.mesh is a THREE.Group

    const heights = [0.8, 1.6, 2.4, 3.2];
    let hitGroup = null;

    for (const h of heights) {
      const origin = basePos.clone();
      origin.y = basePos.y + h;

      raycaster.set(origin, direction);

      // recursive = true so we can hit child meshes inside the mob group
      const intersects = raycaster.intersectObjects(mobGroups, true);

      if (intersects.length > 0) {
        let obj = intersects[0].object;

        // Walk up until we reach the mob Group
        while (obj && obj.parent && !mobGroups.includes(obj)) {
          obj = obj.parent;
        }

        if (obj && mobGroups.includes(obj)) {
          hitGroup = obj;
          break;
        }
      }
    }

    if (hitGroup) {
      const mobIndex = this.mobs.findIndex(m => m.mesh === hitGroup);
      if (mobIndex !== -1) {
        this.mobs[mobIndex].destroy();
        this.mobs.splice(mobIndex, 1);
        this.setInfo("Laser hit a mob!");
        this.addScore(10);
      }
    } else {
      this.setInfo("Laser missed.");
    }

    // Visual laser line
    const originViz = basePos.clone();
    originViz.y = basePos.y + 1.6;

    const lineMat = new THREE.LineBasicMaterial({ color: 0x00ffff });
    const points = [originViz, originViz.clone().addScaledVector(direction, 20)];
    const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(lineGeom, lineMat);

    this.scene.add(line);
    setTimeout(() => {
      this.scene.remove(line);
      lineGeom.dispose();
      lineMat.dispose();
    }, 100);
  }
}

export class SwordWeapon {
  constructor(player, mobs, setInfo, addScore) {
    this.player = player;
    this.mobs = mobs;
    this.setInfo = setInfo;
    this.addScore = addScore;
    this.cooldown = 0.4;
    this.lastSwingTime = 0;
    this.range = 2.0;
  }

  attack() {
    const now = performance.now() / 1000;
    if (now - this.lastSwingTime < this.cooldown) return;
    this.lastSwingTime = now;

    const pPos = this.player.mesh.position;
    let killed = 0;
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      const dist = m.mesh.position.distanceTo(pPos);
      if (dist <= this.range) {
        m.destroy();
        this.mobs.splice(i, 1);
        killed++;
      }
    }

    if (killed > 0) {
      this.setInfo(`Sword slash! Killed ${killed} mob(s).`);
      this.addScore(killed * 15);
    } else {
      this.setInfo("Sword swing missed.");
    }
  }
}

export class OrbWeapon {
  constructor(player, mobs, projectiles, scene, setInfo, addScore) {
    this.player = player;
    this.mobs = mobs;
    this.projectiles = projectiles;
    this.scene = scene;
    this.setInfo = setInfo;
    this.addScore = addScore;
    this.cooldown = 0.8;
    this.lastThrowTime = 0;
  }

  attack() {
  const now = performance.now() / 1000;
  if (now - this.lastShotTime < this.cooldown) return;
  this.lastShotTime = now;

  const basePos = this.player.mesh.position.clone();
  const playerBox = new THREE.Box3().setFromObject(this.player.mesh);
const baseY = playerBox.min.y; // true feet/bottom in world space


  // Shoot forward in world -Z (matches your orb velocity too)
  const direction = new THREE.Vector3(0, 0, -1);

  const raycaster = new THREE.Raycaster();
  const mobGroups = this.mobs.map(m => m.mesh); // each mob.mesh is a THREE.Group :contentReference[oaicite:2]{index=2}
  const heights = [0.8, 1.6, 2.4, 3.2];

  let hitGroup = null;

  for (const h of heights) {
    const origin = basePos.clone();
    origin.y = baseY + h; // ✅ relative to player, not absolute world height :contentReference[oaicite:3]{index=3}

    raycaster.set(origin, direction);

    // ✅ recursive = true so we hit meshes inside the mob group
    const intersects = raycaster.intersectObjects(mobGroups, true);

    if (intersects.length > 0) {
      // We likely hit a child mesh; walk up to the mob group
      let obj = intersects[0].object;
      while (obj && obj.parent && !mobGroups.includes(obj)) {
        obj = obj.parent;
      }

      if (obj && mobGroups.includes(obj)) {
        hitGroup = obj;
        break;
      }
    }
  }

  if (hitGroup) {
    const mobIndex = this.mobs.findIndex(m => m.mesh === hitGroup);
    if (mobIndex !== -1) {
      this.mobs[mobIndex].destroy();
      this.mobs.splice(mobIndex, 1);
      this.setInfo("Laser hit a mob!");
      this.addScore(10);
    }
  } else {
    this.setInfo("Laser missed.");
  }

  // Visual line (also use player-relative height)
  const originViz = basePos.clone();
  originViz.y = baseY + 1.6;

  const lineMat = new THREE.LineBasicMaterial({ color: 0x00ffff });
  const points = [originViz, originViz.clone().addScaledVector(direction, 20)];
  const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.Line(lineGeom, lineMat);

  this.scene.add(line);
  setTimeout(() => {
    this.scene.remove(line);
    lineGeom.dispose();
    lineMat.dispose();
  }, 100);
}

}
