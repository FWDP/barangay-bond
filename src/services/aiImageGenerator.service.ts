/**
 * AI Proposal Highlight Poster & Image Generator Service
 * Generates high-quality cinematic imagery based on proposal context (Title, Description, Phases),
 * with support for Standalone User Knowledge Overrides when requested.
 */

export const DEFAULT_BARANGAY_BANNER =
  "https://images.unsplash.com/photo-1577495508048-b635879837f1?w=900&auto=format&fit=crop&q=80";

export interface ProposalImageContext {
  title?: string;
  description?: string;
  phases?: { title?: string; description?: string }[];
}

export const aiImageGenerator = {
  /**
   * Generate / Reimagine an image using Pollinations AI generative prompt.
   * Supports two distinct modes:
   * 1. Standalone User Knowledge Override (when user specifies "override", "ignore title", "my own knowledge", etc.)
   * 2. Full Project Context Synthesis (synthesizing title, description, and milestone deliverables).
   */
  generateReimaginedImage(
    prompt?: string,
    context?: ProposalImageContext
  ): string {
    const rawPrompt = (prompt || "").trim();
    const promptLower = rawPrompt.toLowerCase();

    // Check if the user explicitly requested to use their own knowledge / override project context
    const isStandaloneOverride =
      promptLower.includes("override") ||
      promptLower.includes("ignore title") ||
      promptLower.includes("ignore description") ||
      promptLower.includes("ignore phase") ||
      promptLower.includes("my own knowledge") ||
      promptLower.includes("from scratch") ||
      promptLower.includes("only this") ||
      promptLower.includes("custom only") ||
      promptLower.includes("standalone");

    let finalPromptText = "";

    if (isStandaloneOverride && rawPrompt) {
      // Pure User Knowledge Mode: strip instruction keywords and generate purely from user text
      const cleanCustom = rawPrompt
        .replace(/ignore title/gi, "")
        .replace(/ignore description/gi, "")
        .replace(/ignore phases?/gi, "")
        .replace(/my own knowledge/gi, "")
        .replace(/override/gi, "")
        .replace(/from scratch/gi, "")
        .replace(/only this:?/gi, "")
        .trim();

      finalPromptText = `cinematic photorealistic 4k high quality photography: ${cleanCustom || rawPrompt}`;
    } else {
      // Context-Aware Mode: synthesize project title, scope, phases, and custom prompt
      const title = context?.title || "Community Project";
      const descSnippet = context?.description ? context.description.slice(0, 140) : "";
      const phaseSnippet = (context?.phases || [])
        .map((p) => p.title)
        .filter(Boolean)
        .slice(0, 3)
        .join(", ");

      const contextParts: string[] = [title];
      if (descSnippet) contextParts.push(descSnippet);
      if (phaseSnippet) contextParts.push(`Key Activities: ${phaseSnippet}`);
      if (rawPrompt) contextParts.push(`Visual Focus: ${rawPrompt}`);

      finalPromptText = `cinematic photorealistic 4k high quality Philippine barangay youth community initiative, documentary style: ${contextParts.join(" • ")}`;
    }

    const encoded = encodeURIComponent(finalPromptText);
    return `https://image.pollinations.ai/prompt/${encoded}?width=900&height=600&nologo=true`;
  },
};
