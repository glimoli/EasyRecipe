import OpenAI from "openai";

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

interface ParsedRecipe {
  title: string;
  description?: string;
  imageUrl?: string;
  ingredients: { name: string; quantity: number; unit: string; notes?: string }[];
  steps: { order: number; instruction: string; durationMinutes?: number }[];
  servings: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
}

const SYSTEM_PROMPT = `You are a recipe extraction assistant. Given text content (from a web page, social media post, or user input), extract a structured recipe.

Return ONLY valid JSON with this exact structure:
{
  "title": "Recipe Title",
  "description": "Short description",
  "ingredients": [
    { "name": "flour", "quantity": 2, "unit": "cup", "notes": "all-purpose" }
  ],
  "steps": [
    { "order": 1, "instruction": "Preheat oven to 350°F" }
  ],
  "servings": 4,
  "prepTimeMinutes": 15,
  "cookTimeMinutes": 30
}

Valid units: tsp, tbsp, cup, ml, liter, oz, fl_oz, g, kg, lb, piece, pinch, to_taste.
If you cannot determine a value, use reasonable defaults. Always return valid JSON.`;

export async function parseWithLLM(prompt: string): Promise<ParsedRecipe> {
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    max_tokens: 2000,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from LLM");
  }

  const parsed = JSON.parse(content) as ParsedRecipe;

  // Sanity checks
  if (!parsed.title) parsed.title = "Untitled Recipe";
  if (!Array.isArray(parsed.ingredients)) parsed.ingredients = [];
  if (!Array.isArray(parsed.steps)) parsed.steps = [];
  if (!parsed.servings || parsed.servings < 1) parsed.servings = 4;

  return parsed;
}
