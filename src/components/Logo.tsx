import { Link } from "react-router-dom";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className={`logo ${compact ? "logo--compact" : ""}`} aria-label="Scram-Bo home">
      <span className="logo__scram">SCRAM</span><span className="logo__dash">–</span><span className="logo__bo">BO!</span>
    </Link>
  );
}
