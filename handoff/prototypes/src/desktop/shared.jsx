// pulseGroove desktop — shared data + hooks
const DESKTOP_GROOVES = [
  { id: 'ballad', name: 'Ballad', bpm: 72, n: 4, d: 4, accents: [1], subs: [1,1,1,1], hint: 'Slow 4 — give it room.', tag: 'feel' },
  { id: 'backbeat', name: 'Backbeat', bpm: 96, n: 4, d: 4, accents: [2,4], subs: [1,2,1,2], hint: 'Snare on 2 & 4. Hats in eighths.', tag: 'pop' },
  { id: 'halftime', name: 'Half-time', bpm: 88, n: 4, d: 4, accents: [3], subs: [2,2,2,2], hint: 'Big snare on 3.', tag: 'hip-hop' },
  { id: 'pop', name: 'Four-on-floor', bpm: 120, n: 4, d: 4, accents: [1,2,3,4], subs: [2,2,2,2], hint: 'Disco/house pulse.', tag: 'dance' },
  { id: 'waltz', name: 'Waltz', bpm: 132, n: 3, d: 4, accents: [1], subs: [1,1,1], hint: 'Strong 1, lift on 2-3.', tag: 'classical' },
  { id: 'shuffle', name: 'Shuffle', bpm: 100, n: 4, d: 4, accents: [1,3], subs: [3,3,3,3], hint: 'Triplet feel — swing it.', tag: 'blues' },
  { id: 'buleria', name: 'Bulería', bpm: 220, n: 12, d: 8, accents: [1,4,7,9,11], subs: Array(12).fill(1), hint: 'Compound flamenco cycle.', tag: 'flamenco' },
  { id: 'odd-5', name: '5/4 odd', bpm: 100, n: 5, d: 4, accents: [1,4], subs: [2,2,2,2,2], hint: 'Take Five vibe.', tag: 'jazz' },
  { id: 'odd-7', name: '7/8 odd', bpm: 130, n: 7, d: 8, accents: [1,4,6], subs: [1,1,1,1,1,1,1], hint: 'Balkan / prog 7.', tag: 'odd' },
  { id: 'sixteenths', name: 'Sixteenth grid', bpm: 60, n: 4, d: 4, accents: [1], subs: [4,4,4,4], hint: 'Slow, clean it up.', tag: 'practice' },
  { id: 'samba', name: 'Samba', bpm: 100, n: 2, d: 4, accents: [1], subs: [4,4], hint: 'Brazilian 2 with sixteenths.', tag: 'latin' },
  { id: 'reggaeton', name: 'Dembow', bpm: 95, n: 4, d: 4, accents: [1,2,3,4], subs: [2,2,2,2], hint: 'Boom-ch-boom-chick.', tag: 'latin' },
];

const TEMPO_CHARACTER = (bpm) => {
  const table = [
    [40, 'Grave', 'Solemn · very slow'],
    [60, 'Largo', 'Broad · slow'],
    [76, 'Adagio', 'At ease'],
    [108, 'Andante', 'Walking pace'],
    [120, 'Moderato', 'Moderate'],
    [156, 'Allegro', 'Lively · quick'],
    [176, 'Vivace', 'Brisk · lively'],
    [200, 'Presto', 'Very fast'],
    [999, 'Prestissimo', 'Extremely fast'],
  ];
  return table.find((t) => bpm <= t[0]) || table[table.length - 1];
};

// Simulated tuner demo cycle (same shape as mobile)
const TUNER_DEMO_DESK = [
  { midi: 57, cents: -22, clarity: 0.62, hold: 1100 },
  { midi: 57, cents: -8,  clarity: 0.78, hold: 800 },
  { midi: 57, cents: -2,  clarity: 0.93, hold: 1500 },
  { midi: 50, cents: 12,  clarity: 0.71, hold: 1200 },
  { midi: 50, cents: 1,   clarity: 0.94, hold: 1500 },
  { midi: 64, cents: -32, clarity: 0.58, hold: 1100 },
  { midi: 64, cents: -3,  clarity: 0.92, hold: 1400 },
];

// Global keyboard shortcut hook
function useDesktopShortcuts(handlers) {
  React.useEffect(() => {
    const fn = (e) => {
      if (e.target.matches('input, textarea')) return;
      if (e.code === 'Space') { e.preventDefault(); handlers.toggle && handlers.toggle(); }
      else if (e.key === '+' || e.key === '=') { handlers.bpmUp && handlers.bpmUp(); }
      else if (e.key === '-' || e.key === '_') { handlers.bpmDown && handlers.bpmDown(); }
      else if (e.key === 't' || e.key === 'T') { handlers.tap && handlers.tap(); }
      else if (e.key === 'm' || e.key === 'M') { handlers.metro && handlers.metro(); }
      else if (e.key === 'u' || e.key === 'U') { handlers.tuner && handlers.tuner(); }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [handlers]);
}

// Shared metronome state simulation (for visual demos)
function useMetronomeDemo(initial = { bpm: 108, n: 4 }) {
  const [bpm, setBpm] = React.useState(initial.bpm);
  const [numerator, setNumerator] = React.useState(initial.n);
  const [denominator, setDenominator] = React.useState(4);
  const [accents, setAccents] = React.useState([1]);
  const [subdivisions, setSubdivisions] = React.useState([1,1,1,1]);
  const [isRunning, setIsRunning] = React.useState(false);
  const [currentBeat, setCurrentBeat] = React.useState(0);
  const [tickId, setTickId] = React.useState(0);
  const [bar, setBar] = React.useState(0);
  const [elapsed, setElapsed] = React.useState(0);
  const startRef = React.useRef(null);
  const beatRef = React.useRef(0);

  React.useEffect(() => {
    setSubdivisions((s) => s.length === numerator ? s : (s.length < numerator ? [...s, ...Array(numerator - s.length).fill(1)] : s.slice(0, numerator)));
    setAccents((a) => a.filter((b) => b <= numerator));
  }, [numerator]);

  React.useEffect(() => {
    if (!isRunning) return;
    const period = 60000 / bpm;
    let id = setInterval(() => {
      beatRef.current = (beatRef.current % numerator) + 1;
      if (beatRef.current === 1) setBar((b) => b + 1);
      setCurrentBeat(beatRef.current);
      setTickId((t) => t + 1);
    }, period);
    // first beat
    setTimeout(() => {
      beatRef.current = 1; setCurrentBeat(1); setTickId((t) => t + 1);
    }, 0);
    return () => clearInterval(id);
  }, [isRunning, bpm, numerator]);

  React.useEffect(() => {
    if (!isRunning || !startRef.current) return;
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 250);
    return () => clearInterval(id);
  }, [isRunning]);

  const toggle = () => {
    if (isRunning) {
      setIsRunning(false); setCurrentBeat(0); beatRef.current = 0;
    } else {
      setBar(0); setElapsed(0); startRef.current = Date.now();
      setIsRunning(true);
    }
  };
  const applyGroove = (g) => {
    setBpm(g.bpm); setNumerator(g.n); setDenominator(g.d);
    setAccents(g.accents); setSubdivisions(g.subs);
  };
  const toggleAccent = (b) => setAccents((a) => a.includes(b) ? a.filter((x) => x !== b) : [...a, b].sort((x,y)=>x-y));
  const cycleSub = (i) => setSubdivisions((s) => { const next = s.slice(); next[i] = [1,2,3,4][([1,2,3,4].indexOf(next[i]||1)+1)%4]; return next; });

  return {
    bpm, setBpm, numerator, setNumerator, denominator, setDenominator,
    accents, subdivisions, isRunning, currentBeat, tickId, bar, elapsed,
    toggle, applyGroove, toggleAccent, cycleSub,
    isAccent: accents.includes(currentBeat),
  };
}

function useTunerDemo() {
  const [sample, setSample] = React.useState({ midi: 57, cents: -2, clarity: 0.92 });
  const [history, setHistory] = React.useState([]);
  React.useEffect(() => {
    let i = 0;
    const step = () => {
      const s = TUNER_DEMO_DESK[i % TUNER_DEMO_DESK.length];
      setSample({ midi: s.midi, cents: s.cents, clarity: s.clarity });
      setHistory((h) => [...h.slice(-11), { midi: s.midi, cents: s.cents }]);
      i++;
      timer = setTimeout(step, s.hold);
    };
    let timer = setTimeout(step, 200);
    return () => clearTimeout(timer);
  }, []);
  return { sample, history };
}

const NOTE_NAMES_DESK = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];

function formatElapsedDesk(ms) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
}

function midiToFreqDesk(midi, ref = 440) {
  return ref * Math.pow(2, (midi - 69) / 12);
}

Object.assign(window, {
  DESKTOP_GROOVES, TEMPO_CHARACTER, NOTE_NAMES_DESK,
  useDesktopShortcuts, useMetronomeDemo, useTunerDemo,
  formatElapsedDesk, midiToFreqDesk,
});
