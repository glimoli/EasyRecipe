import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Recipe } from '../models/types';
import SourceBadge from './SourceBadge';

interface Props {
  recipe: Recipe;
  onPress: () => void;
  categoryLabel?: string;
  categoryColor?: string;
  categoryBorderColor?: string;
}

export default function RecipeCard({ recipe, onPress, categoryLabel, categoryColor, categoryBorderColor }: Props) {
  return (
    <TouchableOpacity
      style={[
        styles.card,
        categoryColor ? { backgroundColor: categoryColor } : undefined,
        categoryBorderColor ? { borderColor: categoryBorderColor } : undefined,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {recipe.imageUrl && recipe.imageUrl.length > 0 ? (
        <Image source={{ uri: recipe.imageUrl }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.image, styles.placeholder]}>
          <Text style={styles.placeholderText}>🍽️</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {recipe.title}
        </Text>
        <View style={styles.row}>
          <SourceBadge sourceType={recipe.sourceType} label={recipe.sourcePlatformLabel} />
          {recipe.isAiGenerated && (
            <Text style={styles.aiTag}>✨ AI</Text>
          )}
        </View>
        <Text style={styles.meta}>
          {recipe.servings} {recipe.servingUnit || 'servings'}
          {recipe.cookTimeMinutes ? ` · ${recipe.cookTimeMinutes} min` : ''}
        </Text>
        {categoryLabel ? (
          <Text style={styles.categoryLabel}>{categoryLabel}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    overflow: 'hidden',
  },
  image: { width: 90, height: 90 },
  placeholder: { backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  placeholderText: { fontSize: 28 },
  info: { flex: 1, padding: 10, justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  aiTag: { fontSize: 11, color: '#F39C12', fontWeight: '600' },
  meta: { fontSize: 12, color: '#888' },
  categoryLabel: { fontSize: 11, color: '#6B7280', fontStyle: 'italic', marginTop: 2 },
});
