<?php

require_once __DIR__ . '/database.php';

function migrations_database_name(): string
{
    $database = (string) database_config()['database'];

    if ($database === '') {
        throw new RuntimeException('DB_DATABASE must not be empty.');
    }

    return $database;
}

function quote_mysql_identifier(string $identifier): string
{
    return '`' . str_replace('`', '``', $identifier) . '`';
}

function ensure_database_exists(PDO $server): void
{
    $config = database_config();
    $database = quote_mysql_identifier(migrations_database_name());
    $charset = preg_replace('/[^a-zA-Z0-9_]/', '', (string) $config['charset']);

    if ($charset === '') {
        $charset = 'utf8mb4';
    }

    $server->exec("CREATE DATABASE IF NOT EXISTS {$database} CHARACTER SET {$charset} COLLATE {$charset}_unicode_ci");
}

function ensure_migrations_table(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            migration VARCHAR(255) NOT NULL PRIMARY KEY,
            applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function migration_files(): array
{
    $databaseDir = realpath(__DIR__ . '/../database');

    if ($databaseDir === false) {
        throw new RuntimeException('Database directory not found.');
    }

    $files = [];
    $baseline = $databaseDir . DIRECTORY_SEPARATOR . 'schema.sql';

    if (is_file($baseline)) {
        $files[] = [
            'name' => '00000000000000_schema.sql',
            'path' => $baseline,
        ];
    }

    $migrationsDir = $databaseDir . DIRECTORY_SEPARATOR . 'migrations';
    $migrationPaths = is_dir($migrationsDir) ? glob($migrationsDir . DIRECTORY_SEPARATOR . '*.sql') : [];

    if ($migrationPaths === false) {
        $migrationPaths = [];
    }

    sort($migrationPaths, SORT_STRING);

    foreach ($migrationPaths as $path) {
        $files[] = [
            'name' => basename($path),
            'path' => $path,
        ];
    }

    return $files;
}

function applied_migrations(PDO $pdo): array
{
    $rows = $pdo->query('SELECT migration FROM schema_migrations ORDER BY migration')->fetchAll(PDO::FETCH_COLUMN);

    return array_fill_keys($rows ?: [], true);
}

function split_sql_statements(string $sql): array
{
    $statements = [];
    $statement = '';
    $length = strlen($sql);
    $quote = null;
    $lineComment = false;
    $blockComment = false;

    for ($i = 0; $i < $length; $i++) {
        $char = $sql[$i];
        $next = $i + 1 < $length ? $sql[$i + 1] : '';

        if ($lineComment) {
            $statement .= $char;
            if ($char === "\n") {
                $lineComment = false;
            }
            continue;
        }

        if ($blockComment) {
            $statement .= $char;
            if ($char === '*' && $next === '/') {
                $statement .= $next;
                $i++;
                $blockComment = false;
            }
            continue;
        }

        if ($quote !== null) {
            $statement .= $char;

            if ($char === '\\' && $next !== '') {
                $statement .= $next;
                $i++;
                continue;
            }

            if ($char === $quote) {
                $quote = null;
            }

            continue;
        }

        if (($char === '-' && $next === '-') || $char === '#') {
            $lineComment = true;
            $statement .= $char;

            if ($char === '-') {
                $statement .= $next;
                $i++;
            }

            continue;
        }

        if ($char === '/' && $next === '*') {
            $blockComment = true;
            $statement .= $char . $next;
            $i++;
            continue;
        }

        if ($char === '\'' || $char === '"') {
            $quote = $char;
            $statement .= $char;
            continue;
        }

        if ($char === ';') {
            $trimmed = trim($statement);

            if ($trimmed !== '') {
                $statements[] = $trimmed;
            }

            $statement = '';
            continue;
        }

        $statement .= $char;
    }

    $trimmed = trim($statement);

    if ($trimmed !== '') {
        $statements[] = $trimmed;
    }

    return $statements;
}

function run_sql_file(PDO $pdo, string $path): int
{
    $sql = file_get_contents($path);

    if ($sql === false) {
        throw new RuntimeException("Unable to read migration file: {$path}");
    }

    $count = 0;

    foreach (split_sql_statements($sql) as $statement) {
        $pdo->exec($statement);
        $count++;
    }

    return $count;
}

function migration_status(): array
{
    $server = db_server();
    ensure_database_exists($server);
    $pdo = db();
    ensure_migrations_table($pdo);
    $applied = applied_migrations($pdo);

    return array_map(
        fn (array $file): array => [
            'migration' => $file['name'],
            'path' => $file['path'],
            'applied' => isset($applied[$file['name']]),
        ],
        migration_files()
    );
}

function run_migrations(bool $pretend = false): array
{
    $server = db_server();
    ensure_database_exists($server);
    $pdo = db();
    ensure_migrations_table($pdo);
    $applied = applied_migrations($pdo);
    $results = [];

    foreach (migration_files() as $file) {
        if (isset($applied[$file['name']])) {
            $results[] = [
                'migration' => $file['name'],
                'status' => 'skipped',
                'statements' => 0,
            ];
            continue;
        }

        if ($pretend) {
            $results[] = [
                'migration' => $file['name'],
                'status' => 'pending',
                'statements' => count(split_sql_statements((string) file_get_contents($file['path']))),
            ];
            continue;
        }

        $statementCount = run_sql_file($pdo, $file['path']);
        $record = $pdo->prepare('INSERT INTO schema_migrations (migration) VALUES (:migration)');
        $record->execute(['migration' => $file['name']]);

        $results[] = [
            'migration' => $file['name'],
            'status' => 'applied',
            'statements' => $statementCount,
        ];
    }

    return $results;
}
