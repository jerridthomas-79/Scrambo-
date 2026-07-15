import type { Card, NumberRank } from "./types";

export function createDeck(): Card[] {
  const cards: Card[] = [];

  for (let rank = 1; rank <= 12; rank += 1) {
    for (let copy = 1; copy <= 12; copy += 1) {
      cards.push({ id: `n${rank}-${copy}`, rank: rank as NumberRank });
    }
  }

  for (let copy = 1; copy <= 18; copy += 1) {
    cards.push({ id: `w-${copy}`, rank: "WILD" });
  }

  return cards;
}

export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const left = result[i];
    const right = result[j];
    if (left !== undefined && right !== undefined) {
      result[i] = right;
      result[j] = left;
    }
  }
  return result;
}
