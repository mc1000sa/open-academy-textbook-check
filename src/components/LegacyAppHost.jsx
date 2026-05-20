import { useEffect, useRef } from 'react';
import { mountLegacyApp } from '../legacy/legacyApp.js';

export default function LegacyAppHost() {
  const appRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function mount() {
      if (!appRef.current || cancelled) return;
      await mountLegacyApp(appRef.current);
    }

    mount();

    return () => {
      cancelled = true;
      if (appRef.current) appRef.current.innerHTML = '';
    };
  }, []);

  return <div ref={appRef} className="app-shell" />;
}
