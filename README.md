# Five Star Construction

Mobile-first construction management web app using React, PHP, and MySQL.

## Project Structure

- `frontend/` - React app built with Vite.
- `backend/` - PHP API for MySQL-backed data.
- `backend/database/schema.sql` - MySQL database bootstrap and migrations.
- `frontend/dist/` - Built frontend files for hosting that cannot run Node/npm.

## Backend Setup

1. Create the database by importing:

   ```sql
   backend/database/schema.sql
   ```

2. Copy the backend environment example:

   ```bash
   cp backend/.env.example backend/.env
   ```

3. Update `backend/.env` with your local MySQL username and password.

4. Test the health endpoint:

   ```text
   http://localhost/five_star_construction/backend/public/index.php/api/health
   ```

## Default Login

After importing `backend/database/schema.sql`, the first owner account is available:

```text
Phone: owner
Password: Owner@12345
```

Change this password in a later user-management phase before using the app with real data.

## Frontend Setup

1. Copy the frontend environment example:

   ```bash
   cp frontend/.env.example frontend/.env
   ```

2. Install dependencies and run the app:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. Build for production:

   ```bash
   npm run build
   ```

## Shared Hosting / GitHub Deploy

Use this setup when the hosting server can run PHP/MySQL but cannot run `npm install` or `npm run build`.

1. Build the frontend locally before pushing:

   ```bash
   cd frontend
   npm install
   npm run build
   ```

2. Push the repository to GitHub, including the generated `frontend/dist/` folder.

3. On hosting, pull the repository into the public web folder.

4. Copy backend environment config:

   ```bash
   cp backend/.env.example backend/.env
   ```

5. Edit `backend/.env` with the hosting MySQL database name, username, and password.

6. Import `backend/database/schema.sql` into the hosting MySQL database.

7. Open the website root. `index.php` redirects to the built app at `frontend/dist/`.

The production frontend build uses `frontend/.env.production`, so API calls go to:

```text
../../backend/public/index.php
```

That means the frontend and backend should be kept in the same repository path on the same domain.
