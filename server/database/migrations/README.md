# Database migrations

Add future schema changes here as timestamped SQL files:

```text
YYYYMMDDHHMMSS_short_description.sql
```

Example:

```text
20260713231500_add_project_budget_to_sites.sql
```

Run pending migrations from the project root:

```bash
php server/migrate.php
```

The baseline schema in `server/database/schema.sql` is tracked as the first migration by the runner.
