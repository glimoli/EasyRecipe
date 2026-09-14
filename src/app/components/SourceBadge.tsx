import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RecipeSourceType } from '../models/types';

const BADGE_COLORS: Record<string, string> = {
  tiktok: '#010101',
  instagram: '#E1306C',
  youtube: '#FF0000',
  pinterest: '#E60023',
  facebook: '#1877F2',
  web: '#4A90D9',
  image: '#8E44AD',
  manual: '#27AE60',
  'ai-generated': '#F39C12',
  'ai-remix': '#E67E22',
};

const BADGE_LABELS: Record<string, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
  pinterest: 'Pinterest',
  facebook: 'Facebook',
  web: 'Web',
  image: 'Image',
  manual: 'Manual',
  'ai-generated': 'AI Generated',
  'ai-remix': 'AI Remix',
};

interface Props {
  sourceType: RecipeSourceType;
  label?: string;
}

export default function SourceBadge({ sourceType, label }: Props) {
  const bgColor = BADGE_COLORS[sourceType] ?? '#999';
  const displayLabel = label ?? BADGE_LABELS[sourceType] ?? sourceType;

  return (
    <View style={[styles.badge, { backgroundColor: bgColor }]}>
      <Text style={styles.text}>{displayLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
