<?php

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/response.php';
require_once __DIR__ . '/sites.php';

function valid_report_date(string $date): bool
{
    $parsed = DateTimeImmutable::createFromFormat('Y-m-d', $date);
    return $parsed !== false && $parsed->format('Y-m-d') === $date;
}

function report_attendance(int $reportId): array
{
    $statement = db()->prepare(
        'SELECT attendance.worker_id, workers.name AS worker_name, attendance.status,
                attendance.wage_amount, attendance.note
         FROM attendance
         INNER JOIN workers ON workers.id = attendance.worker_id
         WHERE attendance.daily_report_id = :report_id
         ORDER BY workers.name ASC'
    );
    $statement->execute(['report_id' => $reportId]);

    return array_map(function (array $entry): array {
        return [
            'worker_id' => (int) $entry['worker_id'],
            'worker_name' => $entry['worker_name'],
            'status' => $entry['status'],
            'wage_amount' => (float) $entry['wage_amount'],
            'note' => $entry['note'] ?? '',
        ];
    }, $statement->fetchAll());
}

function public_daily_report(array $report): array
{
    return [
        'id' => (int) $report['id'],
        'site_id' => (int) $report['site_id'],
        'site_name' => $report['site_name'],
        'report_date' => $report['report_date'],
        'submitted_by' => [
            'id' => (int) $report['submitted_by'],
            'name' => $report['submitted_by_name'],
        ],
        'attendance' => report_attendance((int) $report['id']),
    ];
}

function report_select_sql(): string
{
    return 'SELECT daily_reports.*, sites.name AS site_name, users.name AS submitted_by_name
            FROM daily_reports
            INNER JOIN sites ON sites.id = daily_reports.site_id
            INNER JOIN users ON users.id = daily_reports.submitted_by';
}

function find_daily_report(int $reportId): ?array
{
    $statement = db()->prepare(report_select_sql() . ' WHERE daily_reports.id = :id LIMIT 1');
    $statement->execute(['id' => $reportId]);
    $report = $statement->fetch();

    return is_array($report) ? $report : null;
}

function find_daily_report_for_site_date(int $siteId, string $date): ?array
{
    $statement = db()->prepare(
        report_select_sql() . ' WHERE daily_reports.site_id = :site_id AND daily_reports.report_date = :date LIMIT 1'
    );
    $statement->execute([
        'site_id' => $siteId,
        'date' => $date,
    ]);
    $report = $statement->fetch();

    return is_array($report) ? $report : null;
}

function require_daily_report_access(array $user, int $reportId): array
{
    $report = find_daily_report($reportId);

    if ($report === null) {
        error_response('NOT_FOUND', 'Daily report not found.', 404);
    }

    if (!user_can_access_site($user, (int) $report['site_id'])) {
        error_response('FORBIDDEN', 'You do not have permission to access this daily report.', 403);
    }

    return $report;
}

function list_daily_reports(array $user, ?string $date, ?int $siteId): array
{
    $where = [];
    $params = [];

    if ($date !== null && $date !== '') {
        if (!valid_report_date($date)) {
            error_response('VALIDATION_ERROR', 'Date must use YYYY-MM-DD format.', 422);
        }

        $where[] = 'daily_reports.report_date = :date';
        $params['date'] = $date;
    }

    if ($siteId !== null) {
        require_site_access($user, $siteId);
        $where[] = 'daily_reports.site_id = :site_id';
        $params['site_id'] = $siteId;
    } elseif ($user['role'] !== 'owner') {
        $where[] = 'daily_reports.site_id IN (SELECT site_id FROM site_users WHERE user_id = :user_id)';
        $params['user_id'] = (int) $user['id'];
    }

    $sql = report_select_sql();

    if (count($where) > 0) {
        $sql .= ' WHERE ' . implode(' AND ', $where);
    }

    $sql .= ' ORDER BY daily_reports.report_date DESC, daily_reports.id DESC';

    $statement = db()->prepare($sql);
    $statement->execute($params);

    return array_map('public_daily_report', $statement->fetchAll());
}

function valid_report_month(string $month): bool
{
    $parsed = DateTimeImmutable::createFromFormat('Y-m', $month);
    return $parsed !== false && $parsed->format('Y-m') === $month;
}

function list_worker_attendance_month(array $user, int $workerId, string $month): array
{
    require_worker_access($user, $workerId);

    if (!valid_report_month($month)) {
        error_response('VALIDATION_ERROR', 'Month must use YYYY-MM format.', 422);
    }

    $startDate = "{$month}-01";
    $endDate = DateTimeImmutable::createFromFormat('Y-m-d', $startDate)->modify('last day of this month')->format('Y-m-d');
    $params = [
        'worker_id' => $workerId,
        'start_date' => $startDate,
        'end_date' => $endDate,
    ];

    $siteFilter = '';
    if ($user['role'] !== 'owner') {
        $siteFilter = ' AND attendance.site_id IN (SELECT site_id FROM site_users WHERE user_id = :user_id)';
        $params['user_id'] = (int) $user['id'];
    }

    $statement = db()->prepare(
        "SELECT attendance.*, sites.name AS site_name
         FROM attendance
         INNER JOIN sites ON sites.id = attendance.site_id
         WHERE attendance.worker_id = :worker_id
           AND attendance.date BETWEEN :start_date AND :end_date
           {$siteFilter}
         ORDER BY attendance.date DESC, sites.name ASC"
    );
    $statement->execute($params);

    return array_map(function (array $entry): array {
        return [
            'site_id' => (int) $entry['site_id'],
            'site_name' => $entry['site_name'],
            'date' => $entry['date'],
            'status' => $entry['status'],
            'wage_amount' => (float) $entry['wage_amount'],
            'note' => $entry['note'] ?? '',
        ];
    }, $statement->fetchAll());
}

function worker_ids_for_site(int $siteId): array
{
    $statement = db()->prepare('SELECT worker_id FROM worker_sites WHERE site_id = :site_id');
    $statement->execute(['site_id' => $siteId]);

    return array_map('intval', $statement->fetchAll(PDO::FETCH_COLUMN));
}

function validate_attendance_payload(array $input): array
{
    $siteId = (int) ($input['site_id'] ?? 0);
    $date = trim((string) ($input['report_date'] ?? ''));
    $entries = $input['attendance'] ?? [];

    if ($siteId <= 0) {
        error_response('VALIDATION_ERROR', 'Site is required.', 422);
    }

    if (!valid_report_date($date)) {
        error_response('VALIDATION_ERROR', 'Report date must use YYYY-MM-DD format.', 422);
    }

    if (!is_array($entries)) {
        error_response('VALIDATION_ERROR', 'Attendance must be an array.', 422);
    }

    $validStatuses = ['present', 'absent', 'half_day'];
    $cleanEntries = [];

    foreach ($entries as $entry) {
        $workerId = (int) ($entry['worker_id'] ?? 0);
        $status = trim((string) ($entry['status'] ?? ''));
        $wageAmount = (float) ($entry['wage_amount'] ?? 0);
        $note = trim((string) ($entry['note'] ?? ''));

        if ($workerId <= 0) {
            error_response('VALIDATION_ERROR', 'Worker is required for each attendance entry.', 422);
        }

        if (!in_array($status, $validStatuses, true)) {
            error_response('VALIDATION_ERROR', 'Attendance status must be present, absent, or half_day.', 422);
        }

        if ($wageAmount < 0) {
            error_response('VALIDATION_ERROR', 'Wage amount cannot be negative.', 422);
        }

        $cleanEntries[$workerId] = [
            'worker_id' => $workerId,
            'status' => $status,
            'wage_amount' => number_format($wageAmount, 2, '.', ''),
            'note' => $note,
        ];
    }

    return [
        'site_id' => $siteId,
        'report_date' => $date,
        'attendance' => array_values($cleanEntries),
    ];
}

function save_daily_report(array $user, array $input): array
{
    $data = validate_attendance_payload($input);
    require_open_site_access($user, $data['site_id']);

    $validWorkerIds = worker_ids_for_site($data['site_id']);

    foreach ($data['attendance'] as $entry) {
        if (!in_array((int) $entry['worker_id'], $validWorkerIds, true)) {
            error_response('VALIDATION_ERROR', 'Attendance workers must be assigned to this site.', 422);
        }
    }

    db()->beginTransaction();

    try {
        $report = find_daily_report_for_site_date($data['site_id'], $data['report_date']);

        if (function_exists('report_is_locked') && report_is_locked($data['site_id'], $data['report_date'])) {
            $canEditLocked = $user['role'] === 'owner'
                || ($report !== null && has_approved_edit_request((int) $report['id'], (int) $user['id']));
            if (!$canEditLocked) {
                error_response('REPORT_LOCKED', 'Daily report is locked after the cutoff time.', 423);
            }
        }

        if ($report === null) {
            $insertReport = db()->prepare(
                'INSERT INTO daily_reports (site_id, report_date, submitted_by)
                 VALUES (:site_id, :report_date, :submitted_by)'
            );
            $insertReport->execute([
                'site_id' => $data['site_id'],
                'report_date' => $data['report_date'],
                'submitted_by' => (int) $user['id'],
            ]);
            $reportId = (int) db()->lastInsertId();
        } else {
            $reportId = (int) $report['id'];
            $updateReport = db()->prepare('UPDATE daily_reports SET submitted_by = :submitted_by WHERE id = :id');
            $updateReport->execute([
                'submitted_by' => (int) $user['id'],
                'id' => $reportId,
            ]);
        }

        $delete = db()->prepare('DELETE FROM attendance WHERE daily_report_id = :daily_report_id');
        $delete->execute(['daily_report_id' => $reportId]);

        if (count($data['attendance']) > 0) {
            $insertAttendance = db()->prepare(
                'INSERT INTO attendance
                 (daily_report_id, site_id, worker_id, date, status, wage_amount, note)
                 VALUES
                 (:daily_report_id, :site_id, :worker_id, :date, :status, :wage_amount, :note)'
            );

            foreach ($data['attendance'] as $entry) {
                $insertAttendance->execute([
                    'daily_report_id' => $reportId,
                    'site_id' => $data['site_id'],
                    'worker_id' => $entry['worker_id'],
                    'date' => $data['report_date'],
                    'status' => $entry['status'],
                    'wage_amount' => $entry['wage_amount'],
                    'note' => $entry['note'],
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

    return public_daily_report(find_daily_report($reportId));
}
