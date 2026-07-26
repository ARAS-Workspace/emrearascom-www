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
 * emrearas.com AI Worker Configuration
 */

export const CONFIG = {
	/**
	 * Anthropic Claude AI Settings
	 */
	claude: {
		/**
		 * Claude model to use
		 * @example model: CONFIG.claude.model
		 */
		model: 'claude-haiku-4-5',

		/**
		 * Maximum tokens per completion (server-fixed; not client-controllable)
		 * @example max_tokens: CONFIG.claude.maxTokens
		 */
		maxTokens: 4096,
	},

	/**
	 * API Endpoints
	 */
	endpoints: {
		/**
		 * Turnstile verification → signed session token
		 * @example if (url.pathname === CONFIG.endpoints.session)
		 */
		session: '/api/v1/session',

		/**
		 * Chat completion (SSE streaming)
		 * @example if (url.pathname === CONFIG.endpoints.chat)
		 */
		chat: '/api/v1/chat',
	},

	/**
	 * CORS — origin allowlist (never wildcard)
	 */
	cors: {
		/**
		 * Origins allowed in every environment
		 * @example if (CONFIG.cors.allowedOrigins.includes(origin))
		 */
		allowedOrigins: ['https://www.emrearas.com'],

		/**
		 * Extra origins allowed only when ENVIRONMENT === 'development'
		 * @example [...CONFIG.cors.allowedOrigins, ...CONFIG.cors.devOrigins]
		 */
		devOrigins: ['https://localhost:5173', 'http://localhost:5173', 'http://localhost:8791'],

		/**
		 * Preflight cache lifetime in seconds
		 * @example 'Access-Control-Max-Age': String(CONFIG.cors.maxAgeSeconds)
		 */
		maxAgeSeconds: 86400,
	},

	/**
	 * Request Validation Limits
	 */
	validation: {
		/**
		 * Maximum length of a single message content
		 * @example if (message.content.length > CONFIG.validation.maxMessageLength)
		 */
		maxMessageLength: 16384,

		/**
		 * Maximum number of messages in a single request.
		 * The UI starts a fresh chain (rollover) when this cap is reached.
		 * @example if (messages.length > CONFIG.validation.maxMessagesPerRequest)
		 */
		maxMessagesPerRequest: 50,

		/**
		 * Maximum request body size in bytes (64KB)
		 * @example if (contentLength > CONFIG.validation.maxRequestBodySize)
		 */
		maxRequestBodySize: 65536,
	},

	/**
	 * Session (Turnstile verify-once → signed token)
	 */
	session: {
		/**
		 * Session token lifetime in seconds
		 * @example exp: now + CONFIG.session.ttlSeconds
		 */
		ttlSeconds: 3600,

		/**
		 * Hostnames accepted from the Turnstile siteverify response
		 * @example if (!CONFIG.session.expectedHostnames.includes(data.hostname))
		 */
		expectedHostnames: ['www.emrearas.com', 'localhost'],
	},

	/**
	 * Token Budgets — the whole rate-limit model.
	 *
	 * Turnstile is the human gate; the conversation budget is the
	 * session's overall limit; the daily budget is the wallet fuse. No
	 * separate store: both are derived from D1 (the integrity layer logs
	 * every turn's tokens anyway, awaited before the SSE `done`).
	 */
	budget: {
		/**
		 * Maximum tokens (input+output) per conversation chain. A real
		 * user with working prompt-cache burns ~60-75K over the 25-turn
		 * context cap; an abuser gets a deterministic per-chain ceiling.
		 * @example if (chainTokens >= CONFIG.budget.tokensPerSession)
		 */
		tokensPerSession: 200000,

		/**
		 * Maximum tokens consumed per UTC day (all users, wallet fuse).
		 * Invisible in normal traffic; caps the worst day at a fixed cost.
		 * @example if (totalTokens >= CONFIG.budget.tokensPerDay)
		 */
		tokensPerDay: 2000000,
	},

	/**
	 * llms-full Context Injection
	 *
	 * Fetched fresh on every message (no caching layer), so a site deploy
	 * reaches the agent immediately — mid-session too. The context lives in
	 * the Claude `system` blocks, never in the message array, so it is
	 * outside the integrity chain and invisible to the client.
	 */
	llms: {
		/**
		 * Per-locale source URLs
		 * @example CONFIG.llms.urls[locale]
		 */
		urls: {
			tr: 'https://www.emrearas.com/llms-full/tr.txt',
			en: 'https://www.emrearas.com/llms-full/en.txt',
		},
	},

	/**
	 * Localization Settings
	 */
	localization: {
		/**
		 * Default locale for error messages and responses
		 * @example locale: chatRequest.locale || CONFIG.localization.defaultLocale
		 */
		defaultLocale: 'tr' as 'tr' | 'en',

		/**
		 * Supported locales
		 * @example if (!CONFIG.localization.supportedLocales.includes(locale))
		 */
		supportedLocales: ['tr', 'en'] as const,
	},
} as const;
