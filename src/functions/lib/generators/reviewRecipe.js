"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewRecipe = void 0;
const https_1 = require("firebase-functions/v2/https");
const geminiClient_1 = require("./geminiClient");
const REVIEW_SYSTEM_PROMPT = `You are a professional chef and recipe consultant. Given a recipe, provide helpful, actionable tips to improve it.

Return ONLY valid JSON with this exact structure:
{
  "tips": [
    { "category": "flavor", "suggestion": "Your specific suggestion here" },
    { "category": "technique", "suggestion": "Your specific suggestion here" },
    { "category": "nutrition", "suggestion": "Your specific suggestion here" },
    { "category": "presentation", "suggestion": "Your specific suggestion here" },
    { "category": "variation", "suggestion": "Your specific suggestion here" }
  ],
  "overallRating": "A brief 1-2 sentence overall assessment of the recipe"
}

Categories to consider: flavor, technique, nutrition, presentation, variation, time-saving, substitution.
Provide 3-6 tips. Be specific and constructive — reference actual ingredients and steps from the recipe.
Do not include generic advice. Every tip should be directly relevant to THIS recipe.`;
exports.reviewRecipe = (0, https_1.onRequest)({ cors: true }, async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }
    const { recipe } = req.body;
    if (!recipe || !recipe.title || !recipe.ingredients || !recipe.steps) {
        res.status(400).json({ error: "Missing recipe data (title, ingredients, steps required)" });
        return;
    }
    const userPrompt = `Review this recipe and provide improvement tips:

Title: ${recipe.title}
Description: ${recipe.description || "N/A"}
Servings: ${recipe.servings}
Prep Time: ${recipe.prepTimeMinutes || "N/A"} min
Cook Time: ${recipe.cookTimeMinutes || "N/A"} min

Ingredients:
${recipe.ingredients.map((i) => `- ${i.quantity} ${i.unit} ${i.name}${i.notes ? ` (${i.notes})` : ""}`).join("\n")}

Steps:
${recipe.steps.map((s) => `${s.order}. ${s.instruction}`).join("\n")}

${recipe.nutrition ? `Nutrition per serving: ${recipe.nutrition.calories} cal, ${recipe.nutrition.proteinG}g protein, ${recipe.nutrition.carbsG}g carbs, ${recipe.nutrition.fatG}g fat` : ""}`;
    try {
        const text = await (0, geminiClient_1.generateWithGemini)(REVIEW_SYSTEM_PROMPT, userPrompt);
        const result = JSON.parse(text);
        if (!Array.isArray(result.tips)) {
            throw new Error("Invalid response structure");
        }
        res.status(200).json(result);
    }
    catch (err) {
        console.error("reviewRecipe error:", err);
        res.status(500).json({ error: "Failed to review recipe" });
    }
});
//# sourceMappingURL=reviewRecipe.js.map