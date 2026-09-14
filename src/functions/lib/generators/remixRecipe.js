"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.remixRecipe = void 0;
const https_1 = require("firebase-functions/v2/https");
const geminiClient_1 = require("./geminiClient");
const REMIX_SYSTEM_PROMPT = `You are a creative professional chef. Given an existing recipe and an optional direction, create a NEW recipe inspired by the original.

Return ONLY valid JSON with this exact structure:
{
  "title": "New Recipe Title",
  "description": "Short description explaining the inspiration",
  "ingredients": [
    { "name": "flour", "quantity": 2, "unit": "cup", "notes": "all-purpose" }
  ],
  "steps": [
    { "order": 1, "instruction": "Preheat oven to 350°F" }
  ],
  "servings": 4,
  "servingUnit": "servings",
  "prepTimeMinutes": 15,
  "cookTimeMinutes": 30,
  "categories": ["dinner"],
  "tags": ["inspired", "remix"]
}

Valid units: tsp, tbsp, cup, ml, liter, oz, fl_oz, g, kg, lb, piece, pinch, to_taste.
Valid categories: breakfast, lunch, dinner, dessert, snack, appetizer, beverage, other.

The new recipe should be clearly different from the original but share a recognizable connection (similar flavor profile, key ingredient, or technique). Be creative but practical.`;
exports.remixRecipe = (0, https_1.onRequest)({ cors: true }, async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }
    const { recipe, direction } = req.body;
    if (!recipe || !recipe.title || !recipe.ingredients || !recipe.steps) {
        res.status(400).json({ error: "Missing recipe data (title, ingredients, steps required)" });
        return;
    }
    const userPrompt = `Create a new recipe inspired by this one:

Title: ${recipe.title}
Description: ${recipe.description || "N/A"}
Servings: ${recipe.servings}

Ingredients:
${recipe.ingredients.map((i) => `- ${i.quantity} ${i.unit} ${i.name}${i.notes ? ` (${i.notes})` : ""}`).join("\n")}

Steps:
${recipe.steps.map((s) => `${s.order}. ${s.instruction}`).join("\n")}

${direction ? `Direction/twist: ${direction}` : "Create a creative variation of this recipe."}`;
    try {
        const text = await (0, geminiClient_1.generateWithGemini)(REMIX_SYSTEM_PROMPT, userPrompt);
        const result = JSON.parse(text);
        // Sanity checks
        if (!result.title)
            result.title = `Remix of ${recipe.title}`;
        if (!Array.isArray(result.ingredients))
            result.ingredients = [];
        if (!Array.isArray(result.steps))
            result.steps = [];
        if (!result.servings || result.servings < 1)
            result.servings = 4;
        if (!Array.isArray(result.categories))
            result.categories = ["other"];
        if (!Array.isArray(result.tags))
            result.tags = [];
        res.status(200).json(result);
    }
    catch (err) {
        console.error("remixRecipe error:", err);
        res.status(500).json({ error: "Failed to remix recipe" });
    }
});
//# sourceMappingURL=remixRecipe.js.map