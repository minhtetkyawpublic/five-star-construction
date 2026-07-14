<?php

require_once __DIR__ . '/config.php';

function database_config(): array
{
    return [
        'host' => config('DB_HOST', '127.0.0.1'),
        'port' => config('DB_PORT', '3306'),
        'database' => config('DB_DATABASE', 'five_star_construction'),
        'charset' => config('DB_CHARSET', 'utf8mb4'),
        'username' => config('DB_USERNAME', 'root'),
        'password' => config('DB_PASSWORD', ''),
    ];
}

function database_pdo_options(): array
{
    return [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];
}

function db_server(): PDO
{
    $config = database_config();
    $dsn = "mysql:host={$config['host']};port={$config['port']};charset={$config['charset']}";

    return new PDO($dsn, $config['username'], $config['password'], database_pdo_options());
}

function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $config = database_config();

    $dsn = "mysql:host={$config['host']};port={$config['port']};dbname={$config['database']};charset={$config['charset']}";

    $pdo = new PDO($dsn, $config['username'], $config['password'], database_pdo_options());

    return $pdo;
}

function database_is_connected(): bool
{
    try {
        db()->query('SELECT 1');
        return true;
    } catch (Throwable $error) {
        return false;
    }
}
