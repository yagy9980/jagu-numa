"use client";

import { useMemo, useState } from "react";

export type CalendarEntry = { id:number; date:string; primary:number; secondary?:number; label:string };

const keyOf=(date:string)=>/^\d{4}-\d{2}-\d{2}$/.test(date)?date:(()=>{const [m,d]=date.split("/").map(Number);return `${new Date().getFullYear()}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`})();
const signed=(n:number,unit:string)=>`${n>=0?"+":"−"}${Math.abs(n).toLocaleString("ja-JP")}${unit}`;

export default function IncomeCalendar({entries,secondary=false}:{entries:CalendarEntry[];secondary?:boolean}){
  const [month,setMonth]=useState(()=>{const n=new Date();return new Date(n.getFullYear(),n.getMonth(),1)});
  const grouped=useMemo(()=>{const map=new Map<string,CalendarEntry[]>();entries.forEach(e=>{const k=keyOf(e.date);map.set(k,[...(map.get(k)||[]),e]);});return map},[entries]);
  const year=month.getFullYear(),mo=month.getMonth();
  const monthEntries=entries.filter(e=>{const d=new Date(`${keyOf(e.date)}T00:00:00`);return d.getFullYear()===year&&d.getMonth()===mo});
  const total=monthEntries.reduce((s,e)=>s+e.primary,0), yen=monthEntries.reduce((s,e)=>s+(e.secondary||0),0);
  const wins=monthEntries.filter(e=>(secondary?e.secondary:e.primary)!>=0).length;
  const cells=[...Array(new Date(year,mo,1).getDay()).fill(null),...Array.from({length:new Date(year,mo+1,0).getDate()},(_,i)=>i+1)];
  return <section className="incomeCalendar"><header><button onClick={()=>setMonth(new Date(year,mo-1,1))}>‹</button><div><small>MONTHLY RESULT</small><h2>{year}年{mo+1}月の収支</h2></div><button onClick={()=>setMonth(new Date(year,mo+1,1))}>›</button></header><div className="calendarSummary"><div><small>月間収支</small><b className={total>=0?"plus":"minus"}>{signed(total,secondary?"枚":"円")}</b>{secondary&&<span className={yen>=0?"plus":"minus"}>{signed(yen,"円")}</span>}</div><div><small>実戦／勝率</small><b>{monthEntries.length}回</b><span>{monthEntries.length?`${Math.round(wins/monthEntries.length*100)}%`:"—"}</span></div></div><div className="week"><span>日</span><span>月</span><span>火</span><span>水</span><span>木</span><span>金</span><span>土</span></div><div className="calendarGrid">{cells.map((day,i)=>{if(!day)return <div className="blank" key={`b${i}`}/>;const k=`${year}-${String(mo+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`,xs=grouped.get(k)||[],p=xs.reduce((s,e)=>s+e.primary,0),y=xs.reduce((s,e)=>s+(e.secondary||0),0);return <div className={xs.length?(secondary?y:p)>=0?"win":"lose":""} key={k}><small>{day}</small>{xs.length>0&&<><b>{signed(p,secondary?"枚":"円")}</b>{secondary&&<em>{signed(y,"円")}</em>}</>}</div>})}</div><p>実戦記録を保存すると、その日付の収支が自動で反映されます。</p></section>
}
