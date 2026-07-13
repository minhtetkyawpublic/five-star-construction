<?php

function json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function success_response($data = null, ?string $message = null, int $status = 200): void
{
    $payload = [
        'success' => true,
        'data' => $data ?? new stdClass(),
    ];

    if ($message !== null) {
        $payload['message'] = $message;
    }

    json_response($payload, $status);
}

function error_response(string $code, string $message, int $status = 400): void
{
    json_response([
        'success' => false,
        'error' => [
            'code' => $code,
            'message' => $message,
        ],
    ], $status);
}
