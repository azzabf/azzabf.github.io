// src/controls.js

export const keys = {
  ArrowLeft: false,
  ArrowRight: false,
  ArrowUp: false,
  ArrowDown: false,
  KeyA: false,
  KeyD: false,
  KeyW: false,
  KeyS: false,

  // ✅ IMPORTANT FIX: Space must exist or keydown won't track it
  Space: false,

  // Optional: attack key tracked (we’ll also call player.attack directly)
  KeyF: false,
};

export function setupControls(player, keysObj) {
  function onKeyDown(e) {
    if (keysObj.hasOwnProperty(e.code)) {
      keysObj[e.code] = true;
      e.preventDefault();
    }

    // Jump on space
    if (e.code === "Space") {
      player.jump();
      e.preventDefault();
    }

    // Attack on F
    if (e.code === "KeyF") {
      player.attack();
      e.preventDefault();
    }
  }

  function onKeyUp(e) {
    if (keysObj.hasOwnProperty(e.code)) {
      keysObj[e.code] = false;
      e.preventDefault();
    }
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // ---------- Mobile ----------
  const btnLeft = document.getElementById("leftBtn");
  const btnRight = document.getElementById("rightBtn");
  const btnForward = document.getElementById("forwardBtn");
  const btnBackward = document.getElementById("backwardBtn");
  const btnJump = document.getElementById("jumpBtn");
  const btnAttack = document.getElementById("attackBtn");

  function bindMobile(btn, code) {
    if (!btn) return;

    const down = (e) => {
      keysObj[code] = true;
      e.preventDefault();
    };
    const up = (e) => {
      keysObj[code] = false;
      e.preventDefault();
    };

    btn.addEventListener("pointerdown", down);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);
    btn.addEventListener("pointerleave", up);
  }

  bindMobile(btnLeft, "KeyA");
  bindMobile(btnRight, "KeyD");
  bindMobile(btnForward, "KeyW");
  bindMobile(btnBackward, "KeyS");

  if (btnJump) {
    btnJump.addEventListener("pointerdown", (e) => {
      player.jump();
      e.preventDefault();
    });
  }

  // ✅ Mobile attack button
  if (btnAttack) {
    btnAttack.addEventListener("pointerdown", (e) => {
      player.attack();
      e.preventDefault();
    });
  }
}
