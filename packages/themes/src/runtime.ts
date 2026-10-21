/**
 * Browser runtime for rendered pages: copy buttons, the theme toggle (remembered per viewer) and
 * Mermaid rendering when the page has Mermaid blocks. Plain ES2020, no dependencies.
 * Mermaid comes from `window.MARKUPME_MERMAID_URL` (set by the page) and is loaded only when needed.
 */
export const runtimeScript = `(() => {
  const root = document.documentElement;
  const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
  const saved = store.get('markupme-theme');
  if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;
  const isDark = () => root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;

  document.addEventListener('click', async (e) => {
    const btn = e.target instanceof Element ? e.target.closest('.mm-copy') : null;
    if (btn) {
      const code = btn.parentElement && btn.parentElement.querySelector('pre code, pre');
      if (!code) return;
      try { await navigator.clipboard.writeText(code.innerText); btn.textContent = 'Copied'; }
      catch { btn.textContent = 'Press Ctrl+C'; }
      btn.setAttribute('data-copied', '');
      setTimeout(() => { btn.textContent = 'Copy'; btn.removeAttribute('data-copied'); }, 1500);
      return;
    }
    const toggle = e.target instanceof Element ? e.target.closest('.mm-theme-toggle') : null;
    if (toggle) {
      const next = isDark() ? 'light' : 'dark';
      root.dataset.theme = next;
      store.set('markupme-theme', next);
      toggle.setAttribute('aria-pressed', String(next === 'dark'));
      renderMermaid(true);
    }
  });

  let mermaidReady;
  function loadMermaid() {
    if (window.mermaid) return Promise.resolve(window.mermaid);
    if (!mermaidReady) mermaidReady = new Promise((resolve, reject) => {
      const url = window.MARKUPME_MERMAID_URL;
      if (!url) return reject(new Error('No Mermaid URL configured'));
      const s = document.createElement('script');
      s.src = url; s.onload = () => resolve(window.mermaid); s.onerror = () => reject(new Error('Mermaid failed to load from ' + url));
      document.head.appendChild(s);
    });
    return mermaidReady;
  }
  async function renderMermaid(rerender) {
    const blocks = Array.from(document.querySelectorAll('pre.mermaid'));
    if (blocks.length === 0) return;
    try {
      const mermaid = await loadMermaid();
      for (const b of blocks) {
        if (!b.dataset.source) b.dataset.source = b.textContent || '';
        if (rerender) { b.removeAttribute('data-processed'); b.innerHTML = ''; b.textContent = b.dataset.source; }
      }
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: isDark() ? 'dark' : 'default' });
      await mermaid.run({ nodes: blocks, suppressErrors: true });
    } catch (err) {
      for (const b of blocks) b.setAttribute('title', String(err && err.message || err));
    }
  }
  window.markupme = Object.assign(window.markupme || {}, { renderMermaid });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => renderMermaid(false));
  else renderMermaid(false);
})();`
