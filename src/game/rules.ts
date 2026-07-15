import type { Card, NumberRank, PlayedCard } from "./types";

export function nextRequiredRank(pile: readonly PlayedCard[]): NumberRank {
  if (pile.length === 0) return 1;
  const top = pile[pile.length - 1];
  if (!top || top.resolvedRank === 12) return 1;
  return (top.resolvedRank + 1) as NumberRank;
}

export function canPlayOnBuild(card: Card, pile: readonly PlayedCard[]): boolean {
  return card.rank === "WILD" || card.rank === nextRequiredRank(pile);
}

export function resolveForBuild(card: Card, pile: readonly PlayedCard[]): PlayedCard {
  if (!canPlayOnBuild(card, pile)) {
    throw new Error(`That pile needs a ${nextRequiredRank(pile)}.`);
  }
  return {
    cardId: card.id,
    printedRank: card.rank,
    resolvedRank: card.rank === "WILD" ? nextRequiredRank(pile) : card.rank,
  };
}

export function isCompletedPile(pile: readonly PlayedCard[]): boolean {
  return pile[pile.length - 1]?.resolvedRank === 12;
}

export function legalBuildTargets(card: Card, piles: readonly PlayedCard[][]): number[] {
  return piles.flatMap((pile, index) => (canPlayOnBuild(card, pile) ? [index] : []));
}

export const SCREEN_NAME_PATTERN = /^[\p{L}\p{N} '\-\p{Emoji_Presentation}\p{Extended_Pictographic}]+$/u;

export function validateScreenName(value: string): string | null {
  const name = value.trim();
  if (name.length < 2 || name.length > 20) return "Use 2–20 characters.";
  if (!SCREEN_NAME_PATTERN.test(name)) return "Use letters, numbers, spaces, apostrophes, dashes, or emoji.";
  return null;
}
