'use client'

// No React state: the theme lives on <html data-theme>, set before paint by the script in layout.tsx,
// and CSS shows the label for the theme the button switches to.
export function ThemeToggle() {
  function toggle() {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'
    document.documentElement.dataset.theme = next
    try { localStorage.theme = next } catch { /* private mode: the choice lasts for this page only */ }
  }
  return (
    <button type="button" onClick={toggle} className="plush key">
      <span className="when-dark">Light</span>
      <span className="when-light">Dark</span>
      <span className="sr-only"> theme</span>
    </button>
  )
}
