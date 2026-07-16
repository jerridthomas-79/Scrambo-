import { Link } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { useSetting } from "../hooks/useSetting";

export function SettingsPage() {
  const [sound, setSound] = useSetting("scrambo.soundEnabled", true);
  const [volume, setVolume] = useSetting("scrambo.soundVolume", 1);
  const [motion, setMotion] = useSetting("scrambo.motionEnabled", true);

  return <AppShell compact><section className="settings panel"><p className="eyebrow">YOUR TABLE</p><h1>Settings</h1><label className="toggle"><span><b>Sound</b><small>Turn chimes and card effects</small></span><input type="checkbox" checked={sound} onChange={(event) => setSound(event.target.checked)} /></label><label className="volume-control"><span><b>Sound effect volume</b><small>{Math.round(volume * 100)}%</small></span><input aria-label="Sound effect volume" type="range" min="0.5" max="2" step="0.1" value={volume} disabled={!sound} onChange={(event) => setVolume(Number(event.target.value))} /></label><label className="toggle"><span><b>Motion</b><small>Card movement and placard glow</small></span><input type="checkbox" checked={motion} onChange={(event) => setMotion(event.target.checked)} /></label><Link className="button button--ghost" to="/profile">Edit player name</Link><Link className="button button--primary" to="/">Done</Link></section></AppShell>;
}
