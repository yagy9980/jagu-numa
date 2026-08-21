"use client";

import { FormEvent, useEffect, useState } from "react";

type Mode = "login" | "signup" | "reset";
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

async function authRequest(path: string, body?: unknown, token?: string) {
  const current = config();
  if (!current) throw new Error("会員機能の接続設定がまだ完了していません。");
  const response = await fetch(`${current.url}/auth/v1/${path}`, {
    method: "POST",
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

  useEffect(() => {
    try {
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    const displayName = String(data.get("displayName") || "").trim();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "reset") {
        await authRequest("recover", { email, redirect_to: window.location.origin });
        setMessage("パスワード再設定メールを送りました。メールをご確認ください。");
      } else if (mode === "signup") {
        if (password.length < 8) throw new Error("パスワードは8文字以上にしてください。");
        const result = await authRequest("signup", {
          email,
          password,
          data: { display_name: displayName || email.split("@")[0] },
          options: { emailRedirectTo: window.location.origin },
        });
        if (result.access_token) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
          setSession(result);
          setOpen(false);
        } else {
          setMessage("確認メールを送りました。メール内のリンクを押すと登録完了です。");
        }
      } else {
        const result = await authRequest("token?grant_type=password", { email, password });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
        setSession(result);
        setOpen(false);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "認証に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (session?.access_token) {
      await authRequest("logout", undefined, session.access_token).catch(() => undefined);
    }
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setMessage("");
  }

  const label = session?.user.user_metadata?.display_name || session?.user.email?.split("@")[0] || "会員";

  return (
    <>
      <button className="numa-auth-trigger" type="button" onClick={() => { setOpen(true); setError(""); setMessage(""); }}>
        {session ? label.slice(0, 2) : "会員"}
      </button>
      {open && (
        <div className="numa-auth-backdrop" onMouseDown={() => setOpen(false)}>
          <section className="numa-auth-modal" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div><small>NUMA ACCOUNT</small><h2>{session ? "会員メニュー" : mode === "signup" ? "新規会員登録" : mode === "reset" ? "パスワード再設定" : "ログイン"}</h2></div>
              <button type="button" onClick={() => setOpen(false)}>×</button>
            </header>
            {session ? (
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
                  <label>メールアドレス<input required name="email" type="email" autoComplete="email" placeholder="name@example.com" /></label>
                  {mode !== "reset" && <label>パスワード<input required name="password" type="password" minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder="8文字以上" /></label>}
                  {error && <p className="numa-auth-error">{error}</p>}
                  {message && <p className="numa-auth-success">{message}</p>}
                  <button className="numa-auth-submit" disabled={busy}>{busy ? "処理中…" : mode === "signup" ? "無料で登録する" : mode === "reset" ? "再設定メールを送る" : "ログインする"}</button>
                </form>
                {mode === "login" && <button className="numa-auth-reset" type="button" onClick={() => { setMode("reset"); setError(""); setMessage(""); }}>パスワードを忘れた方</button>}
                {mode === "reset" && <button className="numa-auth-reset" type="button" onClick={() => { setMode("login"); setError(""); setMessage(""); }}>ログインへ戻る</button>}
              </>
            )}
          </section>
        </div>
      )}
      <style jsx>{`
        .numa-auth-trigger{min-width:48px;height:48px;border-radius:50%;border:1px solid #ffffff32;background:#21192a;color:#fff;font-weight:800;padding:0 8px}
        .numa-auth-backdrop{position:fixed;inset:0;z-index:1000;background:#000b;display:grid;place-items:center;padding:20px}
        .numa-auth-modal{width:min(430px,100%);max-height:calc(100dvh - 40px);overflow:auto;background:#0b1914;color:#f7f5ef;border:1px solid #8b35a8;border-radius:28px;padding:24px;box-shadow:0 24px 80px #000}
        .numa-auth-modal header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px}
        .numa-auth-modal header small{color:#d66df2;letter-spacing:.18em}.numa-auth-modal h2{font-size:28px;margin:5px 0 0}
        .numa-auth-modal header button{border:0;background:transparent;color:#aaa;font-size:34px}
        .numa-auth-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:18px}
        .numa-auth-tabs button{border:1px solid #734083;background:#17151c;color:#aaa;border-radius:14px;padding:12px;font-weight:800}
        .numa-auth-tabs .active{background:#6e2185;color:#fff}
        .numa-auth-modal form{display:grid;gap:15px}.numa-auth-modal label{display:grid;gap:7px;color:#b8c2bd;font-weight:700}
        .numa-auth-modal input{width:100%;box-sizing:border-box;border:1px solid #653071;border-radius:14px;background:#07110d;color:#fff;padding:15px;font-size:16px}
        .numa-auth-submit,.numa-auth-account button{border:0;border-radius:14px;background:linear-gradient(100deg,#ef3c32,#bd1024);color:#fff;padding:15px;font-size:17px;font-weight:900}
        .numa-auth-submit:disabled{opacity:.55}.numa-auth-reset{display:block;margin:16px auto 0;border:0;background:transparent;color:#d98bf0;text-decoration:underline}
        .numa-auth-error,.numa-auth-success{border-radius:12px;padding:12px;margin:0}.numa-auth-error{background:#401d18;color:#ffaaa3}.numa-auth-success{background:#123426;color:#85e3b0}
        .numa-auth-account p{display:grid;gap:5px;background:#101f19;border-radius:16px;padding:18px}.numa-auth-account p b{font-size:22px}.numa-auth-account p span{color:#aab5af}
        .numa-auth-account{display:grid;gap:14px}
      `}</style>
    </>
  );
}
