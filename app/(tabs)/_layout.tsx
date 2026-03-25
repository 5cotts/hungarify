import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { colors } from '@/src/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accentGreen,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
        },
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '600' },
        headerShown: Platform.OS !== 'web',
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hungarify',
          tabBarLabel: 'Home',
        }}
      />
      <Tabs.Screen
        name="reference"
        options={{
          title: 'Reference',
          tabBarLabel: 'Reference',
        }}
      />
    </Tabs>
  );
}
