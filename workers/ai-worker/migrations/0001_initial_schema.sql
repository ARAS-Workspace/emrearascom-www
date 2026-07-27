-- noinspection SqlDialectInspectionForFile

-- Migration: Initial schema
-- Version: 0001
--
-- Two tables, and the split between them is the whole design.
--
-- conversation_logs is the record and the proof. Each row is one turn: what was
-- asked, what was answered, and the hashes that make the conversation it belongs
-- to tamper-evident. There is no conversations table — a conversation *is* the
-- set of rows sharing a chain_id, read in block_index order. The chain is minted
-- on the first message and inherited by every later turn through context_hash,
-- which is why that index is UNIQUE: it is the lookup that decides whether a
-- client-sent history is one this worker actually produced.
--
-- daily_usage is the meter. Tokens are what this worker is billed for, so tokens
-- are what it counts, once per UTC day, incremented as the model reports usage
-- rather than when a turn finishes. That placement is deliberate: a stream the
-- visitor walks out on has still been generated and still costs money, and
-- whatever the model reported before the cut lands here like any other turn's.
-- Input is always reported, output only once generation completes, so an
-- abandoned turn is counted short by what it had produced — the total is a
-- close floor, not an exact figure. Nothing here is metered per visitor or per
-- conversation: the agent is a feature of this site, not something sold by the
-- turn, and the only ceiling is what a day may cost.
--
-- Indexes: the worker itself makes exactly one SELECT against conversation_logs,
-- the context_hash lookup, and that index is UNIQUE because the lookup is what
-- decides whether a client-sent history is one this worker produced. The other
-- three carry no query today; they are here for the dashboard that will read
-- this table — opening a conversation (chain_id, block_index), filtering by day
-- (created_at), and grouping a visitor's conversations without storing who they
-- are (ip_hash).

CREATE TABLE IF NOT EXISTS conversation_logs (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Chain: which conversation this turn belongs to, and where in it.
  chain_id            TEXT NOT NULL,     -- 32 random bytes, hex; minted at the first turn
  block_hash          TEXT NOT NULL,     -- SHA-256 over this turn's canonical fields
  prev_hash           TEXT,              -- previous block_hash; NULL on the first turn
  block_index         INTEGER NOT NULL,  -- 0-based position within the chain

  -- Continuation key: SHA-256 of the conversation INCLUDING this turn — the
  -- value the next turn's prior context hashes to. Re-deriving it from a stored
  -- row means normalizing the text fields (NFC, LF) first; D1 keeps them raw.
  context_hash        TEXT NOT NULL,

  -- The turn itself.
  user_message        TEXT NOT NULL,
  assistant_response  TEXT NOT NULL,

  -- Metadata, read by the dashboard rather than by the worker.
  locale              TEXT DEFAULT 'tr',
  ip_hash             TEXT,              -- SHA-256(ip); pseudonymized grouping only
  model               TEXT NOT NULL,
  tokens_in           INTEGER NOT NULL,
  tokens_out          INTEGER NOT NULL,
  latency_ms          INTEGER NOT NULL,
  created_at          INTEGER NOT NULL   -- Unix epoch milliseconds (Date.now())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_context_hash ON conversation_logs(context_hash);
CREATE INDEX IF NOT EXISTS idx_chain_block ON conversation_logs(chain_id, block_index);
CREATE INDEX IF NOT EXISTS idx_logs_created ON conversation_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_logs_ip_hash ON conversation_logs(ip_hash);

CREATE TABLE IF NOT EXISTS daily_usage (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL UNIQUE,   -- UTC calendar day, 'YYYY-MM-DD'
  tokens_in   INTEGER NOT NULL DEFAULT 0,
  tokens_out  INTEGER NOT NULL DEFAULT 0
);
