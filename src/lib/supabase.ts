import { createClient } from "@supabase/supabase-js";

// Client-side Supabase client. Uses the publishable key, which is safe to
// expose in the browser (same idea as the old "anon" key) — access control
// happens via the trip code, not via this key being secret.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);
