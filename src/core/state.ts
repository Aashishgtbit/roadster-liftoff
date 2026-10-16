// App-wide flags that several modules read and write. Change them through `app.x = …`; don't add module-level
// `let`s that other modules need to write.

export const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const app = {
  playing: !prefersReducedMotion,   // the simulation is running
  freeLook: false,                  // the user is orbiting the camera instead of the cinematic shots
  visible: true,                    // the stage is on screen (nothing runs while it is not)
  needsRender: true,                // draw a frame even while paused
  snapCamera: true,                 // jump straight to the next shot instead of easing there
};
