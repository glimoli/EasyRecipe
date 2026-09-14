"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRecipe = void 0;
const https_1 = require("firebase-functions/v2/https");
const geminiClient_1 = require("./geminiClient");
const GENERATE_SYSTEM_PROMPT = `You are a creative professional chef. Given a set of criteria, generate an original recipe that matches ALL the requirements.

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
  "servingUnit": "servings",
  "prepTimeMinutes": 15,
  "cookTimeMinutes": 30,
  "categories": ["dinner"],
  "tags": ["quick", "healthy"]
}

Valid units: tsp, tbsp, cup, ml, liter, oz, fl_oz, g, kg, lb, piece, pinch, to_taste.
Valid categories: breakfast, lunch, dinner, dessert, snack, appetizer, beverage, other.

Be creative but practical. Provide clear, detailed instructions. Respect all dietary restrictions strictly.`;
exports.generateRecipe = (0, https_1.onRequest)({ cors: true }, async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }
    const { mealType, maxMinutes, dietary, ingredients, avoid, freeText, existingTitles } = req.body;
    if (!mealType && !dietary && !ingredients && !freeText && !avoid) {
        res.status(400).json({ error: "Provide at least one search criterion" });
        return;
    }
    const parts = [];
    if (mealType)
        parts.push(`Meal type: ${mealType}`);
    if (maxMinutes)
        parts.push(`Total time: under ${maxMinutes} minutes`);
    if (dietary)
        parts.push(`Dietary requirements: ${dietary}`);
    if (ingredients)
        parts.push(`Must include these ingredients: ${ingredients}`);
    if (avoid)
        parts.push(`MUST NOT contain any of these ingredients (strictly avoid): ${avoid}`);
    if (freeText)
        parts.push(`Additional notes: ${freeText}`);
    if (Array.isArray(existingTitles) && existingTitles.length > 0) {
        parts.push(`IMPORTANT: Do NOT generate any of these existing recipes (create something different):\n- ${existingTitles.join("\n- ")}`);
    }
    const userPrompt = `Generate a recipe with these criteria:\n\n${parts.join("\n")}`;
    try {
        const text = await (0, geminiClient_1.generateWithGemini)(GENERATE_SYSTEM_PROMPT, userPrompt);
        const result = JSON.parse(text);
        if (!result.title)
            result.title = "AI Recipe";
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
        console.error("generateRecipe error:", err);
        res.status(500).json({ error: "Failed to generate recipe" });
    }
});
//# sourceMappingURL=generateRecipe.js.map