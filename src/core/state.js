// Shared, mutable app flags (playing, free look, visibility, redraw, camera snap) and the live plume particles.

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const state = { playing: !reduce, free: false, visible: true, dirty: true, snapCam: true, parts: [] };

export { reduce };
