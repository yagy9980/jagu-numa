"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Tab = "home" | "judge" | "records" | "community" | "ranking";
type Play = { id:number; machine:string; shop:string; games:number; big:number; reg:number; coins:number; memo:string; date:string };

const initial: Play[] = [
  {id:1,machine:"マイジャグラーV",shop:"中津駅前店",games:6324,big:29,reg:25,coins:1280,memo:"REG先行から後半にBIGが追いついた。",date:"8/17"},
  {id:2,machine:"アイムジャグラーEX",shop:"大分中央店",games:4812,big:18,reg:20,coins:420,memo:"ブドウ良好。閉店まで粘り。",date:"8/16"},
  {id:3,machine:"ファンキージャグラー2",shop:"別府店",games:3540,big:12,reg:9,coins:-760,memo:"合算失速。深追いせず終了。",date:"8/15"},
];
const ranks = [
  ["マイジャグラーV",91,"1/240","1/272","12,842"],
  ["アイムジャグラーEX",88,"1/251","1/279","11,076"],
  ["ゴーゴージャグラー3",85,"1/245","1/285","8,941"],
  ["ファンキージャグラー2",82,"1/237","1/302","7,620"],
] as const;
const posts = [
  {user:"北電子観測班",body:"6,100GでBB28・RB25。単独REGが強く、まだ追える数字。",stat:"合算 1/115.1",likes:38},
  {user:"ペカり沼民",body:"朝からREG4連。数字を信じて粘ったら夕方に伸びました。",stat:"差枚 +1,840枚",likes:51},
  {user:"ぶどう数える人",body:"感覚ではなく毎回記録。店ごとの癖が少しずつ見えてきた。",stat:"実戦 47回",likes:29},
];
const rate=(g:number,n:number)=>n>0?g/n:0;
const show=(n:number)=>n>0?`1/${n.toFixed(1)}`:"—";
const coins=(n:number)=>`${n>=0?"+":"−"}${Math.abs(n).toLocaleString("ja-JP")}枚`;

export default function Home(){
  const [tab,setTab]=useState<Tab>("home");
  const [games,setGames]=useState(6324),[big,setBig]=useState(29),[reg,setReg]=useState(25);
  const [plays,setPlays]=useState<Play[]>(()=>{if(typeof window==="undefined")return initial;const s=localStorage.getItem("jagu-numa-plays");return s?JSON.parse(s):initial;}),[modal,setModal]=useState(false),[toast,setToast]=useState("");
  useEffect(()=>{if(!toast)return;const id=setTimeout(()=>setToast(""),2200);return()=>clearTimeout(id);},[toast]);
  const combined=rate(games,big+reg),rr=rate(games,reg);
  const judge=useMemo(()=>games<1500?{n:"?",label:"データ不足",pct:20,note:"1,500G以上を目安に記録を続けましょう。"}:rr<=270&&combined<=125?{n:"5–6",label:"高設定域",pct:88,note:"REGと合算が強い数値。サンプルを増やして確認。"}:rr<=310&&combined<=140?{n:"3–4",label:"中間域",pct:61,note:"続行候補。単独REGやブドウも合わせて判断。"}:{n:"1–2",label:"低設定域",pct:31,note:"現在の数値は弱め。追いすぎには注意。"},[games,combined,rr]);
  const title={home:"ホーム",judge:"設定推測",records:"実戦記録",community:"ペカ民広場",ranking:"沼ランキング"}[tab];
  const total=plays.reduce((a,p)=>a+p.coins,0);
  function save(e:FormEvent<HTMLFormElement>){e.preventDefault();const d=new FormData(e.currentTarget);const p:Play={id:Date.now(),machine:String(d.get("machine")),shop:String(d.get("shop"))||"店舗未設定",games:Number(d.get("games")),big:Number(d.get("big")),reg:Number(d.get("reg")),coins:Number(d.get("coins")),memo:String(d.get("memo"))||"メモなし",date:new Intl.DateTimeFormat("ja-JP",{month:"numeric",day:"numeric"}).format(new Date())};const next=[p,...plays];setPlays(next);localStorage.setItem("jagu-numa-plays",JSON.stringify(next));setModal(false);setTab("records");setToast("実戦データを保存しました");}
  return <main className="shell">
    <header className="topbar"><button className="brand" onClick={()=>setTab("home")}><span>🤡</span><div><b>JAGU NUMA</b><small>ジャグラー実戦研究所</small></div></button><div className="tools"><button>⌕</button><button className="user">王</button></div></header>
    {tab!=="home"&&<div className="pagehead"><button onClick={()=>setTab("home")}>‹</button><h1>{title}</h1></div>}
    {tab==="home"&&<><section className="hero"><div className="scan"/><div className="eyebrow">● THE LAMP NEVER LIES</div><h1>光った回数より、<br/><em>光る理由を。</em></h1><p>BIG・REG・合算を記録。<br/>全国の実戦値で、ジャグラーの沼を読み解け。</p><div className="heroBtns"><button className="primary" onClick={()=>setModal(true)}>＋ 実戦を記録</button><button className="secondary" onClick={()=>setTab("judge")}>設定を推測</button></div><div className="heroStats"><div><b>26,491</b><small>ペカ民</small></div><div><b>183,720</b><small>実戦データ</small></div><div><b>21</b><small>対応機種</small></div></div></section><section className="quick"><button onClick={()=>setTab("judge")}><i>判</i><div><b>設定推測</b><small>BB・REG・合算で判定</small></div><span>›</span></button><button onClick={()=>setTab("records")}><i>録</i><div><b>実戦データ</b><small>自分の履歴を分析</small></div><span>›</span></button></section><Title text="本日の機種ランキング" action="すべて見る" click={()=>setTab("ranking")}/><Machines/><Title text="ペカ民の最新報告" action="広場へ" click={()=>setTab("community")}/><div className="posts">{posts.slice(0,2).map(p=><Post key={p.user} p={p}/>)}</div></>}
    {tab==="judge"&&<section className="content"><div className="warning"><b>!</b><p>入力した実戦値を整理する参考機能です。設定を確定するものではありません。</p></div><div className="inputs"><label>総回転数<input type="number" value={games} onChange={e=>setGames(Number(e.target.value))}/><span>G</span></label><label>BIG回数<input type="number" value={big} onChange={e=>setBig(Number(e.target.value))}/><span>回</span></label><label>REG回数<input type="number" value={reg} onChange={e=>setReg(Number(e.target.value))}/><span>回</span></label></div><div className="rateGrid"><div><small>BB確率</small><b>{show(rate(games,big))}</b></div><div><small>REG確率</small><b>{show(rr)}</b></div><div className="wide"><small>ボーナス合算</small><b>{show(combined)}</b></div></div><div className="judgement"><small>現在の設定期待度</small><strong>{judge.n}</strong><em>{judge.label}</em><div className="meter"><span style={{width:`${judge.pct}%`}}/></div><p>{judge.note}</p></div><button className="primary full" onClick={()=>setModal(true)}>このデータを実戦記録に残す</button><p className="legal">利益を保証するものではありません。公表値、サンプル数、ホール状況と合わせてご利用ください。</p></section>}
    {tab==="records"&&<section className="content"><div className="summary"><div><small>累計差枚</small><b className={total>=0?"plus":"minus"}>{coins(total)}</b></div><div><small>実戦回数</small><b>{plays.length}回</b></div></div><button className="primary full" onClick={()=>setModal(true)}>＋ 新しい実戦を記録</button><div className="recordList">{plays.map(p=><article key={p.id}><time>{p.date}</time><div><b>{p.machine}</b><small>{p.shop}</small><p>{p.games.toLocaleString()}G　BB {p.big} / RB {p.reg}</p><em>合算 {show(rate(p.games,p.big+p.reg))}　{p.memo}</em></div><strong className={p.coins>=0?"plus":"minus"}>{coins(p.coins)}</strong></article>)}</div></section>}
    {tab==="community"&&<section className="content"><div className="communityHero"><span>🤡</span><div><h2>ペカ民広場</h2><p>光っても、ハマっても、データは残る。</p></div></div><div className="composer"><span className="user">王</span><button onClick={()=>setToast("投稿機能は次の開発で追加します")}>今日のペカり、どうだった？</button></div><div className="posts">{posts.map(p=><Post key={p.user} p={p}/>)}</div></section>}
    {tab==="ranking"&&<section className="content"><div className="rankHero"><small>全国実戦データから集計</small><h2>沼ランキング</h2><p>勝率・合算・REG・投稿数を独自集計</p></div><Machines full/></section>}
    <nav><Nav active={tab==="home"} icon="⌂" label="ホーム" click={()=>setTab("home")}/><Nav active={tab==="judge"} icon="判" label="推測" click={()=>setTab("judge")}/><button className="fab" onClick={()=>setModal(true)}><span>🤡</span><small>記録</small></button><Nav active={tab==="community"} icon="♧" label="広場" click={()=>setTab("community")}/><Nav active={tab==="ranking"} icon="王" label="順位" click={()=>setTab("ranking")}/></nav>
    {modal&&<div className="backdrop" onMouseDown={()=>setModal(false)}><form className="modal" onSubmit={save} onMouseDown={e=>e.stopPropagation()}><header><div><small>PEKA LOG</small><h2>実戦を記録する</h2></div><button type="button" onClick={()=>setModal(false)}>×</button></header><label>機種名<input required name="machine" placeholder="例：マイジャグラーV"/></label><label>店舗名<input name="shop" placeholder="例：中津駅前店"/></label><div className="formrow"><label>総回転数<input required name="games" type="number" defaultValue={games}/></label><label>差枚<input required name="coins" type="number" placeholder="例：1280 / -760"/></label></div><div className="formrow"><label>BIG<input required name="big" type="number" defaultValue={big}/></label><label>REG<input required name="reg" type="number" defaultValue={reg}/></label></div><label>メモ<textarea name="memo" placeholder="ブドウ、単独REG、店の傾向など"/></label><button className="primary full">保存する</button></form></div>}
    {toast&&<div className="toast">✓ {toast}</div>}
  </main>;
}
function Title({text,action,click}:{text:string;action:string;click:()=>void}){return <div className="title"><h2>{text}</h2><button onClick={click}>{action}</button></div>}
function Machines({full=false}:{full?:boolean}){return <div className="machines">{ranks.slice(0,full?4:3).map((m,i)=><article key={m[0]}><span className={`r r${i+1}`}>{i+1}</span><i>🤡</i><div><b>{m[0]}</b><small>BB {m[2]}　REG {m[3]}　{m[4]}件</small></div><strong>{m[1]}<small>沼スコア</small></strong></article>)}</div>}
function Post({p}:{p:typeof posts[number]}){return <article className="post"><header><span className="lamp">●</span><div><b>{p.user}</b><small>18分前</small></div><em>{p.stat}</em></header><p>{p.body}</p><footer>♥ {p.likes}　　💬 報告を見る</footer></article>}
function Nav({active,icon,label,click}:{active:boolean;icon:string;label:string;click:()=>void}){return <button className={active?"active":""} onClick={click}><span>{icon}</span><small>{label}</small></button>}
