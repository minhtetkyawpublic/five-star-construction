<?php

require_once __DIR__ . '/../src/database.php';
require_once __DIR__ . '/../src/cors.php';
require_once __DIR__ . '/../src/request.php';
require_once __DIR__ . '/../src/auth.php';
require_once __DIR__ . '/../src/sites.php';
require_once __DIR__ . '/../src/workers.php';
require_once __DIR__ . '/../src/attendance.php';
require_once __DIR__ . '/../src/payments.php';
require_once __DIR__ . '/../src/reports.php';
require_once __DIR__ . '/../src/locking.php';
require_once __DIR__ . '/../src/stock.php';
require_once __DIR__ . '/../src/response.php';

apply_cors_headers();

set_exception_handler(function (Throwable $error): void {
    if ($error instanceof PDOException) {
        error_response('DATABASE_ERROR', 'A database error occurred. Please check that MySQL is running and the database is imported.', 500);
    }

    error_response('SERVER_ERROR', 'An unexpected server error occurred.', 500);
});

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function request_path(): string
{
    $pathInfo = $_SERVER['PATH_INFO'] ?? null;

    if (is_string($pathInfo) && $pathInfo !== '') {
        return '/' . trim($pathInfo, '/');
    }

    $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    $script = $_SERVER['SCRIPT_NAME'] ?? '';
    $path = is_string($uri) ? $uri : '/';

    if ($script !== '' && substr($path, 0, strlen($script)) === $script) {
        $path = substr($path, strlen($script));
    }

    return '/' . trim($path, '/');
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = request_path();

if ($method === 'GET' && $path === '/api/health') {
    success_response([
        'status' => 'ok',
        'database' => [
            'connected' => database_is_connected(),
        ],
    ], 'API is healthy');
}

if ($method === 'POST' && $path === '/api/login') {
    $input = json_input();
    $phone = trim((string) ($input['phone'] ?? ''));
    $password = (string) ($input['password'] ?? '');

    if ($phone === '' || $password === '') {
        error_response('INVALID_CREDENTIALS', 'Phone and password are required.', 401);
    }

    try {
        $user = find_active_user_by_phone($phone);
    } catch (Throwable $error) {
        error_response('DATABASE_ERROR', 'Unable to check login credentials.', 500);
    }

    if ($user === null || !password_verify($password, $user['password_hash'])) {
        error_response('INVALID_CREDENTIALS', 'Invalid phone or password.', 401);
    }

    try {
        $token = issue_token((int) $user['id']);
    } catch (Throwable $error) {
        error_response('TOKEN_ERROR', 'Unable to create login session.', 500);
    }

    success_response([
        'token' => $token,
        'user' => public_user($user),
    ], 'Login successful');
}

if ($method === 'GET' && $path === '/api/me') {
    try {
        $user = require_auth();
    } catch (Throwable $error) {
        error_response('AUTH_REQUIRED', 'Authentication is required.', 401);
    }

    success_response([
        'user' => public_user($user),
    ]);
}

if ($method === 'POST' && $path === '/api/logout') {
    require_auth();
    revoke_current_token();

    success_response(null, 'Logout successful');
}

if ($method === 'GET' && $path === '/api/sites') {
    $user = require_auth();
    success_response([
        'sites' => sites_for_user($user),
    ]);
}

if ($method === 'POST' && $path === '/api/sites') {
    require_role(['owner']);
    $input = validate_site_input(json_input());

    $statement = db()->prepare(
        'INSERT INTO sites (name, location, status) VALUES (:name, :location, :status)'
    );
    $statement->execute($input);

    $site = find_site((int) db()->lastInsertId());

    success_response([
        'site' => public_site($site, []),
    ], 'Site created', 201);
}

if (preg_match('#^/api/sites/([0-9]+)$#', $path, $matches)) {
    $siteId = (int) $matches[1];

    if ($method === 'GET') {
        $user = require_auth();
        $site = require_site_access($user, $siteId);

        success_response([
            'site' => public_site($site, site_incharges($siteId)),
        ]);
    }

    if ($method === 'POST') {
        require_role(['owner']);
        $site = find_site($siteId);

        if ($site === null) {
            error_response('NOT_FOUND', 'Site not found.', 404);
        }

        $input = validate_site_input(json_input());
        $statement = db()->prepare(
            'UPDATE sites SET name = :name, location = :location, status = :status WHERE id = :id'
        );
        $statement->execute([
            'name' => $input['name'],
            'location' => $input['location'],
            'status' => $input['status'],
            'id' => $siteId,
        ]);

        $site = find_site($siteId);

        success_response([
            'site' => public_site($site, site_incharges($siteId)),
        ], 'Site updated');
    }
}

if ($method === 'POST' && preg_match('#^/api/sites/([0-9]+)/incharges$#', $path, $matches)) {
    require_role(['owner']);
    $siteId = (int) $matches[1];

    if (find_site($siteId) === null) {
        error_response('NOT_FOUND', 'Site not found.', 404);
    }

    $input = json_input();
    $userIds = $input['user_ids'] ?? [];

    if (!is_array($userIds)) {
        error_response('VALIDATION_ERROR', 'user_ids must be an array.', 422);
    }

    $site = assign_site_incharges($siteId, $userIds);

    success_response([
        'site' => $site,
    ], 'Site in-charges updated');
}

if ($method === 'POST' && preg_match('#^/api/sites/([0-9]+)/delete$#', $path, $matches)) {
    require_role(['owner']);
    success_response([
        'site' => delete_site((int) $matches[1]),
    ], 'Site deleted');
}

if ($method === 'GET' && $path === '/api/site-incharges') {
    require_role(['owner']);
    success_response([
        'site_incharges' => list_site_incharge_users(),
    ]);
}

if ($method === 'POST' && $path === '/api/site-incharges') {
    require_role(['owner']);
    $user = create_site_incharge_user(json_input());

    success_response([
        'site_incharge' => $user,
    ], 'Site in-charge created', 201);
}

if ($method === 'GET' && $path === '/api/users') {
    require_role(['owner']);
    success_response([
        'users' => list_users(),
    ]);
}

if ($method === 'POST' && $path === '/api/users') {
    require_role(['owner']);
    success_response([
        'user' => create_user(json_input()),
    ], 'User created', 201);
}

if (preg_match('#^/api/users/([0-9]+)$#', $path, $matches)) {
    $userId = (int) $matches[1];

    if ($method === 'GET') {
        require_role(['owner']);
        $user = find_user_by_id($userId);

        if ($user === null) {
            error_response('NOT_FOUND', 'User not found.', 404);
        }

        success_response([
            'user' => public_managed_user($user),
        ]);
    }

    if ($method === 'POST') {
        $currentOwner = require_role(['owner']);
        success_response([
            'user' => update_user($userId, json_input(), $currentOwner),
        ], 'User updated');
    }
}

if ($method === 'POST' && preg_match('#^/api/users/([0-9]+)/delete$#', $path, $matches)) {
    $currentOwner = require_role(['owner']);
    success_response([
        'user' => deactivate_user((int) $matches[1], $currentOwner),
    ], 'User deactivated');
}

if ($method === 'GET' && $path === '/api/workers') {
    $user = require_auth();
    success_response([
        'workers' => workers_for_user($user),
    ]);
}

if ($method === 'POST' && $path === '/api/workers') {
    $user = require_role(['site_incharge']);
    $worker = create_worker_for_user($user, json_input());

    success_response([
        'worker' => $worker,
    ], 'Worker created', 201);
}

if (preg_match('#^/api/workers/([0-9]+)$#', $path, $matches)) {
    $workerId = (int) $matches[1];

    if ($method === 'GET') {
        $user = require_auth();
        $worker = require_worker_access($user, $workerId);

        success_response([
            'worker' => public_worker($worker, visible_worker_sites($user, $workerId)),
        ]);
    }

    if ($method === 'POST') {
        $user = require_role(['owner', 'site_incharge']);
        $worker = update_worker_for_user($user, $workerId, json_input());

        success_response([
            'worker' => $worker,
        ], 'Worker updated');
    }
}

if ($method === 'GET' && preg_match('#^/api/workers/([0-9]+)/payments$#', $path, $matches)) {
    $user = require_auth();
    $workerId = (int) $matches[1];
    require_worker_access($user, $workerId);

    success_response([
        'worker_payments' => list_worker_payments($user, ['worker_id' => $workerId]),
    ]);
}

if ($method === 'GET' && preg_match('#^/api/workers/([0-9]+)/attendance$#', $path, $matches)) {
    $user = require_auth();
    $workerId = (int) $matches[1];
    $month = trim((string) ($_GET['month'] ?? date('Y-m')));

    success_response([
        'attendance' => list_worker_attendance_month($user, $workerId, $month),
    ]);
}

if ($method === 'POST' && preg_match('#^/api/workers/([0-9]+)/sites$#', $path, $matches)) {
    require_role(['owner']);
    $workerId = (int) $matches[1];

    if (find_worker($workerId) === null) {
        error_response('NOT_FOUND', 'Worker not found.', 404);
    }

    $input = json_input();
    $siteIds = $input['site_ids'] ?? [];

    if (!is_array($siteIds)) {
        error_response('VALIDATION_ERROR', 'site_ids must be an array.', 422);
    }

    $worker = assign_worker_sites($workerId, $siteIds);

    success_response([
        'worker' => $worker,
    ], 'Worker sites updated');
}

if ($method === 'POST' && preg_match('#^/api/workers/([0-9]+)/delete$#', $path, $matches)) {
    require_role(['owner']);
    success_response([
        'worker' => delete_worker((int) $matches[1]),
    ], 'Worker deleted');
}

if ($method === 'GET' && $path === '/api/worker-payments') {
    $user = require_auth();

    success_response([
        'worker_payments' => list_worker_payments($user, $_GET),
    ]);
}

if ($method === 'POST' && $path === '/api/worker-payments') {
    $user = require_role(['owner', 'site_incharge']);
    $payment = create_worker_payment($user, json_input());

    success_response([
        'worker_payment' => $payment,
    ], 'Worker payment recorded', 201);
}

if ($method === 'GET' && preg_match('#^/api/sites/([0-9]+)/workers$#', $path, $matches)) {
    $user = require_auth();
    $siteId = (int) $matches[1];

    success_response([
        'workers' => workers_for_site($user, $siteId),
    ]);
}

if ($method === 'GET' && $path === '/api/daily-reports') {
    $user = require_auth();
    $date = isset($_GET['date']) ? trim((string) $_GET['date']) : null;
    $siteId = isset($_GET['site_id']) && $_GET['site_id'] !== '' ? (int) $_GET['site_id'] : null;

    success_response([
        'daily_reports' => list_daily_reports($user, $date, $siteId),
    ]);
}

if ($method === 'POST' && $path === '/api/daily-reports') {
    $user = require_auth();
    if (!in_array($user['role'], ['site_incharge', 'owner'], true)) {
        error_response('FORBIDDEN', 'You do not have permission to save daily reports.', 403);
    }
    $report = save_daily_report($user, json_input());

    success_response([
        'daily_report' => $report,
    ], 'Daily report saved');
}

if ($method === 'GET' && preg_match('#^/api/daily-reports/([0-9]+)$#', $path, $matches)) {
    $user = require_auth();
    $report = require_daily_report_access($user, (int) $matches[1]);

    success_response([
        'daily_report' => public_daily_report($report),
    ]);
}

if ($method === 'GET' && preg_match('#^/api/sites/([0-9]+)/daily-report$#', $path, $matches)) {
    $user = require_auth();
    $siteId = (int) $matches[1];
    $date = isset($_GET['date']) ? trim((string) $_GET['date']) : '';

    require_site_access($user, $siteId);

    if (!valid_report_date($date)) {
        error_response('VALIDATION_ERROR', 'Date must use YYYY-MM-DD format.', 422);
    }

    $report = find_daily_report_for_site_date($siteId, $date);

    success_response([
        'daily_report' => $report !== null ? public_daily_report($report) : null,
    ]);
}

if ($method === 'GET' && $path === '/api/reports/workers/monthly') {
    $user = require_auth();
    $month = trim((string) ($_GET['month'] ?? ''));
    $siteId = isset($_GET['site_id']) && $_GET['site_id'] !== '' ? (int) $_GET['site_id'] : null;
    success_response(['report' => monthly_worker_report($user, $month, $siteId)]);
}

if ($method === 'GET' && $path === '/api/report-settings') {
    $user = require_auth();
    success_response(['settings' => list_report_settings($user)]);
}

if ($method === 'POST' && $path === '/api/report-settings') {
    success_response(['setting' => save_report_setting(json_input())], 'Report setting saved');
}

if ($method === 'GET' && $path === '/api/report-edit-requests') {
    $user = require_auth();
    success_response(['edit_requests' => list_edit_requests($user)]);
}

if ($method === 'POST' && $path === '/api/report-edit-requests') {
    $user = require_role(['site_incharge']);
    success_response(['edit_request' => create_edit_request($user, json_input())], 'Edit request sent', 201);
}

if ($method === 'POST' && preg_match('#^/api/report-edit-requests/([0-9]+)/review$#', $path, $matches)) {
    $user = require_role(['owner']);
    $input = json_input();
    success_response(['edit_request' => review_edit_request($user, (int) $matches[1], (string) ($input['status'] ?? ''))]);
}

if ($method === 'GET' && $path === '/api/stock-items') {
    require_auth();
    success_response(['stock_items' => list_stock_items()]);
}

if ($method === 'POST' && $path === '/api/stock-items') {
    success_response(['stock_item' => create_stock_item(json_input())], 'Stock item created', 201);
}

if ($method === 'POST' && $path === '/api/cash-transfers') {
    $user = require_role(['owner']);
    success_response(['cash_transfer' => create_cash_transfer($user, json_input())], 'Cash transfer recorded', 201);
}

if ($method === 'POST' && $path === '/api/stock-purchases') {
    $user = require_role(['site_incharge']);
    success_response(['stock_purchase' => create_stock_purchase($user, json_input())], 'Stock purchase recorded', 201);
}

if ($method === 'POST' && $path === '/api/stock-usage') {
    $user = require_role(['site_incharge']);
    success_response(['stock_usage' => create_stock_usage($user, json_input())], 'Stock usage recorded', 201);
}

if ($method === 'GET' && $path === '/api/stock-balances') {
    $user = require_auth();
    $siteId = isset($_GET['site_id']) && $_GET['site_id'] !== '' ? (int) $_GET['site_id'] : null;
    success_response(['stock_balances' => stock_balances($user, $siteId)]);
}

if ($method === 'GET' && $path === '/api/reports/stock/monthly') {
    $user = require_auth();
    $month = trim((string) ($_GET['month'] ?? ''));
    $siteId = isset($_GET['site_id']) && $_GET['site_id'] !== '' ? (int) $_GET['site_id'] : null;
    success_response(['report' => monthly_stock_report($user, $month, $siteId)]);
}

error_response('NOT_FOUND', 'Endpoint not found.', 404);
