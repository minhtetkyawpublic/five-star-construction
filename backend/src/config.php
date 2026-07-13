<?php

function load_env(string $path): array
{
    if (!file_exists($path)) {
        return [];
    }

    $values = parse_ini_file($path, false, INI_SCANNER_RAW);

    return is_array($values) ? $values : [];
}

function config(string $key, $default = null)
{
    static $env = null;

    if ($env === null) {
        $env = load_env(__DIR__ . '/../.env');
    }

    return $env[$key] ?? $default;
}
