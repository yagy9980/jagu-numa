import { NextResponse } from "next/server";

export const runtime = "nodejs";

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    machine: { type: ["string", "null"] },
    shop: { type: ["string", "null"] },
    games: { type: ["integer", "null"] },
    big: { type: ["integer", "null"] },
    reg: { type: ["integer", "null"] },
    coins: { type: ["integer", "null"] },
    yen: { type: ["integer", "null"] },
    memo: { type: ["string", "null"] },
    currentSpins: { type: ["integer", "null"] },
    stateSummary: { type: ["string", "null"] },
    observations: { type: "array", items: { type: "string" } },
    settingSignal: { type: ["string", "null"] },
    confidence: { type: ["string", "null"] },
  },
  required: ["machine", "shop", "games", "big", "reg", "coins", "yen", "memo", "currentSpins", "stateSummary", "observations", "settingSignal", "confidence"],
};

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "AI読取りの準備がまだ完了していません。VercelにAPIキーを設定してください。" }, { status: 503 });
    }

    const body = await request.json();
    const image = typeof body.image === "string" ? body.image : "";
    if (!image.startsWith("data:image/") || image.length > 8_000_000) {
      return NextResponse.json({ error: "写真を確認できません。別の写真を選んでください。" }, { status: 400 });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        input: [{
          role: "user",
          content: [
            {
              type: "input_text",
              text: "これは日本のジャグラー台の状態分析です。データカウンターや台表示から、機種名、店舗名、当日の総回転数、BIG回数、REG回数、現在のハマり回転数、差枚、円収支を読み取ってください。グラフや履歴から確認できる事実をobservationsに2〜4件、合算・REG比率・サンプル数を踏まえた現在の状態をstateSummaryにまとめてください。設定材料はsettingSignal（高設定寄り・中間・低設定寄り・データ不足）で、読取り確度はconfidence（高・中・低）で返してください。写真に明記されていない記録値は推測せずnullにしてください。過去日の履歴と当日の累計を混同せず、ハマり履歴から次回当選を断定しないでください。",
            },
            { type: "input_image", image_url: image, detail: "high" },
          ],
        }],
        text: {
          format: {
            type: "json_schema",
            name: "juggler_record",
            strict: true,
            schema,
          },
        },
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      console.error("OpenAI scan error", payload);
      return NextResponse.json({ error: "AI解析に失敗しました。少し時間を置いて再度お試しください。" }, { status: 502 });
    }
    const outputText = payload.output
      ?.flatMap((item: { content?: Array<{ type?: string; text?: string }> }) => item.content || [])
      .find((item: { type?: string }) => item.type === "output_text")?.text;
    if (!outputText) {
      return NextResponse.json({ error: "写真から数字を読み取れませんでした。正面から撮り直してください。" }, { status: 422 });
    }
    const parsed = JSON.parse(outputText) as Record<string, unknown>;
    const record = Object.fromEntries(Object.entries(parsed).filter(([, value]) => value !== null)) as Record<string, unknown>;
    const games = typeof parsed.games === "number" ? parsed.games : 0;
    const big = typeof parsed.big === "number" ? parsed.big : 0;
    const reg = typeof parsed.reg === "number" ? parsed.reg : 0;
    const combined = big + reg > 0 ? games / (big + reg) : 0;
    const chance = (turns: number) => combined > 1 ? Number(((1 - Math.pow(1 - 1 / combined, turns)) * 100).toFixed(1)) : null;
    record.combinedOdds = combined > 1 ? Number(combined.toFixed(1)) : null;
    record.chance50 = chance(50);
    record.chance100 = chance(100);
    record.chance200 = chance(200);
    record.medianSpins = combined > 1 ? Math.ceil(Math.log(0.5) / Math.log(1 - 1 / combined)) : null;
    return NextResponse.json({ record });
  } catch (error) {
    console.error("Numa scan failed", error);
    return NextResponse.json({ error: "写真の解析中にエラーが発生しました。" }, { status: 500 });
  }
}
