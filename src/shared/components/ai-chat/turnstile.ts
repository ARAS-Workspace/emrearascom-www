// SPDX-License-Identifier: AGPL-3.0-or-later
/*
 * Copyright (C) 2026 Rıza Emre ARAS <r.emrearas@proton.me>
 *
 * This file is part of emrearas.com.
 *
 * emrearas.com is free software: you can redistribute it and/or modify it
 * under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or (at your
 * option) any later version. See <https://www.gnu.org/licenses/>.
 */

/**
 * Cloudflare Turnstile browser API — the visible managed widget, rendered
 * explicitly. Solved once per session: the token is exchanged for the
 * worker's own session token, so it never rides along with chat messages.
 */

interface TurnstileRenderOptions {
  sitekey: string;
  theme?: 'light' | 'dark' | 'auto';
  callback?: (token: string) => void;
  'error-callback'?: () => void;
  'expired-callback'?: () => void;
}

interface TurnstileAPI {
  render: (container: HTMLElement | string, options: TurnstileRenderOptions) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileAPI;
    onTurnstileLoadCallback?: () => void;
  }
}

const SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoadCallback';

/** How long to wait for the API before calling the load a failure. */
const LOAD_TIMEOUT_MS = 10_000;

/**
 * Load the Turnstile script once and run `onReady` when the API is available.
 * Safe to call from several components: an existing script tag is reused and
 * only the load callback is re-pointed.
 *
 * `onFailure` matters as much as `onReady` — a blocked or unreachable script
 * would otherwise leave the gate sitting empty forever with nothing to tell
 * the visitor why.
 *
 * Returns a disposer. Both things this leaves behind outlive the caller — a
 * global callback the script will invoke whenever it finishes loading, and a
 * timer that reports failure — so a component that unmounts before the API
 * arrives has to be able to take them back.
 *
 * @example useEffect(() => loadTurnstile(renderWidget, showGateError), [...]);
 */
export function loadTurnstile(onReady: () => void, onFailure: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  if (window.turnstile) {
    onReady();
    return () => {};
  }

  // The API can take a moment even on a good connection; this only fires when
  // it never arrives at all.
  const timeout = window.setTimeout(() => {
    if (!window.turnstile) onFailure();
  }, LOAD_TIMEOUT_MS);
  window.onTurnstileLoadCallback = () => {
    window.clearTimeout(timeout);
    onReady();
  };

  const dispose = (): void => {
    window.clearTimeout(timeout);
    // Only give up the callback if it is still the one installed here; a later
    // caller may already have replaced it.
    if (window.onTurnstileLoadCallback) window.onTurnstileLoadCallback = undefined;
  };

  const existing = document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]');
  if (existing) return dispose;

  const script = document.createElement('script');
  script.src = SCRIPT_URL;
  script.async = true;
  script.defer = true;
  script.onerror = () => {
    window.clearTimeout(timeout);
    onFailure();
  };
  document.body.appendChild(script);

  return dispose;
}
