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
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRecipe = exports.remixRecipe = exports.reviewRecipe = exports.extractRecipeFromImage = exports.extractRecipeFromText = exports.extractRecipe = void 0;
const admin = __importStar(require("firebase-admin"));
const extractRecipe_1 = require("./extractors/extractRecipe");
Object.defineProperty(exports, "extractRecipe", { enumerable: true, get: function () { return extractRecipe_1.extractRecipe; } });
const extractFromText_1 = require("./extractors/extractFromText");
Object.defineProperty(exports, "extractRecipeFromText", { enumerable: true, get: function () { return extractFromText_1.extractRecipeFromText; } });
const extractFromImage_1 = require("./extractors/extractFromImage");
Object.defineProperty(exports, "extractRecipeFromImage", { enumerable: true, get: function () { return extractFromImage_1.extractRecipeFromImage; } });
const reviewRecipe_1 = require("./generators/reviewRecipe");
Object.defineProperty(exports, "reviewRecipe", { enumerable: true, get: function () { return reviewRecipe_1.reviewRecipe; } });
const remixRecipe_1 = require("./generators/remixRecipe");
Object.defineProperty(exports, "remixRecipe", { enumerable: true, get: function () { return remixRecipe_1.remixRecipe; } });
const generateRecipe_1 = require("./generators/generateRecipe");
Object.defineProperty(exports, "generateRecipe", { enumerable: true, get: function () { return generateRecipe_1.generateRecipe; } });
admin.initializeApp();
//# sourceMappingURL=index.js.map