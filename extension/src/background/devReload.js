// Development helper: poll a local /version endpoint and reload extension when it changes.
// This is safe to leave in during development; it will silently fail if localhost isn't reachable.
(function setupDevAutoReload() {
    if (!self.TRUTHLAYER_CONFIG?.ENABLE_DEV_RELOAD) {
        return;
    }

    const VERSION_URL = self.TRUTHLAYER_CONFIG?.VERSION_URL || 'http://localhost:3000/version';
    const POLL_INTERVAL_MS = 3000;
    let current = null;

    async function check() {
        try {
            const res = await fetch(VERSION_URL, { cache: 'no-store' });
            if (!res.ok) return;
            const j = await res.json();
            const v = j && j.version ? String(j.version) : null;
            if (!v) return;
            if (current === null) current = v;
            else if (v !== current) {
                console.log('TruthLayer: Dev version changed from', current, 'to', v, '- reloading extension');
                // reload the extension so updated files are used
                try {
                    chrome.runtime.reload();
                } catch (err) {
                    console.error('TruthLayer: failed to reload extension', err);
                }
            }
        } catch (err) {
            // Common while developing (localhost down) — keep quiet but available in logs
            // console.debug('TruthLayer dev reload check failed', err);
        }
    }

    // Only start polling if host permissions likely allow localhost (manifest includes it in this project)
    try {
        check();
        setInterval(check, POLL_INTERVAL_MS);
    } catch (e) {
        console.error('TruthLayer: could not start dev auto-reload', e);
    }
})();
