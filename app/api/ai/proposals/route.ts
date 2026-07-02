import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { Post } from "@/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { posts }: { posts: Post[] } = await req.json();

  const sorted = [...posts].sort((a, b) => (b.likes + b.saves * 3) - (a.likes + a.saves * 3));
  const topPosts = sorted.slice(0, 5);
  const postSummary = posts
    .map((p) => `・テーマ:${p.theme} / フォーマット:${p.format} / いいね${p.likes} 保存${p.saves} コメント${p.comments}${p.caption ? ` / キャプション概要:${p.caption.slice(0, 60)}` : ""}`)
    .join("\n");
  const topSummary = topPosts
    .map((p) => `・${p.theme}（保存${p.saves}、いいね${p.likes}）`)
    .join("\n");

  const prompt = `あなたは工務店のInstagram運用を支援するプロのSNSコンサルタントです。

以下の投稿ログを分析し、次の企画案を3〜5個提案してください。

【過去の投稿ログ（全${posts.length}件）】
${postSummary}

【エンゲージメントが特に高かった投稿】
${topSummary}

以下のJSON形式のみで返答してください。説明文は不要です：
{
  "proposals": [
    {
      "title": "企画タイトル",
      "aim": "この企画の狙い（1〜2文）",
      "format": "リール/フィード/ストーリーズのいずれか",
      "outline": "投稿の構成案（箇条書きOK、3〜5要素）"
    }
  ]
}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return NextResponse.json({ error: "AI response parse error" }, { status: 500 });
  }
  const parsed = JSON.parse(jsonMatch[0]);
  return NextResponse.json(parsed);
}
