<?php

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/response.php';
require_once __DIR__ . '/sites.php';
require_once __DIR__ . '/workers.php';
require_once __DIR__ . '/locking.php';

function valid_payment_date(string $date): bool
{
    $parsed = DateTimeImmutable::createFromFormat('Y-m-d', $date);
    return $parsed !== false && $parsed->format('Y-m-d') === $date;
}

function public_worker_payment(array $payment): array
{
    return [
        'id' => (int) $payment['id'],
        'site_id' => (int) $payment['site_id'],
        'site_name' => $payment['site_name'],
        'worker_id' => (int) $payment['worker_id'],
        'worker_name' => $payment['worker_name'],
        'recorded_by' => [
            'id' => (int) $payment['recorded_by'],
            'name' => $payment['recorded_by_name'],
        ],
        'payment_date' => $payment['payment_date'],
        'type' => $payment['type'],
        'amount' => (float) $payment['amount'],
        'note' => $payment['note'] ?? '',
    ];
}

function worker_payment_select_sql(): string
{
    return 'SELECT worker_payments.*, sites.name AS site_name, workers.name AS worker_name,
                   users.name AS recorded_by_name
            FROM worker_payments
            INNER JOIN sites ON sites.id = worker_payments.site_id
            INNER JOIN workers ON workers.id = worker_payments.worker_id
            INNER JOIN users ON users.id = worker_payments.recorded_by';
}

function worker_is_assigned_to_site(int $workerId, int $siteId): bool
{
    $statement = db()->prepare(
        'SELECT 1 FROM worker_sites WHERE worker_id = :worker_id AND site_id = :site_id LIMIT 1'
    );
    $statement->execute([
        'worker_id' => $workerId,
        'site_id' => $siteId,
    ]);

    return (bool) $statement->fetchColumn();
}

function validate_worker_payment_input(array $input): array
{
    $siteId = (int) ($input['site_id'] ?? 0);
    $workerId = (int) ($input['worker_id'] ?? 0);
    $paymentDate = trim((string) ($input['payment_date'] ?? ''));
    $type = trim((string) ($input['type'] ?? ''));
    $amount = (float) ($input['amount'] ?? 0);
    $note = trim((string) ($input['note'] ?? ''));

    if ($siteId <= 0) {
        error_response('VALIDATION_ERROR', 'Site is required.', 422);
    }

    if ($workerId <= 0) {
        error_response('VALIDATION_ERROR', 'Worker is required.', 422);
    }

    if (!valid_payment_date($paymentDate)) {
        error_response('VALIDATION_ERROR', 'Payment date must use YYYY-MM-DD format.', 422);
    }

    if (!in_array($type, ['wage_payment', 'advance'], true)) {
        error_response('VALIDATION_ERROR', 'Payment type must be wage_payment or advance.', 422);
    }

    if ($amount <= 0) {
        error_response('VALIDATION_ERROR', 'Amount must be greater than zero.', 422);
    }

    return [
        'site_id' => $siteId,
        'worker_id' => $workerId,
        'payment_date' => $paymentDate,
        'type' => $type,
        'amount' => number_format($amount, 2, '.', ''),
        'note' => $note,
    ];
}

function find_worker_payment(int $paymentId): ?array
{
    $statement = db()->prepare(worker_payment_select_sql() . ' WHERE worker_payments.id = :id LIMIT 1');
    $statement->execute(['id' => $paymentId]);
    $payment = $statement->fetch();

    return is_array($payment) ? $payment : null;
}

function create_worker_payment(array $user, array $input): array
{
    $data = validate_worker_payment_input($input);
    require_open_site_access($user, $data['site_id']);

    if (!worker_is_assigned_to_site($data['worker_id'], $data['site_id'])) {
        error_response('VALIDATION_ERROR', 'Worker must be assigned to this site.', 422);
    }

    if ($user['role'] !== 'owner') {
        require_unlocked_report($data['site_id'], $data['payment_date'], 'worker');
    }

    $statement = db()->prepare(
        'INSERT INTO worker_payments (site_id, worker_id, recorded_by, payment_date, type, amount, note)
         VALUES (:site_id, :worker_id, :recorded_by, :payment_date, :type, :amount, :note)'
    );
    $statement->execute([
        'site_id' => $data['site_id'],
        'worker_id' => $data['worker_id'],
        'recorded_by' => (int) $user['id'],
        'payment_date' => $data['payment_date'],
        'type' => $data['type'],
        'amount' => $data['amount'],
        'note' => $data['note'],
    ]);

    return public_worker_payment(find_worker_payment((int) db()->lastInsertId()));
}

function list_worker_payments(array $user, array $filters): array
{
    $where = [];
    $params = [];

    $siteId = isset($filters['site_id']) && $filters['site_id'] !== '' ? (int) $filters['site_id'] : null;
    $workerId = isset($filters['worker_id']) && $filters['worker_id'] !== '' ? (int) $filters['worker_id'] : null;
    $date = isset($filters['date']) ? trim((string) $filters['date']) : '';
    $type = isset($filters['type']) ? trim((string) $filters['type']) : '';

    if ($siteId !== null) {
        $site = require_site_access($user, $siteId);
        if ($user['role'] !== 'owner' && $site['status'] !== 'active') {
            return [];
        }
        $where[] = 'worker_payments.site_id = :site_id';
        $params['site_id'] = $siteId;
    } elseif ($user['role'] !== 'owner') {
        $where[] = 'worker_payments.site_id IN (
            SELECT site_users.site_id
            FROM site_users
            INNER JOIN sites ON sites.id = site_users.site_id
            WHERE site_users.user_id = :user_id AND sites.status = "active"
        )';
        $params['user_id'] = (int) $user['id'];
    }

    if ($workerId !== null) {
        if (!user_can_access_worker($user, $workerId)) {
            error_response('FORBIDDEN', 'You do not have permission to access this worker.', 403);
        }

        $where[] = 'worker_payments.worker_id = :worker_id';
        $params['worker_id'] = $workerId;
    }

    if ($date !== '') {
        if (!valid_payment_date($date)) {
            error_response('VALIDATION_ERROR', 'Date must use YYYY-MM-DD format.', 422);
        }

        $where[] = 'worker_payments.payment_date = :date';
        $params['date'] = $date;
    }

    if ($type !== '') {
        if (!in_array($type, ['wage_payment', 'advance'], true)) {
            error_response('VALIDATION_ERROR', 'Payment type must be wage_payment or advance.', 422);
        }

        $where[] = 'worker_payments.type = :type';
        $params['type'] = $type;
    }

    $sql = worker_payment_select_sql();

    if (count($where) > 0) {
        $sql .= ' WHERE ' . implode(' AND ', $where);
    }

    $sql .= ' ORDER BY worker_payments.payment_date DESC, worker_payments.id DESC';

    $statement = db()->prepare($sql);
    $statement->execute($params);

    return array_map('public_worker_payment', $statement->fetchAll());
}
