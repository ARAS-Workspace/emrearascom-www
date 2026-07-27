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
 * Build-time configuration for the AI worker (ai-worker.emrearas.com).
 *
 * The endpoint follows the build mode rather than a separate mode flag:
 * `npm run dev` serves the dev worker, a production build the deployed one.
 */

/** Worker origin for this build. */
export const AI_WORKER_ENDPOINT: string = (
  import.meta.env.DEV
    ? import.meta.env.VITE_AI_WORKER_DEV_ENDPOINT
    : import.meta.env.VITE_AI_WORKER_PRODUCTION_ENDPOINT
) as string;

/** Turnstile site key (visible managed widget). */
export const TURNSTILE_SITE_KEY: string = import.meta.env
  .VITE_AI_WORKER_TURNSTILE_SITE_KEY as string;

/** Worker routes. */
export const AI_WORKER_ROUTES = {
  session: '/api/v1/session',
  chat: '/api/v1/chat',
} as const;

/**
 * Whether the chat can run at all. A build without the env vars renders the
 * page's prose but not a broken widget.
 */
export const isAiChatConfigured = (): boolean =>
  Boolean(AI_WORKER_ENDPOINT) && Boolean(TURNSTILE_SITE_KEY);

