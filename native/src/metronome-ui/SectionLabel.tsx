import type { ReactNode } from 'react'
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native'
import { useTheme } from '../theme'

/** `.pg-section-label`: mono, uppercase, wide tracking, muted. */
export function SectionLabel({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const { colors, fonts } = useTheme()
  return (
    <Text style={[styles.label, { color: colors.muted, fontFamily: fonts.sans.semibold }, style]}>{children}</Text>
  )
}

const styles = StyleSheet.create({
  label: { fontSize: 9.5, letterSpacing: 1.9, textTransform: 'uppercase' },
})
