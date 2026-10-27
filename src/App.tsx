import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { TabBar } from './components/TabBar'
import { MetronomeScreen } from './screens/MetronomeScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { TunerScreen } from './screens/TunerScreen'
import { useTheme } from './hooks/useTheme'
import { MetronomeProvider } from './hooks/MetronomeProvider'
import { TunerSettingsProvider } from './hooks/TunerSettingsProvider'

function AppShell() {
  useTheme() // initialize theme on mount

  return (
    <div className="flex h-full flex-col">
      <main
        className="flex-1 overflow-y-auto"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <Routes>
          <Route path="/" element={<TunerScreen />} />
          <Route path="/metronome" element={<MetronomeScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <TabBar />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <TunerSettingsProvider>
        <MetronomeProvider>
          <AppShell />
        </MetronomeProvider>
      </TunerSettingsProvider>
    </BrowserRouter>
  )
}
