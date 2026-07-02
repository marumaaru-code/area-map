import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { Facility, OwnAccountProfile } from "@/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { facilities, profile }: { facilities: Facility[]; profile: OwnAccountProfile } =
    await req.json();

  const facilitySummary = facilities
    .map((f, i) => `[${i}] ${f.name_ja || f.name}：${f.concept_memo}`)
    .join("\n");

  const prompt = `あなたは工務店のInstagram運用を支援するアナリストです。

自社アカウントの特徴：
・コンセプト：${profile.concept_memo}
・ターゲットエリア：${profile.target_area}
・ブランドトーン：${profile.brand_tone}

以下の工務店リストを「自社との類似度が高い順」に並べ替え、各社について類似している理由を一言（30〜50文字）で述べてください。

【工務店リスト】
${facilitySummary}

以下のJSON形式のみで返答してください（説明文不要）：
{
  "ranked_indices": [0, 3, 1, ...],
  "reasons": {
    "0": "理由テキスト",
    "3": "理由テキスト"
  }
}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return NextResponse.json({ error: "AI response parse error" }, { status: 500 });
  }
  const { ranked_indices, reasons } = JSON.parse(jsonMatch[0]);

  const ranked = (ranked_indices as number[]).map((idx: number) => ({
    ...facilities[idx],
    similarity_reason: reasons[String(idx)] || "",
  }));

  return NextResponse.json({ ranked });
}
