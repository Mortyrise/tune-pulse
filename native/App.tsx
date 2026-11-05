// Owned by task 04-shell. Two tabs by state; both screens stay mounted so a
// running metronome keeps its engine when switching tabs.
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import TunerScreen from './src/screens/TunerScreen'
import MetronomeScreen from './src/screens/MetronomeScreen'

type Tab = 'tuner' | 'metronome'

const TABS: { key: Tab; label: string }[] = [
  { key: 'tuner', label: 'Tuner' },
  { key: 'metronome', label: 'Metronome' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('tuner')

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.tabBar}>
          {TABS.map(({ key, label }) => (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              style={[styles.tab, tab === key && styles.tabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === key }}
            >
              <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={[styles.screen, tab !== 'tuner' && styles.hidden]}>
          <TunerScreen active={tab === 'tuner'} />
        </View>
        <View style={[styles.screen, tab !== 'metronome' && styles.hidden]}>
          <MetronomeScreen active={tab === 'metronome'} />
        </View>
        <StatusBar style="dark" />
      </SafeAreaView>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#ccc' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 3, borderColor: '#000' },
  tabText: { fontSize: 16, color: '#666' },
  tabTextActive: { color: '#000', fontWeight: '600' },
  screen: { flex: 1 },
  hidden: { display: 'none' },
})
