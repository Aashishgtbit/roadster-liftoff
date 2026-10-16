// The 0–60 drag strip: each car covers 0–60 mph in its claimed time, played in real time. Constant acceleration, so
// the distance covered grows with time squared.
const lanes = [...document.querySelectorAll<HTMLElement>(".lane")];
const raceButton = document.getElementById("raceBtn") as HTMLButtonElement;
const START_LEFT = "28px";
let racing = false;

const part = (lane: HTMLElement, selector: string) => lane.querySelector<HTMLElement>(selector)!;

raceButton.addEventListener("click", () => {
  if (racing) return;
  racing = true;
  raceButton.disabled = true;
  const start = performance.now() + 500;
  for (const lane of lanes) {
    part(lane, ".car").style.left = START_LEFT;
    part(lane, ".fill").style.width = "0%";
    part(lane, ".time").textContent = "0.00 s";
  }
  function tick(now: number) {
    let finished = true;
    for (const lane of lanes) {
      const time = parseFloat(lane.dataset.time ?? "1"), elapsed = Math.max(0, (now - start) / 1000), share = Math.min(1, elapsed / time);
      if (share < 1) finished = false;
      const distance = share * share;
      part(lane, ".car").style.left = `calc(${START_LEFT} + (100% - ${START_LEFT}) * ${distance})`;
      part(lane, ".fill").style.width = (distance * 100) + "%";
      part(lane, ".time").textContent = (share < 1 ? elapsed : time).toFixed(2) + " s";
    }
    if (!finished) requestAnimationFrame(tick);
    else { racing = false; raceButton.disabled = false; raceButton.textContent = "Run again"; }
  }
  requestAnimationFrame(tick);
});
