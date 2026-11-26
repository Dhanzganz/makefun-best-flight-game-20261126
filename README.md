[![Make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![Rank](https://make.fun/badge/best-flight-game-20261126-0057/Dhanzganz/makefun-best-flight-game-20261126/rank.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![Reward](https://make.fun/badge/best-flight-game-20261126-0057/Dhanzganz/makefun-best-flight-game-20261126/reward.svg)](https://make.fun/c/best-flight-game-20261126-0057)

# Archipelago Airmail ✈️

A bush-plane mail run across a tropical island chain — a complete 3D flight game that runs offline in a desktop browser from its own files. Entry for the make.fun **best flight game** bounty (`best-flight-game-20261126-0057`).

## How to play

You fly a red-and-cream mail plane out of Coral Bay. Each mission: throttle up on the runway, lift off, thread the glowing numbered rings in order, then put the plane down gently on the destination strip. Fuel drains with throttle — green fuel rings top the tank up. Land too hard, too fast, or banked, and the mail (and the plane) is lost.

| Control | Action |
| --- | --- |
| ↑ / ↓ | Pitch down / up |
| ← / → or A / D | Bank & turn |
| SHIFT / W | Throttle up |
| CTRL / C / S | Throttle down |
| Mouse drag | Nudge pitch & roll |
| P / Esc | Pause |
| M | Mute |

Three missions, increasing in wind, ring count and fuel pressure:

1. **First Post** — 4 rings, Coral Bay → Turtle Island, calm air.
2. **Storm Run** — 6 rings, Turtle Island → Palm Cay, 6 m/s gusts.
3. **Island Grand Tour** — 8 rings over all three islands, then home; 9 m/s wind, tight fuel.

Score: +100 per ring, up to +500 landing bonus for a soft, slow, centred touchdown, minus a time penalty.

## The game

- **Chase view** over recognisable terrain: five low-poly islands with beaches, palm groves, clouds and a warm afternoon sun, with the aircraft in frame.
- **Live HUD**: altitude, speed, heading + compass strip, vertical speed, attitude indicator, fuel and throttle bars, ring counter, score and timer.
- **Instruments that read**: the attitude indicator banks and pitches with the plane; the compass strip slides with heading.
- **Decisions, not just flying**: throttle discipline vs fuel, wind drift on later missions, and landings that judge flare, speed and wings-level.
- **Sound**: fully synthesised WebAudio — engine hum tied to throttle, wind rush, ring chimes, landing fanfare. No audio files.
- **Offline**: every file it loads lives under `game/`; Three.js r160 is vendored as `game/vendor/three.min.js`.

## Play it locally

```sh
node serve.ts
# open http://localhost:8080 in desktop Chrome
```

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library.
