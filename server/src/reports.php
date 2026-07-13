<?php

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/response.php';
require_once __DIR__ . '/sites.php';

function valid_month(string $month): bool
{
    $parsed = DateTimeImmutable::createFromFormat('Y-m', $month);
    return $parsed !== false && $parsed->format('Y-m') === $month;
}

function month_bounds(string $month): array
{
    if (!valid_month($month)) {
        error_response('VALIDATION_ERROR', 'Month must use YYYY-MM format.', 422);
    }

    $start = DateTimeImmutable::createFromFormat('Y-m-d', $month . '-01');
    return [
        $start->format('Y-m-d'),
        $start->modify('last day of this month')->format('Y-m-d'),
    ];
}

function accessible_site_filter(array $user, ?int $siteId, array &$params): string
{
    if ($siteId !== null) {
        require_site_access($user, $siteId);
        $params['site_id'] = $siteId;
        return ' AND sites.id = :site_id';
    }

    if ($user['role'] !== 'owner') {
        $params['user_id'] = (int) $user['id'];
        return ' AND sites.id IN (SELECT site_id FROM site_users WHERE user_id = :user_id)';
    }

    return '';
}

function monthly_worker_report(array $user, string $month, ?int $siteId): array
{
    [$startDate, $endDate] = month_bounds($month);
    $params = [
        'start_date' => $startDate,
        'end_date' => $endDate,
        'pay_start_date' => $startDate,
        'pay_end_date' => $endDate,
    ];
    $siteFilter = accessible_site_filter($user, $siteId, $params);

    $sql = "
        SELECT workers.id AS worker_id, workers.name AS worker_name, sites.id AS site_id, sites.name AS site_name,
               COALESCE(SUM(CASE
                   WHEN attendance.status = 'present' THEN 1
                   WHEN attendance.status = 'half_day' THEN 0.5
                   ELSE 0
               END), 0) AS working_days,
               COALESCE(SUM(CASE
                   WHEN attendance.status = 'present' THEN workers.daily_wage
                   WHEN attendance.status = 'half_day' THEN workers.daily_wage / 2
                   ELSE 0
               END), 0) AS wage_total,
               COALESCE(payments.paid_total, 0) AS paid_total,
               COALESCE(payments.advance_total, 0) AS advance_total
        FROM attendance
        INNER JOIN workers ON workers.id = attendance.worker_id
        INNER JOIN sites ON sites.id = attendance.site_id
        LEFT JOIN (
            SELECT site_id, worker_id,
                   SUM(CASE WHEN type = 'wage_payment' THEN amount ELSE 0 END) AS paid_total,
                   SUM(CASE WHEN type = 'advance' THEN amount ELSE 0 END) AS advance_total
            FROM worker_payments
            WHERE payment_date BETWEEN :pay_start_date AND :pay_end_date
            GROUP BY site_id, worker_id
        ) payments ON payments.site_id = attendance.site_id AND payments.worker_id = attendance.worker_id
        WHERE attendance.date BETWEEN :start_date AND :end_date {$siteFilter}
        GROUP BY workers.id, workers.name, sites.id, sites.name, payments.paid_total, payments.advance_total
        ORDER BY sites.name ASC, workers.name ASC";

    $statement = db()->prepare($sql);
    $statement->execute($params);

    return array_map(function (array $row): array {
        $wageTotal = (float) $row['wage_total'];
        $paidTotal = (float) $row['paid_total'];
        $advanceTotal = (float) $row['advance_total'];
        return [
            'worker_id' => (int) $row['worker_id'],
            'worker_name' => $row['worker_name'],
            'site_id' => (int) $row['site_id'],
            'site_name' => $row['site_name'],
            'working_days' => (float) $row['working_days'],
            'wage_total' => $wageTotal,
            'paid_total' => $paidTotal,
            'advance_total' => $advanceTotal,
            'remaining_balance' => $wageTotal - $paidTotal - $advanceTotal,
        ];
    }, $statement->fetchAll());
}

function monthly_stock_report(array $user, string $month, ?int $siteId): array
{
    [$startDate, $endDate] = month_bounds($month);
    $baseParams = [
        'start_date' => $startDate,
        'end_date' => $endDate,
    ];
    $cashParams = $baseParams;
    $siteFilter = accessible_site_filter($user, $siteId, $cashParams);

    $cashSql = "SELECT sites.id AS site_id, sites.name AS site_name,
                       COALESCE(SUM(cash_transfers.amount), 0) AS cash_received
                FROM sites
                LEFT JOIN cash_transfers ON cash_transfers.site_id = sites.id
                  AND cash_transfers.transfer_date BETWEEN :start_date AND :end_date
                WHERE 1=1 {$siteFilter}
                GROUP BY sites.id, sites.name
                ORDER BY sites.name ASC";
    $cashStmt = db()->prepare($cashSql);
    $cashStmt->execute($cashParams);
    $sites = [];
    foreach ($cashStmt->fetchAll() as $row) {
        $sites[(int) $row['site_id']] = [
            'site_id' => (int) $row['site_id'],
            'site_name' => $row['site_name'],
            'cash_received' => (float) $row['cash_received'],
            'purchase_total' => 0.0,
            'expected_cash_remaining' => (float) $row['cash_received'],
            'items' => [],
        ];
    }

    $itemParams = [
        'start_date' => $startDate,
        'end_date' => $endDate,
        'usage_start_date' => $startDate,
        'usage_end_date' => $endDate,
    ];
    $itemSiteFilter = accessible_site_filter($user, $siteId, $itemParams);

    $itemSql = "SELECT sites.id AS site_id, stock_items.id AS item_id, stock_items.name AS item_name,
                       stock_items.unit,
                       COALESCE(SUM(stock_purchases.quantity), 0) AS purchased_quantity,
                       COALESCE(SUM(stock_purchases.total_amount), 0) AS purchase_total,
                       COALESCE(usage_totals.used_quantity, 0) AS used_quantity
                FROM stock_purchases
                INNER JOIN sites ON sites.id = stock_purchases.site_id
                INNER JOIN stock_items ON stock_items.id = stock_purchases.item_id
                LEFT JOIN (
                    SELECT site_id, item_id, SUM(quantity) AS used_quantity
                    FROM stock_usage
                    WHERE usage_date BETWEEN :usage_start_date AND :usage_end_date
                    GROUP BY site_id, item_id
                ) usage_totals ON usage_totals.site_id = stock_purchases.site_id
                  AND usage_totals.item_id = stock_purchases.item_id
                WHERE stock_purchases.purchase_date BETWEEN :start_date AND :end_date {$itemSiteFilter}
                GROUP BY sites.id, stock_items.id, stock_items.name, stock_items.unit, usage_totals.used_quantity
                ORDER BY sites.name ASC, stock_items.name ASC";
    $itemStmt = db()->prepare($itemSql);
    $itemStmt->execute($itemParams);
    foreach ($itemStmt->fetchAll() as $row) {
        $site = (int) $row['site_id'];
        if (!isset($sites[$site])) {
            continue;
        }
        $purchaseTotal = (float) $row['purchase_total'];
        $sites[$site]['purchase_total'] += $purchaseTotal;
        $sites[$site]['expected_cash_remaining'] = $sites[$site]['cash_received'] - $sites[$site]['purchase_total'];
        $sites[$site]['items'][] = [
            'item_id' => (int) $row['item_id'],
            'item_name' => $row['item_name'],
            'unit' => $row['unit'],
            'purchased_quantity' => (float) $row['purchased_quantity'],
            'used_quantity' => (float) $row['used_quantity'],
            'remaining_quantity' => (float) $row['purchased_quantity'] - (float) $row['used_quantity'],
            'purchase_total' => $purchaseTotal,
        ];
    }

    return array_values($sites);
}
