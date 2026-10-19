import { useEffect, useRef, useState, type FormEvent } from "react";
import { passwordLogin, type HubAuthState } from "@/lib/auth";
import { Icon } from "@/components/Icon";
import "./PilotLoginDialog.css";

export function PilotLoginDialog({ onClose, onAuthenticated }: { onClose: () => void; onAuthenticated: (auth: HubAuthState) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setBusy(true);
    try { onAuthenticated(await passwordLogin(username, password)); onClose(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "登入失敗"); }
    finally { setBusy(false); }
  };
  return <dialog ref={dialog} className="community-hub-pilot-login" onCancel={onClose} aria-labelledby="pilot-login-title">
    <form onSubmit={submit}>
      <header><h2 id="pilot-login-title">測試版管理員登入</h2><button type="button" onClick={onClose} aria-label="關閉登入"><Icon name="x" /></button></header>
      <p>使用獨立測試帳號；操作只會影響測試版。</p>
      <label>帳號<input autoComplete="username" autoFocus required value={username} onChange={event => setUsername(event.target.value)} /></label>
      <label>密碼<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>
      <p role="alert">{error}</p><button type="submit" disabled={busy}>{busy ? "登入中…" : "登入"}</button>
    </form>
  </dialog>;
}
