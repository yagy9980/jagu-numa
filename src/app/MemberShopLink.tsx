"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "numa-supabase-session";

export default function MemberShopLink() {
  const [member, setMember] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const session = JSON.parse(raw) as { access_token?: string; expires_at?: number };
      const active = Boolean(session.access_token) && (!session.expires_at || session.expires_at * 1000 > Date.now());
      setMember(active);
    } catch {
      setMember(false);
    }
  }, []);

  if (!member) return null;

  return (
    <a href="/shops" style={{position:"fixed",right:14,bottom:18,zIndex:900,textDecoration:"none",background:"#6f2387",color:"#fff",border:"1px solid #d987ef",borderRadius:999,padding:"12px 16px",fontWeight:900,boxShadow:"0 8px 28px #0008"}}>
      🔒 会員限定・店舗データ
    </a>
  );
}
