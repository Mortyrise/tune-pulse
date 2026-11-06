// Key-value storage behind usePersistentState. AsyncStorage throws at import
// time when its native module is missing (e.g. an older dev build), so it is
// required lazily and falls back to an in-memory map instead of crashing.

export type KeyValueStorage = {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<void>
}

export function createMemoryStorage(): KeyValueStorage {
  const map = new Map<string, string>()
  return {
    getItem: async (key) => map.get(key) ?? null,
    setItem: async (key, value) => {
      map.set(key, value)
    },
  }
}

let backend: KeyValueStorage | null = null

function loadAsyncStorage(): KeyValueStorage {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-async-storage/async-storage')
    return (mod.default ?? mod) as KeyValueStorage
  } catch (error) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('[storage] AsyncStorage unavailable, settings will not persist:', error)
    }
    return createMemoryStorage()
  }
}

export function getStorage(): KeyValueStorage {
  if (!backend) backend = loadAsyncStorage()
  return backend
}

/**
 * Decodes a stored JSON string. Returns undefined when missing, unparsable or
 * rejected by `validate` (the caller then keeps its initial value).
 */
export function decodeStored<T>(
  raw: string | null,
  validate?: (value: unknown) => T | undefined,
): T | undefined {
  if (raw == null) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return undefined
  }
  return validate ? validate(parsed) : (parsed as T)
}
