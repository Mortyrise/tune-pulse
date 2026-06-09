// pulseGroove — visual primitives (v2)
const { useEffect, useRef, useState, useMemo, useCallback } = React;

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────
const Icon = ({ name, size = 18, stroke = 1.6 }) => {
  const p = (d) => <path d={d} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />;
  const c = (cx, cy, r) => <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} />;
  const map = {
    play: <polygon points="6,4 20,12 6,20" fill="currentColor" stroke="none" />,
    pause: <g fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></g>,
    mic: <g>{p('M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z')}{p('M19 11a7 7 0 0 1-14 0')}{p('M12 18v3')}</g>,
    micOff: <g>{p('M3 3l18 18')}{p('M9 9v3a3 3 0 0 0 5.12 2.12')}{p('M15 9V6a3 3 0 0 0-5.94-.6')}{p('M19 11a7 7 0 0 1-.4 2.3')}{p('M12 18v3')}</g>,
    minus: p('M5 12h14'),
    plus: <g>{p('M12 5v14')}{p('M5 12h14')}</g>,
    refresh: <g>{p('M3 12a9 9 0 0 1 15-6.7L21 8')}{p('M21 3v5h-5')}{p('M21 12a9 9 0 0 1-15 6.7L3 16')}{p('M3 21v-5h5')}</g>,
    tap: <g>{p('M12 2v8')}{c(12, 14, 4)}</g>,
    bookmark: p('M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z'),
    vibrate: <g>{p('M4 8v8')}{p('M20 8v8')}{p('M8 5v14')}{p('M16 5v14')}</g>,
    volume: <g>{p('M11 5L6 9H2v6h4l5 4z')}{p('M19 12a4 4 0 0 0-2-3.46')}</g>,
    pulse: p('M3 12h3l3-9 6 18 3-9h3'),
    metronome: p('M6 21L12 3l6 18M8 14h8'),
    check: p('M5 12l5 5L20 7'),
    arrowUp: p('M12 19V5M5 12l7-7 7 7'),
    arrowDown: p('M12 5v14M5 12l7 7 7-7'),
    chevR: p('M9 6l6 6-6 6'),
    chevL: p('M15 6l-6 6 6 6'),
    sliders: <g>{p('M4 6h12')}{p('M4 12h6')}{p('M4 18h14')}{c(18, 6, 2)}{c(12, 12, 2)}{c(20, 18, 2)}</g>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }}>{map[name]}</svg>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Dial — number is the control; drag to rotate
// ─────────────────────────────────────────────────────────────────────────────
function Dial({ value, min, max, onChange, size = 270, children, isRunning }) {
  const ref = useRef(null);
  const dragging = useRef(null);

  const SWEEP = 270;
  const START = -135;
  const pct = (value - min) / (max - min);
  const angle = START + pct * SWEEP;

  const center = useCallback(() => {
    const el = ref.current;
    if (!el) return { cx: 0, cy: 0 };
    const r = el.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  }, []);

  const angleFromEvent = useCallback((e) => {
    const { cx, cy } = center();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - cx;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - cy;
    return Math.atan2(x, -y) * (180 / Math.PI);
  }, [center]);

  const onPointerDown = (e) => {
    if (e.target.closest('.pg-no-drag')) return;
    e.preventDefault();
    const a = angleFromEvent(e);
    dragging.current = { startA: a, startValue: value };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };
  const onPointerMove = (e) => {
    if (!dragging.current) return;
    let a = angleFromEvent(e);
    let delta = a - dragging.current.startA;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    const valueDelta = (delta / SWEEP) * (max - min);
    const next = Math.round(dragging.current.startValue + valueDelta);
    onChange(Math.max(min, Math.min(max, next)));
  };
  const onPointerUp = () => {
    dragging.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  };

  // Tick marks: minor every degree group, major every 10%
  const TICK_COUNT = 60;
  const ticks = [];
  const scaleNumbers = [];
  for (let i = 0; i < TICK_COUNT; i++) {
    const t = i / (TICK_COUNT - 1);
    const a = (START + t * SWEEP) * (Math.PI / 180);
    const isMajor = i % 10 === 0;
    const r1 = size / 2 - (isMajor ? 14 : 10);
    const r2 = size / 2 - (isMajor ? 4 : 6);
    const x1 = size / 2 + Math.sin(a) * r1;
    const y1 = size / 2 - Math.cos(a) * r1;
    const x2 = size / 2 + Math.sin(a) * r2;
    const y2 = size / 2 - Math.cos(a) * r2;
    const active = t <= pct;
    ticks.push(
      <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={active ? 'var(--accent)' : 'var(--border-strong)'}
        strokeWidth={isMajor ? 1.5 : 1}
        strokeLinecap="round"
        opacity={active ? (isMajor ? 1 : 0.85) : 0.55}
      />
    );
    // BPM scale numbers at major marks (skip extremes for cleanliness)
    if (isMajor && i > 0 && i < TICK_COUNT - 1) {
      const labelValue = Math.round(min + t * (max - min));
      const lr = size / 2 - 24;
      const lx = size / 2 + Math.sin(a) * lr;
      const ly = size / 2 - Math.cos(a) * lr;
      scaleNumbers.push(
        <text key={`l${i}`} x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
          fontFamily="var(--font-mono)" fontSize="9" fill="var(--muted)" opacity="0.7">
          {labelValue}
        </text>
      );
    }
  }

  // Indicator
  const knobA = angle * (Math.PI / 180);
  const knobR = size / 2 - 9;
  const kx = size / 2 + Math.sin(knobA) * knobR;
  const ky = size / 2 - Math.cos(knobA) * knobR;

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      style={{ width: size, height: size, position: 'relative', touchAction: 'none', userSelect: 'none', cursor: 'grab' }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <radialGradient id="dial-glow" cx="50%" cy="50%" r="50%">
            <stop offset="55%" stopColor="var(--accent)" stopOpacity="0.06" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
        </defs>
        {isRunning && <circle cx={size/2} cy={size/2} r={size/2 - 16} fill="url(#dial-glow)" />}
        {ticks}
        {scaleNumbers}
        {/* Indicator triangle pointing inward */}
        <g transform={`translate(${kx}, ${ky}) rotate(${angle})`}>
          <circle cx="0" cy="0" r="3.5" fill="var(--accent)" />
          <circle cx="0" cy="0" r="8" fill="var(--accent)" fillOpacity="0.18" />
        </g>
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PulseRings — concentric rings emanating from center on each beat
// ─────────────────────────────────────────────────────────────────────────────
function PulseRings({ tickId, isRunning, isAccent, size = 260 }) {
  const [rings, setRings] = useState([]);
  useEffect(() => {
    if (!isRunning || tickId == null) return;
    const id = `${tickId}-${Math.random()}`;
    setRings((rs) => [...rs.slice(-3), { id, accent: isAccent }]);
    const t = setTimeout(() => setRings((rs) => rs.filter((r) => r.id !== id)), 1200);
    return () => clearTimeout(t);
  }, [tickId, isRunning, isAccent]);

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none', zIndex: 0,
    }}>
      {rings.map((r) => (
        <span
          key={r.id}
          style={{
            position: 'absolute',
            width: size, height: size,
            borderRadius: '50%',
            border: `${r.accent ? 2 : 1}px solid var(--accent)`,
            opacity: r.accent ? 0.7 : 0.4,
            animation: `pg-ring-expand ${r.accent ? 1200 : 950}ms cubic-bezier(0.16, 1, 0.3, 1) forwards`,
          }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SubdivisionCluster — visual representation of N clicks per beat
// ─────────────────────────────────────────────────────────────────────────────
function SubdivisionCluster({ count, isActive, subIndex }) {
  // count: 1, 2, 3, or 4 — clicks per beat
  // subIndex: 0..count-1 which subdivision currently sounds
  const dots = [];
  for (let i = 0; i < count; i++) {
    const lit = isActive && subIndex === i;
    dots.push(
      <span key={i} style={{
        width: 3.5, height: 3.5, borderRadius: 99,
        background: lit ? 'var(--accent)' : 'var(--ink-2)',
        opacity: lit ? 1 : (count === 1 ? 0.9 : 0.55),
        transition: 'background 80ms, transform 80ms',
        transform: lit ? 'scale(1.4)' : 'scale(1)',
      }} />
    );
  }
  return (
    <div style={{
      display: 'flex', gap: 3, alignItems: 'center', justifyContent: 'center',
      minHeight: 8,
    }}>{dots}</div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BeatColumn — a single editable beat in the bar
// ─────────────────────────────────────────────────────────────────────────────
function BeatColumn({ beat, isAccent, subdivision, currentBeat, currentSub, isRunning, inCountIn, onToggleAccent, onCycleSubdivision, dense }) {
  const isCurrent = isRunning && beat === currentBeat && !inCountIn;
  const SUB_LABEL = { 1: '♩', 2: '♫', 3: '³', 4: '♬' };
  return (
    <div className="pg-beat" style={{ flex: 1, minWidth: 0 }}>
      {/* Accent bar */}
      <button type="button"
        onClick={onToggleAccent}
        aria-pressed={isAccent}
        style={{
          appearance: 'none', cursor: 'pointer',
          width: '100%', maxWidth: 30, height: 11, padding: 0,
          borderRadius: 4,
          border: '0.5px solid ' + (isAccent ? 'transparent' : 'var(--border-strong)'),
          background: isAccent
            ? (isCurrent ? 'var(--accent)' : 'var(--fg)')
            : (isCurrent ? 'var(--accent-soft)' : 'transparent'),
          transition: 'all 120ms',
        }} />
      {/* Beat number */}
      <span className="pg-numeric" style={{
        fontSize: 11, fontWeight: 500,
        color: isCurrent ? 'var(--accent)' : 'var(--muted)',
        transition: 'color 80ms',
      }}>{beat}</span>
      {/* Subdivision cluster */}
      <button type="button" onClick={onCycleSubdivision}
        style={{
          appearance: 'none', cursor: 'pointer',
          background: 'var(--surface)',
          border: '0.5px solid var(--border)',
          borderRadius: 8, padding: '5px 6px',
          minWidth: 36,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        }}>
        <SubdivisionCluster count={subdivision} isActive={isCurrent} subIndex={currentSub} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'var(--muted)', letterSpacing: '0.04em' }}>
          ×{subdivision}
        </span>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tempo character — Italian terms + meaning
// ─────────────────────────────────────────────────────────────────────────────
const TEMPO_NAMES = [
  { max: 40, name: 'Grave', meaning: 'Solemn · very slow' },
  { max: 60, name: 'Largo', meaning: 'Broad · slow' },
  { max: 66, name: 'Larghetto', meaning: 'Rather broad' },
  { max: 76, name: 'Adagio', meaning: 'At ease' },
  { max: 108, name: 'Andante', meaning: 'Walking pace' },
  { max: 120, name: 'Moderato', meaning: 'Moderate' },
  { max: 156, name: 'Allegro', meaning: 'Lively · quick' },
  { max: 176, name: 'Vivace', meaning: 'Brisk · lively' },
  { max: 200, name: 'Presto', meaning: 'Very fast' },
  { max: 999, name: 'Prestissimo', meaning: 'Extremely fast' },
];
function getTempoCharacter(bpm) {
  return TEMPO_NAMES.find((t) => bpm <= t.max) || TEMPO_NAMES[TEMPO_NAMES.length - 1];
}

// ─────────────────────────────────────────────────────────────────────────────
// CentsRing — orbiting indicator on a top arc
// ─────────────────────────────────────────────────────────────────────────────
function CentsRing({ cents, clarity, active, noteLabel, accidental, octave, size = 290, holdProgress = 0 }) {
  const radius = size / 2 - 26;
  const range = 50;
  const c = Math.max(-range, Math.min(range, cents));
  const angle = (c / range) * 90 - 90;
  const a = angle * (Math.PI / 180);
  const x = size/2 + Math.cos(a) * radius;
  const y = size/2 + Math.sin(a) * radius;

  const inTune = Math.abs(cents) <= 5;
  const near = Math.abs(cents) <= 15;
  const color = !active ? 'var(--muted)' : (inTune ? 'var(--good)' : (near ? 'var(--warn)' : 'var(--bad)'));

  const markers = [-25, 0, 25];
  const labels = [-50, 50];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* hairline background circle */}
      <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="var(--border)" strokeWidth="1" />
      {/* full track arc top */}
      <path d={describeArc(size/2, size/2, radius, -90, 90)} fill="none" stroke="var(--border-strong)" strokeWidth="2.5" strokeLinecap="round" />
      {/* in-tune sweet zone */}
      <path d={describeArc(size/2, size/2, radius, -99.6, -80.4)} fill="none" stroke="var(--good)" strokeWidth="4" strokeLinecap="round" opacity="0.4" />
      {/* near zone hairline */}
      <path d={describeArc(size/2, size/2, radius, -117, -63)} fill="none" stroke="var(--warn)" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />

      {/* hold progress arc */}
      {active && holdProgress > 0 && (
        <path d={describeArc(size/2, size/2, radius, -90 - holdProgress * 10, -90 + holdProgress * 10)}
          fill="none" stroke="var(--good)" strokeWidth="6" strokeLinecap="round" />
      )}

      {/* markers */}
      {markers.map((m) => {
        const ma = (m / range) * 90 - 90;
        const mr = ma * (Math.PI / 180);
        const mx = size/2 + Math.cos(mr) * (radius - 14);
        const my = size/2 + Math.sin(mr) * (radius - 14);
        return (
          <g key={m}>
            <line
              x1={size/2 + Math.cos(mr) * (radius - 6)} y1={size/2 + Math.sin(mr) * (radius - 6)}
              x2={size/2 + Math.cos(mr) * (radius + 4)} y2={size/2 + Math.sin(mr) * (radius + 4)}
              stroke="var(--border-strong)" strokeWidth="1"
            />
            <text x={mx} y={my} textAnchor="middle" dominantBaseline="central"
              fontFamily="var(--font-mono)" fontSize="9" fill="var(--muted)">
              {m === 0 ? '0' : (m > 0 ? `+${m}` : m)}
            </text>
          </g>
        );
      })}
      {/* extreme labels */}
      {labels.map((m) => {
        const ma = (m / range) * 90 - 90;
        const mr = ma * (Math.PI / 180);
        const mx = size/2 + Math.cos(mr) * (radius + 14);
        const my = size/2 + Math.sin(mr) * (radius + 14);
        return (
          <text key={m} x={mx} y={my} textAnchor="middle" dominantBaseline="central"
            fontFamily="var(--font-mono)" fontSize="9" fill="var(--muted)">
            {m > 0 ? `+${m}¢` : `${m}¢`}
          </text>
        );
      })}
      {/* directional caret hints (flat / sharp sides) */}
      <text x={size/2 - radius - 6} y={size/2 + 4} textAnchor="end"
        fontFamily="var(--font-mono)" fontSize="11" fill="var(--muted)" opacity="0.7">♭</text>
      <text x={size/2 + radius + 6} y={size/2 + 4} textAnchor="start"
        fontFamily="var(--font-mono)" fontSize="11" fill="var(--muted)" opacity="0.7">♯</text>

      {/* orbiting indicator */}
      {active && (
        <g>
          <circle cx={x} cy={y} r="18" fill={color} fillOpacity="0.12" />
          <circle cx={x} cy={y} r="8" fill={color} />
          <line x1={size/2} y1={size/2 + radius * 0.18} x2={x} y2={y} stroke={color} strokeWidth="1.2" strokeOpacity="0.4" />
        </g>
      )}
      {/* center note */}
      <g>
        <text x={size/2} y={size/2 + 12}
          textAnchor="middle" dominantBaseline="middle"
          fontFamily="var(--font-display)" fontWeight="300"
          fontSize="88" fill={active ? 'var(--fg)' : 'var(--muted)'}
          style={{ letterSpacing: '-0.05em' }}
        >{noteLabel || '—'}</text>
        {active && accidental && (
          <text x={size/2 + 32} y={size/2 - 6}
            textAnchor="start" dominantBaseline="middle"
            fontFamily="var(--font-display)" fontSize="34" fill="var(--accent)">
            {accidental}
          </text>
        )}
        {octave != null && (
          <text x={size/2} y={size/2 + 54}
            textAnchor="middle"
            fontFamily="var(--font-mono)" fontSize="11" fill="var(--muted)"
            style={{ letterSpacing: '0.18em' }}>
            OCT {octave}
          </text>
        )}
      </g>
    </svg>
  );
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = Math.abs(endAngle - startAngle) <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}
function polarToCartesian(cx, cy, r, angleDeg) {
  const a = (angleDeg) * Math.PI / 180.0;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

// ─────────────────────────────────────────────────────────────────────────────
// History strip — shows recent cents readings
// ─────────────────────────────────────────────────────────────────────────────
function HistoryStrip({ history, active }) {
  const SLOTS = 12;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span className="pg-section-label">Recent</span>
        <span className="pg-numeric pg-nowrap" style={{ fontSize: 9.5, color: 'var(--muted)', letterSpacing: '0.06em' }}>last 12</span>
      </div>
      <div style={{
        position: 'relative', height: 26,
        border: '0.5px solid var(--border)', borderRadius: 8,
        padding: '0 6px',
        display: 'flex', alignItems: 'center',
        background: 'transparent',
      }}>
        {/* center reference line */}
        <div style={{
          position: 'absolute', left: 0, right: 0, top: '50%',
          height: 0.5, background: 'var(--border-strong)',
        }} />
        <div style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', gap: 4 }}>
          {Array.from({ length: SLOTS }).map((_, i) => {
            const h = history[i];
            const cents = h ? h.cents : null;
            if (cents == null) {
              return <div key={i} style={{ flex: 1, height: 3, borderRadius: 99, background: 'var(--rule-strong)', opacity: 0.4 }} />;
            }
            const inTune = Math.abs(cents) <= 5;
            const near = Math.abs(cents) <= 15;
            const color = inTune ? 'var(--good)' : (near ? 'var(--warn)' : 'var(--bad)');
            const offset = Math.max(-1, Math.min(1, cents / 50));
            return (
              <div key={i} style={{ flex: 1, height: '100%', position: 'relative' }}>
                <div style={{
                  position: 'absolute', left: '50%',
                  top: `calc(50% + ${offset * 9}px)`,
                  width: 4, height: 4, borderRadius: 99,
                  background: color,
                  transform: 'translate(-50%, -50%)',
                }} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  Icon, Dial, PulseRings, SubdivisionCluster, BeatColumn,
  TEMPO_NAMES, getTempoCharacter,
  CentsRing, HistoryStrip,
});
