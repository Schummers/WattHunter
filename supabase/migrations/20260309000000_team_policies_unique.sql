-- Add unique constraint on team_policies for safe upsert
ALTER TABLE public.team_policies
  ADD CONSTRAINT team_policies_team_policy_unique UNIQUE (team_id, policy_id);
