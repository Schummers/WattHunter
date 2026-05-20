-- Add 'sponsor_bonus_revert' to treasury_log type check constraint.
-- Used when a GT sponsor bonus is reverted because the rider was not
-- in the GT squad at race time (temporal squad check fix).

ALTER TABLE public.treasury_log DROP CONSTRAINT IF EXISTS treasury_log_type_check;
ALTER TABLE public.treasury_log ADD CONSTRAINT treasury_log_type_check CHECK (
  type = ANY (ARRAY[
    'starting_fund', 'auction_purchase', 'monthly_salary', 'rider_revenue',
    'sponsor_payment', 'bankruptcy_release', 'monthly_bonus', 'phase_salary',
    'phase_sponsor_base', 'sponsor_bonus', 'release_fee', 'transfer_bonus',
    'payday_salary', 'gt_dnf_refund', 'gt_emergency_purchase', 'gt_goal_bonus',
    'sponsor_bonus_revert'
  ])
);
