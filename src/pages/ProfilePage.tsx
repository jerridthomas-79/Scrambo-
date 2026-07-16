import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { useAuth } from "../app/providers";
import { validateScreenName } from "../game/rules";

const AVATARS = [
  { value: "🦥", label: "Sloth" },
  { value: "✈️", label: "Jet fighter" },
  { value: "🔥", label: "Fire pit" },
  { value: "🥤", label: "Orange soda" },
  { value: "🍧", label: "Popsicle bar" },
  { value: "🍫", label: "Peanut-butter cup" },
  { value: "🦖", label: "Dinosaur" },
  { value: "🚀", label: "Rocket" },
  { value: "🎸", label: "Guitar" },
  { value: "⛳", label: "Golf" },
];

export function ProfilePage() {
  const { profile, updateProfile } = useAuth();
  const [name, setName] = useState(profile?.screen_name ?? localStorage.getItem("scrambo.profileName") ?? "");
  const [avatar, setAvatar] = useState(profile?.avatar ?? localStorage.getItem("scrambo.profileAvatar") ?? "🦥");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const validation = validateScreenName(name);
    if (validation) return setError(validation);
    setBusy(true);
    try {
      await updateProfile(name, avatar);
      navigate("/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save your profile.");
    } finally {
      setBusy(false);
    }
  }

  return <AppShell><section className="panel profile-panel"><p className="eyebrow">PLAYER ONE, REPORT IN</p><h1>{profile ? "Edit your player" : "What should we call you?"}</h1><p>Your name and avatar stay with this player profile.</p><form onSubmit={(event) => void submit(event)}><label htmlFor="screen-name">Screen name</label><input id="screen-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={20} autoFocus autoComplete="nickname" /><small>2–20 characters. Emoji welcome.</small><fieldset className="avatar-picker"><legend>Choose an avatar</legend>{AVATARS.map((option) => <label key={option.label} className={`avatar-option ${avatar === option.value ? "avatar-option--selected" : ""}`}><input type="radio" name="avatar" value={option.value} checked={avatar === option.value} onChange={() => setAvatar(option.value)} /><span aria-hidden="true">{option.value}</span><small>{option.label}</small></label>)}</fieldset>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button--primary" disabled={busy}>{busy ? "Saving…" : "Save player"}</button></form></section></AppShell>;
}
