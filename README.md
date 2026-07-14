# Five Star Construction

Mobile-first construction management web app using React, PHP, and MySQL.

## Project Structure

- `src/` - React app built with Vite.
- `static/` - Frontend static assets copied into builds.
- `public/` - Built frontend files.
- `server/` - PHP API for MySQL-backed data.
- `server/database/schema.sql` - Baseline MySQL schema.
- `server/database/migrations/` - Future SQL migrations.
- `.env` - Shared local environment config for frontend and server.

## Backend Setup

1. Copy the shared environment example:

   ```bash
   cp .env.example .env
   ```

2. Update `.env` with your local MySQL database name, username, password, API URL, and CORS settings.

3. Run database migrations from the project root:

   ```bash
   php server/migrate.php
   ```

   Helpful migration commands:

   ```bash
   php server/migrate.php --status
   php server/migrate.php --pretend
   ```

4. Test the health endpoint:

   ```text
   http://localhost/five-star-construction/server/public/index.php/api/health
   ```

## Backend CORS

Configure CORS in the root `.env`:

```text
CORS_ALLOWED_ORIGINS=*
CORS_ALLOWED_HEADERS=Content-Type,Authorization
CORS_ALLOWED_METHODS=GET,POST,OPTIONS
CORS_ALLOW_CREDENTIALS=false
CORS_MAX_AGE=86400
```

For production, replace `*` with a comma-separated origin allowlist, for example:

```text
CORS_ALLOWED_ORIGINS=https://example.com,https://www.example.com
```

## Default Login

After running migrations, the first owner account is available:

```text
Phone: owner
Password: Owner@12345
```

Change this password in a later user-management phase before using the app with real data.

## Frontend Setup

1. Install dependencies and run the app:

   ```bash
   npm install
   npm run dev
   ```

2. Build for production:

   ```bash
   npm run build
   ```

## Shared Hosting / GitHub Deploy

Use this setup when the hosting server can run PHP/MySQL but cannot run `npm install` or `npm run build`.

1. Build the frontend locally before pushing:

   ```bash
   npm install
   npm run build
   ```

2. Push the repository to GitHub, including the generated `public/` folder if your hosting server cannot build it.

3. On hosting, pull the repository into the public web folder.

4. Copy shared environment config:

   ```bash
   cp .env.example .env
   ```

5. Edit `.env` with the hosting MySQL database name, username, password, API URL, and CORS settings.

6. Run server migrations from the repository root:

   ```bash
   php server/migrate.php
   ```

7. Open the website root. `index.php` redirects to the built app at `public/`.

For same-domain production hosting with the built frontend in `public/`, set this before building:

```text
VITE_API_BASE_URL=../server/public/index.php
```

That means the frontend and server should be kept in the same repository path on the same domain.
