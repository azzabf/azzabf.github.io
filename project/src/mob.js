// ===============================
//   mob.js  (MODULE VERSION)
// ===============================

export class Mob {
    constructor(position, options = {}) {

        // Store settings
        this.speed = options.speed ?? 2.5;             // slower, natural
        this.aggroRadius = options.aggroRadius ?? 10;  // how close player must be
        this.chaseDelay = options.chaseDelay ?? 1.0;   // seconds before mob moves
        this.spawnTime = performance.now() / 1000;

        // Materials
        this.materialPrototype = new THREE.MeshStandardMaterial({ color: 0x880000 });
        this.materialFull = new THREE.MeshStandardMaterial({
            color: 0xaa0000,
            emissive: 0x330000,
            metalness: 0.6,
            roughness: 0.4,
        });

        // ==================
        //     MODEL
        // ==================
        this.mesh = new THREE.Group();

        // Body
        const bodyGeom = new THREE.BoxGeometry(1.4, 1.8, 1.0);
        const body = new THREE.Mesh(bodyGeom, this.materialPrototype);
        body.castShadow = true;
        body.receiveShadow = true;
        body.position.set(0, 0.9, 0);

        // Head
        const headGeom = new THREE.BoxGeometry(1.0, 1.0, 1.0);
        const head = new THREE.Mesh(headGeom, this.materialPrototype);
        head.position.set(0, 2.0, 0);
        head.castShadow = true;

        // Eyes
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

        // Horns
        const hornGeom = new THREE.BoxGeometry(0.2, 0.4, 0.2);
        const hornMat = new THREE.MeshStandardMaterial({ color: 0x222222 });

        const hornL = new THREE.Mesh(hornGeom, hornMat);
        const hornR = new THREE.Mesh(hornGeom, hornMat);

        hornL.position.set(-0.3, 0.5, -0.1);
        hornR.position.set(0.3, 0.5, -0.1);

        head.add(hornL, hornR);

        // Build mob model
        this.mesh.add(body, head);
        this.mesh.position.copy(position);
        this.mesh.castShadow = true;

        scene.add(this.mesh);
    }

    // Switch materials for prototype / full mode
    setMode(prototypeMode) {
        const mat = prototypeMode ? this.materialPrototype : this.materialFull;

        this.mesh.traverse(obj => {
            if (obj.isMesh && (obj.material === this.materialPrototype || obj.material === this.materialFull)) {
                obj.material = mat;
            }
        });
    }

    update(delta, player) {
        if (!player) return;

        const now = performance.now() / 1000;

        // ⏳ 1. Delay before chasing
        if (now - this.spawnTime < this.chaseDelay) {
            return; // stand still
        }

        // 📏 2. Check distance to player
        const toPlayer = new THREE.Vector3()
            .subVectors(player.mesh.position, this.mesh.position);

        toPlayer.y = 0; // ignore vertical
        const dist = toPlayer.length();

        // 🧠 3. Only chase if player is close enough
        if (dist <= this.aggroRadius && dist > 0.5) {
            toPlayer.normalize();
            this.mesh.position.addScaledVector(toPlayer, this.speed * delta);
        }

        // 👣 4. Bobbing motion makes them feel “alive”
        this.mesh.position.y += Math.sin(performance.now() * 0.005) * 0.002;

        // ☠️ 5. Collision with player → die or reset
        const mobBox = new THREE.Box3().setFromObject(this.mesh);
        const playerBox = new THREE.Box3().setFromObject(player.mesh);

        if (mobBox.intersectsBox(playerBox)) {
            resetLevel("A mob got you! Be careful!");
        }
    }

    destroy() {
        scene.remove(this.mesh);
    }
}
