import { badgeText } from '../../build/buildEnv';

/** Small, non-interactive label shown only on staging so nobody mistakes it for production. */
export function mountEnvBadge(appEnv: string, commit: string): void {
  const text = badgeText(appEnv, commit);
  if (!text) return;
  const badge = document.createElement('div');
  badge.id = 'env-badge';
  badge.textContent = text;
  badge.style.cssText =
    'position:fixed;left:4px;bottom:4px;z-index:5;padding:1px 5px;font:10px monospace;color:#ffd84a;' +
    'background:rgba(0,0,0,.55);border-radius:3px;opacity:.7;pointer-events:none;user-select:none';
  document.body.appendChild(badge);
}
