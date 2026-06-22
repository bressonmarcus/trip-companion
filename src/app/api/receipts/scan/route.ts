import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic";

type ExtractedItem = { name: string; price: number };
type ExtractResult = {
  merchant: string | null;
  date: string | null;
  total: number | null;
  items: ExtractedItem[];
  itemsSum: number;
  mismatch: boolean;
  mismatchDiff: number;
};

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType } = (await req.json()) as {
      imageBase64?: string;
      mediaType?: string;
    };
    if (!imageBase64) {
      return NextResponse.json({ error: "Missing image." }, { status: 400 });
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system:
        "You read photos of receipts and extract structured data. Respond with ONLY valid JSON, no markdown " +
        "fences, no commentary, in exactly this shape: " +
        '{"merchant":string|null,"date":string|null (YYYY-MM-DD if visible, else null),' +
        '"total":number|null,"items":[{"name":string,"price":number}]}. ' +
        "Prices are decimal numbers in the receipt's currency, no currency symbols. Read every line item you can " +
        "see, including ones that might be partially obscured — do your best rather than skipping them. If a " +
        "character is ambiguous (e.g. could be a 1 or a 7), pick the digit you think is most likely correct; a " +
        "downstream check will flag the receipt for manual review if your numbers don't add up, so it's fine to " +
        "be wrong as long as you commit to a best guess rather than omitting the item.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: (mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif") || "image/jpeg",
                data: imageBase64,
              },
            },
            { type: "text", text: "Extract this receipt's merchant, date, total, and line items as JSON." },
          ],
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No response from the model." }, { status: 500 });
    }

    let parsed: { merchant: string | null; date: string | null; total: number | null; items: ExtractedItem[] };
    try {
      const cleaned = textBlock.text.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      const match = textBlock.text.match(/\{[\s\S]*\}/);
      if (!match) {
        console.error("Unparseable receipt-scan response:", textBlock.text);
        return NextResponse.json({ error: "Could not read this receipt. Try another photo or enter it manually." }, { status: 500 });
      }
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        console.error("Unparseable receipt-scan response:", textBlock.text);
        return NextResponse.json({ error: "Could not read this receipt. Try another photo or enter it manually." }, { status: 500 });
      }
    }

    const items = (parsed.items ?? []).map((item) => ({
      name: item.name,
      price: Number(item.price) || 0,
    }));
    const itemsSum = Math.round(items.reduce((sum, item) => sum + item.price, 0) * 100) / 100;
    const total = parsed.total != null ? Number(parsed.total) : null;
    const mismatchDiff = total != null ? Math.round((itemsSum - total) * 100) / 100 : 0;
    // Allow a tiny rounding tolerance (e.g. 0.05) before flagging a mismatch.
    const mismatch = total != null && Math.abs(mismatchDiff) > 0.05;

    const result: ExtractResult = {
      merchant: parsed.merchant ?? null,
      date: parsed.date ?? null,
      total,
      items,
      itemsSum,
      mismatch,
      mismatchDiff,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong reading the receipt." }, { status: 500 });
  }
}
