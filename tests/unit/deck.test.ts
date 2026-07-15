import { describe, expect, it } from "vitest";
import { createDeck, shuffle } from "../../src/game/deck";

describe("Scram-Bo deck", () => {
  it("creates 162 unique physical cards", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(162);
    expect(new Set(deck.map((card) => card.id))).toHaveLength(162);
  });

  it("contains twelve of every number and eighteen wilds", () => {
    const deck = createDeck();
    for (let rank = 1; rank <= 12; rank += 1) {
      expect(deck.filter((card) => card.rank === rank)).toHaveLength(12);
    }
    expect(deck.filter((card) => card.rank === "WILD")).toHaveLength(18);
  });

  it("shuffles without changing card membership", () => {
    const deck = createDeck();
    let value = 0.317;
    const shuffled = shuffle(deck, () => { value = (value * 7.13) % 1; return value; });
    expect(shuffled.map((card) => card.id).sort()).toEqual(deck.map((card) => card.id).sort());
    expect(shuffled.map((card) => card.id)).not.toEqual(deck.map((card) => card.id));
  });
});
