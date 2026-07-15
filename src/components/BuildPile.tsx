import type { PlayedCard } from "../game/types";

export function BuildPile({ pile, index, legal, onClick }: { pile: PlayedCard[]; index: number; legal: boolean; onClick: () => void }) {
  const top = pile[pile.length - 1];
  const next = top ? (top.resolvedRank === 12 ? 1 : top.resolvedRank + 1) : 1;
  return (
    <button
      type="button"
      className={`build-pile ${legal ? "build-pile--legal" : ""}`}
      onClick={onClick}
      disabled={!legal}
      aria-label={`Building pile ${index + 1}. ${top ? `Top card ${top.resolvedRank}.` : "Empty."} Next card required ${next}.`}
    >
      {top ? <><b>{top.printedRank === "WILD" ? "★" : top.resolvedRank}</b><span>{pile.length} cards</span></> : <><b>1</b><span>START</span></>}
    </button>
  );
}
