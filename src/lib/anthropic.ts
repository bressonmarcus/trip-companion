import Anthropic from "@anthropic-ai/sdk";

// Server-side only — this file must never be imported from a "use client"
// component. The API key here is never sent to the browser.
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
