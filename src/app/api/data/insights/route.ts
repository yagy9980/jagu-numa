import { NextRequest, NextResponse } from "next/server";

type Row={machine_name:string;category:string;total_spins:number|null;bb:number|null;rb:number|null;jackpot_count:number|null;net_coins:number|null;net_balls:number|null;play_date:string};

export async function GET(req:NextRequest){
 const machine=(req.nextUrl.searchParams.get("machine")||"").trim();
 const category=(req.nextUrl.searchParams.get("category")||"slot").trim();
 if(!machine)return NextResponse.json({error:"machine is required"},{status:400});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return NextResponse.json({sampleSize:0,available:false});
 const qs=new URLSearchParams({select:"machine_name,category,total_spins,bb,rb,jackpot_count,net_coins,net_balls,play_date",category:`eq.${category}`,machine_name:`ilike.*${machine}*`,order:"play_date.desc",limit:"1000"});
 const r=await fetch(`${url}/rest/v1/oita_machine_daily?${qs}`,{headers:{apikey:key,Authorization:`Bearer ${key}`},next:{revalidate:300}});
 if(!r.ok)return NextResponse.json({sampleSize:0,available:false});
 const rows=await r.json() as Row[];
 let spins=0,hits=0,net=0,netN=0;
 for(const x of rows){const s=Number(x.total_spins||0);const h=category==="slot"?Number(x.bb||0)+Number(x.rb||0):Number(x.jackpot_count||0);if(s>0&&h>0){spins+=s;hits+=h}const n=category==="slot"?x.net_coins:x.net_balls;if(typeof n==="number"){net+=n;netN++}}
 const empiricalOdds=hits>0?spins/hits:null;
 return NextResponse.json({available:rows.length>0,sampleSize:rows.length,totalSpins:spins,totalHits:hits,empiricalOdds:empiricalOdds?Number(empiricalOdds.toFixed(2)):null,averageNet:netN?Number((net/netN).toFixed(1)):null,latestDate:rows[0]?.play_date||null});
}
