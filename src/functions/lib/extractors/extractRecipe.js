"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractRecipe = void 0;
const https_1 = require("firebase-functions/v2/https");
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const llmParser_1 = require("./llmParser");
/**
 * Detect recipe source type from URL hostname.
 */
function detectSourceType(url) {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("tiktok.com"))
        return "tiktok";
    if (host.includes("instagram.com"))
        return "instagram";
    if (host.includes("youtube.com") || host.includes("youtu.be"))
        return "youtube";
    if (host.includes("pinterest.com"))
        return "pinterest";
    if (host.includes("facebook.com") || host.includes("fb.com"))
        return "facebook";
    return "web";
}
/**
 * Try to extract a Recipe from JSON-LD structured data on the page.
 */
function extractJsonLd($) {
    const scripts = $('script[type="application/ld+json"]');
    for (let i = 0; i < scripts.length; i++) {
        try {
            const raw = $(scripts[i]).html();
            if (!raw)
                continue;
            const data = JSON.parse(raw);
            const recipes = Array.isArray(data) ? data : data["@graph"] ?? [data];
            for (const item of recipes) {
                if (item["@type"] === "Recipe" || (Array.isArray(item["@type"]) && item["@type"].includes("Recipe"))) {
                    return jsonLdToRecipe(item);
                }
            }
        }
        catch {
            continue;
        }
    }
    return null;
}
function jsonLdToRecipe(ld) {
    const ingredients = (ld.recipeIngredient ?? []).map((line, i) => ({
        name: line,
        quantity: 0,
        unit: "to_taste",
        notes: undefined,
    }));
    const instructionsRaw = ld.recipeInstructions;
    let steps = [];
    if (Array.isArray(instructionsRaw)) {
        steps = instructionsRaw.map((s, i) => ({
            order: i + 1,
            instruction: typeof s === "string" ? s : s.text ?? String(s),
        }));
    }
    const imageRaw = ld.image;
    const imageUrl = typeof imageRaw === "string"
        ? imageRaw
        : Array.isArray(imageRaw) ? imageRaw[0] : imageRaw?.url;
    return {
        title: ld.name ?? "Untitled Recipe",
        description: ld.description,
        imageUrl,
        ingredients,
        steps,
        servings: parseInt(String(ld.recipeYield ?? "4"), 10) || 4,
        prepTimeMinutes: parseDuration(ld.prepTime),
        cookTimeMinutes: parseDuration(ld.cookTime),
    };
}
/**
 * Parse ISO 8601 duration (e.g., "PT30M") to minutes.
 */
function parseDuration(iso) {
    if (!iso)
        return undefined;
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (!match)
        return undefined;
    return (parseInt(match[1] ?? "0", 10) * 60) + parseInt(match[2] ?? "0", 10);
}
/**
 * Cloud Function: extract recipe from URL.
 */
exports.extractRecipe = (0, https_1.onRequest)({ cors: true, maxInstances: 10 }, async (req, res) => {
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
    }
    catch {
        res.status(400).json({ error: "Invalid URL format" });
        return;
    }
    try {
        const sourceType = detectSourceType(url);
        // For video platforms, go straight to LLM (no HTML recipe schema)
        if (["tiktok", "instagram", "youtube"].includes(sourceType)) {
            const result = await (0, llmParser_1.parseWithLLM)(`Extract a recipe from this ${sourceType} URL: ${url}\nParse any caption, description, or transcript into a structured recipe.`);
            res.json(result);
            return;
        }
        // Fetch HTML for web/pinterest/facebook
        const { data: html } = await axios_1.default.get(url, {
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
        const result = await (0, llmParser_1.parseWithLLM)(`Extract a recipe from this webpage text. Return structured JSON with title, ingredients (with quantity, unit, name), steps, servings, prepTimeMinutes, cookTimeMinutes.\n\nText:\n${bodyText}`);
        res.json(result);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        res.status(500).json({ error: `Extraction failed: ${message}` });
    }
});
//# sourceMappingURL=extractRecipe.js.map