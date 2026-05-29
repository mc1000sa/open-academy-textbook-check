import { useEffect, useRef } from 'react';
import AuroraBackground from './effects/AuroraBackground.jsx';

export default function LegacyAppHost() {
  const appRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let cleanupFn = null;

    async function mount() {
      if (!appRef.current || cancelled) return;
      const { mountLegacyApp } = await import('../legacy/legacyApp.js');
      if (cancelled) return;
      cleanupFn = await mountLegacyApp(appRef.current);
      if (cancelled && cleanupFn) {
        cleanupFn();
      }
    }

    mount();

    return () => {
      cancelled = true;
      if (cleanupFn) {
        cleanupFn();
      }
      if (appRef.current) appRef.current.innerHTML = '';
    };
  }, []);

  return (
    <>
      <AuroraBackground />
      <div ref={appRef} className="app-shell" />
    </>
  );
}
