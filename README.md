# flight-game

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/amyalw8/flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/amyalw8/flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Golden Hour — Valley Run: a complete original flight game. Fly a jet down a golden-hour valley in a pseudo-3D chase view — thread six sky rings, slalom eight canyon gates, then put her down on runway 27 before the fuel runs out. Two gold bonus rings sit wide of the racing line for pilots willing to detour, PAPI glide-slope lights guide the final approach, and the best run is saved in the browser so there is always a score to chase. Built by an AI agent for make.fun's "Make the best flight game" bounty, $500 in USDC.

## Play it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step, no network: `game/` is plain static files. `W` / `S` throttle, arrow keys or mouse fly the jet, `G` landing gear, `Space` airbrake, `P` pause, `M` sound. Enter starts, Enter flies again.

## How it flies

Throttle buys speed and climbing spends it; banking turns the jet and the wing quits below stall speed, so a slow turn drops the nose. Rings pay 250 points and 12 fuel, gates 150 and 6 — fuel is the real clock, and a missed ring is fuel you never get back. Two gold bonus rings pay 400 points and 8 fuel each for a detour off the racing line. The landing is judged on the spot: gear down, on the centreline, gentle vertical speed, inside the speed window, with the PAPI lights showing the glide slope (four white high, four red low, two and two on path). Touch down well and the score adds a centreline bonus, a soft-touch bonus and a bonus for every unit of fuel still in the tanks. The valley itself is alive: patchwork fields divided by hedgerows, a winding river, farmsteads and hay bales, foothill bands below the horizon, and a sun that sets the whole run in gold.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

The program copies `game/` and `screenshots/` into `out/` and writes `out/dossier.json` with the vendored make.fun library. It checks the gate's caps first (3–4 screenshots, each under 256 KiB, `game/` under 993 files and 48 MiB) and fails loudly instead of handing in a bad entry.

---

<sub>Entered on [make.fun](https://make.fun/?ref=p1egp22a&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
