# UI

## Reference

Borrow the information density of [spacex.com](https://www.spacex.com): black background, hairline dividers, small labels, large numbers, and one primary action with room around it. Do not take SpaceX photography, logos, sentences, or vehicle names.

Chessy's subject is the board and the generation number.

## Tone

- Sentences stay short. Buttons are verbs: `Start evolution`, `Watch game`, `Play best`, `Play anchor`.
- Product name, preset names, labels, and body copy are English.
- Status is literal. Evolution running is `Running`, stopped is `Paused`, and a failure is `Worker error` plus the message.
- Strength words are the metric names from the algorithm doc: Best fitness, Anchor.

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| background | `#000000` | page |
| surface | `#0a0a0a` | cards, side panel |
| line | `rgba(255,255,255,0.14)` | dividers, borders |
| text | `#ffffff` | titles, numbers |
| muted | `rgba(255,255,255,0.64)` | body |
| faint | `rgba(255,255,255,0.40)` | labels, inactive |
| signal | `#9ec1ff` | the single running dot. Not a decorative gradient |
| board-light | `#efefef` | light square |
| board-dark | `#161616` | dark square |
| move | `#d6e4ff` | thin border on the last-move squares |

Type:

- Body and UI: Geist Sans, then a system sans.
- Large numbers and route labels use Geist Sans with wider tracking. A separate display face is not part of the look.

Labels are 11px, uppercase, tracking 0.14em. Body is 15–16px with line-height 1.5. Hero numbers scale from 64 to 120px with the viewport, at weight 500 or below.

Corners are square. There is no shadow. Separation comes from lines and space.

## Shell

The top bar is 56px, black, with a 1px bottom border.

```text
CHESSY                 MISSION   PLAY   WATCH   LINEAGE   HALL   EVOLVE   PRESETS
```

- The wordmark goes to `/`.
- The current route is white. The others use muted.
- The right edge is status text only: `Idle` or `Gen 12 · Running`.
- The bar stays put while the page scrolls.

A footer appears on the first screen only: build version and a docs link. Board screens have no footer.

## Pages

### Mission `/`

The first screen is the cover of the current run.

```text
GENERATION
12

DARWIN
depth 2 · population 12 · seed 1042

12          7.5         1,240
GENERATION  ANCHOR      NODES/S

[ Start evolution ]  [ Play best ]  [ Play anchor ]
```

- With no run, Generation reads `00` and the supporting line describes the default preset, Darwin.
- The primary action is `Start evolution`. While a run is going, it reads `Pause`.
- `Play best` is enabled only when a best individual exists.
- `Play anchor` stores the Classic genome as the opponent and opens Play. The selected Darwin, Synapse, or Pilot preset stays put.
- Under the hero, show Anchor for the latest six generations as a row of numbers. Phase 1 does not add a chart library.

### Play `/play`

On a wide viewport the board is on the left and the spec panel on the right. On a narrow viewport the spec sits under the board.

Panel order:

1. Opponent name and preset id
2. Budget: Depth and Nodes, or the simulation count for Surveyor
3. Last search: score, nodes, pv
4. Game record. One move per line, UCI converted to coordinate notation. Each line jumps the board to the position after that move.
5. Actions are `Previous`, `Next`, `New game`, and `Flip board`

Board:

- Squares are square. Pieces are flat geometric marks. Unicode piece glyphs are an acceptable start. No textures and no wood theme.
- Files a–h and ranks 1–8 are faint labels.
- Show the selected square and the legal destinations. No coaching arrows.
- A human move is two clicks. Promotion opens queen, rook, bishop, and knight beside the board. There is no automatic queen promotion.
- While the engine thinks, the panel status becomes `Thinking`. The board is not dimmed. Previous, Next, and the move list stay put until the reply arrives.
- Previous and Next step one ply. Behind the last ply the status reads `Ply N`, legal destinations disappear, and a square does not start a move. At the last ply, play continues. A move played from there shows the new live position.

### Watch `/watch`

A player for completed game records.

- The screen opens on the last generation that has games. The generation picker still reaches the others.
- That generation's game list, the board, previous move, and next move.
- The selected game lists every move in coordinate notation. A line jumps the board to the position after that move, and the current line is white.
- Autoplay uses one speed: 600ms per move. Previous, Next, and a move line stop autoplay.
- With no games, show an empty board and `No games in this generation`.

### Lineage `/lineage`

The parent chain of one individual.

- The run follows the selected preset, the same way Watch does.
- `Played` is the latest generation. `Next` is the population that has not played yet.
- The chain follows the first parent back to a founder. Each row shows the generation, individual id, genome id, anchor score, and parent ids.
- An elite has one parent id. A child has two. Either id selects that individual.
- With no saved run, the screen says `No lineage yet.`

### Hall `/hall`

The best-so-far opponent pool for the selected preset's run.

- Order is the stored hall order: highest anchor first, then id.
- Each row shows rank, individual id, anchor score, and generation.
- The selected row shows the genome id and either the five material numbers or the weight count.
- `Play` stores that genome as the opponent and opens Play. The preset stays put.
- With no run, or an empty hall, the screen says `No hall yet.`

### Evolve `/evolve`

The control room. Controls and the log come before decorative charts.

Top row: preset, seed, budget name.

Two budgets only:

| Name | Depth | Node cap |
| --- | --- | --- |
| Rapid | 2 | 2_000 |
| Standard | 3 | 8_000 |

Below that:

- `Start`, `Pause`, `Step one generation`
- Progress for this generation, such as `18 / 72 games`. The first generation, with an empty hall, uses 48 as the denominator.
- A table: rank, first 8 characters of id, fitness, anchor, elite

Selecting a row reveals that genome's five material numbers and its parent ids. The 384 PST values stay collapsed. `Export genome` downloads that row's JSON only.

Secondary actions: `Export run`, `Import run`, `New run`. `New run` asks for confirmation before clearing the current run.

### Presets `/presets`

A card grid. Card contents:

```text
01
DARWIN
Crossover and mutation rewrite evaluation weights each generation.

SEARCH     negamax
GENOME     material + pst
EVOLVES    yes
BUDGET     depth 2 · 2,000 nodes

[ Use preset ]
```

`Use preset` stops an in-progress generation only after confirmation. A finished run stays, so Play best remains available. Frozen presets then open Play. Darwin, Synapse, and Pilot open Evolve. Evolve shows `This preset does not evolve. Play it on the board.` when the selected preset is none of those. A Synapse row shows the weight count, 24,673, instead of the five material numbers. Pilot's budget line counts simulations.

## Responsive behavior

Below 960px, the top links collapse into one `Menu`. Board width is the smaller of viewport width minus 32px and 560px.

Hover raises opacity to 1 and does not recolor the control. The focus ring is a 2px white outline.

Motion is limited to two rules:

- No page-transition animation.
- The Running dot changes opacity on a 1.2s cycle. With reduced motion enabled, the dot stays lit and still.

## Empty states and errors

| Situation | Screen |
| --- | --- |
| No saved run | Mission zeros and the Darwin description |
| Worker failed to start | `Worker error` in the panel. Board interaction stays; engine moves stop |
| Invalid JSON | `Schema mismatch` beside Import. The current run stays |
| Watch at generation 0 | The empty-list sentence |

Errors sit next to the control that caused them. There is no toast stack.

## Access

- Each square is a button named by its coordinate. Example: `e2`, or `e2 white pawn` when occupied.
- Tab to a square and press Enter to pick it up. Arrow keys move focus to the neighboring square in the direction on screen. A flipped board reverses rank and file. The edge square keeps focus. Enter is the same action as a click.
- Default contrast is white text on black. Faint labels do not replace body text.
- Check is also the word `Check` in the panel, not a color change alone.

## Copy

Mission supporting line:

> Self-play under one budget. Evaluations that outscore the anchor carry into the next generation.

Presets header:

> Search paired with an evaluation. Evolution is on for Darwin, Synapse, and Pilot.

Those two sentences are the phase-1 prose. As features grow, add spec numbers rather than more sentences.
