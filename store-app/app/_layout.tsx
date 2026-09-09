import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// Side-effect import: installs the foreground notification handler app-wide,
// so a screen-offline alert is presented even outside the dashboard group.
import '../lib/notifications';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      {/* No backgroundColor: SDK 54 targets API 36, where edge-to-edge is
          always on and the status bar is transparent over app content. */}
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
    </SafeAreaProvider>
  );
}
