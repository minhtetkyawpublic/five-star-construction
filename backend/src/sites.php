<?php

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/response.php';

function public_site_incharge(array $user): array
{
    $publicUser = [
        'id' => (int) $user['id'],
        'name' => $user['name'],
        'phone' => $user['phone'],
        'role' => $user['role'],
        'status' => $user['status'] ?? 'active',
    ];

    if (array_key_exists('assigned_site_id', $user)) {
        $publicUser['assigned_site_id'] = $user['assigned_site_id'] !== null ? (int) $user['assigned_site_id'] : null;
        $publicUser['assigned_site_name'] = $user['assigned_site_name'] ?? '';
    }

    return $publicUser;
}

function public_managed_user(array $user): array
{
    return [
        'id' => (int) $user['id'],
        'name' => $user['name'],
        'phone' => $user['phone'],
        'role' => $user['role'],
        'status' => $user['status'],
    ];
}

function public_site(array $site, array $incharges = []): array
{
    return [
        'id' => (int) $site['id'],
        'name' => $site['name'],
        'location' => $site['location'],
        'status' => $site['status'],
        'incharges' => array_map('public_site_incharge', $incharges),
    ];
}

function site_incharges(int $siteId): array
{
    $statement = db()->prepare(
        'SELECT users.id, users.name, users.phone, users.role
         FROM site_users
         INNER JOIN users ON users.id = site_users.user_id
         WHERE site_users.site_id = :site_id
           AND users.role = "site_incharge"
           AND users.status = "active"
         ORDER BY users.name ASC'
    );
    $statement->execute(['site_id' => $siteId]);

    return $statement->fetchAll();
}

function sites_for_user(array $user): array
{
    if ($user['role'] === 'owner') {
        $statement = db()->query('SELECT * FROM sites ORDER BY created_at DESC, id DESC');
        $sites = $statement->fetchAll();
    } else {
        $statement = db()->prepare(
            'SELECT sites.*
             FROM site_users
             INNER JOIN sites ON sites.id = site_users.site_id
             WHERE site_users.user_id = :user_id
               AND sites.status = "active"
             ORDER BY sites.created_at DESC, sites.id DESC'
        );
        $statement->execute(['user_id' => (int) $user['id']]);
        $sites = $statement->fetchAll();
    }

    return array_map(function (array $site): array {
        return public_site($site, site_incharges((int) $site['id']));
    }, $sites);
}

function find_site(int $siteId): ?array
{
    $statement = db()->prepare('SELECT * FROM sites WHERE id = :id LIMIT 1');
    $statement->execute(['id' => $siteId]);
    $site = $statement->fetch();

    return is_array($site) ? $site : null;
}

function user_can_access_site(array $user, int $siteId): bool
{
    if ($user['role'] === 'owner') {
        return true;
    }

    $statement = db()->prepare(
        'SELECT 1 FROM site_users WHERE site_id = :site_id AND user_id = :user_id LIMIT 1'
    );
    $statement->execute([
        'site_id' => $siteId,
        'user_id' => (int) $user['id'],
    ]);

    return (bool) $statement->fetchColumn();
}

function require_site_access(array $user, int $siteId): array
{
    $site = find_site($siteId);

    if ($site === null) {
        error_response('NOT_FOUND', 'Site not found.', 404);
    }

    if (!user_can_access_site($user, $siteId)) {
        error_response('FORBIDDEN', 'You do not have permission to access this site.', 403);
    }

    return $site;
}

function require_open_site(array $site): void
{
    if (($site['status'] ?? '') !== 'active') {
        error_response('SITE_CLOSED', 'This site is inactive or completed, so new records cannot be added.', 423);
    }
}

function require_open_site_access(array $user, int $siteId): array
{
    $site = require_site_access($user, $siteId);
    require_open_site($site);

    return $site;
}

function validate_site_input(array $input): array
{
    $name = trim((string) ($input['name'] ?? ''));
    $location = trim((string) ($input['location'] ?? ''));
    $status = trim((string) ($input['status'] ?? 'active'));

    if ($name === '') {
        error_response('VALIDATION_ERROR', 'Site name is required.', 422);
    }

    if (!in_array($status, ['active', 'inactive', 'completed'], true)) {
        error_response('VALIDATION_ERROR', 'Site status must be active, inactive, or completed.', 422);
    }

    return [
        'name' => $name,
        'location' => $location,
        'status' => $status,
    ];
}

function validate_site_incharge_input(array $input): array
{
    $name = trim((string) ($input['name'] ?? ''));
    $phone = trim((string) ($input['phone'] ?? ''));
    $password = (string) ($input['password'] ?? '');

    if ($name === '' || $phone === '' || $password === '') {
        error_response('VALIDATION_ERROR', 'Name, phone, and password are required.', 422);
    }

    if (strlen($password) < 8) {
        error_response('VALIDATION_ERROR', 'Password must be at least 8 characters.', 422);
    }

    return [
        'name' => $name,
        'phone' => $phone,
        'password' => $password,
    ];
}

function validate_user_input(array $input, bool $passwordRequired): array
{
    $name = trim((string) ($input['name'] ?? ''));
    $phone = trim((string) ($input['phone'] ?? ''));
    $role = trim((string) ($input['role'] ?? 'site_incharge'));
    $status = trim((string) ($input['status'] ?? 'active'));
    $password = (string) ($input['password'] ?? '');

    if ($name === '' || $phone === '') {
        error_response('VALIDATION_ERROR', 'Name and phone are required.', 422);
    }

    if (!in_array($role, ['owner', 'site_incharge'], true)) {
        error_response('VALIDATION_ERROR', 'Role must be owner or site_incharge.', 422);
    }

    if (!in_array($status, ['active', 'inactive'], true)) {
        error_response('VALIDATION_ERROR', 'Status must be active or inactive.', 422);
    }

    if ($passwordRequired && $password === '') {
        error_response('VALIDATION_ERROR', 'Password is required.', 422);
    }

    if ($password !== '' && strlen($password) < 8) {
        error_response('VALIDATION_ERROR', 'Password must be at least 8 characters.', 422);
    }

    return [
        'name' => $name,
        'phone' => $phone,
        'role' => $role,
        'status' => $status,
        'password' => $password,
    ];
}

function list_users(): array
{
    $statement = db()->query(
        'SELECT id, name, phone, role, status
         FROM users
         ORDER BY role ASC, name ASC'
    );

    return array_map('public_managed_user', $statement->fetchAll());
}

function find_user_by_id(int $userId): ?array
{
    $statement = db()->prepare('SELECT id, name, phone, role, status FROM users WHERE id = :id LIMIT 1');
    $statement->execute(['id' => $userId]);
    $user = $statement->fetch();

    return is_array($user) ? $user : null;
}

function create_user(array $input): array
{
    $data = validate_user_input($input, true);

    $statement = db()->prepare(
        'INSERT INTO users (name, phone, password_hash, role, status)
         VALUES (:name, :phone, :password_hash, :role, :status)'
    );

    try {
        $statement->execute([
            'name' => $data['name'],
            'phone' => $data['phone'],
            'password_hash' => password_hash($data['password'], PASSWORD_DEFAULT),
            'role' => $data['role'],
            'status' => $data['status'],
        ]);
    } catch (PDOException $error) {
        if ($error->getCode() === '23000') {
            error_response('DUPLICATE_PHONE', 'A user with this phone already exists.', 422);
        }

        throw $error;
    }

    return public_managed_user(find_user_by_id((int) db()->lastInsertId()));
}

function update_user(int $userId, array $input, array $currentOwner): array
{
    $existing = find_user_by_id($userId);

    if ($existing === null) {
        error_response('NOT_FOUND', 'User not found.', 404);
    }

    $data = validate_user_input($input, false);

    if ((int) $currentOwner['id'] === $userId && ($data['role'] !== 'owner' || $data['status'] !== 'active')) {
        error_response('VALIDATION_ERROR', 'You cannot remove your own active owner access.', 422);
    }

    $params = [
        'name' => $data['name'],
        'phone' => $data['phone'],
        'role' => $data['role'],
        'status' => $data['status'],
        'id' => $userId,
    ];
    $passwordSql = '';

    if ($data['password'] !== '') {
        $passwordSql = ', password_hash = :password_hash';
        $params['password_hash'] = password_hash($data['password'], PASSWORD_DEFAULT);
    }

    $statement = db()->prepare(
        "UPDATE users
         SET name = :name, phone = :phone, role = :role, status = :status{$passwordSql}
         WHERE id = :id"
    );

    try {
        $statement->execute($params);
    } catch (PDOException $error) {
        if ($error->getCode() === '23000') {
            error_response('DUPLICATE_PHONE', 'A user with this phone already exists.', 422);
        }

        throw $error;
    }

    if ($data['status'] === 'inactive') {
        $revoke = db()->prepare('UPDATE auth_tokens SET revoked_at = NOW() WHERE user_id = :user_id AND revoked_at IS NULL');
        $revoke->execute(['user_id' => $userId]);
    }

    return public_managed_user(find_user_by_id($userId));
}

function deactivate_user(int $userId, array $currentOwner): array
{
    $existing = find_user_by_id($userId);

    if ($existing === null) {
        error_response('NOT_FOUND', 'User not found.', 404);
    }

    if ((int) $currentOwner['id'] === $userId) {
        error_response('VALIDATION_ERROR', 'You cannot delete your own account.', 422);
    }

    $protectedReferences = [
        'daily_reports' => 'submitted_by',
        'worker_payments' => 'recorded_by',
        'cash_transfers' => 'created_by',
        'stock_purchases' => 'created_by',
        'stock_usage' => 'created_by',
    ];

    foreach ($protectedReferences as $table => $column) {
        $statement = db()->prepare("SELECT COUNT(*) FROM {$table} WHERE {$column} = :user_id");
        $statement->execute(['user_id' => $userId]);

        if ((int) $statement->fetchColumn() > 0) {
            error_response(
                'USER_HAS_RECORDS',
                'This user has reports or transactions, so they cannot be completely deleted without removing history.',
                422
            );
        }
    }

    $revoke = db()->prepare('UPDATE auth_tokens SET revoked_at = NOW() WHERE user_id = :user_id AND revoked_at IS NULL');
    $revoke->execute(['user_id' => $userId]);

    $delete = db()->prepare('DELETE FROM users WHERE id = :id');
    $delete->execute(['id' => $userId]);

    return public_managed_user($existing);
}

function list_site_incharge_users(): array
{
    $statement = db()->query(
        'SELECT users.id, users.name, users.phone, users.role, users.status,
                assigned_sites.id AS assigned_site_id,
                assigned_sites.name AS assigned_site_name
         FROM users
         LEFT JOIN site_users ON site_users.user_id = users.id
         LEFT JOIN sites AS assigned_sites ON assigned_sites.id = site_users.site_id
         WHERE users.role = "site_incharge" AND users.status = "active"
         ORDER BY users.name ASC'
    );

    return array_map('public_site_incharge', $statement->fetchAll());
}

function create_site_incharge_user(array $input): array
{
    $data = validate_site_incharge_input($input);

    $statement = db()->prepare(
        'INSERT INTO users (name, phone, password_hash, role, status)
         VALUES (:name, :phone, :password_hash, "site_incharge", "active")'
    );

    try {
        $statement->execute([
            'name' => $data['name'],
            'phone' => $data['phone'],
            'password_hash' => password_hash($data['password'], PASSWORD_DEFAULT),
        ]);
    } catch (PDOException $error) {
        if ($error->getCode() === '23000') {
            error_response('DUPLICATE_PHONE', 'A user with this phone already exists.', 422);
        }

        throw $error;
    }

    return [
        'id' => (int) db()->lastInsertId(),
        'name' => $data['name'],
        'phone' => $data['phone'],
        'role' => 'site_incharge',
    ];
}

function assign_site_incharges(int $siteId, array $userIds): array
{
    $userIds = array_values(array_unique(array_map('intval', $userIds)));
    $userIds = array_values(array_filter($userIds, function (int $userId): bool {
        return $userId > 0;
    }));

    if (count($userIds) > 0) {
        $placeholders = implode(',', array_fill(0, count($userIds), '?'));
        $check = db()->prepare(
            "SELECT id FROM users WHERE id IN ({$placeholders}) AND role = 'site_incharge' AND status = 'active'"
        );
        $check->execute($userIds);
        $validIds = array_map('intval', $check->fetchAll(PDO::FETCH_COLUMN));

        if (count($validIds) !== count($userIds)) {
            error_response('VALIDATION_ERROR', 'Assigned users must be active site in-charges.', 422);
        }

        $assignmentCheck = db()->prepare(
            "SELECT user_id FROM site_users
             WHERE user_id IN ({$placeholders}) AND site_id <> ?"
        );
        $assignmentCheck->execute([...$userIds, $siteId]);
        $alreadyAssignedIds = array_map('intval', $assignmentCheck->fetchAll(PDO::FETCH_COLUMN));

        if (count($alreadyAssignedIds) > 0) {
            error_response('VALIDATION_ERROR', 'A site in-charge can only be assigned to one site.', 422);
        }
    }

    db()->beginTransaction();

    try {
        $delete = db()->prepare('DELETE FROM site_users WHERE site_id = :site_id');
        $delete->execute(['site_id' => $siteId]);

        if (count($userIds) > 0) {
            $insert = db()->prepare(
                'INSERT INTO site_users (site_id, user_id) VALUES (:site_id, :user_id)'
            );

            foreach ($userIds as $userId) {
                $insert->execute([
                    'site_id' => $siteId,
                    'user_id' => $userId,
                ]);
            }
        }

        db()->commit();
    } catch (Throwable $error) {
        if (db()->inTransaction()) {
            db()->rollBack();
        }

        throw $error;
    }

    $site = find_site($siteId);

    return public_site($site, site_incharges($siteId));
}

function delete_site(int $siteId): array
{
    $site = find_site($siteId);

    if ($site === null) {
        error_response('NOT_FOUND', 'Site not found.', 404);
    }

    $statement = db()->prepare('DELETE FROM sites WHERE id = :id');
    $statement->execute(['id' => $siteId]);

    return [
        'id' => $siteId,
        'name' => $site['name'],
    ];
}
