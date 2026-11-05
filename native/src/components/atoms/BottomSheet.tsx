import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import {
  GestureDetector,
  GestureHandlerRootView,
  usePanGesture,
} from 'react-native-gesture-handler'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { scheduleOnRN } from 'react-native-worklets'
import { useTheme } from '../../theme'

export type BottomSheetProps = {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

const PANEL_MS = 220
const BACKDROP_MS = 180
const PANEL_EASE = Easing.bezier(0.2, 0.9, 0.3, 1)
const BACKDROP_EASE = Easing.ease
const DISMISS_FRACTION = 0.25
const DISMISS_VELOCITY = 900
const RUBBER_BAND = 0.2

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const { colors, fonts } = useTheme()
  const insets = useSafeAreaInsets()

  // Stay mounted through the exit animation (state adjusted during render).
  const [mounted, setMounted] = useState(open)
  if (open && !mounted) {
    setMounted(true)
  }

  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])
  const requestClose = useMemo(() => () => onCloseRef.current(), [])
  const unmount = useMemo(() => () => setMounted(false), [])

  const panel = useSharedValue(0) // 0 = hidden, 1 = shown
  const backdrop = useSharedValue(0)
  const dragY = useSharedValue(0)
  const height = useSharedValue(Dimensions.get('window').height)
  const isOpen = useSharedValue(open)

  useEffect(() => {
    isOpen.set(open)
    if (open) {
      dragY.set(0)
      panel.set(withTiming(1, { duration: PANEL_MS, easing: PANEL_EASE }))
      backdrop.set(withTiming(1, { duration: BACKDROP_MS, easing: BACKDROP_EASE }))
    } else {
      backdrop.set(withTiming(0, { duration: BACKDROP_MS, easing: BACKDROP_EASE }))
      panel.set(
        withTiming(0, { duration: PANEL_MS, easing: PANEL_EASE }, (finished) => {
          'worklet'
          if (finished && !isOpen.get()) scheduleOnRN(unmount)
        }),
      )
    }
  }, [open, panel, backdrop, dragY, isOpen, unmount])

  const pan = usePanGesture({
    activeOffsetY: 6,
    failOffsetX: [-20, 20],
    onUpdate: (e) => {
      'worklet'
      const ty = e.translationY
      dragY.set(ty >= 0 ? ty : ty * RUBBER_BAND)
    },
    onDeactivate: (e) => {
      'worklet'
      const h = height.get()
      if (e.translationY > h * DISMISS_FRACTION || e.velocityY > DISMISS_VELOCITY) {
        // Fold the drag into the panel progress so the exit continues from here.
        const shown = Math.max(0, 1 - dragY.get() / h)
        dragY.set(0)
        panel.set(shown)
        scheduleOnRN(requestClose)
      } else {
        dragY.set(withTiming(0, { duration: BACKDROP_MS, easing: PANEL_EASE }))
      }
    },
  })

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.get() }))
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - panel.get()) * height.get() + dragY.get() }],
  }))

  if (!mounted) return null

  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType="none"
      onRequestClose={requestClose}
    >
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[styles.fill, { backgroundColor: colors.scrim }, backdropStyle]}>
          <Pressable
            style={styles.fill}
            onPress={requestClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          accessibilityLabel={title}
          onLayout={(e) => height.set(e.nativeEvent.layout.height)}
          style={[
            styles.panel,
            {
              backgroundColor: colors.paper,
              borderColor: colors.borderStrong,
              paddingBottom: 28 + insets.bottom,
            },
            panelStyle,
          ]}
        >
          <GestureDetector gesture={pan}>
            <View style={styles.dragArea}>
              <View style={[styles.grabber, { backgroundColor: colors.borderStrong }]} />
              <View style={styles.header}>
                <Text
                  style={[styles.title, { color: colors.muted, fontFamily: fonts.sans.semibold }]}
                >
                  {title}
                </Text>
                <Pressable
                  onPress={requestClose}
                  accessibilityRole="button"
                  hitSlop={8}
                  style={[styles.done, { borderColor: colors.borderStrong }]}
                >
                  <Text
                    style={[
                      styles.doneLabel,
                      { color: colors.fgDim, fontFamily: fonts.sans.medium },
                    ]}
                  >
                    Done
                  </Text>
                </Pressable>
              </View>
            </View>
          </GestureDetector>
          {children}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  panel: {
    width: '100%',
    maxWidth: 672,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  dragArea: { paddingBottom: 14 },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 9.5, letterSpacing: 1.9, textTransform: 'uppercase' },
  done: {
    height: 26,
    paddingHorizontal: 12,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  doneLabel: { fontSize: 11, letterSpacing: 0.22 },
})
