// Root layout: providers above the navigator (metronome keeps playing across
// screens), splash held until fonts + persisted theme are ready.
import { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import * as SystemUI from 'expo-system-ui'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { ThemeProvider, statusBarStyle, useTheme, useThemeReady } from '../theme'
import { TunerSettingsProvider } from '../settings'
import { MetronomeProvider } from '../hooks/MetronomeProvider'

SplashScreen.preventAutoHideAsync().catch(() => {})

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider>
        <RootNavigator />
      </ThemeProvider>
    </GestureHandlerRootView>
  )
}

function RootNavigator() {
  const ready = useThemeReady()
  const { mode, colors } = useTheme()

  useEffect(() => {
    if (ready) SplashScreen.hide()
  }, [ready])

  useEffect(() => {
    // Root view colour behind screens (avoids white flashes on transitions).
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {})
  }, [colors.bg])

  if (!ready) return null

  return (
    <TunerSettingsProvider>
      <MetronomeProvider>
        <StatusBar style={statusBarStyle(mode)} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="settings"
            options={{
              // back button only: the page draws its own design title
              headerShown: true,
              title: '',
              headerBackTitle: '',
              headerStyle: { backgroundColor: colors.bg },
              headerTintColor: colors.fg,
              headerShadowVisible: false,
            }}
          />
        </Stack>
      </MetronomeProvider>
    </TunerSettingsProvider>
  )
}

const styles = StyleSheet.create({ root: { flex: 1 } })
