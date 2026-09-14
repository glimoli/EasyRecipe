"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractRecipeFromImage = void 0;
const https_1 = require("firebase-functions/v2/https");
const llmParser_1 = require("./llmParser");
/**
 * Cloud Function: extract recipe from an image.
 * Accepts an imageUri that has already been uploaded to Firebase Storage.
 * Uses Google Cloud Vision OCR to extract text, then LLM to structure it.
 */
exports.extractRecipeFromImage = (0, https_1.onRequest)({ cors: true, maxInstances: 10 }, async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).send("Method not allowed");
        return;
    }
    const { imageUri } = req.body;
    if (!imageUri || typeof imageUri !== "string") {
        res.status(400).json({ error: "Missing or invalid 'imageUri' field" });
        return;
    }
    try {
        // --- OCR via Google Cloud Vision ---
        // In production, use @google-cloud/vision client:
        //   const vision = require('@google-cloud/vision');
        //   const client = new vision.ImageAnnotatorClient();
        //   const [result] = await client.textDetection(imageUri);
        //   const text = result.textAnnotations?.[0]?.description ?? '';
        //
        // For now, placeholder that sends the imageUri description to LLM:
        const ocrText = `[OCR placeholder — replace with actual Cloud Vision integration]\nImage URI: ${imageUri}`;
        const result = await (0, llmParser_1.parseWithLLM)(`The following text was extracted via OCR from an image of a recipe. Please structure it into a valid recipe JSON.\n\n${ocrText}`);
        res.json(result);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        res.status(500).json({ error: `Image extraction failed: ${message}` });
    }
});
//# sourceMappingURL=extractFromImage.js.map