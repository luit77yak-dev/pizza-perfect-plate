# Reproducing the Neroxa order-storage migration tests

The three migrations in PR #33 depend on shared Neroxa Master/storefront objects that are not created by this repository's migration history. The fixture at `supabase/tests/fixtures/neroxa_shared_schema_baseline.sql` makes that dependency explicit and repeatable for isolated SQL tests.

## Scope and safety

- This is a **test fixture**, not a production migration.
- It defines only the minimum shared-schema contract needed by the three order migrations; it is not a full export of the Neroxa Master schema and does not make a whole-repository clean `supabase db reset` valid.
- Run only against a disposable local Supabase database or the existing isolated test project. Never run it against the production Neroxa Master project.
- The seed/test data must be fictitious. No production orders are needed.

## Apply the fixture and migrations to a clean local Supabase database

1. Start the local Supabase stack using the project's usual local setup.
2. Apply the fixture to the local database using the local Postgres connection string, for example:

   ```sh
   psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/fixtures/neroxa_shared_schema_baseline.sql
   ```

3. Apply the three PR migrations in timestamp order, against that same local database:

   ```sh
   psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261009195000_create_neroxa_order_storage.sql
   psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261009200000_bind_public_orders_to_verified_domain.sql
   psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261010120000_unify_neroxa_order_storage.sql
   ```

4. Run the fictitious checkout, idempotency, tracking, append-items, status-transition, and authorization scenarios described in PR #33. Keep the data isolated from production.

The fixture is idempotent for its own tables/functions, but the migration files are intended to be applied once to a clean test database. This targeted procedure validates the order-migration slice only; it deliberately does not pretend that the entire repository migration chain is self-contained until the shared Neroxa base schema has an authoritative migration source.
