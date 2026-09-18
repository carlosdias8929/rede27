import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessaoProvider } from '../src/state/sessao';
import { colors } from '../src/theme';

export default function LayoutRaiz() {
  return (
    <SafeAreaProvider>
      <SessaoProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="inicio" />
          <Stack.Screen name="corrida" />
          <Stack.Screen name="carteira" options={{ presentation: 'modal' }} />
          <Stack.Screen name="motorista" />
          <Stack.Screen name="admin" />
        </Stack>
      </SessaoProvider>
    </SafeAreaProvider>
  );
}
