export type TempoCharacter = {
  max: number
  name: string
  meaning: string
}

export const TEMPO_CHARACTERS: TempoCharacter[] = [
  { max: 40, name: 'Grave', meaning: 'Solemn · very slow' },
  { max: 60, name: 'Largo', meaning: 'Broad · slow' },
  { max: 66, name: 'Larghetto', meaning: 'Rather broad' },
  { max: 76, name: 'Adagio', meaning: 'At ease' },
  { max: 108, name: 'Andante', meaning: 'Walking pace' },
  { max: 120, name: 'Moderato', meaning: 'Moderate' },
  { max: 156, name: 'Allegro', meaning: 'Lively · quick' },
  { max: 176, name: 'Vivace', meaning: 'Brisk · lively' },
  { max: 200, name: 'Presto', meaning: 'Very fast' },
  { max: Infinity, name: 'Prestissimo', meaning: 'Extremely fast' },
]

export function getTempoCharacter(bpm: number): TempoCharacter {
  const match = TEMPO_CHARACTERS.find((t) => bpm <= t.max)
  return match ?? TEMPO_CHARACTERS[TEMPO_CHARACTERS.length - 1]
}
