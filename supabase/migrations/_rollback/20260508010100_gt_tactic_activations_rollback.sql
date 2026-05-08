DROP TRIGGER IF EXISTS gt_tactic_activations_usage_limit ON gt_tactic_activations;
DROP FUNCTION IF EXISTS enforce_tactic_usage_limit();
DROP TABLE IF EXISTS gt_tactic_activations;
