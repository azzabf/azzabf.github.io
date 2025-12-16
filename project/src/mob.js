// src/mob.js

export class Mob {
  constructor(position, options = {}, scene) {
    this.scene = scene;

    this.speed = options.speed ?? 2.5;
    this.aggroRadius = options.aggroRadius ?? 10;
    this.chaseDelay = options.chaseDelay ?? 1.0;
    this.spawnTime = performance.now() / 1000;

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
    body.position.set(0, 0.9, 0);
    body.castShadow = true;

    const headGeom = new THREE.BoxGeometry(1.0, 1.0, 1.0);
    const head = new THREE.Mesh(headGeom, this.materialPrototype);
    head.position.set(0, 2.0, 0);
    head.castShadow = true;

    const eyeGeom = new THREE.BoxGeometry(0.2, 0.2, 0.1);
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
    });
    const eyeL = new THREE.Mesh(eyeGeom, eyeMat);
    const eyeR = new THREE.Mesh(eyeGeom, eyeMat);
    eyeL.position.set(-0.25, 0.1, 0.51);
    eyeR.position.set(0.25, 0.1, 0.51);
    head.add(eyeL, eyeR);

    const hornGeom = new THREE.BoxGeometry(0.2, 0.4, 0.2);
    const hornMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const hornL = new THREE.Mesh(hornGeom, hornMat);
    const hornR = new THREE.Mesh(hornGeom, hornMat);
    hornL.position.set(-0.3, 0.5, -0.1);
    hornR.position.set(0.3, 0.5, -0.1);
    head.add(hornL, hornR);

    this.mesh.add(body, head);
    this.mesh.position.copy(position);
    this.scene.add(this.mesh);
  }

  setMode(isPrototype) {
    const mat = isPrototype ? this.materialPrototype : this.materialFull;
    this.mesh.traverse(obj => {
      if (obj.isMesh && (obj.material === this.materialPrototype || obj.material === this.materialFull)) {
        obj.material = mat;
      }
    });
  }

  update(delta, player, resetLevel) {
    const now = performance.now() / 1000;
    if (now - this.spawnTime < this.chaseDelay) return;

    const toPlayer = new THREE.Vector3()
      .subVectors(player.mesh.position, this.mesh.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();

    if (dist <= this.aggroRadius && dist > 0.5) {
      toPlayer.normalize();
      this.mesh.position.addScaledVector(toPlayer, this.speed * delta);
    }

    this.mesh.position.y += Math.sin(performance.now() * 0.005) * 0.002;

    const mobBox = new THREE.Box3().setFromObject(this.mesh);
    const playerBox = new THREE.Box3().setFromObject(player.mesh);
    if (mobBox.intersectsBox(playerBox)) {
      resetLevel("A mob caught you!");
    }
  }

  destroy() {
    this.scene.remove(this.mesh);
  }
}
