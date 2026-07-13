<?php

require_once __DIR__ . '/config.php';

function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $host = config('DB_HOST', '127.0.0.1');
    $port = config('DB_PORT', '3306');
    $database = config('DB_DATABASE', 'five_star_construction');
    $charset = config('DB_CHARSET', 'utf8mb4');
    $username = config('DB_USERNAME', 'root');
    $password = config('DB_PASSWORD', '');

    $dsn = "mysql:host={$host};port={$port};dbname={$database};charset={$charset}";

    $pdo = new PDO($dsn, $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

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
