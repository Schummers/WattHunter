-- GT Goal Completions — V1b sponsor unique bonuses
-- Tracks which T4 sponsor goals have been achieved per team per Grand Tour.

CREATE TABLE public.sponsor_goal_completions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id        uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  sponsor_id     uuid NOT NULL REFERENCES public.sponsors(id) ON DELETE RESTRICT,
  goal_index     int NOT NULL,
  goal_label     text NOT NULL,
  race_slug      text NOT NULL,
  stage_slug     text,
  rider_id       uuid REFERENCES public.riders(id) ON DELETE SET NULL,
  base_reward    int NOT NULL,
  multiplier     numeric(4,2) NOT NULL DEFAULT 1.0,
  final_reward   int NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_goal_completions_dedup
  ON public.sponsor_goal_completions (team_id, sponsor_id, goal_index, race_slug);

ALTER TABLE public.sponsor_goal_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Goal completions readable by all"
  ON public.sponsor_goal_completions FOR SELECT USING (true);

-- Update treasury_log type constraint to accept gt_goal_bonus
ALTER TABLE public.treasury_log DROP CONSTRAINT IF EXISTS treasury_log_type_check;
ALTER TABLE public.treasury_log ADD CONSTRAINT treasury_log_type_check CHECK (
  type = ANY (ARRAY[
    'starting_fund', 'auction_purchase', 'monthly_salary', 'rider_revenue',
    'sponsor_payment', 'bankruptcy_release', 'monthly_bonus', 'phase_salary',
    'phase_sponsor_base', 'sponsor_bonus', 'release_fee', 'transfer_bonus',
    'payday_salary', 'gt_dnf_refund', 'gt_emergency_purchase', 'gt_goal_bonus'
  ])
);
