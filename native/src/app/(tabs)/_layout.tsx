// Two tabs (Tuner, Metronome) with the handoff tab bar. Screens get the top
// safe-area inset here; the tab bar handles the bottom one.
import { Tabs } from 'expo-router/js-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TabBar } from '../../components/TabBar'
import { Icon } from '../../components/Icon'
import { useTheme } from '../../theme'

export default function TabsLayout() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // keep false: a blurred tuner must re-render with active=false to stop the mic
        freezeOnBlur: false,
        sceneStyle: { backgroundColor: colors.bg, paddingTop: insets.top },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tuner',
          tabBarIcon: ({ color, size }) => (
            <Icon name="audioWaveform" size={size} strokeWidth={1.6} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="metronome"
        options={{
          title: 'Metronome',
          tabBarIcon: ({ color, size }) => <Icon name="timer" size={size} strokeWidth={1.6} color={String(color)} />,
        }}
      />
    </Tabs>
  )
}
