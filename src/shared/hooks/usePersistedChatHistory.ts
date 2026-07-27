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

import { useCallback, useEffect, useRef, useState } from 'react';

import type { HistoryItem } from '@carbon/ai-chat';

/**
 * Chat history in two shapes, because the two consumers need different ones:
 * Carbon AI Chat restores its transcript from `HistoryItem[]`, while the
 * worker needs the plain `{role, content}` array it hashes into the integrity
 * chain. Keeping both avoids lossy round-trips between them.
 *
 * The API copy is the one that must stay byte-exact: the worker anchors each
 * turn on a hash of the whole conversation, so an assistant message stored
 * here has to equal the concatenation of the streamed deltas exactly.
 *
 * Both copies live in refs rather than state. Nothing here is rendered — the
 * widget owns the visible transcript and reads this once, while it hydrates —
 * so state bought nothing but a re-render on every completed turn, and a
 * write-during-render to keep a ref in step with it. The callbacks below are
 * registered once and read whatever is current when they run.
 */

const HISTORY_STORAGE_KEY = 'emrearas-agent-history-items';
const API_STORAGE_KEY = 'emrearas-agent-api-context';

/** Worker-side message shape. */
export interface ApiMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface UsePersistedChatHistoryReturn {
  /** Transcript for Carbon AI Chat's history restore — always current. */
  readHistoryItems: () => HistoryItem[];
  /** Conversation as the worker sees it — always current, never stale. */
  readApiContext: () => ApiMessage[];
  /** Append one turn to both copies. */
  addTurn: (items: HistoryItem[], messages: ApiMessage[]) => void;
  /** Wipe both copies. Only the visitor triggers this, via "New conversation". */
  clearHistory: () => void;
  /** True once localStorage has been read (Carbon needs history up front). */
  isLoaded: boolean;
}

/**
 * Read a stored array, treating anything that fails `isValid` as corruption.
 * Shape matters here: a half-written or hand-edited API context would desync
 * from the worker's chain and reject every later message, so it is safer to
 * start clean than to restore something that only looks like an array.
 */
function readJson<T>(key: string, isValid: (item: unknown) => boolean): T[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isValid)) return null;
    return parsed as T[];
  } catch {
    return null;
  }
}

const isApiMessage = (item: unknown): boolean => {
  if (typeof item !== 'object' || item === null) return false;
  const { role, content } = item as Partial<ApiMessage>;
  return (role === 'user' || role === 'assistant') && typeof content === 'string' && content.length > 0;
};

const isHistoryItem = (item: unknown): boolean => {
  if (typeof item !== 'object' || item === null) return false;
  const { message } = item as { message?: unknown };
  if (typeof message !== 'object' || message === null) return false;
  // Carbon rebuilds the restored transcript keyed by message id. Two stored
  // messages without one share a single key: they collapse into one slot, and
  // every turn is then rendered again in each of those slots under duplicate
  // React keys. A transcript written before ids were stored is dropped rather
  // than patched — it would restore in the wrong order anyway.
  return typeof (message as { id?: unknown }).id === 'string';
};

/**
 * Write both copies, or neither.
 *
 * They are written together because they describe the same turns, and the
 * transcript is much the larger of the two: quota runs out on that one first.
 * Leaving the smaller one behind would persist a conversation whose visible
 * half is a turn shorter than the half the worker is shown, and the gap would
 * widen with every later turn. Dropping both is the choice the loader already
 * makes when it finds them inconsistent — the session itself carries on from
 * the refs, it simply will not survive a reload.
 */
function writePair(context: ApiMessage[], items: HistoryItem[]): void {
  try {
    localStorage.setItem(API_STORAGE_KEY, JSON.stringify(context));
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(items));
  } catch {
    try {
      localStorage.removeItem(API_STORAGE_KEY);
      localStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch {
      // Storage is unavailable altogether; nothing was persisted to undo.
    }
  }
}

/**
 * @example const { readHistoryItems, readApiContext, addTurn } = usePersistedChatHistory();
 */
export const usePersistedChatHistory = (): UsePersistedChatHistoryReturn => {
  // Only `isLoaded` is state: it gates the first render, everything else is
  // read through a callback that must see the newest value, not a rendered one.
  const [isLoaded, setIsLoaded] = useState(false);
  const historyItems = useRef<HistoryItem[]>([]);
  const apiContext = useRef<ApiMessage[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedHistory = readJson<HistoryItem>(HISTORY_STORAGE_KEY, isHistoryItem);
    const storedContext = readJson<ApiMessage>(API_STORAGE_KEY, isApiMessage);

    if (storedHistory === null || storedContext === null) {
      // Corrupt or partially written — start clean rather than half-restored,
      // which would desync the transcript from the worker's chain. Guarded
      // because reading storage can succeed where writing throws: a browser
      // with storage blocked would otherwise take the whole page down from
      // inside a mount effect.
      try {
        localStorage.removeItem(HISTORY_STORAGE_KEY);
        localStorage.removeItem(API_STORAGE_KEY);
      } catch {
        // Nothing to clean up; the refs already start empty.
      }
    } else {
      historyItems.current = storedHistory;
      apiContext.current = storedContext;
    }

    setIsLoaded(true);
  }, []);

  const readHistoryItems = useCallback((): HistoryItem[] => historyItems.current, []);

  const readApiContext = useCallback((): ApiMessage[] => apiContext.current, []);

  const addTurn = useCallback((items: HistoryItem[], messages: ApiMessage[]): void => {
    // Neither copy needs a cap of its own: the worker refuses a conversation
    // past its message limit, and that limit is what ends it.
    apiContext.current = [...apiContext.current, ...messages];
    historyItems.current = [...historyItems.current, ...items];
    writePair(apiContext.current, historyItems.current);
  }, []);

  const clearHistory = useCallback((): void => {
    apiContext.current = [];
    historyItems.current = [];
    try {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
      localStorage.removeItem(API_STORAGE_KEY);
    } catch {
      // Nothing to clean up.
    }
  }, []);

  return {
    readHistoryItems,
    readApiContext,
    addTurn,
    clearHistory,
    isLoaded,
  };
};
