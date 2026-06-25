-- Rollback: drop the atomic goal-reward payout RPC.
-- goal_evaluator.py must be reverted to the inline insert+credit path before applying this.
DROP FUNCTION IF EXISTS public.credit_goal_reward(jsonb);
