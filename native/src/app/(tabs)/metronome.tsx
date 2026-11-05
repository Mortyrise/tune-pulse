import { useIsFocused } from 'expo-router'
import MetronomeScreen from '../../screens/MetronomeScreen'

/** `active` only gates UI beat updates; the engine lives in MetronomeProvider. */
export default function MetronomeRoute() {
  const focused = useIsFocused()
  return <MetronomeScreen active={focused} />
}
