"use client";

import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Mode = "login" | "signup" | "reset" | "recovery";
type Session = {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  user: { id: string; email?: string; user_metadata?: { display_name?: string } };
};

const STORAGE_KEY = "numa-supabase-session";

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

async function authRequest(path: string, body?: unknown, token?: string, method: "POST" | "PUT" = "POST") {
  const current = config();
  if (!current) throw new Error("会員機能の接続設定がまだ完了していません。");
  const response = await fetch(`${current.url}/auth/v1/${path}`, {
    method,
    headers: {
      apikey: current.key,
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = result?.msg || result?.message || result?.error_description || "認証に失敗しました。";
    throw new Error(
      message.includes("Invalid login") ? "メールアドレスまたはパスワードが違います。" :
      message.includes("already registered") ? "このメールアドレスは登録済みです。" :
      message
    );
  }
  return result;
}

export default function AuthButton() {
  const [session, setSession] = useState<Session | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = hash.get("access_token");
      if (accessToken) {
        const parsed: Session = {
          access_token: accessToken,
          refresh_token: hash.get("refresh_token") || undefined,
          expires_at: Math.floor(Date.now() / 1000) + Number(hash.get("expires_in") || 3600),
          user: { id: "", email: "" },
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        setSession(parsed);
        if (hash.get("type") === "recovery") {
          setMode("recovery");
          setOpen(true);
        } else {
          setMessage("メール確認が完了しました。");
        }
        history.replaceState(null, "", window.location.pathname + window.location.search);
        return;
      }
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Session;
      if (parsed.expires_at && parsed.expires_at * 1000 <= Date.now()) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      setSession(parsed);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    const displayName = String(data.get("displayName") || "").trim();
    setBusy(true); setError(""); setMessage("");
    try {
      if (mode === "recovery") {
        if (password.length < 8) throw new Error("パスワードは8文字以上にしてください。");
        if (!session?.access_token) throw new Error("再設定リンクの有効期限が切れています。");
        await authRequest("user", { password }, session.access_token, "PUT");
        setMessage("新しいパスワードを保存しました。"); setMode("login");
      } else if (mode === "reset") {
        await authRequest(`recover?redirect_to=${encodeURIComponent(window.location.origin)}`, { email });
        setMessage("パスワード再設定メールを送りました。メールをご確認ください。");
      } else if (mode === "signup") {
        if (password.length < 8) throw new Error("パスワードは8文字以上にしてください。");
        const result = await authRequest(`signup?redirect_to=${encodeURIComponent(window.location.origin)}`, {
          email, password, data: { display_name: displayName || email.split("@")[0] },
        });
        if (result.access_token) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(result)); setSession(result); setOpen(false);
        } else {
          setMessage("確認メールを送りました。メール内のリンクを押すと登録完了です。");
        }
      } else {
        const result = await authRequest("token?grant_type=password", { email, password });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(result)); setSession(result); setOpen(false);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "認証に失敗しました。");
    } finally { setBusy(false); }
  }

  async function logout() {
    if (session?.access_token) await authRequest("logout", undefined, session.access_token).catch(() => undefined);
    localStorage.removeItem(STORAGE_KEY); setSession(null); setMessage("");
  }

  const label = session?.user.user_metadata?.display_name || session?.user.email?.split("@")[0] || "会員";

  const modal = open ? (
    <div className="numa-auth-backdrop" onMouseDown={() => setOpen(false)}>
      <section className="numa-auth-modal" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><small>NUMA ACCOUNT</small><h2>{session ? "会員メニュー" : mode === "signup" ? "無料会員登録" : mode === "reset" || mode === "recovery" ? "パスワード再設定" : "ログイン"}</h2></div>
          <button className="numa-auth-close" type="button" aria-label="閉じる" onClick={() => setOpen(false)}>×</button>
        </header>
        {!session && mode !== "recovery" && <p className="numa-auth-guide">初めての方は「新規登録」を選んでください。</p>}
        {session && mode !== "recovery" ? (
          <div className="numa-auth-account">
            <p><b>{label}</b><span>{session.user.email}</span></p>
            <button type="button" onClick={logout}>ログアウト</button>
          </div>
        ) : (
          <>
            <div className="numa-auth-tabs">
              <button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); setMessage(""); }}>ログイン</button>
              <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setError(""); setMessage(""); }}>新規登録</button>
            </div>
            <form onSubmit={submit}>
              {mode === "signup" && <label>表示名<input name="displayName" autoComplete="nickname" placeholder="例：沼太郎" /></label>}
              {mode !== "recovery" && <label>メールアドレス<input required name="email" type="email" autoComplete="email" placeholder="name@example.com" /></label>}
              {mode !== "reset" && <label>{mode === "recovery" ? "新しいパスワード" : "パスワード"}<input required name="password" type="password" minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder="8文字以上" /></label>}
              {error && <p className="numa-auth-error">{error}</p>}
              {message && <p className="numa-auth-success">{message}</p>}
              <button className="numa-auth-submit" disabled={busy}>{busy ? "処理中…" : mode === "signup" ? "無料で会員登録する" : mode === "reset" ? "再設定メールを送る" : mode === "recovery" ? "新しいパスワードを保存" : "ログインする"}</button>
            </form>
            {mode === "login" && <button className="numa-auth-reset" type="button" onClick={() => { setMode("reset"); setError(""); setMessage(""); }}>パスワードを忘れた方</button>}
            {mode === "reset" && <button className="numa-auth-reset" type="button" onClick={() => { setMode("login"); setError(""); setMessage(""); }}>ログインへ戻る</button>}
          </>
        )}
      </section>
      <style jsx>{`
        .numa-auth-backdrop{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.78);display:flex;align-items:center;justify-content:center;padding:max(16px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom));overflow:auto;-webkit-overflow-scrolling:touch}
        .numa-auth-modal{box-sizing:border-box;width:min(430px,100%);max-height:calc(100dvh - 32px);overflow:auto;-webkit-overflow-scrolling:touch;background:#071b14;color:#f7f5ef;border:1px solid #8b35a8;border-radius:24px;padding:20px;box-shadow:0 24px 80px #000;position:relative}
        .numa-auth-modal header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px}.numa-auth-modal header small{color:#d66df2;letter-spacing:.14em;font-size:11px}.numa-auth-modal h2{font-size:26px;line-height:1.2;margin:4px 0 0}.numa-auth-close{flex:0 0 44px;width:44px!important;height:44px!important;min-width:44px!important;border:0!important;background:#ffffff0d!important;color:#ddd!important;border-radius:50%!important;font-size:30px!important;line-height:1!important;padding:0!important}
        .numa-auth-guide{margin:0 0 14px;padding:11px 12px;border-radius:12px;background:#181322;color:#e7d7ec;font-size:13px;line-height:1.55}.numa-auth-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px}.numa-auth-tabs button{width:auto!important;height:auto!important;min-width:0!important;white-space:nowrap!important;border:1px solid #734083!important;background:#17151c!important;color:#ddd!important;border-radius:12px!important;padding:12px 8px!important;font-size:15px!important;font-weight:800!important;line-height:1.4!important}.numa-auth-tabs .active{background:#6e2185!important;color:#fff!important}
        .numa-auth-modal form{display:grid;gap:14px}.numa-auth-modal label{display:grid;gap:7px;color:#c6d0ca;font-size:15px;font-weight:700;line-height:1.4}.numa-auth-modal input{display:block;width:100%!important;min-width:0!important;height:52px!important;box-sizing:border-box;border:1px solid #653071;border-radius:12px;background:#04120d;color:#fff;padding:0 14px!important;font-size:16px!important;line-height:52px;writing-mode:horizontal-tb!important;text-orientation:mixed!important}.numa-auth-submit,.numa-auth-account button{display:block;width:100%!important;height:auto!important;min-height:52px!important;white-space:normal!important;border:0!important;border-radius:12px!important;background:linear-gradient(100deg,#ef3c32,#bd1024)!important;color:#fff!important;padding:14px 16px!important;font-size:16px!important;line-height:1.45!important;font-weight:900!important}.numa-auth-submit:disabled{opacity:.55}.numa-auth-reset{display:block!important;width:auto!important;height:auto!important;min-width:0!important;margin:16px auto 0!important;padding:8px 12px!important;border:0!important;background:transparent!important;color:#d98bf0!important;text-decoration:underline!important;font-size:14px!important;white-space:nowrap!important;line-height:1.4!important}
        .numa-auth-error,.numa-auth-success{border-radius:12px;padding:12px;margin:0;font-size:13px;line-height:1.5}.numa-auth-error{background:#401d18;color:#ffaaa3}.numa-auth-success{background:#123426;color:#85e3b0}.numa-auth-account{display:grid;gap:14px}.numa-auth-account p{display:grid;gap:5px;background:#101f19;border-radius:14px;padding:16px;margin:0}.numa-auth-account p b{font-size:21px}.numa-auth-account p span{color:#aab5af;overflow-wrap:anywhere}
        @media(max-width:480px){.numa-auth-backdrop{align-items:flex-start;padding-top:max(18px,env(safe-area-inset-top))}.numa-auth-modal{margin:auto 0;padding:18px;border-radius:20px;max-height:calc(100dvh - max(36px,env(safe-area-inset-top) + env(safe-area-inset-bottom)))}.numa-auth-modal h2{font-size:24px}}
      `}</style>
    </div>
  ) : null;

  return (
    <>
      <button className="numa-auth-trigger" type="button" onClick={() => { setOpen(true); setError(""); setMessage(""); }}>
        {session ? label.slice(0, 2) : "会員"}
      </button>
      {mounted && modal ? createPortal(modal, document.body) : null}
      <style jsx>{`.numa-auth-trigger{min-width:48px;height:48px;border-radius:50%;border:1px solid #ffffff32;background:#21192a;color:#fff;font-weight:800;padding:0 8px}`}</style>
    </>
  );
}
