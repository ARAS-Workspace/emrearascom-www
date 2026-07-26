-- noinspection SqlDialectInspectionForFile

-- Migration: Create usage ledger
-- Version: 0002
-- Description: Token spend that never becomes a conversation block.
--
-- A turn the client abandons mid-stream is still generated and billed, but it
-- must not enter the hash chain (an unanswered turn would never anchor, and
-- every later message would be rejected). Without a home, that spend was
-- invisible to the budgets, which read only from conversation_logs — so an
-- abandoned request cost money that no ceiling ever counted.
--
-- This table is that home: budget sums span conversation_logs + usage_ledger,
-- while the chain and the dashboard keep reading conversation_logs alone.

CREATE TABLE IF NOT EXISTS usage_ledger (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  chain_id    TEXT,               -- chain the abandoned turn belonged to (NULL for a genesis attempt)
  reason      TEXT NOT NULL,      -- why it never became a block, e.g. 'aborted'
  locale      TEXT DEFAULT 'tr',
  ip_hash     TEXT,
  model       TEXT NOT NULL,
  tokens_in   INTEGER NOT NULL,
  tokens_out  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL    -- Unix epoch milliseconds (Date.now())
);

CREATE INDEX IF NOT EXISTS idx_usage_chain_id ON usage_ledger(chain_id);
CREATE INDEX IF NOT EXISTS idx_usage_created ON usage_ledger(created_at);
