import type { BrandTheme } from '../../packages/shared-sdk/index';

/**
 * Writes the brand theme onto the page.
 * `index.html` reads these variables, so a new brand does not need a CSS change.
 */
export function applyBrandTheme(theme: BrandTheme): void {
  const root = document.documentElement;
  root.style.setProperty('--brand-background', theme.backgroundColor);
  root.style.setProperty('--brand-text', theme.textColor);
  root.style.setProperty('--brand-accent', theme.accentColor);
  root.style.setProperty('--brand-accent-text', theme.accentTextColor);
  root.style.setProperty('--brand-font', theme.fontFamily);

  document.title = theme.name;
  const heading = document.querySelector<HTMLElement>('#brand-name');
  if (heading) {
    heading.textContent = theme.name;
  }
}
