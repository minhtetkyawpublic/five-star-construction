<?php

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/response.php';
require_once __DIR__ . '/sites.php';

function public_worker_site(array $site): array
{
    return [
        'id' => (int) $site['id'],
        'name' => $site['name'],
        'location' => $site['location'],
        'status' => $site['status'],
    ];
}

function worker_sites(int $workerId): array
{
    $statement = db()->prepare(
        'SELECT sites.id, sites.name, sites.location, sites.status
         FROM worker_sites
         INNER JOIN sites ON sites.id = worker_sites.site_id
         WHERE worker_sites.worker_id = :worker_id
         ORDER BY sites.name ASC'
    );
    $statement->execute(['worker_id' => $workerId]);

    return $statement->fetchAll();
}

function visible_worker_sites(array $user, int $workerId): array
{
    if ($user['role'] === 'owner') {
        return worker_sites($workerId);
    }

    $statement = db()->prepare(
        'SELECT sites.id, sites.name, sites.location, sites.status
         FROM worker_sites
         INNER JOIN sites ON sites.id = worker_sites.site_id
         INNER JOIN site_users ON site_users.site_id = sites.id
         WHERE worker_sites.worker_id = :worker_id
           AND site_users.user_id = :user_id
           AND sites.status = "active"
         ORDER BY sites.name ASC'
    );
    $statement->execute([
        'worker_id' => $workerId,
        'user_id' => (int) $user['id'],
    ]);

    return $statement->fetchAll();
}

function public_worker(array $worker, array $sites = []): array
{
    return [
        'id' => (int) $worker['id'],
        'name' => $worker['name'],
        'phone' => $worker['phone'],
        'daily_wage' => (float) $worker['daily_wage'],
        'status' => $worker['status'],
        'sites' => array_map('public_worker_site', $sites),
    ];
}

function find_worker(int $workerId): ?array
{
    $statement = db()->prepare('SELECT * FROM workers WHERE id = :id LIMIT 1');
    $statement->execute(['id' => $workerId]);
    $worker = $statement->fetch();

    return is_array($worker) ? $worker : null;
}

function workers_for_user(array $user): array
{
    if ($user['role'] === 'owner') {
        $statement = db()->query('SELECT * FROM workers ORDER BY created_at DESC, id DESC');
    } else {
        $statement = db()->prepare(
            'SELECT DISTINCT workers.*
             FROM workers
             INNER JOIN worker_sites ON worker_sites.worker_id = workers.id
             INNER JOIN site_users ON site_users.site_id = worker_sites.site_id
             INNER JOIN sites ON sites.id = worker_sites.site_id
             WHERE site_users.user_id = :user_id
               AND sites.status = "active"
             ORDER BY workers.name ASC'
        );
        $statement->execute(['user_id' => (int) $user['id']]);
    }

    return array_map(function (array $worker) use ($user): array {
        return public_worker($worker, visible_worker_sites($user, (int) $worker['id']));
    }, $statement->fetchAll());
}

function workers_for_site(array $user, int $siteId): array
{
    $site = require_site_access($user, $siteId);

    if ($user['role'] !== 'owner' && $site['status'] !== 'active') {
        return [];
    }

    $statement = db()->prepare(
        'SELECT workers.*
         FROM worker_sites
         INNER JOIN workers ON workers.id = worker_sites.worker_id
         WHERE worker_sites.site_id = :site_id
         ORDER BY workers.name ASC'
    );
    $statement->execute(['site_id' => $siteId]);

    return array_map(function (array $worker) use ($user): array {
        return public_worker($worker, visible_worker_sites($user, (int) $worker['id']));
    }, $statement->fetchAll());
}

function user_can_access_worker(array $user, int $workerId): bool
{
    if ($user['role'] === 'owner') {
        return true;
    }

    $statement = db()->prepare(
        'SELECT 1
         FROM worker_sites
         INNER JOIN site_users ON site_users.site_id = worker_sites.site_id
         INNER JOIN sites ON sites.id = worker_sites.site_id
         WHERE worker_sites.worker_id = :worker_id
           AND site_users.user_id = :user_id
           AND sites.status = "active"
         LIMIT 1'
    );
    $statement->execute([
        'worker_id' => $workerId,
        'user_id' => (int) $user['id'],
    ]);

    return (bool) $statement->fetchColumn();
}

function require_worker_access(array $user, int $workerId): array
{
    $worker = find_worker($workerId);

    if ($worker === null) {
        error_response('NOT_FOUND', 'Worker not found.', 404);
    }

    if (!user_can_access_worker($user, $workerId)) {
        error_response('FORBIDDEN', 'You do not have permission to access this worker.', 403);
    }

    return $worker;
}

function validate_worker_input(array $input, bool $includeWage = true): array
{
    $name = trim((string) ($input['name'] ?? ''));
    $phone = trim((string) ($input['phone'] ?? ''));
    $dailyWage = (float) ($input['daily_wage'] ?? 0);
    $status = trim((string) ($input['status'] ?? 'active'));

    if ($name === '') {
        error_response('VALIDATION_ERROR', 'Worker name is required.', 422);
    }

    if ($includeWage && $dailyWage < 0) {
        error_response('VALIDATION_ERROR', 'Daily wage cannot be negative.', 422);
    }

    if ($includeWage && !in_array($status, ['active', 'inactive'], true)) {
        error_response('VALIDATION_ERROR', 'Worker status must be active or inactive.', 422);
    }

    $data = [
        'name' => $name,
        'phone' => $phone,
    ];

    if ($includeWage) {
        $data['daily_wage'] = number_format($dailyWage, 2, '.', '');
        $data['status'] = $status;
    }

    return $data;
}

function create_worker_for_user(array $user, array $input): array
{
    $data = validate_worker_input($input, $user['role'] === 'owner');
    $siteId = isset($input['site_id']) && $input['site_id'] !== '' ? (int) $input['site_id'] : null;

    if ($user['role'] === 'site_incharge') {
        if ($siteId === null || $siteId <= 0) {
            error_response('VALIDATION_ERROR', 'Site is required when creating a worker.', 422);
        }

        require_open_site_access($user, $siteId);
    }

    db()->beginTransaction();

    try {
        if ($user['role'] === 'owner') {
            $statement = db()->prepare(
                'INSERT INTO workers (name, phone, daily_wage, status)
                 VALUES (:name, :phone, :daily_wage, :status)'
            );
            $statement->execute($data);
        } else {
            $statement = db()->prepare(
                'INSERT INTO workers (name, phone, daily_wage, status)
                 VALUES (:name, :phone, 0.00, "active")'
            );
            $statement->execute($data);
        }
        $workerId = (int) db()->lastInsertId();

        if ($user['role'] === 'site_incharge') {
            $assign = db()->prepare(
                'INSERT INTO worker_sites (worker_id, site_id) VALUES (:worker_id, :site_id)'
            );
            $assign->execute([
                'worker_id' => $workerId,
                'site_id' => $siteId,
            ]);
        }

        db()->commit();
    } catch (Throwable $error) {
        if (db()->inTransaction()) {
            db()->rollBack();
        }

        throw $error;
    }

    $worker = find_worker($workerId);

    return public_worker($worker, visible_worker_sites($user, $workerId));
}

function update_worker_for_user(array $user, int $workerId, array $input): array
{
    if (find_worker($workerId) === null) {
        error_response('NOT_FOUND', 'Worker not found.', 404);
    }

    if ($user['role'] !== 'owner' && !user_can_access_worker($user, $workerId)) {
        error_response('FORBIDDEN', 'You do not have permission to update this worker.', 403);
    }

    $data = validate_worker_input($input, $user['role'] === 'owner');

    if ($user['role'] === 'owner') {
        $statement = db()->prepare(
            'UPDATE workers
             SET name = :name, phone = :phone, daily_wage = :daily_wage, status = :status
             WHERE id = :id'
        );
        $statement->execute([
            'name' => $data['name'],
            'phone' => $data['phone'],
            'daily_wage' => $data['daily_wage'],
            'status' => $data['status'],
            'id' => $workerId,
        ]);
    } else {
        $statement = db()->prepare(
            'UPDATE workers
             SET name = :name, phone = :phone
             WHERE id = :id'
        );
        $statement->execute([
            'name' => $data['name'],
            'phone' => $data['phone'],
            'id' => $workerId,
        ]);
    }

    $worker = find_worker($workerId);

    return public_worker($worker, visible_worker_sites($user, $workerId));
}

function delete_worker(int $workerId): array
{
    $worker = find_worker($workerId);

    if ($worker === null) {
        error_response('NOT_FOUND', 'Worker not found.', 404);
    }

    $statement = db()->prepare('DELETE FROM workers WHERE id = :id');
    $statement->execute(['id' => $workerId]);

    return [
        'id' => $workerId,
        'name' => $worker['name'],
    ];
}

function assign_worker_sites(int $workerId, array $siteIds): array
{
    $siteIds = array_values(array_unique(array_map('intval', $siteIds)));
    $siteIds = array_values(array_filter($siteIds, function (int $siteId): bool {
        return $siteId > 0;
    }));

    if (count($siteIds) > 0) {
        $placeholders = implode(',', array_fill(0, count($siteIds), '?'));
        $check = db()->prepare("SELECT id FROM sites WHERE id IN ({$placeholders})");
        $check->execute($siteIds);
        $validIds = array_map('intval', $check->fetchAll(PDO::FETCH_COLUMN));

        if (count($validIds) !== count($siteIds)) {
            error_response('VALIDATION_ERROR', 'Assigned sites must exist.', 422);
        }
    }

    db()->beginTransaction();

    try {
        $delete = db()->prepare('DELETE FROM worker_sites WHERE worker_id = :worker_id');
        $delete->execute(['worker_id' => $workerId]);

        if (count($siteIds) > 0) {
            $insert = db()->prepare(
                'INSERT INTO worker_sites (worker_id, site_id) VALUES (:worker_id, :site_id)'
            );

            foreach ($siteIds as $siteId) {
                $insert->execute([
                    'worker_id' => $workerId,
                    'site_id' => $siteId,
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

    $worker = find_worker($workerId);

    return public_worker($worker, worker_sites($workerId));
}
