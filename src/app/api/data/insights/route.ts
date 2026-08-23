import { NextRequest, NextResponse } from "next/server";

type InsightRow={
  category:string;
  machine_name:string;
  sample_size:number;
  total_spins:number;
  total_hits:number;
  empirical_odds:number|null;
  avg_net_coins:number|null;
  latest_play_date:string|null;
};

export async function GET(req:NextRequest){
  const machine=(req.nextUrl.searchParams.get("machine")||"").trim();
  if(!machine)return NextResponse.json({error:"machine is required"},{status:400});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key)return NextResponse.json({available:false,sampleSize:0});
  const qs=new URLSearchParams({
    select:"category,machine_name,sample_size,total_spins,total_hits,empirical_odds,avg_net_coins,latest_play_date",
    category:"eq.slot",
    machine_name:`ilike.*${machine}*`,
    order:"sample_size.desc",
    limit:"1"
  });
  const r=await fetch(`${url}/rest/v1/oita_machine_insights?${qs}`,{
    headers:{apikey:key,Authorization:`Bearer ${key}`},
    next:{revalidate:300}
  });
  if(!r.ok)return NextResponse.json({available:false,sampleSize:0});
  const rows=await r.json() as InsightRow[];
  const x=rows[0];
  if(!x)return NextResponse.json({available:false,sampleSize:0});
  return NextResponse.json({
    available:true,
    sampleSize:Number(x.sample_size||0),
    totalSpins:Number(x.total_spins||0),
    totalHits:Number(x.total_hits||0),
    empiricalOdds:x.empirical_odds==null?null:Number(x.empirical_odds),
    averageNet:x.avg_net_coins==null?null:Number(x.avg_net_coins),
    latestDate:x.latest_play_date
  });
}
