// Bottom tab bar per handoff "Tab bar" / web TabBar: paper pill, active tab on
// the bg colour with a hairline. Icons come from each screen's `tabBarIcon`.
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { BottomTabBarProps } from 'expo-router/js-tabs'
import { useTheme } from '../theme'

export function TabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const { colors, fonts } = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.outer, { paddingBottom: insets.bottom, backgroundColor: colors.bg }]}>
      <View style={[styles.pill, { backgroundColor: colors.paper, borderColor: colors.borderStrong }]}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key]
          const focused = state.index === index
          const color = focused ? colors.fg : colors.muted
          const label = options.title ?? route.name

          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
            if (!focused && !event.defaultPrevented) navigateToTab(route.key)
          }

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              style={[
                styles.tab,
                focused && { backgroundColor: colors.bg, borderColor: colors.borderStrong },
              ]}
            >
              {options.tabBarIcon?.({ focused, color, size: 15 })}
              <Text style={[styles.label, { color, fontFamily: fonts.sans.semibold }]}>{label}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  outer: { paddingHorizontal: 18, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    width: '100%',
    maxWidth: 380,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  label: { fontSize: 12, letterSpacing: 0.24 },
})
