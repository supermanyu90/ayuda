-- "Touch grass" metric: seconds the volunteer spent on screen planning this action,
-- measured on-device (visible-tab time only). Compared against planned/completed minutes.
ALTER TABLE volunteer_actions
  ADD COLUMN screen_seconds INT CHECK (screen_seconds IS NULL OR screen_seconds BETWEEN 0 AND 86400);
