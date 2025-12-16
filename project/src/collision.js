// src/collision.js
// Robust landing collision: choose the highest valid platform top when intersecting multiple platforms.
// This fixes "falling through stair 4" style issues on stacked staircases.

export function handlePlayerPlatformCollision(player, platforms) {
  player.canJump = false;

  const playerBoxNow = new THREE.Box3().setFromObject(player.mesh);

  // Approx previous bounds by shifting based on last frame Y
  const dy = player.prevY - player.mesh.position.y;
  const playerBoxPrev = playerBoxNow.clone().translate(new THREE.Vector3(0, dy, 0));

  const EPS = 0.18;          // forgiving
  const NEAR_TOP = 0.45;     // fallback window

  const fallingDown = player.velocity.y <= 0;

  let bestTop = -Infinity;
  let found = false;

  for (const p of platforms) {
    if (!p.boundingBox) continue;
    if (!playerBoxNow.intersectsBox(p.boundingBox)) continue;

    const platTop = p.boundingBox.max.y;

    // "Clean" landing: we were above top last frame
    const wasAbove = playerBoxPrev.min.y >= (platTop - EPS);

    // Fallback: if we start the frame intersecting (common on close stairs),
    // allow landing if our bottom is close to the top while falling.
    const nearTopNow =
      playerBoxNow.min.y <= (platTop + EPS) &&
      playerBoxNow.min.y >= (platTop - NEAR_TOP);

    if (fallingDown && (wasAbove || nearTopNow)) {
      // pick the highest top so we don't snap to a lower stair when two overlap
      if (platTop > bestTop) {
        bestTop = platTop;
        found = true;
      }
    }
  }

  if (found) {
    const snapUp = (bestTop - playerBoxNow.min.y) + 0.01;
    player.mesh.position.y += snapUp;
    player.velocity.y = 0;
    player.canJump = true;
  }
}
