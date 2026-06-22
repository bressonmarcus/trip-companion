import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic";

export async function POST(req: NextRequest) {
  try {
    const { category, query } = (await req.json()) as { category?: string; query?: string };

    if (!category || !query || query.trim().length < 3) {
      return NextResponse.json({ suggestions: [] });
    }

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system:
        "You suggest dish name completions for a home-cooking meal planner. Given a food category and a " +
        "partial dish name the user is typing, return up to 5 real, recognizable dish names that complete or " +
        "closely match what they're typing. Only suggest dish names, not ingredients or instructions. Respond " +
        'with ONLY compact JSON, no commentary, in exactly this shape: {"suggestions":[string,...]}',
      messages: [
        {
          role: "user",
          content: `Category: ${category}. Partial input: "${query}"`,
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ suggestions: [] });
    }

    try {
      const cleaned = textBlock.text
        .trim()
        .replace(/^```(json)?/i, "")
        .replace(/```$/, "")
        .trim();
      const parsed = JSON.parse(cleaned) as { suggestions?: string[] };
      return NextResponse.json({ suggestions: parsed.suggestions ?? [] });
    } catch {
      return NextResponse.json({ suggestions: [] });
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json({ suggestions: [] });
  }
}
