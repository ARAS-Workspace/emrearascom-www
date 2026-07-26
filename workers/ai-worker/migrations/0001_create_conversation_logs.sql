-- noinspection SqlDialectInspectionForFile

-- Migration: Create conversation logs table
-- Version: 0001
-- Description: Hash-chained conversation logging (SHA-256 canonical blocks).
-- Column set is kept dashboard-compatible with the ARTEK reference schema:
-- created_at is Unix epoch MILLISECONDS; genesis prev_hash is SQL NULL;
-- tool_calls stays for compatibility and is always NULL in this worker.

CREATE TABLE IF NOT EXISTS conversation_logs (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Chain Core
  chain_id            TEXT NOT NULL,     -- 32 random bytes hex, generated at genesis
  block_hash          TEXT NOT NULL,     -- SHA-256 over the canonical block serialization
  prev_hash           TEXT,              -- previous block's block_hash (genesis: NULL)
  block_index         INTEGER NOT NULL,  -- 0, 1, 2, ... (chain order)

  -- Lookup Optimization
  context_hash        TEXT NOT NULL,     -- SHA-256 of the full prior context, continuation lookup key

  -- Context & Messages
  context             TEXT NOT NULL,     -- Full conversation JSON
  user_message        TEXT NOT NULL,     -- Last user message
  assistant_response  TEXT NOT NULL,     -- Assistant reply (byte-identical to streamed deltas)

  -- Metadata
  locale              TEXT DEFAULT 'tr',
  ip_hash             TEXT,              -- SHA-256(ip)
  model               TEXT NOT NULL,
  tokens_in           INTEGER NOT NULL,
  tokens_out          INTEGER NOT NULL,
  latency_ms          INTEGER NOT NULL,
  tool_calls          TEXT,              -- always NULL (kept for dashboard compatibility)
  created_at          INTEGER NOT NULL   -- Unix epoch milliseconds (Date.now())
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chain_id ON conversation_logs(chain_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_context_hash ON conversation_logs(context_hash);
CREATE INDEX IF NOT EXISTS idx_block_hash ON conversation_logs(block_hash);
CREATE INDEX IF NOT EXISTS idx_prev_hash ON conversation_logs(prev_hash);
CREATE INDEX IF NOT EXISTS idx_logs_created ON conversation_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_logs_ip_hash ON conversation_logs(ip_hash);
