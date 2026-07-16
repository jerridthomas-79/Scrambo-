import type { PlayedCard } from "../game/types";

export function BuildPile({ pile, index, legal, onClick }: { pile: PlayedCard[]; index: number; legal: boolean; onClick: () => void }) {
  const top = pile[pile.length - 1];
  const next = top ? (top.resolvedRank === 12 ? 1 : top.resolvedRank + 1) : 1;
  const colorClass = top ? getBuildColorClass(top.resolvedRank) : "";
  return (
    <button
      type="button"
      className={`build-pile ${top ? "build-pile--occupied" : ""} ${colorClass} ${top?.printedRank === "WILD" ? "build-pile--wild" : ""} ${legal ? "build-pile--legal" : ""}`}
      onClick={onClick}
      disabled={!legal}
      aria-label={`Building pile ${index + 1}. ${top ? `Top card ${top.resolvedRank}.` : "Empty."} Next card required ${next}.`}
    >
      {top ? (
        <>
          <span className="build-pile__corner">{top.printedRank === "WILD" ? "★" : top.resolvedRank}</span>
          <b>{top.printedRank === "WILD" ? "SCRAM!" : top.resolvedRank}</b>
          <span className="build-pile__corner build-pile__corner--bottom">{top.printedRank === "WILD" ? "★" : top.resolvedRank}</span>
          <span className="build-pile__count">{pile.length} cards</span>
        </>
      ) : (
        <><b>1</b><span>START</span></>
      )}
    </button>
  );
}

function getBuildColorClass(rank: number): string {
  if (rank <= 4) return "build-pile--blue";
  if (rank <= 8) return "build-pile--green";
  return "build-pile--red";
}
