// The 0–60 drag strip: each car covers 0–60 mph in its claimed time, played in real time.
// drag strip: constant acceleration, so distance grows with time squared
  const lanes = [...document.querySelectorAll(".lane")];
  const raceBtn = document.getElementById("raceBtn");
  let racing = false;
  raceBtn.addEventListener("click", () => {
    if (racing) return; racing = true; raceBtn.disabled = true;
    const start = performance.now() + 500;
    lanes.forEach(l => { l.querySelector(".car").style.left = "28px"; l.querySelector(".fill").style.width = "0%"; l.querySelector(".time").textContent = "0.00 s"; });
    function tick(now) {
      let done = true;
      for (const l of lanes) {
        const T = parseFloat(l.dataset.time), el = Math.max(0, (now - start) / 1000), p = Math.min(1, el / T);
        if (p < 1) done = false;
        const pos = p * p;
        l.querySelector(".car").style.left = `calc(28px + (100% - 28px) * ${pos})`;
        l.querySelector(".fill").style.width = (pos * 100) + "%";
        l.querySelector(".time").textContent = (p < 1 ? el : T).toFixed(2) + " s";
      }
      if (!done) requestAnimationFrame(tick); else { racing = false; raceBtn.disabled = false; raceBtn.textContent = "Run again"; }
    }
    requestAnimationFrame(tick);
  });
