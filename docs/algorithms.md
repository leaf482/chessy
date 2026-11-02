# Algorithms

## What a preset fixes

A preset fixes four things.

1. The search procedure
2. The evaluation function's inputs
3. The starting genome
4. Whether the generation loop may change that genome

After choosing a preset, the user adjusts the budget only. There is no per-square weight editor.

| id | Search | Evaluation | Start | Evolution |
| --- | --- | --- | --- | --- |
| classic | negamax, alpha-beta | material | fixed material, PST all 0 | off |
| positional | same | material + PST + sparse terms | authored tables | off |
| darwin | same | same shape as Positional | Positional tables, PST noised once at standard deviation 2 | on |
| horizon | iterative deepening + quiescence | same shape as Positional | Positional tables | off |
| surveyor | UCT Monte Carlo | rollouts | genome unused by evaluation | off in phase 3 |
| synapse | negamax | small fully connected net | small random weights | phase 4 |

Comparisons use the same `Budget`. Preset cards show the default budget. When Evolve and Play use a different budget, the screen shows those numbers as they are.

## Shared rules

- Scores are from White's point of view. When Black searches, negamax flips the sign.
- Mate scores sit outside the material range. A faster mate scores higher: `100_000 - ply`.
- Stalemate, insufficient material, the fifty-move rule, and threefold repetition score 0.
- Phase-1 move ordering is captures first. Killer moves and history heuristics wait for the Horizon phase.

## Classic evaluation

Piece values, in centipawns:

| Pawn | Knight | Bishop | Rook | Queen |
| --- | --- | --- | --- | --- |
| 100 | 320 | 330 | 500 | 900 |

The king is not material. Every PST entry is 0.

This preset is the frozen anchor. Darwin's fitness reference is this evaluation and this search.

## Positional evaluation

```text
score = material · counts + pst[piece][square] + terms · features
```

- `counts` is a length-5 vector of white piece counts minus black piece counts.
- PST tables are stored from White's view. Black reads the same table with ranks flipped.
- Square index is `file + rank * 8`, with a1 at 0.
- In phase 1, `terms` has length 3: `[bishop pair, legal-move count, doubled pawns]`. The doubled-pawn coefficient is negative.
- The starting tables are hand-written: central pawns and developed knights get a small positive value, knights on the rim get a small negative value. Implementation keeps the constants in `presets.ts`. The test only locks that a central knight outscores a corner knight. The full tables are not copied into this doc.

Positional is the readable reference individual. Darwin starts from the Positional tables. Starting Darwin from the empty Classic tables is not a leftover experiment flag.

## Search: negamax

The default search for phases 1–2.

1. At depth 0, or when the node budget is spent, return the evaluation.
2. With no legal moves, return mate or stalemate according to check.
3. Otherwise choose the child maximum with alpha-beta.
4. On a root tie, pick with the seeded RNG and report `tieBreak: true` on the telemetry.

Play's default budget is depth 4 and 50_000 nodes. Self-play inside a generation is depth 2 and 2_000 nodes. Same function, different budget.

In the Horizon phase, iterative deepening comes first, and quiescence that follows captures and checks replaces the depth-0 return. The genome stays the same.

## Surveyor

Phase 3. Expand a tree with UCT. Rollouts draw uniformly among legal moves. The default simulation count is 200.

Evolving the rollout policy is outside this preset. If it is added later, it gets a new preset id.

## Synapse

Phase 4 design, fixed now and implemented later.

- Input: 12 piece planes of 64 squares, plus one side-to-move input. 12×64+1 = 769.
- One hidden layer, 32 units, tanh.
- One output, the score from White's point of view.
- The genome is those weights and biases flattened into one array.
- Search is the same negamax as Classic. The evaluation is what changes.
- The schema splits at `schema: 2` instead of stretching the shared `Genome` arrays.

## Darwin generation

Order inside one generation:

1. Sort the current population by id ascending. Default size 12. That order is the pairing order.
2. Opponents come from a fixed ring, not from sampling.
   - Anchor: each individual plays Classic twice, white then black. 24 games.
   - Population: index `i` plays `i+1` (the last plays 0) twice, white then black. 24 games. Each individual meets two neighbors and plays 4 games inside the population.
   - Hall of fame: when it is non-empty, draw one member with the seed at the start of the generation. Every individual plays that opponent twice. 24 games. The first generation skips this block, for 48 games total. Later generations play 72.
3. A game scores 1 for a win, 0.5 for a draw, and 0 for a loss. An individual's points are means, not sums. Anchor games are 2 and ring games are 4, so a raw sum would weigh the ring more.
4. Components and fitness:

```text
anchorPoints = mean of the 2 Classic games
peerPoints   = mean of the 4 ring games
famePoints   = mean of the 2 hall games, or null when the hall is empty

fitness = (anchorPoints + peerPoints) / 2                         when famePoints is null
          (anchorPoints + peerPoints + famePoints) / 3            otherwise
```

Each component is in 0..1, so fitness is in 0..1. The first generation has two components. Compare generations on `anchorPoints` rather than on fitness alone.

5. Sort by fitness descending. Ties break by id ascending. Rank is not shaken by randomness.
6. Copy the top 2 into the next generation unchanged. Record `parents: [id, id]` so an elite is recognizable.
7. Fill the other 10 slots by picking two parents with tournament size 3, then crossover and mutation.

Games cap at 80 plies. Past the cap the game is a draw and `reason` is `"ply-cap"`. The fitness formula stays the same.

Random draws from games and from mutation stay in a fixed order so they do not interleave differently across runs.

1. One hall-of-fame opponent. Skip this draw when the hall is empty.
2. Anchor 24, ring 24, hall 24. Inside a game, only root tie-breaks consume randomness, and only when a tie occurs.
3. After fitness is computed, build the 10 non-elite slots in rank order. Finish parent tournament, crossover, and per-locus mutation for one slot before the next slot.

### Crossover

Each of the 5 material genes, 384 PST genes, and 3 term genes is a locus.

Each locus is taken from parent A or parent B with equal probability. Values are not averaged. Averaging pulls values toward the middle every generation.

The child gets a new id. `parents` stores the two parent ids.

### Mutation

Non-elite children only.

- Each locus mutates with probability 0.08.
- Material and terms: add a rounded Gaussian with mean 0 and standard deviation 8.
- PST: add a rounded Gaussian with mean 0 and standard deviation 4.
- Clamp material to 50..2000, PST to -80..80, and terms to -200..200.

Gaussian draws use Box–Muller on two uniform draws from the run RNG. No separate random library.

### Hall of fame

After a generation, insert the individual with the highest `anchorPoints`. If that genome id is already present, replace the entry only when the new anchor score is higher. Cap the hall at 8, dropping the lowest anchor scores first.

The extra opponent next generation is one hall member chosen by the seed. The first generation, with an empty hall, skips those games.

## Metrics on screen

| Metric | Computation |
| --- | --- |
| Generation | `GenerationRecord.index` |
| Population | population length |
| Best fitness | highest `fitness` that generation |
| Anchor | the best individual's `anchorPoints`, and how many anchor games it played |
| Nodes/s | nodes from the last search or generation, divided by seconds |
| Elite | an individual whose `parents[0] === parents[1]` |

Elo, win-probability forecasts, and an "intelligence" score are not computed.

## Reproduction

The same `schema`, preset id, `seed`, budget, and app version produce the same generation-1 move lists and the same final best genome.

A different app version may change move ordering, and reproduction is then not guaranteed. The log stores `appVersion`.

## Known limit

Depth-2 self-play misses a lot of one-move tactics. Anchor score against Classic can stay flat as generations pass. That result is the measurement at that budget.

A separate development check asks whether an individual whose central-pawn weight was nudged upward then scores that pawn higher on a symmetric position. The check wires the evolution operators to the genome. It is not a strength claim.
