<?php

require_once __DIR__ . '/src/migrations.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit('Not found');
}

function migration_cli_usage(): void
{
    echo "Usage:\n";
    echo "  php server/migrate.php           Run pending migrations\n";
    echo "  php server/migrate.php --status  Show migration status\n";
    echo "  php server/migrate.php --pretend Show pending migrations without applying schema files\n";
}

$args = array_slice($argv, 1);
$showStatus = in_array('--status', $args, true);
$pretend = in_array('--pretend', $args, true);
$help = in_array('--help', $args, true) || in_array('-h', $args, true);
$unknown = array_values(array_filter(
    $args,
    fn (string $arg): bool => !in_array($arg, ['--status', '--pretend', '--help', '-h'], true)
));

if ($help) {
    migration_cli_usage();
    exit(0);
}

if ($unknown !== []) {
    fwrite(STDERR, "Unknown option: {$unknown[0]}\n\n");
    migration_cli_usage();
    exit(1);
}

if ($showStatus && $pretend) {
    fwrite(STDERR, "Use either --status or --pretend, not both.\n\n");
    migration_cli_usage();
    exit(1);
}

try {
    if ($showStatus) {
        foreach (migration_status() as $migration) {
            $mark = $migration['applied'] ? '[x]' : '[ ]';
            echo "{$mark} {$migration['migration']}\n";
        }

        exit(0);
    }

    $results = run_migrations($pretend);
    $ran = 0;

    foreach ($results as $result) {
        if ($result['status'] === 'skipped') {
            echo "- {$result['migration']} already applied\n";
            continue;
        }

        $ran++;
        $verb = $result['status'] === 'pending' ? 'would run' : 'applied';
        echo "- {$result['migration']} {$verb} ({$result['statements']} statements)\n";
    }

    if ($ran === 0) {
        echo "Nothing to migrate.\n";
    }
} catch (Throwable $error) {
    fwrite(STDERR, "Migration failed: {$error->getMessage()}\n");
    exit(1);
}
