<?php

require_once __DIR__ . '/attendance.php';

function normalize_cutoff_time(string $time): string
{
    if (!preg_match('/^[0-2][0-9]:[0-5][0-9](:[0-5][0-9])?$/', $time)) {
        error_response('VALIDATION_ERROR', 'Cutoff time must use HH:MM format.', 422);
    }

    return strlen($time) === 5 ? $time . ':00' : $time;
}

function normalize_lock_type(string $type): string
{
    if (!in_array($type, ['worker', 'stock'], true)) {
        error_response('VALIDATION_ERROR', 'Lock type must be worker or stock.', 422);
    }

    return $type;
}

function report_lock_setting(int $siteId, string $type): array
{
    $type = normalize_lock_type($type);
    $statement = db()->prepare(
        'SELECT worker_lock_enabled, worker_cutoff_time, stock_lock_enabled, stock_cutoff_time
         FROM report_settings WHERE site_id = :site_id
         UNION ALL
         SELECT worker_lock_enabled, worker_cutoff_time, stock_lock_enabled, stock_cutoff_time
         FROM report_settings WHERE site_id IS NULL LIMIT 1'
    );
    $statement->execute(['site_id' => $siteId]);
    $setting = $statement->fetch();

    if (!is_array($setting)) {
        return [
            'enabled' => true,
            'cutoff_time' => '21:00:00',
        ];
    }

    return $type === 'worker'
        ? ['enabled' => (bool) $setting['worker_lock_enabled'], 'cutoff_time' => (string) $setting['worker_cutoff_time']]
        : ['enabled' => (bool) $setting['stock_lock_enabled'], 'cutoff_time' => (string) $setting['stock_cutoff_time']];
}

function report_cutoff_time(int $siteId): string
{
    return report_lock_setting($siteId, 'worker')['cutoff_time'];
}

function report_is_locked(int $siteId, string $date, string $type = 'worker'): bool
{
    $setting = report_lock_setting($siteId, $type);

    if (!$setting['enabled']) {
        return false;
    }

    $cutoffDateTime = new DateTimeImmutable($date . ' ' . $setting['cutoff_time']);
    return new DateTimeImmutable('now') > $cutoffDateTime;
}

function require_unlocked_report(int $siteId, string $date, string $type): void
{
    if (report_is_locked($siteId, $date, $type)) {
        $message = $type === 'worker'
            ? 'Worker report is locked after the cutoff time.'
            : 'Cash/stock report is locked after the cutoff time.';
        error_response('REPORT_LOCKED', $message, 423);
    }
}

function has_approved_edit_request(int $reportId, int $userId): bool
{
    $statement = db()->prepare(
        'SELECT 1 FROM report_edit_requests
         WHERE daily_report_id = :report_id AND requested_by = :user_id AND status = "approved"
         LIMIT 1'
    );
    $statement->execute(['report_id' => $reportId, 'user_id' => $userId]);
    return (bool) $statement->fetchColumn();
}

function list_report_settings(array $user): array
{
    require_role(['owner']);
    $statement = db()->query(
        'SELECT report_settings.*, sites.name AS site_name
         FROM report_settings
         LEFT JOIN sites ON sites.id = report_settings.site_id
         ORDER BY sites.name ASC'
    );
    return array_map(function (array $setting): array {
        return [
            'id' => (int) $setting['id'],
            'site_id' => $setting['site_id'] !== null ? (int) $setting['site_id'] : null,
            'site_name' => $setting['site_name'] ?? 'Global default',
            'worker_lock_enabled' => (bool) $setting['worker_lock_enabled'],
            'worker_cutoff_time' => (string) $setting['worker_cutoff_time'],
            'stock_lock_enabled' => (bool) $setting['stock_lock_enabled'],
            'stock_cutoff_time' => (string) $setting['stock_cutoff_time'],
        ];
    }, $statement->fetchAll());
}

function save_report_setting(array $input): array
{
    require_role(['owner']);
    $siteId = isset($input['site_id']) && $input['site_id'] !== '' ? (int) $input['site_id'] : null;
    $workerLockEnabled = !empty($input['worker_lock_enabled']);
    $workerCutoff = normalize_cutoff_time(trim((string) ($input['worker_cutoff_time'] ?? $input['attendance_cutoff_time'] ?? '21:00:00')));
    $stockLockEnabled = !empty($input['stock_lock_enabled']);
    $stockCutoff = normalize_cutoff_time(trim((string) ($input['stock_cutoff_time'] ?? '21:00:00')));

    if ($siteId !== null && find_site($siteId) === null) {
        error_response('NOT_FOUND', 'Site not found.', 404);
    }

    $params = [
        'worker_lock_enabled' => $workerLockEnabled ? 1 : 0,
        'worker_cutoff_time' => $workerCutoff,
        'stock_lock_enabled' => $stockLockEnabled ? 1 : 0,
        'stock_cutoff_time' => $stockCutoff,
    ];

    if ($siteId === null) {
        $existing = db()->query('SELECT id FROM report_settings WHERE site_id IS NULL ORDER BY id ASC LIMIT 1')->fetchColumn();
        if ($existing) {
            $statement = db()->prepare(
                'UPDATE report_settings
                 SET attendance_cutoff_time = :worker_cutoff_time,
                     worker_lock_enabled = :worker_lock_enabled,
                     worker_cutoff_time = :worker_cutoff_time,
                     stock_lock_enabled = :stock_lock_enabled,
                     stock_cutoff_time = :stock_cutoff_time
                 WHERE id = :id'
            );
            $statement->execute($params + ['id' => (int) $existing]);
        } else {
            $statement = db()->prepare(
                'INSERT INTO report_settings
                 (site_id, attendance_cutoff_time, worker_lock_enabled, worker_cutoff_time, stock_lock_enabled, stock_cutoff_time)
                 VALUES (NULL, :worker_cutoff_time, :worker_lock_enabled, :worker_cutoff_time, :stock_lock_enabled, :stock_cutoff_time)'
            );
            $statement->execute($params);
        }
    } else {
        $statement = db()->prepare(
            'INSERT INTO report_settings
             (site_id, attendance_cutoff_time, worker_lock_enabled, worker_cutoff_time, stock_lock_enabled, stock_cutoff_time)
             VALUES (:site_id, :worker_cutoff_time, :worker_lock_enabled, :worker_cutoff_time, :stock_lock_enabled, :stock_cutoff_time)
             ON DUPLICATE KEY UPDATE
                attendance_cutoff_time = VALUES(attendance_cutoff_time),
                worker_lock_enabled = VALUES(worker_lock_enabled),
                worker_cutoff_time = VALUES(worker_cutoff_time),
                stock_lock_enabled = VALUES(stock_lock_enabled),
                stock_cutoff_time = VALUES(stock_cutoff_time)'
        );
        $statement->execute($params + ['site_id' => $siteId]);
    }
    return [
        'site_id' => $siteId,
        'worker_lock_enabled' => $workerLockEnabled,
        'worker_cutoff_time' => $workerCutoff,
        'stock_lock_enabled' => $stockLockEnabled,
        'stock_cutoff_time' => $stockCutoff,
    ];
}

function create_edit_request(array $user, array $input): array
{
    $reportId = (int) ($input['daily_report_id'] ?? 0);
    $reason = trim((string) ($input['reason'] ?? ''));
    if ($reportId <= 0 || $reason === '') {
        error_response('VALIDATION_ERROR', 'Daily report and reason are required.', 422);
    }
    $report = require_daily_report_access($user, $reportId);
    $statement = db()->prepare(
        'INSERT INTO report_edit_requests (daily_report_id, requested_by, reason)
         VALUES (:report_id, :requested_by, :reason)'
    );
    $statement->execute(['report_id' => $reportId, 'requested_by' => (int) $user['id'], 'reason' => $reason]);
    return [
        'id' => (int) db()->lastInsertId(),
        'daily_report_id' => $reportId,
        'site_id' => (int) $report['site_id'],
        'reason' => $reason,
        'status' => 'pending',
    ];
}

function list_edit_requests(array $user): array
{
    $params = [];
    $filter = '';
    if ($user['role'] !== 'owner') {
        $filter = ' WHERE report_edit_requests.requested_by = :user_id';
        $params['user_id'] = (int) $user['id'];
    }
    $statement = db()->prepare(
        'SELECT report_edit_requests.*, sites.name AS site_name, daily_reports.report_date,
                requester.name AS requested_by_name, reviewer.name AS reviewed_by_name
         FROM report_edit_requests
         INNER JOIN daily_reports ON daily_reports.id = report_edit_requests.daily_report_id
         INNER JOIN sites ON sites.id = daily_reports.site_id
         INNER JOIN users requester ON requester.id = report_edit_requests.requested_by
         LEFT JOIN users reviewer ON reviewer.id = report_edit_requests.reviewed_by' .
         $filter . ' ORDER BY report_edit_requests.created_at DESC'
    );
    $statement->execute($params);
    return $statement->fetchAll();
}

function review_edit_request(array $user, int $id, string $status): array
{
    require_role(['owner']);
    if (!in_array($status, ['approved', 'rejected'], true)) {
        error_response('VALIDATION_ERROR', 'Status must be approved or rejected.', 422);
    }
    $statement = db()->prepare(
        'UPDATE report_edit_requests SET status = :status, reviewed_by = :reviewed_by, reviewed_at = NOW()
         WHERE id = :id'
    );
    $statement->execute(['status' => $status, 'reviewed_by' => (int) $user['id'], 'id' => $id]);
    return ['id' => $id, 'status' => $status];
}
