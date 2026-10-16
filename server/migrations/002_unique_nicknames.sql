-- Existing names (including their discriminators), accounts, and all progress remain intact.
-- Rollback in intent: drop this index before rolling the application back to discriminator registration.
CREATE UNIQUE INDEX users_username_normalized_unique ON users (lower(normalize(username, NFKC)));
