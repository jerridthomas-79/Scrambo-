import { describe, expect, it } from "vitest";
import { canPlayOnBuild, isCompletedPile, legalBuildTargets, resolveForBuild, validateScreenName } from "../../src/game/rules";
import type { Card, PlayedCard } from "../../src/game/types";

const card = (rank: Card["rank"]): Card => ({ id: String(rank), rank });
const pile = (...ranks: PlayedCard["resolvedRank"][]): PlayedCard[] => ranks.map((rank) => ({ cardId: String(rank), printedRank: rank, resolvedRank: rank }));

describe("building rules", () => {
  it("allows only a 1 or wild on an empty pile", () => {
    expect(canPlayOnBuild(card(1), [])).toBe(true);
    expect(canPlayOnBuild(card(2), [])).toBe(false);
    expect(resolveForBuild(card("WILD"), []).resolvedRank).toBe(1);
  });

  it("enforces sequential play and resolves wilds", () => {
    expect(canPlayOnBuild(card(7), pile(1, 2, 3, 4, 5, 6))).toBe(true);
    expect(canPlayOnBuild(card(8), pile(1, 2, 3, 4, 5, 6))).toBe(false);
    expect(resolveForBuild(card("WILD"), pile(1, 2, 3, 4, 5, 6)).resolvedRank).toBe(7);
  });

  it("completes at 12 and returns legal targets", () => {
    expect(isCompletedPile(pile(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12))).toBe(true);
    expect(legalBuildTargets(card(1), [[], pile(1), [], pile(1, 2)])).toEqual([0, 2]);
  });
});

describe("screen names", () => {
  it("accepts ordinary names and emoji", () => {
    expect(validateScreenName("JT")).toBeNull();
    expect(validateScreenName("Lady Wife 🍹")).toBeNull();
  });
  it("rejects malformed names", () => {
    expect(validateScreenName("J")).toMatch(/2–20/);
    expect(validateScreenName("name<script>")).toMatch(/letters/);
  });
});
