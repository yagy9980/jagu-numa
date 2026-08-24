"use client";

import { useEffect, useMemo, useState } from "react";

type Row={play_date:string;shop_name:string;machine_name:string;machine_number:string;total_spins:number|null;bb:number|null;rb:number|null;net_coins:number|null;payout_rate:number|null;source_name:string};
type Session={access_token?:string;refresh_token?:string;expires_at?:number;user?:unknown};
const STORAGE_KEY="numa-supabase-session";
const SUPABASE_URL="https://orxhhddrjbxjkyxjdegf.supabase.co";
const SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yeGhoZGRyamJ4amt5eGpkZWdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2OTA4MzgsImV4cCI6MjEwMjI2NjgzOH0.80-yjE0YOvzJyfD3Eh9TQ_xmRvUAMaVkNLFVQlOg92k";

async function refreshSession(session:Session){
 if(!session.refresh_token) throw new Error("会員ログインの有効期限が切れています。トップから再ログインしてください。");
 const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{method:"POST",headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({refresh_token:session.refresh_token})});
 const next=await r.json().catch(()=>({}));
 if(!r.ok||!next.access_token) throw new Error("会員ログインの更新に失敗しました。トップから再ログインしてください。");
 localStorage.setItem(STORAGE_KEY,JSON.stringify(next));
 return next as Session;
}

async function getSession(){
 const raw=localStorage.getItem(STORAGE_KEY); if(!raw) throw new Error("会員ログインが必要です。");
 let session=JSON.parse(raw) as Session;
 const expiresSoon=!session.access_token||!session.expires_at||session.expires_at*1000<=Date.now()+30000;
 if(expiresSoon) session=await refreshSession(session);
 return session;
}

export default function ShopsPage(){
 const [rows,setRows]=useState<Row[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[shop,setShop]=useState("ALL");
 useEffect(()=>{(async()=>{try{
   let session=await getSession();
   const q=new URLSearchParams({select:"play_date,shop_name,machine_name,machine_number,total_spins,bb,rb,net_coins,payout_rate,source_name",category:"eq.slot",order:"play_date.desc",limit:"2000"});
   const load=()=>fetch(`${SUPABASE_URL}/rest/v1/oita_machine_daily?${q}`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${session.access_token}`}});
   let r=await load();
   if(r.status===401||r.status===403){session=await refreshSession(session);r=await load();}
   if(!r.ok){const detail=await r.text().catch(()=>"");console.error("shop data error",r.status,detail);throw new Error("店舗データを読み込めませんでした。");}
   setRows(await r.json());
 }catch(e){setError(e instanceof Error?e.message:"読み込みに失敗しました。")}finally{setLoading(false)}})()},[]);
 const shops=useMemo(()=>Array.from(new Set(rows.map(r=>r.shop_name))).sort(),[rows]);
 const view=useMemo(()=>shop==="ALL"?rows:rows.filter(r=>r.shop_name===shop),[rows,shop]);
 const summary=useMemo(()=>{const m=new Map<string,{rows:number;spins:number;hits:number;net:number;netN:number;latest:string}>();for(const r of view){const x=m.get(r.shop_name)||{rows:0,spins:0,hits:0,net:0,netN:0,latest:r.play_date};x.rows++;x.spins+=Number(r.total_spins||0);x.hits+=Number(r.bb||0)+Number(r.rb||0);if(typeof r.net_coins==="number"){x.net+=r.net_coins;x.netN++}if(r.play_date>x.latest)x.latest=r.play_date;m.set(r.shop_name,x)}return Array.from(m.entries()).map(([name,x])=>({name,...x,odds:x.hits?x.spins/x.hits:null,avgNet:x.netN?x.net/x.netN:null})).sort((a,b)=>b.rows-a.rows)},[view]);
 return <main style={{minHeight:"100vh",background:"#09050d",color:"#f8f5fb",padding:"18px",fontFamily:"system-ui,sans-serif"}}><div style={{maxWidth:980,margin:"0 auto"}}><a href="/" style={{color:"#d987ef",textDecoration:"none",fontWeight:800}}>‹ ジャグ沼へ戻る</a><header style={{margin:"18px 0 24px"}}><small style={{color:"#d987ef",letterSpacing:2}}>MEMBERS ONLY</small><h1 style={{fontSize:32,margin:"5px 0"}}>店舗データ</h1><p style={{color:"#aaa"}}>大分県の公開実戦データを店舗・機種・台番号別に確認できます。</p></header>{loading?<p>会員情報と店舗データを確認中…</p>:error?<section style={{background:"#25131c",border:"1px solid #8f3148",borderRadius:18,padding:20}}><b>🔒 会員限定</b><p>{error}</p><a href="/" style={{color:"#fff"}}>トップへ戻ってログイン</a></section>:<><div style={{padding:14,borderRadius:14,background:"#151019",border:"1px solid #34233b",marginBottom:16}}><b>✓ 会員認証済み</b><div style={{color:"#aaa",fontSize:13,marginTop:4}}>店舗データ {rows.length.toLocaleString()}件を読み込みました</div></div><select value={shop} onChange={e=>setShop(e.target.value)} style={{width:"100%",padding:14,borderRadius:14,background:"#17101d",color:"#fff",border:"1px solid #5f376c",marginBottom:16}}><option value="ALL">全店舗</option>{shops.map(s=><option key={s}>{s}</option>)}</select><div style={{display:"grid",gap:12}}>{summary.map(s=><article key={s.name} style={{background:"#151019",border:"1px solid #34233b",borderRadius:18,padding:16}}><h2 style={{fontSize:19,margin:"0 0 10px"}}>{s.name}</h2><div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8,color:"#ccc"}}><span>収録台データ <b style={{color:"#fff"}}>{s.rows.toLocaleString()}件</b></span><span>総回転 <b style={{color:"#fff"}}>{s.spins.toLocaleString()}G</b></span><span>実戦合算 <b style={{color:"#fff"}}>{s.odds?`1/${s.odds.toFixed(1)}`:"—"}</b></span><span>平均差枚 <b style={{color:s.avgNet&&s.avgNet>0?"#7ee6a3":"#fff"}}>{s.avgNet==null?"—":`${s.avgNet>=0?"+":""}${Math.round(s.avgNet).toLocaleString()}枚`}</b></span></div><small style={{display:"block",marginTop:10,color:"#777"}}>最新 {s.latest}</small></article>)}</div><h2 style={{marginTop:28}}>台別データ</h2><div style={{overflowX:"auto",borderRadius:16,border:"1px solid #302136"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:760,background:"#110d14"}}><thead><tr>{["日付","店舗","機種","台番","回転","BB","RB","差枚"].map(h=><th key={h} style={{padding:10,textAlign:"left",color:"#c99bd6",borderBottom:"1px solid #33253a"}}>{h}</th>)}</tr></thead><tbody>{view.slice(0,500).map((r,i)=><tr key={`${r.play_date}-${r.shop_name}-${r.machine_number}-${i}`}><td style={td}>{r.play_date}</td><td style={td}>{r.shop_name}</td><td style={td}>{r.machine_name}</td><td style={td}>{r.machine_number}</td><td style={td}>{r.total_spins??"—"}</td><td style={td}>{r.bb??"—"}</td><td style={td}>{r.rb??"—"}</td><td style={td}>{r.net_coins==null?"—":`${r.net_coins>=0?"+":""}${r.net_coins}`}</td></tr>)}</tbody></table></div>{rows.length===0&&<section style={{marginTop:20,padding:18,border:"1px solid #34233b",borderRadius:16,background:"#151019"}}><b>会員認証は正常です</b><p style={{color:"#aaa"}}>現在、スロットの収集データはまだありません。</p></section>}</>}</div></main>
}
const td={padding:"10px",borderBottom:"1px solid #211927",fontSize:13} as const;
