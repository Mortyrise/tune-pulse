// pulseGroove — responsive shell (mobile + desktop dashboard, same codebase)

const RESPONSIVE_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "view": "auto",
  "theme": "light",
  "density": "spacious",
  "metronomeVariant": "pulse",
  "tunerVariant": "ring"
}/*EDITMODE-END*/;

function ResponsiveApp() {
  const [t, setTweak] = useTweaks(RESPONSIVE_TWEAK_DEFAULTS);
  const [vw, setVw] = React.useState(typeof window !== 'undefined' ? window.innerWidth : 1920);

  React.useEffect(() => {
    const fn = () => setVw(window.innerWidth);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  // Decide which view to render
  const view = t.view === 'auto' ? (vw < 900 ? 'mobile' : 'desktop') : t.view;

  return (
    <>
      {view === 'mobile' && <MobileShell tweaks={t} />}
      {view === 'desktop' && <DesktopShell tweaks={t} />}

      <TweaksPanel>
        <TweakSection label="Viewport" />
        <TweakRadio label="View"
          value={t.view}
          options={['auto', 'mobile', 'desktop']}
          onChange={(v) => setTweak('view', v)} />

        <TweakSection label="Theme" />
        <TweakRadio label="Mode"
          value={t.theme}
          options={['light', 'dark', 'mono']}
          onChange={(v) => setTweak('theme', v)} />

        {view === 'mobile' && (
          <>
            <TweakSection label="Mobile" />
            <TweakRadio label="Density"
              value={t.density}
              options={['compact', 'regular', 'spacious']}
              onChange={(v) => setTweak('density', v)} />
          </>
        )}
      </TweaksPanel>
    </>
  );
}

// ─── Mobile shell — wraps mobile screens in iOS frame
function MobileShell({ tweaks }) {
  const [tab, setTab] = React.useState('metronome');
  const [flashKey, setFlashKey] = React.useState(0);

  // Re-apply theme + density to root
  React.useEffect(() => {
    const root = document.getElementById('mobile-root');
    if (root) {
      root.setAttribute('data-theme', tweaks.theme);
      root.setAttribute('data-density', tweaks.density);
    }
  }, [tweaks.theme, tweaks.density]);

  return (
    <IOSDevice width={390} height={844} dark={tweaks.theme === 'dark'}>
      <div className="pg-app" id="mobile-root" data-theme={tweaks.theme} data-density={tweaks.density}>
        <div key={flashKey} className="pg-flash is-on" />
        {tab === 'metronome' && (
          <MetronomeScreen tweaks={tweaks} onFlash={() => setFlashKey((k) => k + 1)} />
        )}
        {tab === 'tuner' && (
          <TunerScreen tweaks={tweaks} />
        )}
        <div className="pg-tabbar">
          <button type="button" className={`pg-tab ${tab === 'tuner' ? 'is-active' : ''}`}
            onClick={() => setTab('tuner')}>
            <Icon name="pulse" size={15} /> Tuner
          </button>
          <button type="button" className={`pg-tab ${tab === 'metronome' ? 'is-active' : ''}`}
            onClick={() => setTab('metronome')}>
            <Icon name="metronome" size={15} /> Metronome
          </button>
        </div>
      </div>
    </IOSDevice>
  );
}

// ─── Desktop shell — wraps Dashboard variant in browser chrome
function DesktopShell({ tweaks }) {
  return (
    <ChromeWindow tabs={[{ title: 'pulseGroove', active: true }]} activeIndex={0} url="pulsegroove.app/studio" width={1920} height={1080}>
      <DashboardVariant tweaks={tweaks} />
    </ChromeWindow>
  );
}

ReactDOM.createRoot(document.getElementById('mount')).render(<ResponsiveApp />);
