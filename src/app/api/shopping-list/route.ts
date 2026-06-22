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
type StoredItem = { name: string; quantity: string; category: "fresh" | "pantry" | "personal"; checked: boolean; addedBy?: string };
type Loadout = { protein: string[]; sides: string[]; salad: string[]; sauce: string[]; other: string[] };

const CATEGORY_LABELS: Record<keyof Loadout, string> = {
  protein: "Protein",
  sides: "Sides",
  salad: "Salad",
  sauce: "Sauce",
  other: "Other",
};

export async function POST(req: NextRequest) {
  try {
    const { mealId, loadout, headcount } = (await req.json()) as {
      mealId?: string;
      loadout?: Loadout;
      headcount?: number;
    };

    if (!mealId || !loadout || !headcount) {
      return NextResponse.json({ error: "Missing mealId, loadout, or headcount." }, { status: 400 });
    }

    const sections = (Object.keys(CATEGORY_LABELS) as (keyof Loadout)[])
      .filter((key) => (loadout[key] ?? []).length > 0)
      .map((key) => `${CATEGORY_LABELS[key]}: ${loadout[key].join("; ")}`);

    if (sections.length === 0) {
      return NextResponse.json({ error: "Loadout is empty." }, { status: 400 });
    }

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system:
        "You are a precise grocery shopping list generator for home cooking. The user gives you a meal's " +
        "\"loadout\" organized by category (protein, sides, salad, sauce, other). Items within a category are " +
        "components of the same meal, not separate dishes — e.g. a marinade listed under protein is a prep item " +
        "for that protein, not its own dish. Treat the whole loadout as one meal. Produce a combined shopping " +
        "list covering every category. Scale ingredient quantities to the given headcount (most recipes are " +
        "written for 2-4 servings unless an item clearly implies otherwise). Combine duplicate ingredients across " +
        "items into a single line with a summed quantity. Also include common pantry staples needed (oil, salt, " +
        "pepper, garlic, vinegar, etc.) as separate checklist items marked category 'pantry', so the cook can " +
        "check off what they already have stocked, versus fresh ingredients that need buying marked category " +
        '"fresh". Respond with ONLY valid JSON, no markdown fences, no commentary, in exactly this shape: ' +
        '{"items":[{"name":string,"quantity":string,"category":"fresh"|"pantry"}]}. ' +
        "Keep the JSON compact with no extra commentary before or after it.",

      messages: [
        {
          role: "user",
          content: `Meal loadout:\n${sections.join("\n")}\n\nHeadcount: ${headcount} people.`,
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
      // The model occasionally wraps the JSON in stray text or gets cut off mid-object.
      // Try to salvage the outermost {...} block before giving up.
      const match = textBlock.text.match(/\{[\s\S]*\}/);
      if (!match) {
        console.error("Unparseable shopping-list response:", textBlock.text);
        return NextResponse.json({ error: "Could not parse the generated list. Try again." }, { status: 500 });
      }
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        console.error("Unparseable shopping-list response:", textBlock.text);
        return NextResponse.json({ error: "Could not parse the generated list. Try again." }, { status: 500 });
      }
    }

    const generatedItems = parsed.items.map((item) => ({ ...item, checked: false }));

    // Preserve any manually-added personal items across regenerations — only the
    // AI-generated fresh/pantry portion gets replaced.
    const { data: existing } = await supabase
      .from("shopping_lists")
      .select("generated_ingredients")
      .eq("meal_id", mealId)
      .maybeSingle();
    const existingItems =
      (existing?.generated_ingredients as { items?: StoredItem[] } | null)?.items ?? [];
    const personalItems = existingItems.filter((item) => item.category === "personal");

    const items = [...personalItems, ...generatedItems];

    await supabase
      .from("shopping_lists")
      .upsert(
        {
          meal_id: mealId,
          dishes: sections.map((name) => ({ name })),
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
