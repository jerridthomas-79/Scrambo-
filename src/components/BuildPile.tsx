import type { PlayedCard } from "../game/types";

export function BuildPile({ pile, index, legal, onClick }: { pile: PlayedCard[]; index: number; legal: boolean; onClick: () => void }) {
  const top = pile[pile.length - 1];
  const next = top ? (top.resolvedRank === 12 ? 1 : top.resolvedRank + 1) : 1;
  const colorClass = top ? getBuildColorClass(top.resolvedRank) : "";
  const isWild = top?.printedRank === "WILD";
  return (
    <button
      type="button"
      className={`build-pile ${top ? "build-pile--occupied" : ""} ${colorClass} ${isWild ? "build-pile--wild" : ""} ${legal ? "build-pile--legal" : ""}`}
      onClick={onClick}
      disabled={!legal}
      aria-label={`Building pile ${index + 1}. ${top ? `Top card ${top.resolvedRank}${isWild ? ", played as a wild" : ""}.` : "Empty."} Next card required ${next}.`}
    >
      {top ? (
        <>
          <span className="build-pile__corner">{isWild ? "★" : top.resolvedRank}</span>
          <span className={`build-pile__rank ${isWild ? "build-pile__rank--wild" : ""}`}>{top.resolvedRank}</span>
          {isWild && <span className="build-pile__wild-label">SCRAM!</span>}
          <span className="build-pile__corner build-pile__corner--bottom">{isWild ? "★" : top.resolvedRank}</span>
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
