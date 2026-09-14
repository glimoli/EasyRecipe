import * as admin from "firebase-admin";
import { extractRecipe } from "./extractors/extractRecipe";
import { extractRecipeFromText } from "./extractors/extractFromText";
import { extractRecipeFromImage } from "./extractors/extractFromImage";
import { reviewRecipe } from "./generators/reviewRecipe";
import { remixRecipe } from "./generators/remixRecipe";
import { generateRecipe } from "./generators/generateRecipe";

admin.initializeApp();

export { extractRecipe, extractRecipeFromText, extractRecipeFromImage, reviewRecipe, remixRecipe, generateRecipe };
