<?php

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/response.php';
require_once __DIR__ . '/sites.php';
require_once __DIR__ . '/locking.php';

function valid_stock_date(string $date): bool
{
    $parsed = DateTimeImmutable::createFromFormat('Y-m-d', $date);
    return $parsed !== false && $parsed->format('Y-m-d') === $date;
}

function public_stock_item(array $item): array
{
    return ['id' => (int) $item['id'], 'name' => $item['name'], 'unit' => $item['unit'], 'status' => $item['status']];
}

function list_stock_items(): array
{
    $statement = db()->query('SELECT * FROM stock_items ORDER BY name ASC');
    return array_map('public_stock_item', $statement->fetchAll());
}

function create_stock_item(array $input): array
{
    require_role(['owner']);
    $name = trim((string) ($input['name'] ?? ''));
    $unit = trim((string) ($input['unit'] ?? ''));
    if ($name === '' || $unit === '') {
        error_response('VALIDATION_ERROR', 'Item name and unit are required.', 422);
    }
    $statement = db()->prepare('INSERT INTO stock_items (name, unit) VALUES (:name, :unit)');
    $statement->execute(['name' => $name, 'unit' => $unit]);
    return ['id' => (int) db()->lastInsertId(), 'name' => $name, 'unit' => $unit, 'status' => 'active'];
}

function create_cash_transfer(array $user, array $input): array
{
    require_role(['owner']);
    $siteId = (int) ($input['site_id'] ?? 0);
    $amount = (float) ($input['amount'] ?? 0);
    $date = trim((string) ($input['transfer_date'] ?? ''));
    $note = trim((string) ($input['note'] ?? ''));
    if ($siteId <= 0 || $amount <= 0 || !valid_stock_date($date)) {
        error_response('VALIDATION_ERROR', 'Valid site, amount, and date are required.', 422);
    }
    $site = find_site($siteId);
    if ($site === null) {
        error_response('NOT_FOUND', 'Site not found.', 404);
    }
    require_open_site($site);
    require_unlocked_report($siteId, $date, 'stock');
    $statement = db()->prepare(
        'INSERT INTO cash_transfers (site_id, amount, transfer_date, note, created_by)
         VALUES (:site_id, :amount, :date, :note, :created_by)'
    );
    $statement->execute(['site_id' => $siteId, 'amount' => $amount, 'date' => $date, 'note' => $note, 'created_by' => (int) $user['id']]);
    return ['id' => (int) db()->lastInsertId(), 'site_id' => $siteId, 'amount' => $amount, 'transfer_date' => $date, 'note' => $note];
}

function create_stock_purchase(array $user, array $input): array
{
    $siteId = (int) ($input['site_id'] ?? 0);
    $itemId = (int) ($input['item_id'] ?? 0);
    $date = trim((string) ($input['purchase_date'] ?? ''));
    $quantity = (float) ($input['quantity'] ?? 0);
    $unitPrice = (float) ($input['unit_price'] ?? 0);
    $note = trim((string) ($input['note'] ?? ''));
    require_open_site_access($user, $siteId);
    if ($itemId <= 0 || !valid_stock_date($date) || $quantity <= 0 || $unitPrice < 0) {
        error_response('VALIDATION_ERROR', 'Valid item, date, quantity, and price are required.', 422);
    }
    require_unlocked_report($siteId, $date, 'stock');
    $total = $quantity * $unitPrice;
    $statement = db()->prepare(
        'INSERT INTO stock_purchases (site_id, item_id, purchase_date, quantity, unit_price, total_amount, note, created_by)
         VALUES (:site_id, :item_id, :date, :quantity, :unit_price, :total, :note, :created_by)'
    );
    $statement->execute(['site_id' => $siteId, 'item_id' => $itemId, 'date' => $date, 'quantity' => $quantity, 'unit_price' => $unitPrice, 'total' => $total, 'note' => $note, 'created_by' => (int) $user['id']]);
    return ['id' => (int) db()->lastInsertId(), 'site_id' => $siteId, 'item_id' => $itemId, 'quantity' => $quantity, 'unit_price' => $unitPrice, 'total_amount' => $total, 'purchase_date' => $date];
}

function create_stock_usage(array $user, array $input): array
{
    $siteId = (int) ($input['site_id'] ?? 0);
    $itemId = (int) ($input['item_id'] ?? 0);
    $date = trim((string) ($input['usage_date'] ?? ''));
    $quantity = (float) ($input['quantity'] ?? 0);
    $note = trim((string) ($input['note'] ?? ''));
    require_open_site_access($user, $siteId);
    if ($itemId <= 0 || !valid_stock_date($date) || $quantity <= 0) {
        error_response('VALIDATION_ERROR', 'Valid item, date, and quantity are required.', 422);
    }
    require_unlocked_report($siteId, $date, 'stock');
    $statement = db()->prepare(
        'INSERT INTO stock_usage (site_id, item_id, usage_date, quantity, note, created_by)
         VALUES (:site_id, :item_id, :date, :quantity, :note, :created_by)'
    );
    $statement->execute(['site_id' => $siteId, 'item_id' => $itemId, 'date' => $date, 'quantity' => $quantity, 'note' => $note, 'created_by' => (int) $user['id']]);
    return ['id' => (int) db()->lastInsertId(), 'site_id' => $siteId, 'item_id' => $itemId, 'quantity' => $quantity, 'usage_date' => $date];
}

function stock_balances(array $user, ?int $siteId): array
{
    $params = [];
    $siteFilter = accessible_site_filter($user, $siteId, $params);
    if ($user['role'] !== 'owner') {
        $siteFilter .= " AND sites.status = 'active'";
    }
    $sql = "SELECT sites.id AS site_id, sites.name AS site_name,
                   stock_items.id AS item_id, stock_items.name AS item_name, stock_items.unit,
                   COALESCE(p.purchased_quantity, 0) AS purchased_quantity,
                   COALESCE(u.used_quantity, 0) AS used_quantity,
                   COALESCE(p.purchase_total, 0) AS purchase_total,
                   COALESCE(c.cash_received, 0) AS cash_received
            FROM sites
            CROSS JOIN stock_items
            LEFT JOIN (
                SELECT site_id, item_id, SUM(quantity) purchased_quantity, SUM(total_amount) purchase_total
                FROM stock_purchases GROUP BY site_id, item_id
            ) p ON p.site_id = sites.id AND p.item_id = stock_items.id
            LEFT JOIN (
                SELECT site_id, item_id, SUM(quantity) used_quantity FROM stock_usage GROUP BY site_id, item_id
            ) u ON u.site_id = sites.id AND u.item_id = stock_items.id
            LEFT JOIN (
                SELECT site_id, SUM(amount) cash_received FROM cash_transfers GROUP BY site_id
            ) c ON c.site_id = sites.id
            WHERE stock_items.status = 'active' {$siteFilter}
            ORDER BY sites.name, stock_items.name";
    $statement = db()->prepare($sql);
    $statement->execute($params);
    return array_map(function (array $row): array {
        return [
            'site_id' => (int) $row['site_id'],
            'site_name' => $row['site_name'],
            'item_id' => (int) $row['item_id'],
            'item_name' => $row['item_name'],
            'unit' => $row['unit'],
            'purchased_quantity' => (float) $row['purchased_quantity'],
            'used_quantity' => (float) $row['used_quantity'],
            'remaining_quantity' => (float) $row['purchased_quantity'] - (float) $row['used_quantity'],
            'cash_received' => (float) $row['cash_received'],
            'purchase_total' => (float) $row['purchase_total'],
            'cash_remaining' => (float) $row['cash_received'] - (float) $row['purchase_total'],
        ];
    }, $statement->fetchAll());
}
