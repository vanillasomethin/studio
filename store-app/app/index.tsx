import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { loadSession } from '../lib/storage';
import { C } from '../lib/colors';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    loadSession().then((session) => {
      if (session?.storeName) {
        router.replace('/(dashboard)/');
      } else {
        router.replace('/(auth)/sign-in');
      }
    });
  }, [router]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
      <ActivityIndicator size="large" color={C.primary} />
    </View>
  );
}
