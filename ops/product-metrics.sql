SELECT
  COUNT(DISTINCT CASE WHEN is_qa=0 THEN session_hash END) AS users,
  COUNT(DISTINCT CASE WHEN is_qa=0 AND event_name IN ('searched','no_result') THEN session_hash END) AS searchers,
  COUNT(CASE WHEN is_qa=0 AND event_name='searched' THEN 1 END) AS successful_searches,
  COUNT(CASE WHEN is_qa=0 AND event_name='no_result' THEN 1 END) AS no_result_searches,
  COUNT(DISTINCT CASE WHEN is_qa=0 AND event_name='prefecture_changed' THEN session_hash END) AS prefecture_changers,
  COUNT(DISTINCT CASE WHEN is_qa=0 AND event_name='period_changed' THEN session_hash END) AS period_changers,
  COUNT(DISTINCT CASE WHEN is_qa=0 AND event_name='saved' THEN session_hash END) AS savers,
  COUNT(DISTINCT CASE WHEN is_qa=0 AND event_name='copied' THEN session_hash END) AS copiers,
  COUNT(DISTINCT CASE WHEN is_qa=0 AND event_name='official_opened' THEN session_hash END) AS official_openers,
  COUNT(DISTINCT CASE WHEN is_qa=0 AND event_name IN ('searched','no_result') AND created_at>=unixepoch()-7*86400 THEN session_hash END) AS searchers_7d,
  COUNT(DISTINCT CASE WHEN is_qa=0 AND event_name='official_opened' AND created_at>=unixepoch()-7*86400 THEN session_hash END) AS official_openers_7d,
  COUNT(CASE WHEN is_qa=1 THEN 1 END) AS qa_rows
FROM product_events;
