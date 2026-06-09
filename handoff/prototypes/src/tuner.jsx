// pulseGroove — Tuner (v2)
const { useEffect: useEffectT, useRef: useRefT, useState: useStateT, useMemo: useMemoT } = React;

const NOTE_NAMES_T = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const NOTE_LATIN_T = ['Do', 'Do♯', 'Re', 'Re♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'];

// midi 69 = A4 = 440
const noteIndexFromMidi = (midi) => ((midi % 12) + 12) % 12;
const octaveFromMidi = (midi) => Math.floor(midi / 12) - 1;
const semitoneDelta = (fromMidi, toMidi) => toMidi - fromMidi;

// Instrument tunings (MIDI numbers per string, low → high)
const INSTRUMENTS = {
  chromatic: { name: 'Chromatic', strings: null },
  guitar:    { name: 'Guitar',    strings: [{ name: 'E', m: 40 }, { name: 'A', m: 45 }, { name: 'D', m: 50 }, { name: 'G', m: 55 }, { name: 'B', m: 59 }, { name: 'E', m: 64 }] },
  bass:      { name: 'Bass',      strings: [{ name: 'E', m: 28 }, { name: 'A', m: 33 }, { name: 'D', m: 38 }, { name: 'G', m: 43 }] },
  ukulele:   { name: 'Ukulele',   strings: [{ name: 'G', m: 67 }, { name: 'C', m: 60 }, { name: 'E', m: 64 }, { name: 'A', m: 69 }] },
  violin:    { name: 'Violin',    strings: [{ name: 'G', m: 55 }, { name: 'D', m: 62 }, { name: 'A', m: 69 }, { name: 'E', m: 76 }] },
};

// Demo cycle
const DEMO_CYCLE = [
  { midi: 57, cents: -22, clarity: 0.62, hold: 1300 }, // A3
  { midi: 57, cents: -8,  clarity: 0.78, hold: 900 },
  { midi: 57, cents: -2,  clarity: 0.92, hold: 1100 },
  { midi: 57, cents: 1,   clarity: 0.95, hold: 1700 }, // hold in tune
  { midi: 50, cents: 12,  clarity: 0.71, hold: 1200 }, // D3
  { midi: 50, cents: 4,   clarity: 0.85, hold: 900 },
  { midi: 50, cents: -1,  clarity: 0.94, hold: 1600 },
  { midi: 64, cents: -32, clarity: 0.58, hold: 1100 }, // E4
  { midi: 64, cents: -14, clarity: 0.78, hold: 900 },
  { midi: 64, cents: -3,  clarity: 0.93, hold: 1500 },
];

function midiToFreq(midi, refA4 = 440) {
  return refA4 * Math.pow(2, (midi - 69) / 12);
}

function TunerScreen({ tweaks }) {
  const [status, setStatus] = useStateT('idle');
  const [errorKind, setErrorKind] = useStateT(null);
  const [instrument, setInstrument] = useStateT('chromatic');
  const [notation, setNotation] = useStateT('en');
  const [refA4, setRefA4] = useStateT(440);
  const [showSheet, setShowSheet] = useStateT(null);

  // detection state
  const [sample, setSample] = useStateT({ midi: 57, cents: -2, clarity: 0.9 });
  const [history, setHistory] = useStateT([]); // {midi, cents, t}
  const [holdMs, setHoldMs] = useStateT(0);
  const [confirmed, setConfirmed] = useStateT(false);
  const holdStartRef = useRefT(null);
  const tickRef = useRefT(null);

  // demo: cycle through sample states
  useEffectT(() => {
    if (status !== 'running') return;
    let i = 0;
    let cancelled = false;
    const next = () => {
      if (cancelled) return;
      const s = DEMO_CYCLE[i % DEMO_CYCLE.length];
      setSample({ midi: s.midi, cents: s.cents, clarity: s.clarity });
      setHistory((h) => [...h.slice(-11), { midi: s.midi, cents: s.cents, t: Date.now() }]);
      i++;
      tickRef.current = setTimeout(next, s.hold);
    };
    next();
    return () => { cancelled = true; clearTimeout(tickRef.current); };
  }, [status]);

  // hold-to-confirm
  useEffectT(() => {
    if (status !== 'running') return;
    const inTune = Math.abs(sample.cents) <= 5;
    if (inTune) {
      if (holdStartRef.current == null) holdStartRef.current = Date.now();
      const id = setInterval(() => {
        const elapsed = Date.now() - holdStartRef.current;
        setHoldMs(elapsed);
        if (elapsed >= 1500) {
          setConfirmed(true);
        }
      }, 80);
      return () => clearInterval(id);
    } else {
      holdStartRef.current = null;
      setHoldMs(0);
      setConfirmed(false);
    }
  }, [sample.cents, status]);

  const start = () => {
    setStatus('starting');
    setTimeout(() => setStatus('running'), 600);
    setHistory([]);
  };
  const stop = () => { setStatus('idle'); setHistory([]); };

  if (status === 'error') return <ErrorView kind={errorKind} onRetry={start} onIdle={() => setStatus('idle')} />;
  if (status === 'idle')  return <IdleView onStart={start} onSimulateError={(k) => { setErrorKind(k); setStatus('error'); }} />;

  const active = status === 'running';
  const note = sample;
  const noteIndex = noteIndexFromMidi(note.midi);
  const octave = octaveFromMidi(note.midi);
  const noteLabel = (notation === 'en' ? NOTE_NAMES_T : NOTE_LATIN_T)[noteIndex];
  const baseLabel = noteLabel.replace('♯', '');
  const isSharp = noteLabel.includes('♯');
  const freq = midiToFreq(note.midi, refA4) * Math.pow(2, note.cents / 1200);

  const isInTune = active && Math.abs(note.cents) <= 5;
  const isNear   = active && !isInTune && Math.abs(note.cents) <= 15;

  // Instrument: find closest string
  const inst = INSTRUMENTS[instrument];
  let closestString = null;
  if (inst.strings) {
    let best = null;
    inst.strings.forEach((s, i) => {
      const delta = Math.abs(s.m - note.midi);
      if (best == null || delta < best.delta) best = { i, s, delta };
    });
    closestString = best;
  }

  // Narrative
  let narrative = '—';
  if (active) {
    const abs = Math.abs(note.cents);
    if (abs <= 5) narrative = 'In tune';
    else if (abs <= 12) narrative = note.cents > 0 ? 'Sharp · ease back' : 'Flat · push up';
    else if (abs <= 30) narrative = note.cents > 0 ? 'Sharp — keep loosening' : 'Flat — keep tightening';
    else narrative = note.cents > 0 ? 'Very sharp' : 'Very flat';
  }

  return (
    <div className="pg-screen" data-screen-label="Tuner">
      {/* Top */}
      <div className="pg-topbar">
        <div className="pg-brand">
          <span className="pg-brand-dot" />
          <span>pulse·groove</span>
        </div>
        <div className="pg-section-label">Chromatic</div>
      </div>

      {/* Reference + clarity meta row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, fontFamily: 'var(--font-mono)', fontSize: 10.5,
        color: 'var(--muted)', letterSpacing: '0.06em',
      }}>
        <button type="button" onClick={() => setShowSheet('ref')}
          style={{
            appearance: 'none', cursor: 'pointer',
            background: 'transparent', border: 0, padding: 0,
            color: 'inherit', font: 'inherit', display: 'inline-flex', gap: 6, alignItems: 'center', whiteSpace: 'nowrap',
          }}>
          <span>A4 · <strong style={{ color: 'var(--fg)', fontWeight: 500 }}>{refA4} Hz</strong></span>
          <Icon name="chevR" size={11} />
        </button>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', whiteSpace: 'nowrap' }}>
          <span>clarity {Math.round((active ? note.clarity : 0) * 100)}%</span>
          {confirmed && <span className="pg-badge"><Icon name="check" size={11} stroke={2.2} /> In tune</span>}
        </div>
      </div>

      {/* Hero — cents ring */}
      <div style={{
        position: 'relative', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        height: 280,
      }}>
        <CentsRing
          cents={note.cents} clarity={note.clarity} active={active}
          noteLabel={baseLabel}
          accidental={isSharp ? '♯' : null}
          octave={octave}
          size={290}
          holdProgress={Math.min(1, holdMs / 1500)}
        />
      </div>

      {/* Narrative + numbers row */}
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        padding: '0 4px', gap: 12,
      }}>
        <div style={{ minWidth: 0 }}>
          <div className={`pg-numeric ${isInTune ? 'pg-cents-good' : isNear ? 'pg-cents-near' : 'pg-cents-bad'}`}
            style={{ fontSize: 28, fontWeight: 300, letterSpacing: '-0.02em', lineHeight: 1, color: !active ? 'var(--muted)' : undefined, whiteSpace: 'nowrap' }}>
            {active ? (note.cents >= 0 ? '+' : '') + note.cents.toFixed(1) : '0.0'}
            <span style={{ fontSize: 15, marginLeft: 1 }}>¢</span>
          </div>
          <div className="pg-nowrap" style={{
            fontFamily: 'var(--font-mono)', fontSize: 10.5,
            color: 'var(--muted)', marginTop: 6, letterSpacing: '0.06em',
          }}>{narrative}</div>
        </div>
        <div style={{ textAlign: 'right', minWidth: 0 }}>
          <div className="pg-numeric pg-nowrap" style={{ fontSize: 18, fontWeight: 400, color: 'var(--fg)' }}>
            {active ? freq.toFixed(2) : '—'} <span style={{ color: 'var(--muted)', fontSize: 11 }}>Hz</span>
          </div>
          <div className="pg-nowrap" style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--muted)', marginTop: 6, letterSpacing: '0.06em' }}>
            target {midiToFreq(note.midi, refA4).toFixed(2)} Hz
          </div>
        </div>
      </div>

      {/* History strip */}
      <HistoryStrip history={history.slice(-12)} active={active} />

      {/* Instrument target row */}
      <div className="pg-card" style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
          <span className="pg-section-label">{inst.name} target</span>
          <button type="button" onClick={() => setShowSheet('inst')}
            style={{
              appearance: 'none', cursor: 'pointer', background: 'transparent', border: 0, padding: 0,
              color: 'var(--accent)', font: '500 10.5px var(--font-mono)', letterSpacing: '0.06em',
              display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
            }}>change <Icon name="chevR" size={10} /></button>
        </div>
        {inst.strings ? (
          <div style={{ display: 'flex', gap: 4 }}>
            {inst.strings.map((s, i) => {
              const isClosest = closestString && closestString.i === i;
              const semis = note.midi - s.m;
              const tunedHere = isClosest && isInTune;
              return (
                <button key={i} type="button" className={`pg-string ${isClosest ? 'is-target' : ''} ${tunedHere ? 'is-tuned' : ''}`}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: isClosest ? 'var(--fg)' : 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {s.name}<sub style={{ fontSize: 8, opacity: 0.6 }}>{octaveFromMidi(s.m)}</sub>
                  </span>
                  <span className="pg-string-dot" style={{ background: tunedHere ? 'var(--good)' : (isClosest ? 'var(--accent)' : 'var(--rule-strong)') }} />
                  <span className="pg-nowrap" style={{ fontSize: 9, color: 'var(--muted)' }}>
                    {isClosest ? (semis === 0 ? `${note.cents >= 0 ? '+' : ''}${note.cents.toFixed(0)}¢` : `${semis > 0 ? '+' : ''}${semis}st`) : ' '}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', gap: 8 }}>
            <span className="pg-nowrap" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
              Any pitch · 12 notes
            </span>
            <span className="pg-nowrap" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg)', letterSpacing: '0.06em' }}>
              {baseLabel}{isSharp ? '♯' : ''}<sub style={{ fontSize: 8 }}>{octave}</sub>
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 'auto', display: 'flex', gap: 8, padding: '4px 0 22px' }}>
        <div style={{
          flex: 1, display: 'flex', padding: 4, gap: 4,
          background: 'var(--surface)',
          border: '0.5px solid var(--border-strong)',
          borderRadius: 14, height: 48,
        }}>
          <button type="button" onClick={() => setNotation('en')}
            style={{
              flex: 1, appearance: 'none', cursor: 'pointer', border: 0,
              borderRadius: 10, height: '100%',
              background: notation === 'en' ? 'var(--fg)' : 'transparent',
              color: notation === 'en' ? 'var(--bg)' : 'var(--muted)',
              font: '500 12px var(--font-sans)', letterSpacing: '0.04em',
              transition: 'all .15s',
            }}>C – D – E</button>
          <button type="button" onClick={() => setNotation('lat')}
            style={{
              flex: 1, appearance: 'none', cursor: 'pointer', border: 0,
              borderRadius: 10, height: '100%',
              background: notation === 'lat' ? 'var(--fg)' : 'transparent',
              color: notation === 'lat' ? 'var(--bg)' : 'var(--muted)',
              font: '500 12px var(--font-sans)', letterSpacing: '0.04em',
              transition: 'all .15s',
            }}>Do – Re – Mi</button>
        </div>
        <button type="button" onClick={stop}
          className="pg-chip" style={{ width: 48, height: 48, padding: 0, justifyContent: 'center', borderRadius: 14 }}>
          <Icon name="micOff" size={16} />
        </button>
      </div>

      {/* Sheets */}
      {showSheet === 'ref' && (
        <BottomSheetT onClose={() => setShowSheet(null)} title="Reference pitch">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
              The frequency assigned to A above middle C. Most modern music uses 440 Hz; some
              European orchestras prefer 442, early-music ensembles 415.
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[415, 432, 438, 440, 442, 444].map((hz) => (
                <button key={hz} type="button" className={`pg-chip ${refA4 === hz ? 'is-active' : ''}`}
                  onClick={() => { setRefA4(hz); setShowSheet(null); }}
                  style={{ minWidth: 64, justifyContent: 'center' }}>
                  {hz} Hz
                </button>
              ))}
            </div>
          </div>
        </BottomSheetT>
      )}
      {showSheet === 'inst' && (
        <BottomSheetT onClose={() => setShowSheet(null)} title="Instrument target">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflow: 'auto' }}>
            {Object.entries(INSTRUMENTS).map(([k, v]) => (
              <button key={k} type="button"
                onClick={() => { setInstrument(k); setShowSheet(null); }}
                style={{
                  appearance: 'none', cursor: 'pointer', background: 'transparent', border: 0,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '11px 4px', borderBottom: '0.5px solid var(--border)',
                  color: 'var(--fg)',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontWeight: 500, fontSize: 14 }}>{v.name}</span>
                  {instrument === k && <Icon name="check" size={13} stroke={2} />}
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--muted)', letterSpacing: '0.04em' }}>
                  {v.strings ? v.strings.map((s) => s.name).join(' ') : 'any pitch'}
                </span>
              </button>
            ))}
          </div>
        </BottomSheetT>
      )}
    </div>
  );
}

// ─── shared sheet
function BottomSheetT({ children, onClose, title }) {
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

// ─── idle
function IdleView({ onStart, onSimulateError }) {
  return (
    <div className="pg-screen" data-screen-label="Tuner · idle">
      <div className="pg-topbar">
        <div className="pg-brand">
          <span className="pg-brand-dot" />
          <span>pulse·groove</span>
        </div>
        <div className="pg-section-label">Tuner</div>
      </div>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 28,
        padding: '0 24px', textAlign: 'center',
      }}>
        <button type="button" onClick={onStart}
          style={{
            appearance: 'none', cursor: 'pointer',
            width: 130, height: 130, borderRadius: '50%',
            background: 'var(--accent)',
            color: '#FFF',
            border: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
            boxShadow: '0 16px 48px var(--accent-soft)',
          }}>
          <span style={{
            position: 'absolute', inset: -10,
            border: '1px solid var(--accent)',
            opacity: 0.45, borderRadius: '50%',
            animation: 'pg-ring-expand 1900ms ease-out infinite',
          }} />
          <Icon name="mic" size={46} stroke={1.4} />
        </button>
        <div>
          <div className="pg-display" style={{ fontSize: 28, fontWeight: 400, letterSpacing: '-0.015em' }}>Tap to listen</div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--muted)', marginTop: 10, letterSpacing: '0.06em',
          }}>
            Chromatic · A4 = 440 Hz · in-tune within ±5¢
          </div>
        </div>
      </div>
      <div style={{ padding: '0 0 22px', display: 'flex', gap: 6, justifyContent: 'center' }}>
        <button type="button" className="pg-chip" onClick={() => onSimulateError('denied')}>sim · denied</button>
        <button type="button" className="pg-chip" onClick={() => onSimulateError('not-found')}>sim · no mic</button>
      </div>
    </div>
  );
}

// ─── error
function ErrorView({ kind, onRetry, onIdle }) {
  const M = {
    denied: { title: 'Microphone blocked', body: 'Allow microphone access from the address bar, then try again.' },
    'not-found': { title: 'No microphone', body: 'Plug in or pair a microphone, then try again.' },
    busy: { title: 'Microphone in use', body: 'Close any other app using the microphone and try again.' },
  };
  const m = M[kind] || M.denied;
  return (
    <div className="pg-screen" data-screen-label="Tuner · error">
      <div className="pg-topbar">
        <div className="pg-brand"><span className="pg-brand-dot" /><span>pulse·groove</span></div>
        <div className="pg-section-label">Tuner</div>
      </div>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 20,
        padding: '0 28px', textAlign: 'center',
      }}>
        <div style={{
          width: 84, height: 84, borderRadius: '50%',
          background: 'var(--surface)', border: '0.5px solid var(--border-strong)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--bad)',
        }}>
          <Icon name="micOff" size={34} stroke={1.4} />
        </div>
        <div>
          <div className="pg-display" style={{ fontSize: 22, fontWeight: 500 }}>{m.title}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 10, maxWidth: 280, lineHeight: 1.5 }}>{m.body}</div>
        </div>
        <button type="button" onClick={onRetry}
          style={{
            appearance: 'none', cursor: 'pointer',
            background: 'var(--fg)', color: 'var(--bg)',
            border: 0, padding: '10px 18px', borderRadius: 99,
            display: 'inline-flex', alignItems: 'center', gap: 8,
            font: '500 12px var(--font-sans)', letterSpacing: '0.05em', textTransform: 'uppercase',
          }}>
          <Icon name="refresh" size={13} /> Try again
        </button>
      </div>
      <div style={{ padding: '0 0 22px', textAlign: 'center' }}>
        <button type="button" className="pg-chip" onClick={onIdle}>Back</button>
      </div>
    </div>
  );
}

Object.assign(window, { TunerScreen });
