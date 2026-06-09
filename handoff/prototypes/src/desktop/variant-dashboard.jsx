// pulseGroove desktop — Variant A: Dashboard
// metronome + tuner side-by-side · grooves left · stats/shortcuts right

function DashboardVariant({ tweaks }) {
  const metro = useMetronomeDemo();
  const tuner = useTunerDemo();
  const [search, setSearch] = React.useState('');
  const [activeGroove, setActiveGroove] = React.useState('pop');
  const [refA4] = React.useState(440);

  useDesktopShortcuts({
    toggle: metro.toggle,
    bpmUp: () => metro.setBpm(Math.min(280, metro.bpm + 1)),
    bpmDown: () => metro.setBpm(Math.max(30, metro.bpm - 1)),
  });

  const tempo = TEMPO_CHARACTER(metro.bpm);
  const filteredGrooves = DESKTOP_GROOVES.filter((g) =>
    !search || g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.tag.toLowerCase().includes(search.toLowerCase())
  );

  // Tuner-derived values
  const noteIndex = ((tuner.sample.midi % 12) + 12) % 12;
  const octave = Math.floor(tuner.sample.midi / 12) - 1;
  const noteName = NOTE_NAMES_DESK[noteIndex];
  const noteBase = noteName.replace('♯', '');
  const isSharp = noteName.includes('♯');
  const freq = midiToFreqDesk(tuner.sample.midi, refA4) * Math.pow(2, tuner.sample.cents / 1200);
  const isInTune = Math.abs(tuner.sample.cents) <= 5;
  const isNear = Math.abs(tuner.sample.cents) <= 15;

  return (
    <div className="pgd pgd-dash" data-theme={tweaks.theme || 'light'}>
      {/* Top bar */}
      <div className="pgd-dash-topbar">
        <div className="pgd-row pgd-gap-4">
          <div className="pgd-row pgd-gap-2">
            <span className="pg-brand-dot" />
            <span className="pgd-mono pgd-nowrap" style={{ fontSize: 12, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--fg)', fontWeight: 500 }}>
              pulse·groove
            </span>
            <span className="pgd-mono pgd-muted pgd-nowrap" style={{ fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              · studio
            </span>
          </div>
          <span className="pgd-mono pgd-muted pgd-nowrap" style={{ fontSize: 10.5, marginLeft: 24, letterSpacing: '0.06em' }}>
            {metro.isRunning ? <span style={{ color: 'var(--good)' }}>● live</span> : <span style={{ opacity: 0.5 }}>○ idle</span>}
            <span style={{ margin: '0 12px', opacity: 0.4 }}>·</span>
            BAR {String(metro.bar).padStart(3, '0')} · {formatElapsedDesk(metro.elapsed)}
          </span>
        </div>
        <div className="pgd-row pgd-gap-3">
          <span className="pgd-mono pgd-muted" style={{ fontSize: 10.5 }}>A4 = {refA4} Hz</span>
          <span style={{ width: 0.5, alignSelf: 'stretch', background: 'var(--border)' }} />
          <span className="pgd-mono pgd-muted" style={{ fontSize: 10.5 }}>cmd K</span>
        </div>
      </div>

      {/* Left sidebar — Grooves library */}
      <div className="pgd-side">
        <div className="pgd-side-head">
          <span className="pg-section-label">Grooves library</span>
          <span className="pgd-mono pgd-muted" style={{ fontSize: 10 }}>{filteredGrooves.length}</span>
        </div>
        <div style={{ padding: '0 14px 10px' }}>
          <div className="pgd-search">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" strokeLinecap="round" />
            </svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or tag…" />
          </div>
        </div>
        <div className="pgd-side-body">
          {filteredGrooves.map((g) => (
            <button key={g.id} type="button" className={`pgd-groove ${activeGroove === g.id ? 'is-active' : ''}`}
              onClick={() => { setActiveGroove(g.id); metro.applyGroove(g); }}>
              <div style={{ minWidth: 0 }}>
                <div className="pgd-groove-name">{g.name}</div>
                <div className="pgd-groove-hint">{g.hint}</div>
              </div>
              <div className="pgd-col" style={{ alignItems: 'flex-end', gap: 4 }}>
                <span className="pgd-groove-meta">{g.bpm} bpm</span>
                <span className="pgd-groove-meta pgd-muted" style={{ opacity: 0.7 }}>{g.n}/{g.d}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="pgd-dash-main">
        {/* Metronome pane */}
        <div className="pgd-pane">
          <div className="pgd-pane-head">
            <div>
              <span className="pg-section-label">Metronome</span>
              <h2>{tempo[1]} <span className="pgd-mono pgd-muted" style={{ fontSize: 11, fontStyle: 'normal', letterSpacing: '0.06em', marginLeft: 8 }}>· {tempo[2]}</span></h2>
            </div>
            <button type="button" onClick={metro.toggle} className="pgd-bigplay">
              <Icon name={metro.isRunning ? 'pause' : 'play'} size={14} />
              {metro.isRunning ? 'Stop' : 'Start'}
            </button>
          </div>
          <div style={{
            position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '8px 0 18px', flex: 1, minHeight: 0,
          }}>
            <PulseRings tickId={metro.tickId} isRunning={metro.isRunning} isAccent={metro.isAccent} size={420} />
            <Dial value={metro.bpm} min={30} max={280} onChange={metro.setBpm} size={460} isRunning={metro.isRunning}>
              <div className="pgd-display" style={{ fontSize: 150, lineHeight: 1, color: 'var(--fg)' }}>{metro.bpm}</div>
              <div className="pgd-mono pgd-muted pgd-nowrap" style={{ fontSize: 11, letterSpacing: '0.26em', textTransform: 'uppercase', marginTop: 6 }}>
                BPM · drag or ± keys
              </div>
              <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center', pointerEvents: 'auto' }} className="pg-no-drag">
                <button type="button" onClick={() => metro.setNumerator(Math.max(2, metro.numerator - 1))}
                  className="pgd-mono" style={{
                    appearance: 'none', cursor: 'pointer',
                    background: 'var(--surface)', border: '0.5px solid var(--border)',
                    padding: '6px 14px', borderRadius: 99,
                    color: 'var(--fg)', fontSize: 14,
                  }}>{metro.numerator}/{metro.denominator}</button>
              </div>
            </Dial>
          </div>
          {/* Bar pattern editor */}
          <div className="pg-card" style={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
              <span className="pg-section-label">Bar pattern</span>
              <span className="pgd-mono pgd-muted" style={{ fontSize: 10.5 }}>tap to accent · click dots to cycle</span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
              {Array.from({ length: metro.numerator }).map((_, i) => (
                <BeatColumn key={i}
                  beat={i + 1}
                  isAccent={metro.accents.includes(i + 1)}
                  subdivision={metro.subdivisions[i] || 1}
                  currentBeat={metro.currentBeat}
                  currentSub={0}
                  isRunning={metro.isRunning}
                  inCountIn={false}
                  onToggleAccent={() => metro.toggleAccent(i + 1)}
                  onCycleSubdivision={() => metro.cycleSub(i)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="pgd-pane-divider" />

        {/* Tuner pane */}
        <div className="pgd-pane">
          <div className="pgd-pane-head">
            <div>
              <span className="pg-section-label">Tuner</span>
              <h2>Chromatic <span className="pgd-mono pgd-muted" style={{ fontSize: 11, fontStyle: 'normal', letterSpacing: '0.06em', marginLeft: 8 }}>· A4 {refA4} Hz</span></h2>
            </div>
            <div className="pgd-row pgd-gap-3">
              <div className="pgd-stat" style={{ padding: '6px 14px' }}>
                <span className="pgd-mono pgd-muted" style={{ fontSize: 10 }}>CLARITY</span>{' '}
                <span className="pgd-mono" style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>
                  {Math.round(tuner.sample.clarity * 100)}%
                </span>
              </div>
            </div>
          </div>
          <div style={{
            position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '8px 0 18px', flex: 1, minHeight: 0,
          }}>
            <CentsRing
              cents={tuner.sample.cents}
              clarity={tuner.sample.clarity}
              active
              noteLabel={noteBase}
              accidental={isSharp ? '♯' : null}
              octave={octave}
              size={460}
              holdProgress={0}
            />
          </div>
          {/* Narrative + Hz row */}
          <div className="pg-card" style={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div className={`pgd-mono ${isInTune ? 'pg-cents-good' : isNear ? 'pg-cents-near' : 'pg-cents-bad'}`}
                  style={{ fontSize: 36, fontWeight: 300, lineHeight: 1, letterSpacing: '-0.02em' }}>
                  {tuner.sample.cents >= 0 ? '+' : ''}{tuner.sample.cents.toFixed(1)}
                  <span style={{ fontSize: 18, marginLeft: 2 }}>¢</span>
                </div>
                <div className="pgd-mono pgd-muted pgd-nowrap" style={{ fontSize: 11, marginTop: 6 }}>
                  {isInTune ? 'In tune' : tuner.sample.cents > 0 ? 'Sharp · ease back' : 'Flat · push up'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="pgd-mono" style={{ fontSize: 22, fontWeight: 500 }}>
                  {freq.toFixed(2)} <span className="pgd-muted" style={{ fontSize: 12 }}>Hz</span>
                </div>
                <div className="pgd-mono pgd-muted pgd-nowrap" style={{ fontSize: 11, marginTop: 6 }}>
                  target {midiToFreqDesk(tuner.sample.midi, refA4).toFixed(2)} Hz
                </div>
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <HistoryStrip history={tuner.history} active />
            </div>
          </div>
        </div>
      </div>

      {/* Right rail — stats + shortcuts */}
      <div className="pgd-side pgd-side-r">
        <div className="pgd-side-head">
          <span className="pg-section-label">Session</span>
        </div>
        <div style={{ padding: '4px 18px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="pgd-stat">
            <div className="pgd-stat-label">Practice time</div>
            <div className="pgd-stat-value">{formatElapsedDesk(metro.elapsed)}</div>
          </div>
          <div className="pgd-stat">
            <div className="pgd-stat-label pgd-nowrap">Bars · BPM</div>
            <div className="pgd-stat-value">
              {String(metro.bar).padStart(3, '0')}{' '}
              <span className="pgd-mono pgd-muted" style={{ fontSize: 13, marginLeft: 6 }}>· {metro.bpm}</span>
            </div>
          </div>
          <div className="pgd-stat">
            <div className="pgd-stat-label">Detected</div>
            <div className="pgd-stat-value">
              {noteBase}{isSharp && <span style={{ color: 'var(--accent)' }}>♯</span>}
              <span className="pgd-mono pgd-muted" style={{ fontSize: 14, marginLeft: 6 }}>oct {octave}</span>
            </div>
          </div>
        </div>
        <div className="pgd-side-head" style={{ marginTop: 18 }}>
          <span className="pg-section-label">Shortcuts</span>
        </div>
        <div style={{ padding: '4px 18px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            ['Start / stop', 'Space'],
            ['Tempo +1', '+'],
            ['Tempo −1', '−'],
            ['Tap tempo', 'T'],
            ['Focus metro', 'M'],
            ['Focus tuner', 'U'],
            ['Search', '⌘ K'],
          ].map(([label, key]) => (
            <div key={label} className="pgd-row" style={{ justifyContent: 'space-between' }}>
              <span className="pgd-nowrap" style={{ fontSize: 12, color: 'var(--fg-dim)' }}>{label}</span>
              <span className="pgd-kbd">{key}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="pgd-dash-bottombar">
        <div className="pgd-row pgd-gap-4 pgd-nowrap">
          <span>{tempo[1]} <span style={{ opacity: 0.6 }}>· {tempo[2]}</span></span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>{metro.numerator}/{metro.denominator}</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>accents on {metro.accents.join(', ') || '—'}</span>
        </div>
        <div className="pgd-shortcuts pgd-nowrap">
          <span className="pgd-shortcut"><span className="pgd-kbd">Space</span> start/stop</span>
          <span className="pgd-shortcut"><span className="pgd-kbd">+</span><span className="pgd-kbd">−</span> bpm</span>
          <span className="pgd-shortcut"><span className="pgd-kbd">T</span> tap</span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { DashboardVariant });
