"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateWithGemini = generateWithGemini;
const groq_sdk_1 = __importDefault(require("groq-sdk"));
let client = null;
function getClient() {
    if (!client) {
        const key = process.env.GROQ_API_KEY;
        if (!key) {
            throw new Error("GROQ_API_KEY is not configured. Add it to src/functions/.env");
        }
        client = new groq_sdk_1.default({ apiKey: key });
    }
    return client;
}
async function generateWithGemini(systemPrompt, userPrompt) {
    const groq = getClient();
    const enhancedSystem = systemPrompt +
        "\n\nIMPORTANT: All numeric values MUST be valid JSON numbers (use 0.5 instead of 1/2, use 0.25 instead of 1/4, etc). Never use fractions.";
    try {
        const result = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: enhancedSystem },
                { role: "user", content: userPrompt },
            ],
            temperature: 0.7,
            max_tokens: 4000,
            response_format: { type: "json_object" },
        });
        const text = result.choices[0]?.message?.content;
        if (!text) {
            throw new Error("No response from Groq");
        }
        return text;
    }
    catch (err) {
        // Groq rejects JSON with fractions like 1/2 — extract and fix the failed generation
        if (err && typeof err === "object" && "status" in err && err.status === 400) {
            const error = err;
            const raw = error.error?.failed_generation;
            if (raw) {
                const fixed = raw.replace(/:\s*(\d+)\/(\d+)/g, (_, num, den) => `: ${(parseInt(num) / parseInt(den)).toFixed(2)}`);
                return fixed;
            }
        }
        throw err;
    }
}
//# sourceMappingURL=geminiClient.js.map