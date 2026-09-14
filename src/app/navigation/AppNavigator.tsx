import React from 'react';
import { TouchableOpacity, Text, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../contexts/AuthContext';

// Screens
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import RecipeDetailScreen from '../screens/RecipeDetailScreen';
import ImportScreen from '../screens/ImportScreen';
import CookbooksScreen from '../screens/CookbooksScreen';
import CookbookDetailScreen from '../screens/CookbookDetailScreen';
import RecipeEditScreen from '../screens/RecipeEditScreen';

// ── Param lists ──────────────────────────────────────────────
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  RecipeDetail: { recipeId: string };
  RecipeEdit: { recipeId?: string; prefill?: Record<string, unknown> };
  Import: undefined;
  CookbookDetail: { cookbookId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ paddingRight: 12 }}>
      <Text style={{ fontSize: 16, color: '#E85D04' }}>← Back</Text>
    </TouchableOpacity>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Recipes" component={HomeScreen} />
      <Tab.Screen name="Cookbooks" component={CookbooksScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={({ navigation }) => ({
          headerShown: true,
          headerLeft: () =>
            navigation.canGoBack() ? (
              <BackButton onPress={() => navigation.goBack()} />
            ) : null,
        })}
      >
        {!user ? (
          <Stack.Screen name="Auth" component={LoginScreen} options={{ title: 'Sign In', headerLeft: () => null }} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} options={{ title: 'Recipe' }} />
            <Stack.Screen name="RecipeEdit" component={RecipeEditScreen} options={{ title: 'Edit Recipe' }} />
            <Stack.Screen name="Import" component={ImportScreen} options={{ title: 'Import Recipe' }} />
            <Stack.Screen name="CookbookDetail" component={CookbookDetailScreen} options={{ title: 'Cookbook' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
