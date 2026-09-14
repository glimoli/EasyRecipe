import React from 'react';
import { View } from 'react-native';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/AuthContext';
import AppNavigator from './navigation/AppNavigator';

function IdleDetector({ children }: { children: React.ReactNode }) {
  const { resetIdleTimer } = useAuth();
  return (
    <View style={{ flex: 1 }} onTouchStart={resetIdleTimer}>
      {children}
    </View>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <IdleDetector>
        <AppNavigator />
      </IdleDetector>
    </AuthProvider>
  );
}
