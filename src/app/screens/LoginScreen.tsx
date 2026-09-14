import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { signInWithEmail, signUpWithEmail, signInWithGoogle } from '../services/auth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password, displayName || 'User');
      } else {
        await signInWithEmail(email, password);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Authentication failed';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Google sign-in failed';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>EasyRecipe</Text>
      <Text style={styles.subtitle}>
        {isSignUp ? 'Create your account' : 'Sign in to continue'}
      </Text>

      {isSignUp && (
        <TextInput
          style={styles.input}
          placeholder="Display Name"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
        />
      )}
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{isSignUp ? 'Sign Up' : 'Sign In'}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.googleButton} onPress={handleGoogle} disabled={loading}>
        <Text style={styles.googleButtonText}>Continue with Google</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
        <Text style={styles.toggleText}>
          {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 8, color: '#E85D04' },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 32, color: '#666' },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 14,
    fontSize: 16, marginBottom: 12, backgroundColor: '#fafafa',
  },
  button: {
    backgroundColor: '#E85D04', borderRadius: 8, padding: 16,
    alignItems: 'center', marginBottom: 12,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  googleButton: {
    backgroundColor: '#fff', borderRadius: 8, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: '#ddd', marginBottom: 16,
  },
  googleButtonText: { color: '#333', fontSize: 16, fontWeight: '600' },
  toggleText: { textAlign: 'center', color: '#E85D04', fontSize: 14 },
});
