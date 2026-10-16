// Instrument graphics drawn in SVG: speedometer, fuel, altimeter, attitude dial, nozzle map and suction meter.
// Each `create…` builds the gauge inside a container and returns a function that sets its reading; call it every
// frame, it only touches a few attributes.
import type { NozzleMount } from "../car/nozzle-layout";

const SVG_NS = "http://www.w3.org/2000/svg";

/** Create an SVG element with attributes, optionally appended to a parent. */
export function svg<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number> = {}, parent?: Element): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  parent?.appendChild(element);
  return element;
}

/** A point on a circle; angles in degrees, 0 = up, clockwise. */
function polar(cx: number, cy: number, r: number, degrees: number): [number, number] {
  const a = (degrees - 90) * Math.PI / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

/** An SVG arc path from one angle to another (degrees, clockwise from up). */
function arcPath(cx: number, cy: number, r: number, from: number, to: number) {
  const [x0, y0] = polar(cx, cy, r, from), [x1, y1] = polar(cx, cy, r, to);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function gaugeRoot(parent: HTMLElement, className: string, viewBox: string, label: string) {
  const root = svg("svg", { viewBox, class: `gauge ${className}`, role: "img", "aria-label": label });
  parent.appendChild(root);
  return root;
}

/** Round speedometer, 0 to `max` km/h, with a needle, a lit arc and the number in the middle. */
export function createSpeedometer(parent: HTMLElement, max = 160) {
  const root = gaugeRoot(parent, "speedometer", "0 0 120 108", "Speed");
  const cx = 60, cy = 60, r = 50, START = -135, SWEEP = 270;
  const angleFor = (kmh: number) => START + SWEEP * clamp01(kmh / max);
  svg("path", { d: arcPath(cx, cy, r, START, START + SWEEP), class: "track" }, root);
  svg("path", { d: arcPath(cx, cy, r, angleFor(max * 0.875), START + SWEEP), class: "redline" }, root);
  const lit = svg("path", { d: arcPath(cx, cy, r, START, START + 0.01), class: "lit" }, root);
  for (let kmh = 0; kmh <= max; kmh += 10) {
    const major = kmh % 40 === 0, a = angleFor(kmh), [x0, y0] = polar(cx, cy, r - 5, a), [x1, y1] = polar(cx, cy, r - (major ? 12 : 8), a);
    svg("line", { x1: x0, y1: y0, x2: x1, y2: y1, class: major ? "tick major" : "tick" }, root);
    if (major) { const [tx, ty] = polar(cx, cy, r - 20, a); svg("text", { x: tx, y: ty + 3, class: "scale" }, root).textContent = String(kmh); }
  }
  const needle = svg("g", { class: "needle" }, root);
  svg("path", { d: `M${cx - 2} ${cy}L${cx} ${cy - r + 9}L${cx + 2} ${cy}Z` }, needle);
  svg("circle", { cx, cy, r: 4.5, class: "hub" }, root);
  const value = svg("text", { x: cx, y: cy + 27, class: "value" }, root);
  svg("text", { x: cx, y: cy + 38, class: "unit" }, root).textContent = "km/h";
  return (kmh: number) => {
    const a = angleFor(kmh);
    needle.setAttribute("transform", `rotate(${a.toFixed(1)} ${cx} ${cy})`);
    lit.setAttribute("d", arcPath(cx, cy, r, START, Math.max(START + 0.01, a)));
    value.textContent = String(Math.round(kmh));
  };
}

/** Fuel: a can icon and ten cells that empty from the right; red when low. */
export function createFuelGauge(parent: HTMLElement) {
  const root = gaugeRoot(parent, "fuel", "0 0 132 22", "Fuel");
  // fuel can
  svg("path", { d: "M3 6h9l4 4v10H3zM12 6l2-3h3", class: "icon" }, root);
  const cells: SVGRectElement[] = [];
  for (let i = 0; i < 10; i++) cells.push(svg("rect", { x: 22 + i * 9, y: 6, width: 7, height: 12, rx: 1.5, class: "cell" }, root));
  const value = svg("text", { x: 130, y: 16, class: "value", "text-anchor": "end" }, root);
  return (fuel: number) => {
    const low = fuel < 20;
    cells.forEach((cell, i) => {
      const fill = clamp01(fuel / 10 - i);
      cell.setAttribute("class", fill > 0.5 ? (low ? "cell on low" : "cell on") : fill > 0 ? "cell half" : "cell");
    });
    value.textContent = String(Math.round(fuel));
    root.classList.toggle("low", low);
  };
}

/** Vertical altimeter, 0 to `max` m, with a fill and the reading. */
export function createAltimeter(parent: HTMLElement, max = 14) {
  const root = gaugeRoot(parent, "altimeter", "0 0 40 96", "Height");
  const top = 8, bottom = 80, x = 22;
  svg("rect", { x, y: top, width: 6, height: bottom - top, rx: 3, class: "track" }, root);
  const fill = svg("rect", { x, y: bottom, width: 6, height: 0, rx: 3, class: "lit" }, root);
  for (let m = 0; m <= max; m += 2) {
    const y = bottom - (bottom - top) * m / max;
    svg("line", { x1: 14, y1: y, x2: 19, y2: y, class: m % 4 === 0 ? "tick major" : "tick" }, root);
    if (m % 4 === 0) svg("text", { x: 11, y: y + 2.5, class: "scale", "text-anchor": "end" }, root).textContent = String(m);
  }
  const marker = svg("path", { d: "M31 0l5 -3v6z", class: "marker" }, root);
  const value = svg("text", { x: 20, y: 93, class: "value" }, root);
  return (metres: number) => {
    const share = clamp01(metres / max), y = bottom - (bottom - top) * share;
    fill.setAttribute("y", y.toFixed(1)); fill.setAttribute("height", (bottom - y).toFixed(1));
    marker.setAttribute("transform", `translate(0 ${y.toFixed(1)})`);
    value.textContent = metres.toFixed(1) + " m";
  };
}

/** Attitude dial: the car seen from behind (roll) or from the side (pitch), turning with the car. */
export function createAttitudeDial(parent: HTMLElement) {
  const root = gaugeRoot(parent, "attitude", "0 0 96 96", "Rotation");
  const c = 48, r = 38;
  svg("circle", { cx: c, cy: c, r, class: "face" }, root);
  for (let a = 0; a < 360; a += 45) {
    const [x0, y0] = polar(c, c, r, a), [x1, y1] = polar(c, c, r - (a % 90 === 0 ? 7 : 4), a);
    svg("line", { x1: x0, y1: y0, x2: x1, y2: y1, class: a % 90 === 0 ? "tick major" : "tick" }, root);
  }
  svg("line", { x1: c - r + 2, y1: c, x2: c + r - 2, y2: c, class: "horizon" }, root);
  const turns = svg("path", { d: "", class: "lit" }, root);   // how far round it has turned this run
  const rear = svg("g", { class: "car" }, root);
  // rear view: body, cabin, wheels
  svg("path", { d: `M${c - 19} ${c + 3}q0 -7 7 -8h24q7 1 7 8v3h-38z`, class: "body" }, rear);
  svg("path", { d: `M${c - 9} ${c - 5}l3 -7h12l3 7z`, class: "glass" }, rear);
  for (const dx of [-15, 11]) svg("rect", { x: c + dx, y: c + 5, width: 4, height: 6, rx: 1, class: "wheel" }, rear);
  const side = svg("g", { class: "car" }, root);
  // side view: a wedge with a canopy, nose to the right
  svg("path", { d: `M${c - 22} ${c + 4}v-6l8 -2q10 -7 18 -4l14 6q4 2 4 6z`, class: "body" }, side);
  for (const dx of [-15, 11]) svg("circle", { cx: c + dx, cy: c + 5, r: 3.5, class: "wheel" }, side);
  const value = svg("text", { x: c, y: c + r + 8, class: "value" }, root);
  return (radians: number, view: "roll" | "pitch") => {
    const degrees = radians * 180 / Math.PI, shown = ((degrees % 360) + 360) % 360;
    rear.style.display = view === "roll" ? "" : "none";
    side.style.display = view === "pitch" ? "" : "none";
    (view === "roll" ? rear : side).setAttribute("transform", `rotate(${(view === "roll" ? degrees : -degrees).toFixed(1)} ${c} ${c})`);
    const swept = Math.min(359.9, Math.abs(degrees));
    turns.setAttribute("d", swept > 1 ? arcPath(c, c, r + 3, degrees < 0 ? -swept : 0, degrees < 0 ? 0 : swept) : "");
    value.textContent = Math.round(shown) + "°";
  };
}

/** The car from above with its ten nozzles, each glowing with its thrust. */
export function createNozzleMap(parent: HTMLElement, mounts: readonly NozzleMount[]) {
  const root = gaugeRoot(parent, "nozzles", "0 0 64 112", "Nozzles");
  // plan view, nose up: x along the car maps to -y, z across maps to x
  const toSvg = (x: number, z: number): [number, number] => [32 + z * 22, 56 - x * 21];
  svg("path", { d: "M32 6q14 2 17 14v66q0 14 -4 16h-26q-4 -2 -4 -16v-66q3 -12 17 -14z", class: "body" }, root);
  svg("path", { d: "M32 30q10 1 11 8l-1 34h-20l-1 -34q1 -7 11 -8z", class: "glass" }, root);
  const dots = mounts.map(m => {
    const [x, y] = toSvg(m.at.x, m.at.z);
    const halo = svg("circle", { cx: x, cy: y, r: 7, class: "halo" }, root);
    const dot = svg("circle", { cx: x, cy: y, r: m.group === "down" ? 3.4 : 2.6, class: `nozzle ${m.group}` }, root);
    return { halo, dot };
  });
  const value = svg("text", { x: 32, y: 110, class: "value" }, root);
  return (levels: readonly number[], totalKilonewtons: number) => {
    let firing = 0;
    levels.forEach((level, i) => {
      const on = level > 0.04;
      if (on) firing++;
      dots[i].halo.style.opacity = on ? String(0.25 + 0.75 * level) : "0";
      dots[i].dot.classList.toggle("on", on);
    });
    value.textContent = firing ? `${firing}/10 · ${Math.round(totalKilonewtons)} kN` : "0/10";
  };
}

/** Suction fans: a fan that spins with fan power inside an arc meter. */
export function createSuctionMeter(parent: HTMLElement) {
  const root = gaugeRoot(parent, "suction", "0 0 64 76", "Suction");
  const c = 32, r = 26;
  svg("path", { d: arcPath(c, c, r, -135, 135), class: "track" }, root);
  const lit = svg("path", { d: "", class: "lit" }, root);
  const fan = svg("g", { class: "fan" }, root);
  for (let k = 0; k < 3; k++) svg("path", { d: `M${c} ${c}q-3 -10 4 -15q5 6 -4 15z`, transform: `rotate(${k * 120} ${c} ${c})` }, fan);
  svg("circle", { cx: c, cy: c, r: 3, class: "hub" }, root);
  const value = svg("text", { x: c, y: 72, class: "value" }, root);
  let angle = 0;
  return (level: number, kilonewtons: number, dt: number) => {
    angle = (angle + level * 1400 * dt) % 360;
    fan.setAttribute("transform", `rotate(${angle.toFixed(1)} ${c} ${c})`);
    lit.setAttribute("d", level > 0.02 ? arcPath(c, c, r, -135, -135 + 270 * clamp01(level)) : "");
    root.classList.toggle("on", level > 0.02);
    value.textContent = level > 0.02 ? Math.round(kilonewtons) + " kN" : "off";
  };
}
