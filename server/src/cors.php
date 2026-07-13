<?php

require_once __DIR__ . '/config.php';

function cors_clean_origin(string $origin): string
{
    $origin = trim($origin);

    if ($origin === '' || preg_match('/[\r\n]/', $origin)) {
        return '';
    }

    return $origin;
}

function cors_origin_allowed(string $origin, array $allowedOrigins): bool
{
    if (in_array('*', $allowedOrigins, true)) {
        return true;
    }

    return in_array($origin, $allowedOrigins, true);
}

function apply_cors_headers(): void
{
    $allowedOrigins = config_list('CORS_ALLOWED_ORIGINS', ['*']);
    $requestOrigin = cors_clean_origin((string) ($_SERVER['HTTP_ORIGIN'] ?? ''));
    $allowCredentials = config_bool('CORS_ALLOW_CREDENTIALS', false);

    if (in_array('*', $allowedOrigins, true) && $allowCredentials && $requestOrigin !== '') {
        header("Access-Control-Allow-Origin: {$requestOrigin}");
        header('Vary: Origin', false);
    } elseif (in_array('*', $allowedOrigins, true)) {
        header('Access-Control-Allow-Origin: *');
    } elseif ($requestOrigin !== '' && cors_origin_allowed($requestOrigin, $allowedOrigins)) {
        header("Access-Control-Allow-Origin: {$requestOrigin}");
        header('Vary: Origin', false);
    }

    header('Access-Control-Allow-Headers: ' . implode(', ', config_list('CORS_ALLOWED_HEADERS', ['Content-Type', 'Authorization'])));
    header('Access-Control-Allow-Methods: ' . implode(', ', config_list('CORS_ALLOWED_METHODS', ['GET', 'POST', 'OPTIONS'])));

    if ($allowCredentials) {
        header('Access-Control-Allow-Credentials: true');
    }

    $maxAge = (int) config('CORS_MAX_AGE', 0);

    if ($maxAge > 0) {
        header("Access-Control-Max-Age: {$maxAge}");
    }
}
