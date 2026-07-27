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
		devOrigins: ['https://localhost:5174', 'https://localhost:5173', 'http://localhost:5173', 'http://localhost:8791'],

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
		 * Longest a single message may be, in bytes.
		 *
		 * Bytes rather than characters so it can be reasoned about against the
		 * body cap, which is also bytes: a full conversation of this length must
		 * still fit inside it, so that a conversation ends by reaching its
		 * message limit and never by being too large to send. Counting
		 * characters instead would make that guarantee hold for Latin text and
		 * quietly fail for everything else. See `maxRequestBodySize`.
		 *
		 * @example if (message.content.length > CONFIG.validation.maxMessageLength)
		 */
		maxMessageLength: 4096,

		/**
		 * How long a single conversation may get, in messages. Reaching it ends
		 * that conversation: the request is refused and the visitor starts a new
		 * one. Nothing rolls over silently — an agent that quietly forgot the
		 * first half of a conversation would be worse than one that says so.
		 * @example if (messages.length > CONFIG.validation.maxMessagesPerRequest)
		 */
		maxMessagesPerRequest: 50,

		/**
		 * Largest request body accepted, in bytes.
		 *
		 * Sized so the message-count cap is always the binding one. Both caps are
		 * in bytes, so the largest legitimate conversation is exactly
		 * `maxMessageLength * maxMessagesPerRequest` = 200 KB of content, and
		 * what remains covers the JSON envelope around it — measured at 201 KB
		 * for a full conversation of Turkish text. That holds for a body encoded
		 * as UTF-8, which is what `JSON.stringify` produces; a client that
		 * escapes every non-ASCII character instead triples its own payload and
		 * will meet this cap first. A lower cap would
		 * reject a full conversation as oversized before the worker could tell
		 * the client that the conversation is simply finished, and the client
		 * treats those two refusals very differently.
		 *
		 * @example if (contentLength > CONFIG.validation.maxRequestBodySize)
		 */
		maxRequestBodySize: 262144,
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
		 * Hostnames accepted from the Turnstile siteverify response. Local
		 * development is covered by its own short-circuit, so this list is
		 * production-only on purpose.
		 * @example if (!CONFIG.session.expectedHostnames.includes(data.hostname))
		 */
		expectedHostnames: ['www.emrearas.com'],
	},

	/**
	 * The day's token ceiling — the whole rate-limit model.
	 *
	 * Turnstile is the human gate. Beyond it nothing is metered per visitor or
	 * per conversation: the agent is a feature of this site, not something sold
	 * by the turn, and a visitor who asks a lot of questions is using it as
	 * intended. The only ceiling is what the day costs.
	 */
	budget: {
		/**
		 * Maximum tokens across everyone, per UTC day. Invisible in normal
		 * traffic; caps the worst day at a fixed cost. Measured on real
		 * conversations, a question costs ~7-8.5K tokens, so this is on the
		 * order of 250 questions a day for the whole site.
		 * @example if ((await readDailyUsage(env)) >= CONFIG.budget.tokensPerDay)
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
		 * @example const locale = parseLocale(body.locale); // falls back to this
		 */
		defaultLocale: 'tr' as 'tr' | 'en',

		/**
		 * Supported locales
		 * @example if (!CONFIG.localization.supportedLocales.includes(locale))
		 */
		supportedLocales: ['tr', 'en'] as const,
	},
} as const;
