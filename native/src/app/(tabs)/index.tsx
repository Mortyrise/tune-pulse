import { useIsFocused } from 'expo-router'
import TunerScreen from '../../screens/TunerScreen'

/** The tuner listens only while its tab is focused. */
export default function TunerRoute() {
  const focused = useIsFocused()
  return <TunerScreen active={focused} />
}
