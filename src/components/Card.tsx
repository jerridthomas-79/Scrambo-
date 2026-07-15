import type { Card as CardType } from "../game/types";

interface CardProps {
  card: CardType | null;
  hidden?: boolean;
  selected?: boolean;
  disabled?: boolean;
  priority?: boolean;
  small?: boolean;
  allowEmpty?: boolean;
  onClick?: () => void;
  label?: string;
}

export function Card({ card, hidden, selected, disabled, priority, small, allowEmpty, onClick, label }: CardProps) {
  const rank = card?.rank ?? "";
  return (
    <button
      type="button"
      className={`card ${hidden ? "card--back" : ""} ${rank === "WILD" ? "card--wild" : ""} ${selected ? "card--selected" : ""} ${priority ? "card--priority" : ""} ${small ? "card--small" : ""}`}
      disabled={disabled || (!card && !hidden && !allowEmpty)}
      onClick={onClick}
      aria-label={label ?? (hidden ? "Face-down card" : card ? `${rank} card` : "Empty card slot")}
    >
      {hidden ? <span className="card__monogram">S</span> : card ? <CardRank rank={card.rank} /> : <span className="card__empty">EMPTY</span>}
    </button>
  );
}

function CardRank({ rank }: { rank: CardType["rank"] }) {
  return (
    <>
      <span className="card__corner">{rank === "WILD" ? "★" : rank}</span>
      <span className="card__rank">{rank === "WILD" ? "SCRAM!" : rank}</span>
      <span className="card__corner card__corner--bottom">{rank === "WILD" ? "★" : rank}</span>
    </>
  );
}
