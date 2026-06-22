import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { anthropic } from "@/lib/anthropic";

// Server-side Supabase client. RLS is open (trip-code access model, no per-user
// auth), so the publishable key is fine to use here too.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

type GeneratedItem = { name: string; quantity: string; category: "fresh" | "pantry" };

export async function POST(req: NextRequest) {
  try {
    const { mealId, dishes, headcount } = await req.json();

    if (!mealId || !Array.isArray(dishes) || dishes.length === 0 || !headcount) {
      return NextResponse.json({ error: "Missing mealId, dishes, or headcount." }, { status: 400 });
    }

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system:
        "You are a precise grocery shopping list generator for home cooking. Given dish names and a headcount, " +
        "produce a combined shopping list. Scale ingredient quantities to the headcount (most recipes are written " +
        "for 2-4 servings unless the dish clearly implies otherwise). Combine duplicate ingredients across dishes " +
        "into a single line with a summed quantity. Also include common pantry staples needed for these dishes " +
        "(oil, salt, pepper, garlic, vinegar, etc.) as separate checklist items marked category 'pantry', so the " +
        "cook can check off what they already have stocked, versus fresh ingredients that need buying marked " +
        'category "fresh". Respond with ONLY valid JSON, no markdown fences, no commentary, in exactly this shape: ' +
        '{"items":[{"name":string,"quantity":string,"category":"fresh"|"pantry"}]}',
      messages: [
        {
          role: "user",
          content: `Dishes: ${dishes.join(", ")}. Headcount: ${headcount} people.`,
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No response from the model." }, { status: 500 });
    }

    let parsed: { items: GeneratedItem[] };
    try {
      const cleaned = textBlock.text
        .trim()
        .replace(/^```(json)?/i, "")
        .replace(/```$/, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "Could not parse the generated list. Try again." }, { status: 500 });
    }

    const items = parsed.items.map((item) => ({ ...item, checked: false }));

    await supabase
      .from("shopping_lists")
      .upsert(
        {
          meal_id: mealId,
          dishes: dishes.map((name: string) => ({ name })),
          generated_ingredients: { items },
        },
        { onConflict: "meal_id" }
      );

    return NextResponse.json({ items });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong generating the list." }, { status: 500 });
  }
}
