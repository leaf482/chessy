# Chessy

A chess simulator where a population plays itself, gets selected, and carries the winners into the next generation.

Several individuals play short self-play games under the same rules. The evaluation functions that score well survive. The user watches that process on a control-room screen, picks an algorithm preset, and plays the survivors directly.

The project language is English: documentation, UI copy, identifiers, and commit messages.

## Status

Phase 8 moves the board cursor with the arrow keys. Enter on the focused square is the same as a click. A flipped board reverses the direction.

```bash
npm install
npm test
npm run dev
```

## Docs

| Doc | Contents |
| --- | --- |
| [docs/plan.md](docs/plan.md) | Goals, scope, phases, done-when |
| [docs/architecture.md](docs/architecture.md) | Modules, data, worker, storage |
| [docs/algorithms.md](docs/algorithms.md) | Presets, genome, evolution operators |
| [docs/ui.md](docs/ui.md) | Screens and visual language |

## Locked decisions

- One web app. Next.js, React, TypeScript. No game server in the first versions.
- Rules, search, and evolution run in a browser Web Worker.
- The first evolvable object is evaluation weights, not a neural net.
- The screen is black, spec-first, and telemetry-first.
- Strength is the score against the frozen Classic anchor. The UI does not show an Elo estimate.

## Build order

1. Project scaffold and rules tests
2. Human games against the Classic preset
3. The Darwin generation loop and the Evolve screen
4. Horizon and Surveyor
5. Synapse
6. Lineage
7. Pilot
8. Hall
9. Keyboard board
