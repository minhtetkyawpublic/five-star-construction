<?php

require_once __DIR__ . '/database.php';
require_once __DIR__ . '/request.php';
require_once __DIR__ . '/response.php';

function public_user(array $user): array
{
    return [
        'id' => (int) $user['id'],
        'name' => $user['name'],
        'phone' => $user['phone'],
        'role' => $user['role'],
    ];
}

function find_active_user_by_phone(string $phone): ?array
{
    $statement = db()->prepare('SELECT * FROM users WHERE phone = :phone AND status = "active" LIMIT 1');
    $statement->execute(['phone' => $phone]);
    $user = $statement->fetch();

    return is_array($user) ? $user : null;
}

function issue_token(int $userId): string
{
    $token = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $token);
    $expiresAt = (new DateTimeImmutable('+30 days'))->format('Y-m-d H:i:s');

    $statement = db()->prepare(
        'INSERT INTO auth_tokens (user_id, token_hash, expires_at) VALUES (:user_id, :token_hash, :expires_at)'
    );
    $statement->execute([
        'user_id' => $userId,
        'token_hash' => $tokenHash,
        'expires_at' => $expiresAt,
    ]);

    return $token;
}

function current_token_hash(): ?string
{
    $token = bearer_token();

    return $token !== null ? hash('sha256', $token) : null;
}

function current_user(): ?array
{
    $tokenHash = current_token_hash();

    if ($tokenHash === null) {
        return null;
    }

    $statement = db()->prepare(
        'SELECT users.*
         FROM auth_tokens
         INNER JOIN users ON users.id = auth_tokens.user_id
         WHERE auth_tokens.token_hash = :token_hash
           AND auth_tokens.revoked_at IS NULL
           AND auth_tokens.expires_at > NOW()
           AND users.status = "active"
         LIMIT 1'
    );
    $statement->execute(['token_hash' => $tokenHash]);
    $user = $statement->fetch();

    return is_array($user) ? $user : null;
}

function require_auth(): array
{
    $user = current_user();

    if ($user === null) {
        error_response('AUTH_REQUIRED', 'Authentication is required.', 401);
    }

    return $user;
}

function require_role(array $roles): array
{
    $user = require_auth();

    if (!in_array($user['role'], $roles, true)) {
        error_response('FORBIDDEN', 'You do not have permission to access this resource.', 403);
    }

    return $user;
}

function revoke_current_token(): void
{
    $tokenHash = current_token_hash();

    if ($tokenHash === null) {
        return;
    }

    $statement = db()->prepare(
        'UPDATE auth_tokens SET revoked_at = NOW() WHERE token_hash = :token_hash AND revoked_at IS NULL'
    );
    $statement->execute(['token_hash' => $tokenHash]);
}
