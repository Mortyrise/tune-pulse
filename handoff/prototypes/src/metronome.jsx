// pulseGroove — Metronome (v2)
const { useEffect: useEffectM, useRef: useRefM, useState: useStateM, useMemo: useMemoM } = React;

const MIN_BPM_M = 30;
const MAX_BPM_M = 280;
const SUB_OPTIONS = [1, 2, 3, 4]; // clicks per beat

const NOTE_LABEL_BY_DENOM = { 2: '𝅗𝅥', 4: '♩', 8: '♪', 16: '𝅘𝅥𝅯' };

function MetronomeScreen({ tweaks, onFlash }) {
  const [bpm, setBpm] = useStateM(108);
  const [numerator, setNumerator] = useStateM(4);
  const [denominator, setDenominator] = useStateM(4);
  const [accents, setAccents] = useStateM([1]);
  const [subdivisions, setSubdivisions] = useStateM([1, 1, 1, 1]); // length === numerator
  const [isRunning, setIsRunning] = useStateM(false);
  const [currentBeat, setCurrentBeat] = useStateM(0);
  const [currentSub, setCurrentSub] = useStateM(0);
  const [tickId, setTickId] = useStateM(0);
  const [countIn, setCountIn] = useStateM(0);
  const [inCountIn, setInCountIn] = useStateM(false);
  const [haptic, setHaptic] = useStateM(false);
  const [showSheet, setShowSheet] = useStateM(null);
  // session
  const [barCount, setBarCount] = useStateM(0);
  const [startedAt, setStartedAt] = useStateM(null);
  const [elapsed, setElapsed] = useStateM(0);

  const intervalRef = useRefM(null);
  const beatRef = useRefM(0);
  const subRef = useRefM(0);
  const countInRef = useRefM(0);
  const barRef = useRefM(0);

  // keep subdivision array in sync with numerator
  useEffectM(() => {
    setSubdivisions((prev) => {
      if (prev.length === numerator) return prev;
      if (prev.length < numerator) return [...prev, ...Array(numerator - prev.length).fill(1)];
      return prev.slice(0, numerator);
    });
    setAccents((acc) => acc.filter((b) => b <= numerator));
  }, [numerator]);

  // schedule
  useEffectM(() => {
    if (!isRunning) {
      clearInterval(intervalRef.current);
      return;
    }
    const subsPerBar = subdivisions.reduce((a, b) => a + b, 0);
    const period = (60000 / bpm) / Math.max(...subdivisions); // schedule at finest grid
    // Run a single ticker; we walk through beats × subdivisions inside.
    advanceTick(true);
    const id = setInterval(() => advanceTick(false), Math.max(20, 60000 / bpm / 4));
    intervalRef.current = id;
    return () => clearInterval(id);
    // eslint-disable-next-line
  }, [isRunning, bpm, numerator, subdivisions]);

  // Smooth elapsed timer
  useEffectM(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      if (startedAt) setElapsed(Date.now() - startedAt);
    }, 250);
    return () => clearInterval(id);
  }, [isRunning, startedAt]);

  // Real tick scheduler: walk beat × sub at appropriate cadence
  const lastTickAtRef = useRefM(0);
  const lastBeatAtRef = useRefM(0);

  const advanceTick = (first) => {
    const now = performance.now();
    const periodPerBeat = 60000 / bpm;
    if (first) {
      lastBeatAtRef.current = now;
      lastTickAtRef.current = now;
      beatRef.current = 1;
      subRef.current = 0;
      setCurrentBeat(1);
      setCurrentSub(0);
      setTickId((t) => t + 1);
      const accent = countInRef.current > 0 || accents.includes(1);
      if (accent && onFlash) onFlash();
      return;
    }
    // figure out the subdivision period for current beat
    const subCount = subdivisions[beatRef.current - 1] || 1;
    const subPeriod = periodPerBeat / subCount;
    if (now - lastTickAtRef.current < subPeriod * 0.85) return;
    lastTickAtRef.current = now;

    let nextSub = subRef.current + 1;
    if (nextSub >= subCount) {
      // advance beat
      let nextBeat = beatRef.current + 1;
      if (nextBeat > numerator) {
        nextBeat = 1;
        if (countInRef.current > 0) {
          countInRef.current -= 1;
          if (countInRef.current === 0) {
            setInCountIn(false);
            barRef.current = 0;
          }
        } else {
          barRef.current += 1;
          setBarCount(barRef.current);
        }
      }
      beatRef.current = nextBeat;
      subRef.current = 0;
      setCurrentBeat(nextBeat);
      setCurrentSub(0);
      lastBeatAtRef.current = now;
      const accent = !inCountIn && accents.includes(nextBeat);
      if (nextBeat === 1 || accent) {
        if (onFlash) onFlash();
      }
    } else {
      subRef.current = nextSub;
      setCurrentSub(nextSub);
    }
    setTickId((t) => t + 1);
  };

  const toggle = () => {
    if (isRunning) {
      setIsRunning(false);
      setCurrentBeat(0); setCurrentSub(0);
      beatRef.current = 0; subRef.current = 0;
      setInCountIn(false);
    } else {
      countInRef.current = countIn;
      setInCountIn(countIn > 0);
      barRef.current = 0;
      setBarCount(0);
      setStartedAt(Date.now());
      setElapsed(0);
      setIsRunning(true);
    }
  };

  const toggleAccent = (beat) => {
    setAccents((a) => a.includes(beat) ? a.filter((b) => b !== beat) : [...a, beat].sort((x, y) => x - y));
  };
  const cycleSubdivision = (i) => {
    setSubdivisions((s) => {
      const next = s.slice();
      const idx = SUB_OPTIONS.indexOf(next[i] || 1);
      next[i] = SUB_OPTIONS[(idx + 1) % SUB_OPTIONS.length];
      return next;
    });
  };

  const tapTimes = useRefM([]);
  const tap = () => {
    const now = Date.now();
    const arr = tapTimes.current.filter((t) => now - t < 2000);
    arr.push(now);
    tapTimes.current = arr.slice(-5);
    if (arr.length >= 2) {
      const intervals = [];
      for (let i = 1; i < arr.length; i++) intervals.push(arr[i] - arr[i - 1]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const newBpm = Math.round(60000 / avg);
      setBpm(Math.max(MIN_BPM_M, Math.min(MAX_BPM_M, newBpm)));
    }
  };

  const tempo = getTempoCharacter(bpm);
  const period = 60000 / bpm;
  const isAccentBeat = accents.includes(currentBeat) && !inCountIn;
  const variant = tweaks.metronomeVariant || 'pulse';
  const formatElapsed = (ms) => {
    const s = Math.floor(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  return (
    <div className="pg-screen" data-screen-label="Metronome">
      {/* Top */}
      <div className="pg-topbar">
        <div className="pg-brand">
          <span className="pg-brand-dot" style={{
            animationPlayState: isRunning ? 'running' : 'paused',
            animationDuration: isRunning ? `${period * 2}ms` : '2s',
          }} />
          <span>pulse·groove</span>
        </div>
        <div className="pg-section-label">Metronome</div>
      </div>

      {/* Tempo character — adds narrative value */}
      <div className="pg-nowrap" style={{
        display: 'flex', alignItems: 'baseline', gap: 10,
        paddingBottom: 4,
      }}>
        <span className="pg-display" style={{
          fontSize: 22, fontWeight: 400,
          color: 'var(--fg)', letterSpacing: '-0.01em',
          fontStyle: 'italic',
        }}>{tempo.name}</span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10,
          color: 'var(--muted)', letterSpacing: '0.04em',
        }}>· {tempo.meaning}</span>
      </div>

      {/* Hero — dial with pulse rings */}
      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 268,
        margin: '4px 0 8px',
      }}>
        {variant === 'pulse' && (
          <PulseRings tickId={tickId} isRunning={isRunning} isAccent={isAccentBeat} size={244} />
        )}
        <Dial
          value={bpm} min={MIN_BPM_M} max={MAX_BPM_M}
          onChange={setBpm} size={260} isRunning={isRunning}
        >
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 86, fontWeight: 300, lineHeight: 1,
            color: 'var(--fg)', letterSpacing: '-0.045em',
            fontVariantNumeric: 'tabular-nums',
          }}>{bpm}</div>
          <div className="pg-nowrap" style={{
            display: 'flex', alignItems: 'center', gap: 6, marginTop: 4,
            fontFamily: 'var(--font-mono)', fontSize: 9.5,
            color: 'var(--muted)', letterSpacing: '0.22em',
            textTransform: 'uppercase',
          }}>
            <span>BPM</span>
            <span style={{ opacity: 0.45 }}>·</span>
            <span style={{ letterSpacing: '0.12em' }}>drag</span>
          </div>
          <button type="button" className="pg-no-drag"
            onClick={() => setShowSheet('sig')}
            style={{
              marginTop: 16,
              appearance: 'none', cursor: 'pointer',
              background: 'var(--surface)',
              border: '0.5px solid var(--border)',
              padding: '5px 12px', borderRadius: 99,
              color: 'var(--fg)',
              fontFamily: 'var(--font-mono)', fontSize: 13,
              pointerEvents: 'auto',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
            <span>{numerator}/{denominator}</span>
            <span style={{ color: 'var(--muted)', fontSize: 14 }}>
              {NOTE_LABEL_BY_DENOM[denominator] || '♩'}
            </span>
          </button>
        </Dial>
      </div>

      {/* Beat constructor — the centerpiece of "value" */}
      <div className="pg-card" style={{ padding: '12px 14px' }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          marginBottom: 10, gap: 8,
        }}>
          <span className="pg-section-label">Bar pattern</span>
          <span className="pg-numeric pg-nowrap" style={{ fontSize: 9.5, color: 'var(--muted)', letterSpacing: '0.06em' }}>
            tap · cycle clicks
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end' }}>
          {Array.from({ length: numerator }).map((_, i) => (
            <BeatColumn
              key={i}
              beat={i + 1}
              isAccent={accents.includes(i + 1)}
              subdivision={subdivisions[i] || 1}
              currentBeat={currentBeat}
              currentSub={currentSub}
              isRunning={isRunning}
              inCountIn={inCountIn}
              onToggleAccent={() => toggleAccent(i + 1)}
              onCycleSubdivision={() => cycleSubdivision(i)}
            />
          ))}
        </div>
      </div>

      {/* Session strip — gives the metronome memory */}
      <div className="pg-session pg-nowrap">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>BAR <strong>{String(barCount + (isRunning ? 1 : 0)).padStart(3, '0')}</strong></span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>{formatElapsed(elapsed)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {inCountIn && <span style={{ color: 'var(--warn)' }}>● count-in</span>}
          {!inCountIn && isRunning && <span style={{ color: 'var(--good)' }}>● live</span>}
          {!isRunning && <span style={{ opacity: 0.55 }}>○ idle</span>}
        </div>
      </div>

      {/* Secondary chips */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
        <button type="button" className="pg-chip" onClick={tap}>
          <Icon name="tap" size={12} /> Tap tempo
        </button>
        <button type="button" className={`pg-chip ${countIn > 0 ? 'is-active' : ''}`}
          onClick={() => setCountIn((c) => (c + 1) % 3)}>
          Count-in · {countIn === 0 ? 'off' : `${countIn} bar${countIn > 1 ? 's' : ''}`}
        </button>
        <button type="button" className={`pg-chip ${haptic ? 'is-active' : ''}`}
          onClick={() => setHaptic(!haptic)}>
          <Icon name={haptic ? 'vibrate' : 'volume'} size={11} />
          {haptic ? 'Haptic' : 'Audio'}
        </button>
        <button type="button" className="pg-chip" onClick={() => setShowSheet('presets')}>
          <Icon name="bookmark" size={11} /> Grooves
        </button>
      </div>

      {/* Bottom play */}
      <div style={{ marginTop: 'auto', padding: '0 0 22px' }}>
        <button type="button" onClick={toggle}
          className={`pg-play ${isRunning ? 'is-running' : ''}`}>
          <Icon name={isRunning ? 'pause' : 'play'} size={14} />
          {isRunning ? 'Stop' : 'Start groove'}
        </button>
      </div>

      {/* Bottom sheets */}
      {showSheet && (
        <BottomSheet onClose={() => setShowSheet(null)} title={
          showSheet === 'sig' ? 'Time signature' :
          showSheet === 'presets' ? 'Saved grooves' : ''
        }>
          {showSheet === 'sig' && (
            <SignatureSheet
              numerator={numerator} denominator={denominator}
              onNumerator={setNumerator} onDenominator={setDenominator} />
          )}
          {showSheet === 'presets' && (
            <PresetsSheet
              onApply={(p) => {
                setBpm(p.bpm); setNumerator(p.numerator); setDenominator(p.denominator);
                setAccents(p.accents); setSubdivisions(p.subdivisions);
                setShowSheet(null);
              }} />
          )}
        </BottomSheet>
      )}
    </div>
  );
}

function BottomSheet({ children, onClose, title }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column' }}>
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(0,0,0,0.42)', animation: 'pg-fade-in 180ms ease' }} />
      <div style={{
        background: 'var(--surface)',
        borderTop: '0.5px solid var(--border-strong)',
        borderRadius: '24px 24px 0 0',
        padding: '14px 22px 28px',
        animation: 'pg-slide-up 220ms cubic-bezier(.2,.9,.3,1)',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--border-strong)', margin: '0 auto 14px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span className="pg-section-label">{title}</span>
          <button type="button" onClick={onClose} className="pg-chip" style={{ height: 26, padding: '0 12px' }}>Done</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SignatureSheet({ numerator, denominator, onNumerator, onDenominator }) {
  const DENOMS = [2, 4, 8, 16];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <div className="pg-section-label" style={{ marginBottom: 10 }}>Beats per bar</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[2, 3, 4, 5, 6, 7, 8, 9, 12].map((n) => (
            <button key={n} type="button" className={`pg-chip ${numerator === n ? 'is-active' : ''}`}
              onClick={() => onNumerator(n)} style={{ minWidth: 40, justifyContent: 'center' }}>{n}</button>
          ))}
        </div>
      </div>
      <div>
        <div className="pg-section-label" style={{ marginBottom: 10 }}>Note value</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {DENOMS.map((d) => (
            <button key={d} type="button" className={`pg-chip ${denominator === d ? 'is-active' : ''}`}
              onClick={() => onDenominator(d)} style={{ minWidth: 40, justifyContent: 'center', gap: 8 }}>
              <span>{d}</span>
              <span style={{ color: 'inherit', opacity: 0.6 }}>{NOTE_LABEL_BY_DENOM[d]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const STARTER_GROOVES = [
  { name: 'Ballad', bpm: 72, numerator: 4, denominator: 4, accents: [1], subdivisions: [1, 1, 1, 1], hint: 'A slow 4 — leave space.' },
  { name: 'Backbeat', bpm: 96, numerator: 4, denominator: 4, accents: [2, 4], subdivisions: [1, 2, 1, 2], hint: 'Snare on 2 & 4. Hats in eighths.' },
  { name: 'Half-time', bpm: 88, numerator: 4, denominator: 4, accents: [3], subdivisions: [2, 2, 2, 2], hint: 'Big snare on 3.' },
  { name: 'Pop', bpm: 120, numerator: 4, denominator: 4, accents: [1, 3], subdivisions: [2, 2, 2, 2], hint: 'Classic four-on-the-floor.' },
  { name: 'Waltz', bpm: 132, numerator: 3, denominator: 4, accents: [1], subdivisions: [1, 1, 1], hint: 'Strong 1, lift on 2-3.' },
  { name: 'Shuffle', bpm: 100, numerator: 4, denominator: 4, accents: [1, 3], subdivisions: [3, 3, 3, 3], hint: 'Triplet feel — swing it.' },
  { name: 'Bulería', bpm: 220, numerator: 12, denominator: 8, accents: [1, 4, 7, 9, 11], subdivisions: Array(12).fill(1), hint: 'Compound flamenco cycle.' },
  { name: '5/4 odd', bpm: 100, numerator: 5, denominator: 4, accents: [1, 4], subdivisions: [2, 2, 2, 2, 2], hint: 'Take Five vibe.' },
  { name: 'Practice', bpm: 60, numerator: 4, denominator: 4, accents: [1], subdivisions: [4, 4, 4, 4], hint: 'Sixteenth grid — clean it up.' },
];

function PresetsSheet({ onApply }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 380, overflow: 'auto' }}>
      {STARTER_GROOVES.map((p) => (
        <button key={p.name} type="button" onClick={() => onApply(p)}
          style={{
            appearance: 'none', cursor: 'pointer',
            background: 'transparent', border: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '11px 4px', borderBottom: '0.5px solid var(--border)',
            color: 'var(--fg)', textAlign: 'left',
          }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
            <span style={{ fontWeight: 500, fontSize: 14 }}>{p.name}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--muted)', letterSpacing: '0.04em' }}>
              {p.hint}
            </span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
            {p.bpm} · {p.numerator}/{p.denominator}
          </span>
        </button>
      ))}
    </div>
  );
}

Object.assign(window, { MetronomeScreen });
