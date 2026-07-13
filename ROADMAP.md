# Construction Management Web App Roadmap

This roadmap is for a mobile-first construction management web app using React frontend, PHP API server, and MySQL database.

## Phase 1: Project Setup

1. Create React frontend project.
2. Create PHP server API folder.
3. Create MySQL database.
4. Add environment configuration for database connection.
5. Create basic API response format for success and error responses.
6. Create frontend API client for calling PHP endpoints.

## Phase 2: Authentication And Roles

1. Create `users` table.
2. Add user roles:
   - `owner`
   - `site_incharge`
3. Build login API.
4. Store hashed passwords in database.
5. Add authenticated API middleware.
6. Add role checking in the server.
7. Build frontend login screen.
8. Redirect users based on role after login.

## Phase 3: Site Management

1. Create `sites` table.
2. Create `site_users` table for assigning site in-charges to sites.
3. Owner can create sites.
4. Owner can edit sites.
5. Owner can assign site in-charge to a site.
6. Site in-charge can only access assigned site data.
7. Owner can access all site data.
8. Build owner site list screen.
9. Build site detail screen.

## Phase 4: Worker Management

1. Create `workers` table.
2. Create `worker_sites` table for assigning workers to sites.
3. Owner can create workers.
4. Owner can edit workers.
5. Owner can assign workers to sites.
6. Site in-charge can view workers assigned to their site.
7. Build worker list screen.
8. Build worker create/edit screen.
9. Build site worker list screen.

## Phase 5: Daily Worker Attendance

1. Create `daily_reports` table.
2. Create `attendance` table.
3. Site in-charge can create daily report for assigned site.
4. Site in-charge can mark worker attendance:
   - present
   - absent
   - half_day
5. Save wage amount for each attendance entry.
6. Prevent duplicate daily report for same site and date.
7. Owner can view attendance reports from all sites.
8. Build daily attendance entry screen.
9. Build daily attendance detail screen.

## Phase 6: Worker Payments And Advance Money

1. Create `worker_payments` table.
2. Add payment types:
   - `wage_payment`
   - `advance`
3. Site in-charge can record worker payment for assigned site.
4. Site in-charge can record upfront/advance money for assigned worker.
5. Owner can view all worker payments and advances.
6. Build worker payment entry screen.
7. Build worker payment history screen.

## Phase 7: Monthly Worker Reports

1. Create monthly worker report API.
2. Calculate total working days per worker.
3. Calculate total wage amount per worker.
4. Calculate total paid amount per worker.
5. Calculate total advance amount per worker.
6. Calculate remaining balance per worker.
7. Owner can view reports for all sites.
8. Site in-charge can view reports only for assigned site.
9. Build monthly worker report screen.

## Phase 8: Daily Report Locking

1. Create `report_settings` table.
2. Store attendance edit cutoff time.
3. Add server validation before creating or editing daily reports.
4. Site in-charge can add/edit daily report only before cutoff time.
5. After cutoff time, daily report becomes read-only for site in-charge.
6. Owner can still edit locked reports.
7. Create `report_edit_requests` table.
8. Site in-charge can request edit access after cutoff time.
9. Owner can approve or reject edit request.
10. Build locked report state in frontend.
11. Build edit request screen.
12. Build owner approval screen.

## Phase 9: Stock And Cash Management

1. Create `cash_transfers` table.
2. Create `stock_items` table.
3. Create `stock_purchases` table.
4. Create `stock_usage` table.
5. Owner can record money given to site in-charge for a site.
6. Site in-charge can record purchased stock items.
7. Site in-charge can record used stock quantity.
8. Site in-charge can view remaining stock for assigned site.
9. Site in-charge can view remaining cash for assigned site.
10. Owner can view stock and cash data for all sites.
11. Build cash received screen.
12. Build stock purchase screen.
13. Build stock usage screen.
14. Build site stock balance screen.

## Phase 10: Monthly Stock And Cash Reports

1. Create monthly stock report API.
2. Calculate total cash received per site.
3. Calculate total purchase amount per site.
4. Calculate expected remaining cash per site.
5. Calculate purchased quantity per stock item.
6. Calculate used quantity per stock item.
7. Calculate remaining quantity per stock item.
8. Owner can view reports for all sites.
9. Site in-charge can view reports only for assigned site.
10. Build monthly stock and cash report screen.

## Phase 11: Mobile Phone Layout

1. Build mobile-first app layout.
2. Add bottom navigation for site in-charge:
   - Today
   - Workers
   - Stock
   - Reports
   - Profile
3. Add bottom navigation for owner:
   - Sites
   - Workers
   - Stock
   - Reports
   - Users
4. Make all forms easy to use on phone screens.
5. Make all tables readable on phone screens using cards or compact lists.

## Phase 12: Installable Web App

1. Add web app manifest.
2. Add app name, short name, theme color, and background color.
3. Add app icons for phone home screen.
4. Add service worker.
5. Cache frontend app shell files.
6. Detect whether browser supports app install prompt.
7. Show Install button only when app is installable.
8. Hide Install button after user installs the app.
9. Hide Install button for a few days if user dismisses it.
10. Detect standalone installed mode and do not show Install button.

## Phase 13: Online-Only Data Entry

1. Require internet connection for attendance, payment, stock, and report actions.
2. Show clear error message when the app cannot connect to the server.
3. Do not save unsynced attendance, payment, stock, or report drafts on device.
4. Keep installed app caching only for frontend app files, not business data.

## Phase 14: Final Validation

1. Test owner login and site in-charge login.
2. Test site data isolation.
3. Test daily attendance entry.
4. Test worker payment and advance calculation.
5. Test monthly worker report calculation.
6. Test report cutoff time.
7. Test edit request approval flow.
8. Test cash transfer entry.
9. Test stock purchase and usage calculation.
10. Test monthly stock and cash report calculation.
11. Test install button behavior.
12. Test installed app launch from phone home screen.
13. Test online-only behavior when network/server is unavailable.
