ALTER TABLE rider_xp_daily
  ADD COLUMN role_mult numeric(3,1) NOT NULL DEFAULT 1.0,
  ADD COLUMN classif_bonus numeric(6,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN rider_xp_daily.role_mult IS 'GT role multiplier applied (1.0/1.5/2.0)';
COMMENT ON COLUMN rider_xp_daily.classif_bonus IS 'Daily classification bonus points (GC/Points/KOM)';
