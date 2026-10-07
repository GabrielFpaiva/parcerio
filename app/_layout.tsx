import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import 'react-native-gesture-handler';
import '../global.css';
import { AuthProvider } from '@/core/auth/AuthProvider';

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" options={{ animation: 'none' }} />
          <Stack.Screen name="(app)" options={{ animation: 'none' }} />
          <Stack.Screen name="(modals)" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        </Stack>
      </AuthProvider>
    </QueryClientProvider>
  );
}
