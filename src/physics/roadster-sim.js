// The physics. Pure: no DOM, no rendering; three.js is passed in for its vector maths. The tests import this file directly.

/* ---------- physics: a rigid body on four sprung wheels, pushed by ten cold-gas thrusters ---------- */
// Fixed 240 Hz steps. Gravity, tyre grip, suspension, fan suction, aero drag and every nozzle's force and torque are
// integrated; a scripted flight computer (the car was remote-operated on the night) decides how hard each nozzle fires.
// Two stunts from the night: "jump" (roll over the lineup) and "ramp" (climb a curved wall on suction, pause upside down,
// tip off the end of the runway, roll 180° about its length to land on the wheels, then drive away).
// A third mode, "drive", hands the controls to the player: throttle, steering, jets and boost, with fuel, and solid
// obstacle boxes the car can hit, bust through (crates, at speed), or land on.
function makeRoadsterSim(THREE, C) {
  const V = THREE.Vector3, Q = THREE.Quaternion;
  const M = 1900, g = 9.81, I = new V(820, 3900, 3500);          // kg; roll, yaw, pitch inertia (kg m²)
  const LS0 = 0.10, LFREE = LS0 + (M * g / 4) / 66000, LMAX = LFREE + 0.04, LMIN = 0.025;
  const K = 66000, DAMP = 5600, BUMP = 900000, MU = 1.15, CLAT = 9000;
  const VT = 9.5, SPOOL_AT = C.X_TAKE - 2.0, BURN = C.BURN ?? 0.26, T_ROLL = C.T_ROLL ?? 1.5, ROLL_AT = C.ROLL_AT ?? 0.3;
  const RAMP = C.ramp, FAN_MAX = 1.6 * M * g, TH_HANG = C.TH_HANG ?? 0.74 * Math.PI, HANG_T = C.HANG_T ?? 1.3, T_ROLL_R = C.T_ROLL_R ?? 0.8;
  const DT = 1 / 240;
  const wheels = C.XW.flatMap(x => [1, -1].map(s => ({ hp: new V(x, C.WR - C.COM + LS0, s * C.TRACK_Z), len: LS0, prevLen: LS0, F: 0, spin: 0, contact: false })));
  const noz = C.nozzles.map(n => ({ ...n, T: 0, cmd: 0 }));
  const down = noz.filter(n => n.group === "down"), front = noz.filter(n => n.group === "front"), rear = noz.filter(n => n.group === "rear");
  const HULL = [];
  // floor and roof line of the body at tail, middle and nose (relative to the centre of mass)
  for (const [x, lo, hi] of [[-2.2, -0.37, 0.38], [0, -0.44, 0.58], [2.2, -0.27, -0.06]]) for (const z of [-0.85, 0.85]) HULL.push(new V(x, lo, z), new V(x, hi, z));
  const st = { pos: new V(), vel: new V(), q: new Q(), w: new V(), phase: "Approach", pt: 0, roll: 0, pitch: 0, t: 0, wing: 1, scn: "jump", fan: 0, fanCmd: 0, flip0: 0, contacts: 0,
    input: { throttle: 0, steer: 0, jet: false, boost: false }, fuel: 100, steerAng: 0, boxes: [] };
  const BUST_SPEED = C.BUST_SPEED ?? 12.5;   // m/s (45 km/h): crates give way above this
  const _a = new V(), _b = new V(), _c = new V(), _d = new V(), _f = new V(), _l = new V(), _r = new V(), _F = new V(), _T = new V(), _qi = new Q(), _wb = new V(), _Iw = new V(), _n = new V(), _yb = new V();
  function reset(scn = st.scn) {
    st.scn = scn;
    st.pos.set(scn === "ramp" ? RAMP.cx - 18 : scn === "drive" ? -6 : C.X_TAKE - 16, C.COM, 0); st.vel.set(0, 0, 0); st.q.identity(); st.w.set(0, 0, 0);
    st.fuel = C.FUEL0 ?? 60; st.steerAng = 0;
    st.phase = scn === "drive" ? "Ready" : "Approach"; st.pt = 0; st.roll = 0; st.pitch = 0; st.t = 0; st.fan = 0; st.fanCmd = 0;
    for (const w of wheels) { w.len = w.prevLen = LS0; w.spin = 0; w.contact = false; }
    for (const n of noz) n.T = n.cmd = 0;
  }
  const setPhase = p => { st.phase = p; st.pt = 0; };
  function addForceAt(F, P) { _F.add(F); _r.subVectors(P, st.pos); _T.add(_c.crossVectors(_r, F)); }
  function bodyAngles() {
    _f.set(1, 0, 0).applyQuaternion(st.q);
    _qi.copy(st.q).invert(); _wb.copy(st.w).applyQuaternion(_qi);
    return { pitch: Math.asin(Math.max(-1, Math.min(1, _f.y))), yaw: Math.atan2(-_f.z, _f.x), wx: _wb.x, wy: _wb.y, wz: _wb.z, fx: _f.x, fy: _f.y };
  }
  // where a wheel's suspension ray meets the world: the flat ground, or (ramp stunt) the inside of the curved wall
  function contact(P, d) {
    let best = null;
    if (-d.y > 0.3) best = { len: (P.y - C.WR) / -d.y, nx: 0, ny: 1 };
    for (const b of st.boxes) {
      if (b.gone || P.z < b.z0 || P.z > b.z1) continue;
      if (b.ramp) {   // kicker ramp: a wedge rising from 0 at x0 to height h at x1
        const L = b.x1 - b.x0, nl = Math.hypot(b.h, L), nx = -b.h / nl, ny = L / nl;
        const dist0 = nx * (P.x - b.x0) + ny * P.y, dn = -(d.x * nx + d.y * ny);
        if (dn < 0.3 || dist0 < -0.3) continue;
        const len = (dist0 - C.WR) / dn, fx = P.x + d.x * len - nx * C.WR;
        if (fx >= b.x0 && fx <= b.x1 && (!best || len < best.len)) best = { len, nx, ny };
        continue;
      }
      if (-d.y < 0.3 || P.x < b.x0 || P.x > b.x1 || P.y < b.y1 - 0.05) continue;
      const len = (P.y - b.y1 - C.WR) / -d.y;
      if (!best || len < best.len) best = { len, nx: 0, ny: 1 };
    }
    if (st.scn === "ramp" && Math.abs(P.z) < RAMP.hw) {
      const r = RAMP.R - C.WR, qx = P.x - RAMP.cx, qy = P.y - RAMP.R, a = d.x * d.x + d.y * d.y;
      const b = 2 * (qx * d.x + qy * d.y), c = qx * qx + qy * qy - r * r, disc = b * b - 4 * a * c;
      if (a > 0.05 && disc > 0) {
        const len = (-b + Math.sqrt(disc)) / (2 * a), wx = qx + d.x * len, wy = qy + d.y * len;
        const th = Math.atan2(wx, -wy), ln = Math.hypot(wx, wy), nx = -wx / ln, ny = -wy / ln;
        if (th > 0.02 && th < RAMP.thMax && -(d.x * nx + d.y * ny) > 0.3 && (!best || len < best.len)) best = { len, nx, ny };
      }
    }
    return best;
  }
  // torque (in the car's frame) that turns it toward a target orientation along the shortest rotation, rate-limited
  const _qe = new Q(), _qt = new Q(), _qy = new Q(), _ax = new V();
  function attitude(qT, wMax, kw) {
    _qe.copy(st.q).invert().multiply(qT);
    if (_qe.w < 0) _qe.set(-_qe.x, -_qe.y, -_qe.z, -_qe.w);
    const ang = 2 * Math.acos(Math.min(1, _qe.w)), sn = Math.sqrt(Math.max(1e-9, 1 - _qe.w * _qe.w)), wd = Math.min(wMax, 3.2 * ang);
    const wb = _Iw.copy(st.w).applyQuaternion(_qi.copy(st.q).invert());
    return { tx: I.x * kw * (_qe.x / sn * wd - wb.x), ty: I.y * kw * (_qe.y / sn * wd - wb.y), tz: I.z * kw * (_qe.z / sn * wd - wb.z), ang };
  }
  // split a wanted lift and roll / pitch torque across the four floor nozzles (they can only push)
  function allocDown(Tv, tx, tz) {
    for (const n of down) { const T = Tv / 4 + tz / (4 * n.p.x) - tx / (4 * n.p.z); n.cmd = Math.max(0, Math.min(1, T / n.Tmax)); }
  }
  // the two nose nozzles sit either side of the centreline, so firing one more than the other turns the car (yaw)
  function yawHold(A, scale) {
    // wanted torque about the world vertical, expressed in the car's frame (it may be upside down);
    // a nose nozzle pushes backwards, so one at +z twists the car by -z * thrust about its own y axis
    _yb.set(0, I.y * (-6 * A.yaw - 4 * st.w.y), 0).applyQuaternion(_qi.copy(st.q).invert());
    for (const n of front) n.cmd = Math.max(n.cmd, Math.max(0, Math.min(1, _yb.y / (-n.p.z) / n.Tmax)) * scale);
  }
  // spin up quickly, coast at a steady rate, stop: total turn `ang` over time `T`
  function profile(t, ang, T) {
    const r = 0.16, w = ang / (T * (1 - r)), a = w / (r * T), t1 = r * T, t2 = T - t1;
    if (t <= 0) return [0, 0];
    if (t < t1) return [0.5 * a * t * t, a * t];
    if (t < t2) return [0.5 * a * t1 * t1 + w * (t - t1), w];
    if (t < T) { const d = T - t; return [ang - 0.5 * a * d * d, a * d]; }
    return [ang, 0];
  }
  function descend(A, pitchT, rollGoal) {
    if (st.scn === "ramp") {
      const hh = Math.max(0, st.pos.y - C.COM - 0.12), ax = 1.0 * (RAMP.land - st.pos.x) - 1.8 * st.vel.x;
      const lean = Math.max(-0.3, Math.min(0.3, -ax / g)) * Math.max(0, Math.min(1, (hh - 0.4) / 1.2));
      pitchT = I.z * (30 * (lean - A.pitch) - 10 * A.wz);
    }
    // touch down at ~1.5 m/s: follow a constant-deceleration glide path, with feedforward
    const h = Math.max(0, st.pos.y - C.COM - 0.12), DEC = 7, vWant = -(0.8 + Math.sqrt(2 * DEC * h));
    const ff = st.vel.y < vWant + 0.5 ? DEC : 0;
    const up = Math.max(0.3, _a.set(0, 1, 0).applyQuaternion(st.q).y);
    // lean the thrust a few degrees to steer back onto the centreline, then level again before the wheels touch
    const lean = Math.max(-0.3, Math.min(0.3, -(0.12 * st.pos.z + 0.55 * st.vel.z))) * Math.max(0, Math.min(1, (h - 0.4) / 1.2));
    allocDown(Math.max(0, M * (g + ff + 15 * (vWant - st.vel.y))) / up, I.x * (40 * (rollGoal + lean - st.roll) - 10 * A.wx), pitchT);
    yawHold(A, 1);
    if (wheels.some(w => w.contact)) setPhase("Touchdown");
  }
  function control() {
    const A = bodyAngles(), fwd = _f.x * st.vel.x + _f.y * st.vel.y + _f.z * st.vel.z;
    let drive = 0;
    for (const n of noz) n.cmd = 0;
    const pitchT = I.z * (30 * -A.pitch + 10 * -A.wz);
    const brakeJets = () => { for (const n of fwd > 0 ? front : rear) n.cmd = 0.7; };
    if (st.scn === "drive") {
      const inp = st.input, spd = Math.abs(fwd), flying = st.contacts === 0, gas = st.fuel > 0;
      // steering eases toward the input; less lock at speed
      st.steerAng += (-inp.steer * 0.42 / (1 + spd / 14) - st.steerAng) * Math.min(1, DT * 8);
      // Roadster-like punch: ~0.9 g off the line (tyre grip caps it), 150 km/h top speed
      if (inp.throttle > 0) drive = fwd < 42 ? M * 9 * inp.throttle * (1 - Math.max(0, fwd - 30) / 12) : 0;
      else if (inp.throttle < 0) drive = fwd > 0.5 ? -M * 9 : (fwd > -8 ? -M * 4 : 0);
      else drive = -M * 0.3 * Math.sign(fwd) * Math.min(1, spd);
      if (inp.jet && gas) {
        // floor jets lift the car and hold it level; steering turns it in the air with the nose jets
        _qt.setFromAxisAngle(_ax.set(0, 1, 0), A.yaw - (flying ? inp.steer * 0.7 : 0));
        const att = attitude(_qt, 3, 8), upY = Math.max(0.3, _a.set(0, 1, 0).applyQuaternion(st.q).y);
        // climb fast to a hover about 4.5 m up (enough to clear a wall) and hold there while Space is held
        const hAG = st.pos.y - C.COM, vyWant = Math.max(-3, Math.min(7, 1.6 * (C.HOVER_H ?? 4.5) - 1.6 * hAG));
        allocDown(Math.max(0, Math.min(2.3 * M * g, M * (g + 5 * (vyWant - st.vel.y)))) / upY, att.tx, att.tz);
        for (const n of front) n.cmd = Math.max(n.cmd, Math.max(0, Math.min(1, att.ty / (-n.p.z) / n.Tmax)));
        st.fuel -= 15 * DT;
      }
      else if (flying && gas) {
        // stability assist: in the air the flight computer pulses the floor jets to keep the car level (small fuel cost)
        _qt.setFromAxisAngle(_ax.set(0, 1, 0), A.yaw);
        const att = attitude(_qt, 2.5, 5);
        allocDown(0, att.tx, att.tz); st.fuel -= 3 * DT;
      }
      if (inp.boost && gas) { for (const n of rear) n.cmd = 1; st.fuel -= 12 * DT; }
      if (!flying && !inp.jet && !inp.boost) st.fuel += 4 * DT;   // an on-board compressor slowly refills the tanks
      st.fuel = Math.max(0, Math.min(100, st.fuel));
      // stuck on its roof or side for over a second: set it back on its wheels, keeping the heading
      const upNow = _a.set(0, 1, 0).applyQuaternion(st.q).y;
      st.flipT = upNow < 0.4 && st.vel.length() < 1.5 ? (st.flipT || 0) + DT : 0;
      if (st.flipT > 1.1) {
        st.q.setFromAxisAngle(_ax.set(0, 1, 0), A.yaw); st.w.set(0, 0, 0); st.vel.set(0, 0, 0);
        st.pos.y = Math.max(st.pos.y, C.COM + 0.35); st.roll = st.pitch = 0; st.flipT = 0; C.onRecover?.();
      }
      st.phase = flying ? (inp.jet && gas ? "Flying" : "Airborne") : inp.boost && gas ? "Boost" : spd > 0.3 || inp.throttle ? "Driving" : st.phase === "Ready" ? "Ready" : "Stopped";
    } else if (st.scn === "jump") switch (st.phase) {
      case "Approach": drive = M * 2.2 * (VT - fwd); if (st.pos.x > SPOOL_AT) setPhase("Spool"); break;
      case "Spool": drive = M * 2.2 * (VT - fwd); allocDown(M * g * 0.3, 0, pitchT); if (st.pos.x >= C.X_TAKE) setPhase("Lift"); break;
      case "Lift":
        allocDown(4 * down[0].Tmax, 0, pitchT); yawHold(A, 1);
        for (const n of rear) n.cmd = Math.max(0.12, Math.min(1, (VT - fwd) * 0.6));
        if (st.pt >= BURN) setPhase("Roll"); break;
      case "Roll": {
        const tr = st.pt + BURN - ROLL_AT, [want, wantRate] = profile(tr, 2 * Math.PI, T_ROLL);
        // while the car is on its side its floor nozzles point sideways: an even burst there cancels sideways drift
        const upz = _a.set(0, 1, 0).applyQuaternion(st.q).z;
        const Tlat = Math.abs(upz) > 0.6 ? Math.max(0, -M * 4 * (st.vel.z + 0.6 * st.pos.z) * Math.sign(upz)) : 0;
        allocDown(Math.min(Tlat, 4 * down[0].Tmax * 0.7), I.x * (70 * (want - st.roll) + 16 * (wantRate - A.wx)), pitchT);
        yawHold(A, 1);
        if (tr >= T_ROLL && Math.abs(want - st.roll) < 0.12) setPhase("Descend"); break;
      }
      case "Descend": descend(A, pitchT, 2 * Math.PI); break;
    } else switch (st.phase) {
      case "Approach": drive = M * 2.2 * (6 - fwd); if (st.pos.x > RAMP.cx - 8) setPhase("Fans"); break;
      case "Fans": st.fanCmd = 1; drive = M * 2.2 * (6 - fwd); if (st.pos.x > RAMP.cx) setPhase("Climb"); break;
      case "Climb": {
        // speed along the wall eases off toward the pause near the top; gravity along the surface is fed forward
        const th = Math.atan2(st.pos.x - RAMP.cx, -(st.pos.y - RAMP.R)), vt = th < TH_HANG - 0.6 ? 6.5 : Math.max(0, 6.5 * (TH_HANG - th) / 0.6);
        st.fanCmd = 1; drive = M * g * A.fy + M * 2.5 * (vt - fwd);
        if (th >= TH_HANG - 0.04 && Math.abs(fwd) < 0.35) setPhase("Hang"); break;
      }
      case "Hang": st.fanCmd = 1; drive = M * g * A.fy - M * 3 * fwd; if (st.pt > HANG_T) setPhase("Exit"); break;
      case "Exit": {
        // creep on to the lip and tip off it slowly, as in the close-up shot; the fans cut just before the edge
        const th = Math.atan2(st.pos.x - RAMP.cx, -(st.pos.y - RAMP.R));
        st.fanCmd = th < RAMP.thMax - 0.08 ? 1 : 0;
        // tyres alone cannot push further up the overhang, so the diffuser jets help (they are firing at the lip in the video)
        drive = M * g * A.fy + M * 2.5 * (2.2 - fwd);
        for (const r_ of rear) r_.cmd = Math.max(0, Math.min(1, 0.55 + 0.4 * (2.2 - fwd)));
        if (st.contacts === 0) setPhase("Flip"); break;
      }
      case "Flip": {
        // past the end of the runway the car is upside down: roll it 180° about its own length (an x-axis flip), so it
        // comes up on its wheels facing the way it is moving. Side-on, an even burst cancels sideways drift; once the
        // floor faces the ground the jets start carrying the weight.
        st.fanCmd = 0;
        if (st.pt < 1e-6) st.flip0 = st.roll;
        const [d, rate] = profile(st.pt, Math.PI, T_ROLL_R), want = st.flip0 + d;
        const up3 = _a.set(0, 1, 0).applyQuaternion(st.q);
        let Tv = 0;
        if (up3.y > 0.3) Tv = Math.max(0, M * (g + 6 * (-2.5 - st.vel.y))) / up3.y;
        else if (Math.abs(up3.z) > 0.6) Tv = Math.max(0, -M * 4 * (st.vel.z + 0.6 * st.pos.z) * Math.sign(up3.z));
        allocDown(Math.min(Tv, 4 * down[0].Tmax * 0.7), I.x * (70 * (want - st.roll) + 16 * (rate - A.wx)), I.z * 10 * -A.wz);
        if (st.pt >= T_ROLL_R && Math.abs(want - st.roll) < 0.12) setPhase("Hover");
        if (wheels.some(w => w.contact)) setPhase("Touchdown"); break;
      }
      case "Hover": {
        // level out facing away from the ramp and hover slowly down; the diffuser or nose jets hold position over the
        // landing spot at the foot of the ramp
        const h = Math.max(0, st.pos.y - C.COM - 0.1), vWant = -Math.max(0.6, Math.min(2.2, 0.32 * h + 0.4));
        const leanZ = Math.max(-0.25, Math.min(0.25, -(0.12 * st.pos.z + 0.6 * st.vel.z)));
        _qt.setFromAxisAngle(_ax.set(1, 0, 0), leanZ).multiply(_qy.setFromAxisAngle(_ax.set(0, 1, 0), Math.PI));
        const att = attitude(_qt, 3, 8);
        const up = Math.max(0.3, _a.set(0, 1, 0).applyQuaternion(st.q).y);
        allocDown(Math.max(0, M * (g + 8 * (vWant - st.vel.y))) / up, att.tx, att.tz);
        const ax = 1.1 * (RAMP.land - st.pos.x) - 1.9 * st.vel.x, along = ax * Math.sign(A.fx || 1);
        if (along > 0) for (const n of rear) n.cmd = Math.min(1, M * along / (4 * n.Tmax));
        else for (const n of front) n.cmd = Math.min(1, M * -along / (2 * n.Tmax));
        for (const n of front) n.cmd = Math.max(n.cmd, Math.max(0, Math.min(1, att.ty / (-n.p.z) / n.Tmax)));
        if (wheels.some(w => w.contact)) setPhase("Touchdown"); break;
      }
      case "Drive off": drive = M * 2.2 * (6 - fwd); if (st.pt > 2.2) setPhase("Brake"); break;
      case "Descend": descend(A, pitchT, 0); break;
    }
    if (st.scn !== "drive") switch (st.phase) {   // shared by both stunts once the car is back on the ground
      case "Touchdown": allocDown(st.pt < 0.1 ? M * g * 0.6 : 0, 0, pitchT); drive = -M * 2.5 * fwd; if (st.pt > 0.25) setPhase(st.scn === "ramp" ? "Drive off" : "Brake"); break;
      case "Brake": drive = -M * 2.5 * fwd; if (st.pt < 0.7) brakeJets(); if (Math.abs(fwd) < 0.12 && st.pt > 0.8) setPhase("Parked"); break;
      case "Parked": drive = -M * 3 * fwd; break;
    }
    const lim = st.scn === "ramp" || st.scn === "drive" ? 34000 : 14000;
    return Math.max(-lim, Math.min(lim, drive)) / 4;
  }
  function substep() {
    const drive = control();
    _F.set(0, -M * g, 0); _T.set(0, 0, 0);
    const down_ = _d.set(0, -1, 0).applyQuaternion(st.q), up = _b.copy(down_).negate();
    let contacts = 0;
    for (const w of wheels) {
      const P = _a.copy(w.hp).applyQuaternion(st.q).add(st.pos);
      w.prevLen = w.len; w.contact = false;
      const hit = contact(P, down_);
      if (hit && hit.len < LMAX) {
        w.contact = true; contacts++; w.len = Math.max(LMIN * 0.5, hit.len);
        let F = K * (LFREE - w.len) - DAMP * (w.len - w.prevLen) / DT;
        if (w.len < LMIN) F += BUMP * (LMIN - w.len);
        F = Math.max(0, F); w.F = F;
        addForceAt(_c.copy(up).multiplyScalar(F), P);
        // tyre: a frame on the contact surface; lateral grip and drive/brake stay inside the friction circle
        _n.set(hit.nx, hit.ny, 0);
        const cp = _r.copy(P).addScaledVector(down_, w.len).addScaledVector(_n, -C.WR).clone();
        _f.set(1, 0, 0).applyQuaternion(st.q); _f.addScaledVector(_n, -_f.dot(_n)).normalize();
        if (st.steerAng && w.hp.x > 0) _f.applyAxisAngle(_n, st.steerAng);
        _l.crossVectors(_n, _f);
        const rel = _c.subVectors(cp, st.pos), vcp = _Iw.crossVectors(st.w, rel).add(st.vel);
        const vf = vcp.dot(_f), vl = vcp.dot(_l), fmax = MU * F;
        let fx = drive, fz = -vl * CLAT; const mag = Math.hypot(fx, fz); if (mag > fmax) { fx *= fmax / mag; fz *= fmax / mag; }
        addForceAt(new V().addScaledVector(_f, fx).addScaledVector(_l, fz), cp);
        w.spin = vf / C.WR;
      } else { w.len = LMAX; w.F = 0; w.spin *= Math.exp(-0.4 * DT); }
    }
    st.contacts = contacts;
    for (const h of HULL) {
      const P = _a.copy(h).applyQuaternion(st.q).add(st.pos);
      let pen = -P.y, nx = 0, ny = 1, nz = 0;
      if (st.scn === "ramp" && Math.abs(P.z) < RAMP.hw) {
        const dx = P.x - RAMP.cx, dy = P.y - RAMP.R, th = Math.atan2(dx, -dy), ln = Math.hypot(dx, dy);
        if (th > 0.02 && th < RAMP.thMax && ln - RAMP.R > pen) { pen = ln - RAMP.R; nx = -dx / ln; ny = -dy / ln; }
      }
      for (const b of st.boxes) {
        if (b.ramp) {   // body below a ramp's slope is pushed out along the slope's normal
          if (P.z < b.z0 || P.z > b.z1 || P.x < b.x0 || P.x > b.x1) continue;
          const L = b.x1 - b.x0, nl = Math.hypot(b.h, L), rx = -b.h / nl, ry = L / nl, dist = rx * (P.x - b.x0) + ry * P.y;
          if (dist < 0 && dist > -0.8 && -dist > pen) { pen = -dist; nx = rx; ny = ry; nz = 0; }
          continue;
        }
        if (b.gone || P.x < b.x0 || P.x > b.x1 || P.y < b.y0 || P.y > b.y1 || P.z < b.z0 || P.z > b.z1) continue;
        // push out through the shallowest side; the top only counts if the point came down onto it (no launching
        // a car that is scraping up a wall face)
        const faces = [[P.x - b.x0, -1, 0, 0], [b.x1 - P.x, 1, 0, 0], [P.z - b.z0, 0, 0, -1], [b.z1 - P.z, 0, 0, 1]];
        if (P.y - st.vel.y * 0.06 > b.y1 - 0.12) faces.push([b.y1 - P.y, 0, 1, 0]);
        let f = faces[0]; for (const q of faces) if (q[0] < f[0]) f = q;
        const closing = -(st.vel.x * f[1] + st.vel.y * f[2] + st.vel.z * f[3]);
        if (b.bust && closing > BUST_SPEED) { b.gone = true; st.vel.multiplyScalar(0.88); C.onBust?.(b, closing); continue; }
        if (closing > 4 && !b.hitT) C.onHit?.(b, closing);
        // an impact, not a spring: on first contact the speed into the obstacle goes at once (with a small bounce),
        // so a fast car cannot tunnel through a 1 m wall between physics steps
        if (closing > 2 && !b.hitT) { st.vel.x += f[1] * closing * 1.15; st.vel.y += f[2] * closing * 1.15; st.vel.z += f[3] * closing * 1.15; st.w.multiplyScalar(0.5); }
        b.hitT = 0.4;
        if (f[0] > pen) { pen = f[0]; nx = f[1]; ny = f[2]; nz = f[3]; }
      }
      if (pen <= 0) continue;
      _n.set(nx, ny, nz);
      const rel = _c.subVectors(P, st.pos), v = _Iw.crossVectors(st.w, rel).add(st.vel), vn = v.dot(_n);
      const Fn = Math.min(3 * M * g, Math.max(0, 400000 * pen - 30000 * vn));   // capped, so a deep overlap cannot fire the car off
      const vt = _r.copy(v).addScaledVector(_n, -vn), vtl = vt.length();
      const Ff = vtl > 1e-3 ? Math.min(0.3 * Fn, 20000 * vtl) / vtl : 0;
      addForceAt(_c.copy(_n).multiplyScalar(Fn).addScaledVector(vt, -Ff), P.clone());
    }
    for (const b of st.boxes) if (b.hitT) b.hitT = Math.max(0, b.hitT - DT);
    // suction fans: pull the floor toward whatever surface the wheels are on (they only seal with the wheels down)
    st.fan += (st.fanCmd - st.fan) * (1 - Math.exp(-DT / (st.fanCmd > st.fan ? 0.35 : 0.12)));
    if (st.fan > 0.01) _F.addScaledVector(down_, FAN_MAX * st.fan * (contacts >= 3 ? 1 : contacts * 0.15));
    // thrusters: valves lag ~40 ms; thrust pushes opposite the exhaust
    const lag = 1 - Math.exp(-DT / 0.04);
    for (const n of noz) {
      n.T += (n.cmd * n.Tmax - n.T) * lag;
      if (n.T < 1) continue;
      const P = _a.copy(n.p).applyQuaternion(st.q).add(st.pos);
      addForceAt(_c.copy(n.e).applyQuaternion(st.q).multiplyScalar(-n.T), P);
    }
    // aero: drag on the body, downforce at the wing (stowed, high-downforce, low-drag)
    const sp = st.vel.length();
    _F.addScaledVector(st.vel, -0.5 * 1.2 * 0.62 * sp);
    const CLA = [0.15, 1.3, 0.45][st.wing];
    addForceAt(_c.copy(down_).multiplyScalar(0.5 * 1.2 * CLA * sp * sp), _a.set(-2.0, 0.5, 0).applyQuaternion(st.q).add(st.pos));
    _T.addScaledVector(st.w, -350);
    // integrate (semi-implicit Euler; Euler's equations in the body frame)
    st.vel.addScaledVector(_F, DT / M); st.pos.addScaledVector(st.vel, DT);
    _qi.copy(st.q).invert();
    const tb = _c.copy(_T).applyQuaternion(_qi), wb = _wb.copy(st.w).applyQuaternion(_qi);
    _Iw.set(I.x * wb.x, I.y * wb.y, I.z * wb.z);
    const gyro = _r.crossVectors(wb, _Iw);
    wb.x += (tb.x - gyro.x) / I.x * DT; wb.y += (tb.y - gyro.y) / I.y * DT; wb.z += (tb.z - gyro.z) / I.z * DT;
    st.roll += wb.x * DT; st.pitch += wb.z * DT;
    st.w.copy(wb).applyQuaternion(st.q);
    const wq = new Q(st.w.x * DT * 0.5, st.w.y * DT * 0.5, st.w.z * DT * 0.5, 0).multiply(st.q);
    st.q.set(st.q.x + wq.x, st.q.y + wq.y, st.q.z + wq.z, st.q.w + wq.w).normalize();
    st.pt += DT; st.t += DT;
  }
  let acc = 0;
  function step(dt) {
    acc += Math.min(dt, 0.1);
    while (acc >= DT) { substep(); acc -= DT; }
    if (!isFinite(st.pos.x + st.pos.y + st.q.w)) reset();
  }
  reset();
  return { st, wheels, noz, step, reset, substep, DT, LS0, FAN_MAX };
}

export { makeRoadsterSim };
