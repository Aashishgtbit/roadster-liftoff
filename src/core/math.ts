// Small math helpers shared by the scene code.

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Hermite ease from 0 at `edge0` to 1 at `edge1` (either order). */
export const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};
