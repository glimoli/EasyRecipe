import { onRequest } from "firebase-functions/v2/https";
import axios from "axios";
import * as cheerio from "cheerio";
import { parseWithLLM } from "./llmParser";

interface ExtractedRecipe {
  title: string;
  description?: string;
  imageUrl?: string;
  ingredients: { name: string; quantity: number; unit: string; notes?: string }[];
  steps: { order: number; instruction: string; durationMinutes?: number }[];
  servings: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  nutrition?: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number;
    sodiumMg: number;
  };
}

/**
 * Detect recipe source type from URL hostname.
 */
function detectSourceType(url: string): string {
  const host = new URL(url).hostname.toLowerCase();
  if (host.includes("tiktok.com")) return "tiktok";
  if (host.includes("instagram.com")) return "instagram";
  if (host.includes("youtube.com") || host.includes("youtu.be")) return "youtube";
  if (host.includes("pinterest.com")) return "pinterest";
  if (host.includes("facebook.com") || host.includes("fb.com")) return "facebook";
  return "web";
}

/**
 * Try to extract a Recipe from JSON-LD structured data on the page.
 */
function extractJsonLd($: cheerio.CheerioAPI): ExtractedRecipe | null {
  const scripts = $('script[type="application/ld+json"]');
  for (let i = 0; i < scripts.length; i++) {
    try {
      const raw = $(scripts[i]).html();
      if (!raw) continue;
      const data = JSON.parse(raw);
      const recipes = Array.isArray(data) ? data : data["@graph"] ?? [data];
      for (const item of recipes) {
        if (item["@type"] === "Recipe" || (Array.isArray(item["@type"]) && item["@type"].includes("Recipe"))) {
          return jsonLdToRecipe(item);
        }
      }
    } catch {
      continue;
    }
  }
  return null;
}

function jsonLdToRecipe(ld: Record<string, unknown>): ExtractedRecipe {
  const ingredients = (ld.recipeIngredient as string[] ?? []).map((line: string, i: number) => ({
    name: line,
    quantity: 0,
    unit: "to_taste",
    notes: undefined,
  }));

  const instructionsRaw = ld.recipeInstructions;
  let steps: ExtractedRecipe["steps"] = [];
  if (Array.isArray(instructionsRaw)) {
    steps = instructionsRaw.map((s: unknown, i: number) => ({
      order: i + 1,
      instruction: typeof s === "string" ? s : (s as Record<string, string>).text ?? String(s),
    }));
  }

  const imageRaw = ld.image;
  const imageUrl = typeof imageRaw === "string"
    ? imageRaw
    : Array.isArray(imageRaw) ? imageRaw[0] : (imageRaw as Record<string, string>)?.url;

  return {
    title: (ld.name as string) ?? "Untitled Recipe",
    description: ld.description as string | undefined,
    imageUrl,
    ingredients,
    steps,
    servings: parseInt(String(ld.recipeYield ?? "4"), 10) || 4,
    prepTimeMinutes: parseDuration(ld.prepTime as string),
    cookTimeMinutes: parseDuration(ld.cookTime as string),
  };
}

/**
 * Parse ISO 8601 duration (e.g., "PT30M") to minutes.
 */
function parseDuration(iso?: string): number | undefined {
  if (!iso) return undefined;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return undefined;
  return (parseInt(match[1] ?? "0", 10) * 60) + parseInt(match[2] ?? "0", 10);
}

/**
 * Cloud Function: extract recipe from URL.
 */
export const extractRecipe = onRequest(
  { cors: true, maxInstances: 10 },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }

    const { url } = req.body;
    if (!url || typeof url !== "string") {
      res.status(400).json({ error: "Missing or invalid 'url' field" });
      return;
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      res.status(400).json({ error: "Invalid URL format" });
      return;
    }

    try {
      const sourceType = detectSourceType(url);

      // For video platforms, go straight to LLM (no HTML recipe schema)
      if (["tiktok", "instagram", "youtube"].includes(sourceType)) {
        const result = await parseWithLLM(
          `Extract a recipe from this ${sourceType} URL: ${url}\nParse any caption, description, or transcript into a structured recipe.`
        );
        res.json(result);
        return;
      }

      // Fetch HTML for web/pinterest/facebook
      const { data: html } = await axios.get(url, {
        headers: { "User-Agent": "EasyRecipe/1.0" },
        timeout: 15000,
        maxContentLength: 2 * 1024 * 1024, // 2MB limit
      });

      const $ = cheerio.load(html);

      // Try JSON-LD first (structured data)
      const jsonLdRecipe = extractJsonLd($);
      if (jsonLdRecipe) {
        res.json(jsonLdRecipe);
        return;
      }

      // Fallback: extract text and use LLM
      const bodyText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 8000);
      const result = await parseWithLLM(
        `Extract a recipe from this webpage text. Return structured JSON with title, ingredients (with quantity, unit, name), steps, servings, prepTimeMinutes, cookTimeMinutes.\n\nText:\n${bodyText}`
      );
      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: `Extraction failed: ${message}` });
    }
  }
);
