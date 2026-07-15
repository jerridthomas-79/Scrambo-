import { Link } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { useSetting } from "../hooks/useSetting";

export function SettingsPage() {
  const [sound, setSound] = useSetting("scrambo.soundEnabled", true);
  const [motion, setMotion] = useSetting("scrambo.motionEnabled", true);
  return <AppShell compact><section className="settings panel"><p className="eyebrow">YOUR TABLE</p><h1>Settings</h1><label className="toggle"><span><b>Sound</b><small>Turn chimes and card effects</small></span><input type="checkbox" checked={sound} onChange={(event) => setSound(event.target.checked)} /></label><label className="toggle"><span><b>Motion</b><small>Card movement and placard glow</small></span><input type="checkbox" checked={motion} onChange={(event) => setMotion(event.target.checked)} /></label><Link className="button button--ghost" to="/profile">Edit player name</Link><Link className="button button--primary" to="/">Done</Link></section></AppShell>;
}
