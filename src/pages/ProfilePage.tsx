import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { useAuth } from "../app/providers";
import { validateScreenName } from "../game/rules";

export function ProfilePage() {
  const { profile, updateProfile } = useAuth();
  const [name, setName] = useState(profile?.screen_name ?? localStorage.getItem("scrambo.profileName") ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const validation = validateScreenName(name);
    if (validation) return setError(validation);
    setBusy(true);
    try {
      await updateProfile(name);
      navigate("/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save your name.");
    } finally {
      setBusy(false);
    }
  }

  return <AppShell><section className="panel profile-panel"><p className="eyebrow">PLAYER ONE, REPORT IN</p><h1>{profile ? "Edit your name" : "What should we call you?"}</h1><p>This stays with this browser, so JT and Kaci can each have their own seat.</p><form onSubmit={(event) => void submit(event)}><label htmlFor="screen-name">Screen name</label><input id="screen-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={20} autoFocus autoComplete="nickname" /><small>2–20 characters. Emoji welcome.</small>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button--primary" disabled={busy}>{busy ? "Saving…" : "Save player"}</button></form></section></AppShell>;
}
