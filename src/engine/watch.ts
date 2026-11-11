export function latestPlayedIndex(generations: { games: readonly unknown[] }[]): number {
  for (let index = generations.length - 1; index >= 0; index -= 1) {
    if (generations[index].games.length > 0) return index;
  }
  return 0;
}
