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
  },
  required: ["machine", "shop", "games", "big", "reg", "coins", "yen", "memo"],
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
              text: "これは日本のジャグラー実戦記録用写真です。データカウンターや台表示から、機種名、店舗名、総回転数、BIG回数、REG回数、差枚、円収支を読み取ってください。写真に明記されていない値は推測せずnullにしてください。過去日の履歴と当日の累計を混同せず、当日の実戦値を優先してください。補足があればmemoへ短く記載してください。",
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
    const record = Object.fromEntries(Object.entries(parsed).filter(([, value]) => value !== null));
    return NextResponse.json({ record });
  } catch (error) {
    console.error("Numa scan failed", error);
    return NextResponse.json({ error: "写真の解析中にエラーが発生しました。" }, { status: 500 });
  }
}
