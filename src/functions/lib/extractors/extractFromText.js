"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractRecipeFromText = void 0;
const https_1 = require("firebase-functions/v2/https");
const llmParser_1 = require("./llmParser");
/**
 * Cloud Function: extract recipe from user-pasted text.
 */
exports.extractRecipeFromText = (0, https_1.onRequest)({ cors: true, maxInstances: 10 }, async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).send("Method not allowed");
        return;
    }
    const { text } = req.body;
    if (!text || typeof text !== "string") {
        res.status(400).json({ error: "Missing or invalid 'text' field" });
        return;
    }
    if (text.length > 10000) {
        res.status(400).json({ error: "Text too long (max 10,000 characters)" });
        return;
    }
    try {
        const result = await (0, llmParser_1.parseWithLLM)(`Extract a structured recipe from the following text. Return valid JSON.\n\n${text}`);
        res.json(result);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        res.status(500).json({ error: `Text extraction failed: ${message}` });
    }
});
//# sourceMappingURL=extractFromText.js.map