
-- USe For Create a Log Event Table

CREATE TABLE log_events (
  event_id UUID,
  timestamp DateTime MATERIALIZED now(),
  deployment_id Nullable(String),
  log String,
  metadata Nullable(String)
)
ENGINE=MergeTree PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp);


--  To get the all events
SELECT * FROM log_events;


-- ---- VISITOURS  COUNT 

CREATE TABLE visitor_counts (
    project_id String,
    visitor_count UInt64,
    date Date,
    timestamp DateTime DEFAULT now()
) 
ENGINE = MergeTree()
ORDER BY (project_id, date, timestamp);