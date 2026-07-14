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

function find_active_stock_item(int $itemId): ?array
{
    $statement = db()->prepare('SELECT * FROM stock_items WHERE id = :id AND status = "active" LIMIT 1');
    $statement->execute(['id' => $itemId]);
    $item = $statement->fetch();

    return is_array($item) ? $item : null;
}

function find_active_stock_item_by_name_unit(string $name, string $unit): ?array
{
    $statement = db()->prepare(
        'SELECT * FROM stock_items
         WHERE name = :name AND unit = :unit AND status = "active"
         LIMIT 1'
    );
    $statement->execute(['name' => $name, 'unit' => $unit]);
    $item = $statement->fetch();

    return is_array($item) ? $item : null;
}

function resolve_purchase_stock_item(array $input): int
{
    $itemId = (int) ($input['item_id'] ?? 0);

    if ($itemId > 0) {
        if (find_active_stock_item($itemId) === null) {
            error_response('NOT_FOUND', 'Stock item not found.', 404);
        }

        return $itemId;
    }

    $name = trim((string) ($input['item_name'] ?? ''));
    $unit = trim((string) ($input['unit'] ?? ''));

    if ($name === '' || $unit === '') {
        error_response('VALIDATION_ERROR', 'Item name and unit are required.', 422);
    }

    $existing = find_active_stock_item_by_name_unit($name, $unit);
    if ($existing !== null) {
        return (int) $existing['id'];
    }

    try {
        $statement = db()->prepare('INSERT INTO stock_items (name, unit) VALUES (:name, :unit)');
        $statement->execute(['name' => $name, 'unit' => $unit]);
        return (int) db()->lastInsertId();
    } catch (PDOException $error) {
        if ($error->getCode() !== '23000') {
            throw $error;
        }

        $existing = find_active_stock_item_by_name_unit($name, $unit);
        if ($existing !== null) {
            return (int) $existing['id'];
        }

        throw $error;
    }
}

function resolve_usage_stock_item(int $siteId, array $input): int
{
    $itemId = (int) ($input['item_id'] ?? 0);

    if ($itemId > 0) {
        if (find_active_stock_item($itemId) === null) {
            error_response('NOT_FOUND', 'Stock item not found.', 404);
        }

        return $itemId;
    }

    $name = trim((string) ($input['item_name'] ?? ''));

    if ($name === '') {
        error_response('VALIDATION_ERROR', 'Item name is required.', 422);
    }

    $statement = db()->prepare(
        'SELECT stock_items.id
         FROM stock_items
         INNER JOIN stock_purchases ON stock_purchases.item_id = stock_items.id
         WHERE stock_purchases.site_id = :site_id
           AND stock_items.name = :name
           AND stock_items.status = "active"
         GROUP BY stock_items.id
         HAVING
            COALESCE(SUM(stock_purchases.quantity), 0)
            -
            COALESCE((
                SELECT SUM(stock_usage.quantity)
                FROM stock_usage
                WHERE stock_usage.site_id = :usage_site_id
                  AND stock_usage.item_id = stock_items.id
            ), 0) > 0'
    );
    $statement->execute([
        'site_id' => $siteId,
        'name' => $name,
        'usage_site_id' => $siteId,
    ]);
    $itemIds = array_map('intval', $statement->fetchAll(PDO::FETCH_COLUMN));

    if (count($itemIds) === 1) {
        return $itemIds[0];
    }

    if (count($itemIds) > 1) {
        error_response('VALIDATION_ERROR', 'Multiple stock items match this name. Please choose the exact item from the suggestion.', 422);
    }

    error_response('NOT_FOUND', 'Stock item not found for this site.', 404);
}

function site_cash_balance(int $siteId, ?int $excludePurchaseId = null): float
{
    $purchaseFilter = $excludePurchaseId !== null ? ' AND id <> :exclude_purchase_id' : '';
    $statement = db()->prepare(
        'SELECT
            COALESCE((SELECT SUM(amount) FROM cash_transfers WHERE site_id = :cash_site_id), 0)
            -
            COALESCE((SELECT SUM(total_amount) FROM stock_purchases WHERE site_id = :purchase_site_id' . $purchaseFilter . '), 0)
         AS cash_left'
    );
    $params = [
        'cash_site_id' => $siteId,
        'purchase_site_id' => $siteId,
    ];
    if ($excludePurchaseId !== null) {
        $params['exclude_purchase_id'] = $excludePurchaseId;
    }
    $statement->execute($params);

    return (float) $statement->fetchColumn();
}

function site_item_stock_balance(int $siteId, int $itemId, ?int $excludeUsageId = null): float
{
    $usageFilter = $excludeUsageId !== null ? ' AND id <> :exclude_usage_id' : '';
    $statement = db()->prepare(
        'SELECT
            COALESCE((SELECT SUM(quantity) FROM stock_purchases WHERE site_id = :purchase_site_id AND item_id = :purchase_item_id), 0)
            -
            COALESCE((SELECT SUM(quantity) FROM stock_usage WHERE site_id = :usage_site_id AND item_id = :usage_item_id' . $usageFilter . '), 0)
         AS stock_left'
    );
    $params = [
        'purchase_site_id' => $siteId,
        'purchase_item_id' => $itemId,
        'usage_site_id' => $siteId,
        'usage_item_id' => $itemId,
    ];
    if ($excludeUsageId !== null) {
        $params['exclude_usage_id'] = $excludeUsageId;
    }
    $statement->execute($params);

    return (float) $statement->fetchColumn();
}

function public_cash_transfer(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'site_id' => (int) $row['site_id'],
        'site_name' => $row['site_name'] ?? '',
        'amount' => (float) $row['amount'],
        'transfer_date' => $row['transfer_date'],
        'note' => $row['note'] ?? '',
        'created_by' => ['id' => (int) $row['created_by'], 'name' => $row['created_by_name'] ?? ''],
    ];
}

function public_stock_purchase(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'site_id' => (int) $row['site_id'],
        'site_name' => $row['site_name'] ?? '',
        'item_id' => (int) $row['item_id'],
        'item_name' => $row['item_name'] ?? '',
        'unit' => $row['unit'] ?? '',
        'purchase_date' => $row['purchase_date'],
        'quantity' => (float) $row['quantity'],
        'unit_price' => (float) $row['unit_price'],
        'total_amount' => (float) $row['total_amount'],
        'note' => $row['note'] ?? '',
        'created_by' => ['id' => (int) $row['created_by'], 'name' => $row['created_by_name'] ?? ''],
    ];
}

function public_stock_usage(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'site_id' => (int) $row['site_id'],
        'site_name' => $row['site_name'] ?? '',
        'item_id' => (int) $row['item_id'],
        'item_name' => $row['item_name'] ?? '',
        'unit' => $row['unit'] ?? '',
        'usage_date' => $row['usage_date'],
        'quantity' => (float) $row['quantity'],
        'note' => $row['note'] ?? '',
        'created_by' => ['id' => (int) $row['created_by'], 'name' => $row['created_by_name'] ?? ''],
    ];
}

function create_stock_purchase(array $user, array $input): array
{
    require_role(['site_incharge']);
    $siteId = (int) ($input['site_id'] ?? 0);
    $date = trim((string) ($input['purchase_date'] ?? ''));
    $quantity = (float) ($input['quantity'] ?? 0);
    $unitPrice = (float) ($input['unit_price'] ?? 0);
    $note = trim((string) ($input['note'] ?? ''));
    require_open_site_access($user, $siteId);
    if (!valid_stock_date($date) || $quantity <= 0 || $unitPrice < 0) {
        error_response('VALIDATION_ERROR', 'Valid item, date, quantity, and price are required.', 422);
    }
    $itemId = resolve_purchase_stock_item($input);
    require_unlocked_report($siteId, $date, 'stock');
    $total = $quantity * $unitPrice;
    $cashLeft = site_cash_balance($siteId);
    if ($total > $cashLeft) {
        error_response('INSUFFICIENT_SITE_CASH', 'Purchase total is greater than the cash left for this site.', 422);
    }
    $statement = db()->prepare(
        'INSERT INTO stock_purchases (site_id, item_id, purchase_date, quantity, unit_price, total_amount, note, created_by)
         VALUES (:site_id, :item_id, :date, :quantity, :unit_price, :total, :note, :created_by)'
    );
    $statement->execute(['site_id' => $siteId, 'item_id' => $itemId, 'date' => $date, 'quantity' => $quantity, 'unit_price' => $unitPrice, 'total' => $total, 'note' => $note, 'created_by' => (int) $user['id']]);
    return ['id' => (int) db()->lastInsertId(), 'site_id' => $siteId, 'item_id' => $itemId, 'quantity' => $quantity, 'unit_price' => $unitPrice, 'total_amount' => $total, 'purchase_date' => $date];
}

function create_stock_usage(array $user, array $input): array
{
    require_role(['site_incharge']);
    $siteId = (int) ($input['site_id'] ?? 0);
    $date = trim((string) ($input['usage_date'] ?? ''));
    $quantity = (float) ($input['quantity'] ?? 0);
    $note = trim((string) ($input['note'] ?? ''));
    require_open_site_access($user, $siteId);
    if (!valid_stock_date($date) || $quantity <= 0) {
        error_response('VALIDATION_ERROR', 'Valid item, date, and quantity are required.', 422);
    }
    $itemId = resolve_usage_stock_item($siteId, $input);
    require_unlocked_report($siteId, $date, 'stock');
    $stockLeft = site_item_stock_balance($siteId, $itemId);
    if ($quantity > $stockLeft) {
        error_response('INSUFFICIENT_SITE_STOCK', 'Usage quantity is greater than the stock left for this item.', 422);
    }
    $statement = db()->prepare(
        'INSERT INTO stock_usage (site_id, item_id, usage_date, quantity, note, created_by)
         VALUES (:site_id, :item_id, :date, :quantity, :note, :created_by)'
    );
    $statement->execute(['site_id' => $siteId, 'item_id' => $itemId, 'date' => $date, 'quantity' => $quantity, 'note' => $note, 'created_by' => (int) $user['id']]);
    return ['id' => (int) db()->lastInsertId(), 'site_id' => $siteId, 'item_id' => $itemId, 'quantity' => $quantity, 'usage_date' => $date];
}

function stock_transaction_filter(array $user, ?int $siteId, array &$params): string
{
    $filter = accessible_site_filter($user, $siteId, $params);
    if ($user['role'] !== 'owner') {
        $filter .= " AND sites.status = 'active'";
    }

    return $filter;
}

function list_cash_transfers(array $user, ?int $siteId): array
{
    require_role(['owner']);
    $params = [];
    $filter = stock_transaction_filter($user, $siteId, $params);
    $statement = db()->prepare(
        "SELECT cash_transfers.*, sites.name AS site_name, users.name AS created_by_name
         FROM cash_transfers
         INNER JOIN sites ON sites.id = cash_transfers.site_id
         INNER JOIN users ON users.id = cash_transfers.created_by
         WHERE 1=1 {$filter}
         ORDER BY cash_transfers.transfer_date DESC, cash_transfers.id DESC"
    );
    $statement->execute($params);
    return array_map('public_cash_transfer', $statement->fetchAll());
}

function list_stock_purchases(array $user, ?int $siteId): array
{
    $params = [];
    $filter = stock_transaction_filter($user, $siteId, $params);
    $statement = db()->prepare(
        "SELECT stock_purchases.*, sites.name AS site_name, stock_items.name AS item_name,
                stock_items.unit, users.name AS created_by_name
         FROM stock_purchases
         INNER JOIN sites ON sites.id = stock_purchases.site_id
         INNER JOIN stock_items ON stock_items.id = stock_purchases.item_id
         INNER JOIN users ON users.id = stock_purchases.created_by
         WHERE 1=1 {$filter}
         ORDER BY stock_purchases.purchase_date DESC, stock_purchases.id DESC"
    );
    $statement->execute($params);
    return array_map('public_stock_purchase', $statement->fetchAll());
}

function list_stock_usage(array $user, ?int $siteId): array
{
    $params = [];
    $filter = stock_transaction_filter($user, $siteId, $params);
    $statement = db()->prepare(
        "SELECT stock_usage.*, sites.name AS site_name, stock_items.name AS item_name,
                stock_items.unit, users.name AS created_by_name
         FROM stock_usage
         INNER JOIN sites ON sites.id = stock_usage.site_id
         INNER JOIN stock_items ON stock_items.id = stock_usage.item_id
         INNER JOIN users ON users.id = stock_usage.created_by
         WHERE 1=1 {$filter}
         ORDER BY stock_usage.usage_date DESC, stock_usage.id DESC"
    );
    $statement->execute($params);
    return array_map('public_stock_usage', $statement->fetchAll());
}

function find_stock_purchase(int $id): ?array
{
    $statement = db()->prepare(
        'SELECT stock_purchases.*, sites.name AS site_name, stock_items.name AS item_name,
                stock_items.unit, users.name AS created_by_name
         FROM stock_purchases
         INNER JOIN sites ON sites.id = stock_purchases.site_id
         INNER JOIN stock_items ON stock_items.id = stock_purchases.item_id
         INNER JOIN users ON users.id = stock_purchases.created_by
         WHERE stock_purchases.id = :id LIMIT 1'
    );
    $statement->execute(['id' => $id]);
    $row = $statement->fetch();
    return is_array($row) ? $row : null;
}

function find_stock_usage(int $id): ?array
{
    $statement = db()->prepare(
        'SELECT stock_usage.*, sites.name AS site_name, stock_items.name AS item_name,
                stock_items.unit, users.name AS created_by_name
         FROM stock_usage
         INNER JOIN sites ON sites.id = stock_usage.site_id
         INNER JOIN stock_items ON stock_items.id = stock_usage.item_id
         INNER JOIN users ON users.id = stock_usage.created_by
         WHERE stock_usage.id = :id LIMIT 1'
    );
    $statement->execute(['id' => $id]);
    $row = $statement->fetch();
    return is_array($row) ? $row : null;
}

function update_stock_purchase(array $user, int $id, array $input): array
{
    require_role(['site_incharge']);
    $existing = find_stock_purchase($id);
    if ($existing === null) {
        error_response('NOT_FOUND', 'Stock purchase not found.', 404);
    }
    require_open_site_access($user, (int) $existing['site_id']);
    require_unlocked_report((int) $existing['site_id'], (string) $existing['purchase_date'], 'stock');

    $date = trim((string) ($input['purchase_date'] ?? $existing['purchase_date']));
    $quantity = (float) ($input['quantity'] ?? $existing['quantity']);
    $unitPrice = (float) ($input['unit_price'] ?? $existing['unit_price']);
    $note = trim((string) ($input['note'] ?? ''));
    if (!valid_stock_date($date) || $quantity <= 0 || $unitPrice < 0) {
        error_response('VALIDATION_ERROR', 'Valid item, date, quantity, and price are required.', 422);
    }
    require_unlocked_report((int) $existing['site_id'], $date, 'stock');
    $itemInput = $input;
    if (trim((string) ($itemInput['item_name'] ?? '')) === '' && empty($itemInput['item_id'])) {
        $itemInput['item_id'] = (int) $existing['item_id'];
    }
    $itemId = resolve_purchase_stock_item($itemInput);
    $total = $quantity * $unitPrice;
    $cashLeft = site_cash_balance((int) $existing['site_id'], $id);
    if ($total > $cashLeft) {
        error_response('INSUFFICIENT_SITE_CASH', 'Purchase total is greater than the cash left for this site.', 422);
    }
    $statement = db()->prepare(
        'UPDATE stock_purchases
         SET item_id = :item_id, purchase_date = :date, quantity = :quantity,
             unit_price = :unit_price, total_amount = :total, note = :note
         WHERE id = :id'
    );
    $statement->execute([
        'item_id' => $itemId,
        'date' => $date,
        'quantity' => $quantity,
        'unit_price' => $unitPrice,
        'total' => $total,
        'note' => $note,
        'id' => $id,
    ]);
    return public_stock_purchase(find_stock_purchase($id));
}

function update_stock_usage(array $user, int $id, array $input): array
{
    require_role(['site_incharge']);
    $existing = find_stock_usage($id);
    if ($existing === null) {
        error_response('NOT_FOUND', 'Stock usage not found.', 404);
    }
    require_open_site_access($user, (int) $existing['site_id']);
    require_unlocked_report((int) $existing['site_id'], (string) $existing['usage_date'], 'stock');

    $date = trim((string) ($input['usage_date'] ?? $existing['usage_date']));
    $quantity = (float) ($input['quantity'] ?? $existing['quantity']);
    $note = trim((string) ($input['note'] ?? ''));
    if (!valid_stock_date($date) || $quantity <= 0) {
        error_response('VALIDATION_ERROR', 'Valid item, date, and quantity are required.', 422);
    }
    require_unlocked_report((int) $existing['site_id'], $date, 'stock');
    $itemInput = $input;
    if (trim((string) ($itemInput['item_name'] ?? '')) === '' && empty($itemInput['item_id'])) {
        $itemInput['item_id'] = (int) $existing['item_id'];
    }
    $itemId = resolve_usage_stock_item((int) $existing['site_id'], $itemInput);
    $stockLeft = site_item_stock_balance((int) $existing['site_id'], $itemId, $id);
    if ($quantity > $stockLeft) {
        error_response('INSUFFICIENT_SITE_STOCK', 'Usage quantity is greater than the stock left for this item.', 422);
    }
    $statement = db()->prepare(
        'UPDATE stock_usage
         SET item_id = :item_id, usage_date = :date, quantity = :quantity, note = :note
         WHERE id = :id'
    );
    $statement->execute([
        'item_id' => $itemId,
        'date' => $date,
        'quantity' => $quantity,
        'note' => $note,
        'id' => $id,
    ]);
    return public_stock_usage(find_stock_usage($id));
}

function stock_site_summaries(array $user, ?int $siteId): array
{
    $params = [];
    $siteFilter = accessible_site_filter($user, $siteId, $params);
    if ($user['role'] !== 'owner') {
        $siteFilter .= " AND sites.status = 'active'";
    }

    $sql = "SELECT sites.id AS site_id, sites.name AS site_name, sites.status AS site_status,
                   COALESCE(c.cash_received, 0) AS cash_received,
                   COALESCE(p.purchase_total, 0) AS purchase_total
            FROM sites
            LEFT JOIN (
                SELECT site_id, SUM(amount) cash_received FROM cash_transfers GROUP BY site_id
            ) c ON c.site_id = sites.id
            LEFT JOIN (
                SELECT site_id, SUM(total_amount) purchase_total FROM stock_purchases GROUP BY site_id
            ) p ON p.site_id = sites.id
            WHERE 1=1 {$siteFilter}
            ORDER BY sites.name";
    $statement = db()->prepare($sql);
    $statement->execute($params);

    return array_map(function (array $row): array {
        return [
            'site_id' => (int) $row['site_id'],
            'site_name' => $row['site_name'],
            'site_status' => $row['site_status'],
            'cash_received' => (float) $row['cash_received'],
            'purchase_total' => (float) $row['purchase_total'],
            'cash_remaining' => (float) $row['cash_received'] - (float) $row['purchase_total'],
        ];
    }, $statement->fetchAll());
}

function stock_balances(array $user, ?int $siteId): array
{
    $params = [];
    $siteFilter = accessible_site_filter($user, $siteId, $params);
    if ($user['role'] !== 'owner') {
        $siteFilter .= " AND sites.status = 'active'";
    }
    $sql = "SELECT sites.id AS site_id, sites.name AS site_name, sites.status AS site_status,
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
            'site_status' => $row['site_status'],
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
