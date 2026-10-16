# Roadster Liftoff

An unofficial fan page about the Tesla Roadster unveiling on October 15, 2026, built around two
real-time 3D stunts that are **computed by a physics simulation**, with sound generated live from the same numbers.

![The lineup jump](docs/lineup-jump.png)

> **Fan project.** Not affiliated with or endorsed by Tesla or SpaceX. The car is a fan-made model built from
> Tesla's public launch photos and videos, not official design data, and no Tesla images are included in this repo.
> Masses, thrusts and other physics values are estimates. Tesla, Roadster, Cybertruck, Cybercab and Semi are
> trademarks of Tesla, Inc.

## The two stunts

**Lineup jump.** The car spools its floor jets, lifts off, rolls 360° along its direction of travel over two
sedans, a Semi cab, a Cybertruck and a Cybercab, and glides down to land at about 2 m/s.

**Ramp hang.** Suction fans pull the car onto a tall curved wall. It climbs past vertical, pauses upside down
about 12 m up, creeps to the end of the runway and tips off upside down. Past the runway it rolls 180° about
its own length (an x-axis flip), so it comes up on its wheels facing the opposite way to the runway, hovers slowly
down on its jets, settles at the foot of the ramp and drives away.

![The ramp hang, six moments](docs/ramp-hang.png)

## Run it

It is a single static page. Open `index.html` in a browser, or serve the folder:

```bash
npm start
```

Three.js loads from the jsDelivr CDN, so the page needs a network connection the first time.

Controls in the 3D view:

| Control | What it does |
| --- | --- |
| **Choose a stunt** | Switch between Lineup jump and Ramp hang |
| **Sound** | Turn the live sound on or off (browsers only allow audio after a click) |
| **Wing** | Cycle Tesla's Track Mode aero: Road (stowed), High-Downforce, Low-Drag |
| **Free look** | Drag to orbit the car; click again to return to the cinematic camera |
| **Pause / Replay** | Pause the run or restart it |

## How the simulation works

Everything runs at a fixed 240 Hz in the browser:

- **Rigid body.** A 1,900 kg car with separate roll, pitch and yaw inertia.
- **Suspension and tyres.** Each wheel casts a ray to the ground or the curved ramp and rides its own spring and
  damper. Tyre grip stays inside a friction circle (μ 1.15).
- **Ten cold-gas nozzles.** Four under the floor near the wheel arches, four in the diffuser, two in the nose,
  each pushing from its real position with about 40 ms of valve lag, so uneven firing turns the car.
- **Suction fans.** Up to 1.6 times the car's weight, pulling the floor toward the surface the wheels are on.
- **Aero.** Drag, plus downforce that depends on the wing mode.
- **Flight computer.** The car was remote-operated on the night; here a controller flies each stunt phase by phase:
  roll profiles, a quaternion attitude hold, heading hold with the nose jets, sideways drift cancelling, a landing glide path and a
  hover descent.

The sound is synthesised with the Web Audio API from the simulation state: motor whine from wheel speed, tyre
roar, jet hiss and roar from total thrust, a pop as each valve opens, fan whine from suction, and a landing thump
scaled by the touchdown speed. Volume and stereo pan follow the camera.

## Tests

`test/physics.test.mjs` extracts the physics code straight from `index.html`, runs both stunts headlessly and
checks the outcomes: lineup clearance, apex height, a full roll, landing speed, drift, hang height and where the
ramp stunt lands.

```bash
npm install
npm test
```

## Publish with GitHub Pages

In the repository settings, open **Pages**, choose **Deploy from a branch**, and pick `main` with the root folder.
The page has no build step.

## Sources

- [CNN: Tesla unveils what it says is a flying car](https://edition.cnn.com/2026/10/15/business/tesla-unveils-what-it-says-is-a-flying-car)
- [Electrek: Tesla unveils Cyberfied new Roadster that can kickflip](https://electrek.co/2026/10/15/tesla-unveils-cyberfied-new-roadster-kickflip/)
- [Electrek: Roadster event after nearly 9 years of delays](https://electrek.co/2026/10/13/tesla-roadster-event-thursday-nine-years-delays/)
- [Dezeen: Tesla launches flying Roadster concept car](https://www.dezeen.com/2026/10/16/tesla-launches-flying-roadster-concept-car/)
- [Fox Business: New Roadster takes flight at SpaceX facility](https://www.foxbusiness.com/technology/teslas-new-roadster-makes-flying-debut-hitting-60-mph-under-second)
- Tesla's launch posts on X: [the ramp](https://x.com/Tesla/status/2110913438293647789), [Track Mode](https://x.com/Tesla/status/2110905133785829671), and [Elon Musk's lineup jump](https://x.com/elonmusk/status/2110913107094606330)
