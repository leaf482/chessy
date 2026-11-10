# Plan

## One line

Chessy is a simulator where a population of chess individuals replaces its evaluation functions through self-play. The screen is a dark control room that leads with specs and numbers. Algorithms are chosen as presets.

## Goals

1. Play legal chess and step back through the game record.
2. Changing the preset changes the search procedure and the evaluation shape.
3. The Darwin preset repeats generations and updates the population's evaluation weights.
4. The user watches the current generation's games, or plays the anchor and the best individual.
5. A run replays from its seed.

## Out of scope

- A superhuman engine, endgame tablebases, and an opening book.
- Online play, accounts, and ratings.
- Bundling Stockfish or another external engine. Search and evaluation live in this repo so the license stays simple.
- Training on grandmaster games. Self-play is the learning signal.
- Neural evolution in the first phases. The interface stays open; the implementation waits.
- An Elo display. Score against the anchor preset is the strength proxy.

## User

One person running an experiment. They pick a preset and watch how the moves change across generations, rather than implementing the algorithm themselves.

They:

- Read a preset and run it.
- Start evolution, pause it, or step a single generation.
- Pull an individual and a game record onto the board.
- Keep the seed and the genome as JSON.

## Product surfaces

| Route | Role |
| --- | --- |
| `/` | Current run. Generation, population size, anchor score, selected preset |
| `/play` | Human versus the selected individual |
| `/watch` | Replay a game actually played in this generation |
| `/evolve` | Evolution controls. Budget, seed, generation log |
| `/presets` | Algorithm catalog |

Lineage is the phase-5 screen. Earlier phases keep parent ids in the generation log.

## Presets

A preset binds search, evaluation shape, the initial genome, and whether evolution may change that genome. Formulas are in [algorithms.md](algorithms.md).

| id | Name | First inclusion | Evolution |
| --- | --- | --- | --- |
| `classic` | Classic | Phase 1 | Frozen. Material-only anchor |
| `positional` | Positional | Phase 1 | Frozen. Hand-authored piece-square tables |
| `darwin` | Darwin | Phase 1 | On. Evolves the same genome shape as Positional |
| `horizon` | Horizon | Phase 2 | Frozen. Quiescence and deeper iterative deepening |
| `surveyor` | Surveyor | Phase 3 | Frozen. Monte Carlo tree search |
| `synapse` | Synapse | Phase 4 | On. Small neural evaluation |
| `pilot` | Pilot | Phase 6 | On. Evolves the Monte Carlo rollout prior |

Classic stays frozen. Every generation plays a set of games against it, so a population that only beats itself still pays for that in the score.

## Phases

### 0. Docs

This directory. When an implementation decision changes, update the matching doc first.

### 1. Board and anchor

A human plays Classic and Positional.

Done when:

- Legal moves, check, checkmate, stalemate, castling, en passant, promotion, the fifty-move rule, and threefold repetition are in place.
- Perft locks the rules. Starting-position perft(1..3) matches the published node counts.
- Classic, at a fixed depth, plays the same move from the same position and the same seed.
- `/`, `/play`, and `/presets` follow the screen structure in the UI doc.
- Search runs off the UI thread. The board stays operable while a move is computing.

### 2. Evolution loop

A Darwin population produces generations.

Done when:

- A finished generation logs the population, ranking, parents, and score against the anchor.
- The top two individuals are copied into the next generation with no mutation.
- The same run seed reproduces the same generation.
- A paused run resumes.
- A run exports to JSON and imports back.
- `/evolve` and `/watch` operate on that state.

### 3. Second search family

Horizon and Surveyor show that a preset chooses a search algorithm, not only a weight set.

Done when:

- Four presets move on the same board and the same telemetry.
- Each preset shows its node or simulation budget.
- A human can switch between Darwin's best individual and Horizon.

### 4. Neural genome

Synapse. Only the evaluation becomes a small network. The evolution-operator interface stays the one Darwin uses.

Decision, recorded at the start of the implementation: stay in the one worker. A depth-2 search of the start position with a 2,000-node cap finishes in tens of milliseconds. There is no Python service. Schema 2 is a separate `NetworkGenome`. The weight `Genome` is unchanged.

### 5. Lineage

Parent ids become a screen. The chain follows `parents[0]`. The other parent stays on the row and can be selected.

Done when:

- `/lineage` reads the selected preset's run. Synapse uses its own slot. Every other preset uses the Darwin run.
- An elite shows one parent id, and that id is the previous individual.
- A second parent is one click away.
- A run with no finished generation lists the initial population and shows `none` for parents.

### 6. Rollout prior

Pilot. Surveyor stays a uniform rollout. Pilot uses the same UCT search and evolves the move prior with Darwin's operators.

Done when:

- The prior is the piece-square delta plus the genome's capture material, sampled with softmax.
- A Pilot generation plays those rollouts against a one-ply Classic anchor.
- The run is stored apart from Darwin and Synapse.
- Play shows the simulation budget.

### 7. Hall

The hall of fame is the opponent pool. It becomes a screen.

Done when:

- `/hall` reads the selected preset's run. Synapse and Pilot use their own slots. Every other preset uses the Darwin run.
- Rows follow the stored order, highest anchor first.
- `Play` on a row opens that genome on the board and leaves the other runs in place.
- An empty hall says `No hall yet.`

### 8. Keyboard board

Arrow keys move across the board. Enter stays the click.

Done when:

- From a focused square, each arrow moves focus one square in that screen direction.
- Flip board reverses the mapping.
- A move off the edge leaves focus where it is.
- Enter on the focused square plays or selects, the same as a click.

## Phase 1 implementation order

1. Next.js, TypeScript, and Tailwind scaffold
2. Rules module and perft
3. Classic search and evaluation
4. Worker protocol
5. Board and Play
6. Shell, Mission, and Presets
7. Positional piece-square tables
8. Genome, tournament, and Darwin
9. Evolve, Watch, and JSON save

Do not build the evolution UI before step 8. If the moves are wrong, the evolution result cannot be read.

## Risks

| Risk | Response |
| --- | --- |
| Shallow self-play barely learns | Write that expectation in the docs and the UI. The learning signal is score against the anchor. A test checks that center and material ratios still move at depth 2. |
| A generation is too slow | Default budget: population 12, ring schedule of 48 or 72 games, depth 2. The screen offers only Rapid and Standard. |
| The population optimizes only against itself | Fitness includes the Classic anchor score. The best-so-far individual stays in the opponent pool. |
| Search freezes the UI | Pure rules and search run in the worker. The main thread renders the board and the log. |
| Scope drifts into engine research | Search improvements outside a phase's done-when arrive only as a new preset. |

## Success

After phase 1, a first-time visitor can read how the presets differ and finish a game against Classic.

After phase 2, that person runs several generations with a fixed seed, sees anchor scores accumulate in the log, and plays the resulting individual.

The bar is a reproducible log and legal moves.
