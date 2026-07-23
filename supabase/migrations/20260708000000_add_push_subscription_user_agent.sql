-- Record the subscribing browser's user agent so device-specific push
-- delivery issues (iOS Safari vs Android Chrome vs desktop) can be
-- diagnosed directly from the push_subscriptions table.
ALTER TABLE push_subscriptions ADD COLUMN user_agent text;
