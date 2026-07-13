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
        $env = load_env(__DIR__ . '/../../.env');
    }

    return $env[$key] ?? $default;
}

function config_list(string $key, array $default = []): array
{
    $value = config($key);

    if ($value === null || $value === '') {
        return $default;
    }

    if (is_array($value)) {
        return $value;
    }

    return array_values(array_filter(
        array_map('trim', explode(',', (string) $value)),
        fn (string $item): bool => $item !== ''
    ));
}

function config_bool(string $key, bool $default = false): bool
{
    $value = config($key);

    if ($value === null || $value === '') {
        return $default;
    }

    return in_array(strtolower((string) $value), ['1', 'true', 'yes', 'on'], true);
}
