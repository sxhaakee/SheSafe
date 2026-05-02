-- SHESAFE Alerts Table — Run this in Supabase SQL Editor
-- Dashboard: https://supabase.com/dashboard/project/tkpfuucprlodzxubqjsz/sql/new

CREATE TABLE IF NOT EXISTS alerts (
  id BIGSERIAL PRIMARY KEY,
  alert_id TEXT UNIQUE NOT NULL,
  user_name TEXT NOT NULL,
  user_phone TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  address TEXT,
  risk_score INTEGER DEFAULT 0,
  risk_level TEXT DEFAULT 'low',
  trigger_type TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  maps_link TEXT,
  status TEXT DEFAULT 'dispatched',
  is_safe BOOLEAN DEFAULT FALSE,
  safe_confirmed_at TIMESTAMPTZ,
  recipients JSONB DEFAULT '[]'::jsonb,
  evidence_urls JSONB DEFAULT '[]'::jsonb,
  location_pings JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast polling (police/family poll every 5s for active alerts)
CREATE INDEX IF NOT EXISTS idx_alerts_is_safe ON alerts (is_safe);
CREATE INDEX IF NOT EXISTS idx_alerts_alert_id ON alerts (alert_id);

-- Enable Row Level Security but allow service role full access
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Policy: service_role can do everything (backend uses service key)
CREATE POLICY "Service role full access" ON alerts
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant access
GRANT ALL ON alerts TO service_role;
GRANT ALL ON alerts TO authenticated;
