-- Draft bids table
CREATE TABLE draft_bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  rider_id uuid NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount >= 5000 AND amount % 500 = 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, rider_id)
);

-- RLS: team members can manage their own drafts
ALTER TABLE draft_bids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can read their drafts"
  ON draft_bids FOR SELECT
  USING (
    team_id IN (
      SELECT t.id FROM teams t
      JOIN league_members lm ON lm.team_id = t.id
      WHERE lm.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can insert their drafts"
  ON draft_bids FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT t.id FROM teams t
      JOIN league_members lm ON lm.team_id = t.id
      WHERE lm.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can update their drafts"
  ON draft_bids FOR UPDATE
  USING (
    team_id IN (
      SELECT t.id FROM teams t
      JOIN league_members lm ON lm.team_id = t.id
      WHERE lm.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can delete their drafts"
  ON draft_bids FOR DELETE
  USING (
    team_id IN (
      SELECT t.id FROM teams t
      JOIN league_members lm ON lm.team_id = t.id
      WHERE lm.user_id = auth.uid()
    )
  );

-- Index for fast lookups
CREATE INDEX idx_draft_bids_team ON draft_bids(team_id);
CREATE INDEX idx_draft_bids_league ON draft_bids(league_id);
