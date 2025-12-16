// src/player.js
import { createWeaponMesh } from "./weapon.js";

export class Player {
  constructor(scene, isPrototype) {
    this.scene = scene;
    this.speed = 10;
    this.jumpStrength = 12;
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.canJump = false;

    this.materialPrototype = new THREE.MeshStandardMaterial({ color: 0x00ccff });
    this.materialFull = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x004444,
      metalness: 0.5,
      roughness: 0.2,
    });

    this.mesh = new THREE.Group();

    // Body parts
    const bodyGeom = new THREE.BoxGeometry(1.4, 1.8, 0.7);
    const headGeom = new THREE.BoxGeometry(1.0, 1.0, 1.0);
    const armGeom = new THREE.BoxGeometry(0.4, 1.4, 0.4);
    const legGeom = new THREE.BoxGeometry(0.5, 1.5, 0.5);

    const body = new THREE.Mesh(bodyGeom, this.materialPrototype);
    body.position.set(0, 1.3, 0);
    body.castShadow = true;

    const head = new THREE.Mesh(headGeom, this.materialPrototype);
    head.position.set(0, 2.5, 0);
    head.castShadow = true;

    // Simple face
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
    this.scene.add(this.mesh);

    this.weaponLogic = null;
    this.weaponMesh = null;

    this.prevY = 0;

    this.setMode(isPrototype);
  }

  resetPosition() {
    this.mesh.position.set(0, 2, 10);
    this.velocity.set(0, 0, 0);
  }

  setMode(isPrototype) {
    const mat = isPrototype ? this.materialPrototype : this.materialFull;
    this.mesh.traverse(obj => {
      if (obj.isMesh && obj !== this.weaponMesh) {
        obj.material = mat;
      }
    });
  }

  setWeapon(name, weaponLogic) {
    this.weaponLogic = weaponLogic;

    if (this.weaponMesh) {
      this.mesh.remove(this.weaponMesh);
      this.weaponMesh = null;
    }

    this.weaponMesh = createWeaponMesh(name);
    if (this.weaponMesh) {
      this.weaponMesh.position.set(0.9, 1.3, 0.4);
      this.mesh.add(this.weaponMesh);
    }
  }

  update(delta, keys, gravity) {
    // Movement
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
    this.prevY = this.mesh.position.y;
    // Gravity
    this.velocity.y += gravity * delta;
    this.mesh.position.y += this.velocity.y * delta;
  }

  jump() {
    if (this.canJump) {
      this.velocity.y = this.jumpStrength;
      this.canJump = false;
    }
  }

  attack() {
    if (this.weaponLogic) {
      this.weaponLogic.attack();
    }
  }
}
