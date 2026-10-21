# InsightX

InsightX is a browser based workspace for exploring and cleaning CSV, JSON, and Excel datasets.

**Live website:** [shubham01-shubh.github.io/InsightX](https://shubham01-shubh.github.io/InsightX/)

## Features

- Open a comma-, semicolon-, or tab-separated CSV, a JSON array of records, or the first populated worksheet in an `.xlsx` workbook from your device. Data stays in the browser. You can also explore the 62-row sales sample in the repository root; it includes multiple products, regions, and statuses, plus missing values and duplicate records for trying the data quality tools.
- Get actionable import errors for malformed JSON and unclosed CSV quotes.
- Blank or repeated column names receive unique labels when a dataset is opened.
- Uneven rows are aligned to the widest row so extra cells are retained and missing cells stay empty.
- Keep data on your device while you search, sort, filter, and paginate rows; jump directly to a page and choose from 12 to 250 rows per page.
- Apply up to five filter conditions across one or more columns, choosing whether all or any conditions must match. Conditions include empty cells, numeric and ISO date comparisons, exact matches, prefixes, and suffixes.
- Focus dataset search with `/`, and clear an active search with one click or the Escape key.
- Keep column headings visible while scrolling long tables.
- Choose visible columns, copy the filtered view into a spreadsheet, and export cleaned CSV or JSON records; JSON exports preserve imported value types unless a value is changed, and exports can trim whitespace and remove duplicates.
- Edit cells directly in the table before exporting; undo recent edits with the button or Ctrl+Z / Cmd+Z. Edits stay in the current browser session.
- Review missing cells, duplicate rows in the current view, and per-column data quality.
- Profile columns for either the full dataset or the current filtered view, and export rows with missing values for follow-up cleanup.
- Preview exact value replacements and optionally apply them to exported rows.
- Filter the column profile to focus on fields with missing values.
- Identify ISO date columns and inspect their earliest and latest values.
- Compare numeric measures across the matching rows and categories using totals or averages.
- Switch between category comparisons and chronological trend lines, grouping ISO dates by day, month, or year.
- Export the current chart as CSV data or a PNG image.
- Inspect frequent repeated values in column profiles, and download a report with types, completeness, distinct counts, numeric ranges, averages, and medians.
- Scan the current filtered rows for the most incomplete field, the most common category, and potential numeric outliers, with the values and counts shown.
- Save named filter, sort, column, and chart configurations in the browser, then reopen the matching file to restore a view; dataset rows stay out of browser storage.

## Project structure

- `frontend/` — React application powered by Vite
- `backend/` - Django REST API for health checks, profiling, JWT accounts, and owner-scoped dataset storage
- `sample-sales.csv` — sample dataset shown on the GitHub repository home and used by the website

## Run the project locally

### Backend

The frontend works on its own and keeps imported files in the browser until a signed-in user chooses **Save to account**. The API offers both stateless profiling and profiling for authenticated, saved datasets. Uploaded files are stored privately under `backend/media/` by default, while ownership, metadata, and cached profiles are stored in the configured database. Set `MEDIA_ROOT` to a persistent volume path for a single-server install, or choose the private S3 storage backend for shared deployments. Files above 2 MiB are profiled by a Celery worker using Redis by default; for a small deployment without a worker, set `DATASET_BACKGROUND_THRESHOLD_BYTES` at least as high as `MAX_DATASET_UPLOAD_SIZE` so profiling runs during upload.

From the repository root, create and activate a Python virtual environment, copy the environment template, and set a secret key:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
cp .env.example .env
python -c "import secrets; print(secrets.token_urlsafe(48))"
# Put the generated value in SECRET_KEY in .env
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

On Windows PowerShell, activate the environment with `.venv\Scripts\Activate.ps1` and copy the template with `Copy-Item .env.example .env`. The default `DB_ENGINE=sqlite` creates a local SQLite database on the first migration; it is ignored by Git. To use MySQL, install `requirements-mysql.txt`, set `DB_ENGINE=mysql`, and configure `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, and `DB_PORT` in `.env`. To use PostgreSQL, set `DATABASE_URL` to its connection URL. Create that database before running migrations. Keep `.env` and uploaded files private, and set `DEBUG=False`, a unique `SECRET_KEY`, and production `ALLOWED_HOSTS` before deployment.

For S3 storage, set `DATASET_STORAGE_BACKEND=s3`, `AWS_STORAGE_BUCKET_NAME`, and `AWS_S3_REGION_NAME`; set `AWS_S3_ENDPOINT_URL` for an S3-compatible provider. Credentials come from the AWS SDK environment or role chain. Keep bucket public access blocked and grant read/write access only to the API and worker identities. For local storage, mount a persistent directory and set `MEDIA_ROOT` to its path. The API serves downloads through the authenticated dataset route.

#### Backend API

- `GET /api/v1/health/` returns the service health status.
- `POST /api/v1/auth/register/` creates an account and returns an access and refresh JWT. Send `username`, `password`, and an optional `email`.
- `POST /api/v1/auth/token/` exchanges a username and password for JWTs; `POST /api/v1/auth/token/refresh/` rotates a refresh token and returns a new pair. Reuse of the rotated token is rejected.
- `POST /api/v1/auth/logout/` accepts the current refresh token and blacklists it. Send a valid access token in the `Authorization` header; tokens from other accounts are rejected. Access tokens expire after 15 minutes.
- `GET /api/v1/auth/me/` returns the authenticated user's account details.
- `POST /api/v1/datasets/` accepts `multipart/form-data` with a `file` field containing a CSV, JSON, or XLSX file and an optional display `name`. Uploads are limited to 20 MiB by default.
- `GET /api/v1/datasets/` lists only the authenticated user's datasets. Upload responses include `profile_status` (`pending`, `processing`, `ready`, or `failed`). `GET /api/v1/datasets/<id>/` returns its metadata, `GET /api/v1/datasets/<id>/download/` downloads its file, and `DELETE /api/v1/datasets/<id>/` deletes it. Send `Authorization: Bearer <access-token>` to these endpoints.
- `GET /api/v1/datasets/<id>/profile/` profiles the authenticated user's stored CSV, JSON, or XLSX dataset and caches the profile with its metadata. It returns HTTP 202 while a background profile is pending and HTTP 200 with row and column counts, duplicate rows, missing values, frequent values, and numeric or ISO date summaries when ready. Dataset ownership is enforced for this route.
- `POST /api/v1/datasets/profile/` profiles a JSON table. Send `headers` (1–100 unique names) and `rows` (up to 10,000 rows, each matching the header width). Responses include row and column counts, duplicate rows, missing values, frequent values, and numeric or ISO date summaries. Anonymous requests are rate-limited.

Example request body:

```json
{
  "headers": ["Region", "Revenue"],
  "rows": [["West", 120], ["East", 95], ["West", 140]]
}
```

The profiling request body is limited to 8 MB. Invalid headers, unsupported cell values, duplicate column names, or rows with the wrong width return HTTP 400. Dataset uploads must match their CSV, JSON, or XLSX extension; a single file is limited to 20 MiB, 100 columns, 250,000 rows, 2 million cells, and 10,000 characters per cell. XLSX archives are checked for excessive expansion. Each account can store 100 datasets and 200 MiB by default; set `MAX_DATASET_STORAGE_PER_USER` and `MAX_DATASETS_PER_USER` in `backend/.env` to tune these limits. Anonymous profiling clients are limited to 120 requests per hour; registration and login are limited to 10 requests per hour per client, and authenticated dataset uploads are limited to 30 per day per user. Exceeding a rate limit returns HTTP 429.

Example response for the request above:

```json
{
  "rowCount": 3,
  "columnCount": 2,
  "duplicateRows": 0,
  "columns": [
    {"name": "Region", "type": "Text", "filled": 3, "missing": 0, "distinct": 2, "completeness": 100, "commonValues": [{"value": "West", "count": 2}]},
    {"name": "Revenue", "type": "Number", "filled": 3, "missing": 0, "distinct": 3, "completeness": 100, "commonValues": [], "min": 95, "max": 140, "average": 118.33333333333333, "median": 120}
  ]
}
```

The browser continues to analyze and edit data locally. Signing in adds an account panel for saved datasets; choosing **Save to account** uploads the original file to the API, where it is stored under that account and profiled. Opening a saved dataset downloads it back into the local workspace. Changes made in the local table are not uploaded to the saved copy.

Schedule `python manage.py flushexpiredtokens` daily from the `backend/` directory to remove expired refresh-token records.

For files above `DATASET_BACKGROUND_THRESHOLD_BYTES` (2 MiB by default), start Redis and a worker from the `backend/` directory in a second terminal. Set `CELERY_BROKER_URL` if Redis is not at its default local address.

```bash
celery -A config worker --loglevel=info
```

On Windows, run the worker with the solo pool: `celery -A config worker --pool=solo --loglevel=info`.

Run backend checks and API tests from the repository root with `python backend/manage.py check` and `python backend/manage.py test apps.api`.

### Frontend

In a second terminal, copy `frontend/.env.example` to `frontend/.env.local` if you want to override the local API URL. Install dependencies and start the Vite development server:

```bash
cd frontend
npm install
npm run dev
```

Vite prints the local URL when the development server starts.

The local frontend expects the API at `http://127.0.0.1:8000/api/v1`. Start the backend first and keep `CORS_ALLOWED_ORIGINS` in `backend/.env` set to the frontend origin. To enable accounts on the deployed GitHub Pages site, deploy the backend at a public HTTPS URL, allow the Pages origin in the backend's `CORS_ALLOWED_ORIGINS`, and add a repository variable named `VITE_API_BASE_URL` with the API base URL (for example, `https://api.example.com/api/v1`). The Pages workflow uses that variable at build time. Until it is set, the deployed site's account feature reports that it is not configured.

### Free deployment (Render + Supabase)

The repository includes a Render Blueprint at `render.yaml` for a free Django API service. For persistent accounts and uploaded files, pair it with a Supabase Free project for PostgreSQL and private object storage. The app remains usable on the free plans for small projects, with these limits: Render's free API sleeps after 15 minutes without traffic and can take about a minute to wake; Supabase Free includes 500 MB of database, 1 GB of file storage, and may pause projects after a week with very low database activity. Supabase Free does not include downloadable database backups. Avoid using this setup for data that needs guaranteed uptime or backups. See provider limits in [Render's free service guide](https://render.com/docs/free), [Supabase pricing](https://supabase.com/pricing), and [Supabase project pausing](https://supabase.com/docs/guides/platform/free-project-pausing).

1. Create a Supabase project on the Free plan. In **Storage**, create a private bucket named `insightx-private`.
2. In **Storage > Configuration > S3**, enable the S3 protocol and create an access key and secret key. Copy the endpoint and region shown on that S3 configuration page. The API endpoint uses the direct storage hostname, `https://<project-ref>.storage.supabase.co/storage/v1/s3`.
3. In the Supabase **Connect** dialog, select **Session pooler** and copy its PostgreSQL URI. Replace the password placeholder with the database password; URL-encode reserved characters in that password. The session pooler works from Render's IPv4 network and supports Django's prepared statements.
4. In Render, create a **Blueprint** from this GitHub repository and apply `render.yaml`. The blueprint sets up the free API service. Enter the Supabase values when prompted for `DATABASE_URL`, `AWS_S3_ENDPOINT_URL`, `AWS_S3_REGION_NAME`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY`. Keep these values in Render's environment settings, never in Git. The blueprint selects the private bucket and configures uploads up to 20 MiB to profile inline, so a separate Redis service or paid worker isn't needed.
5. After Render finishes deploying, open `https://<render-service>.onrender.com/api/v1/health/`. It should return a healthy status. Render automatically allows the service's `onrender.com` hostname, and CORS is restricted to the GitHub Pages site.
6. In GitHub, open **Settings > Secrets and variables > Actions > Variables** and set `VITE_API_BASE_URL` to `https://<render-service>.onrender.com/api/v1`. Rerun the Pages workflow (or push a new commit) so it rebuilds the frontend with the API URL. Without this variable the Pages site stays in browser-only mode.

Render migrates the Supabase database when the API starts. Keep the Supabase bucket private; the API authorizes every file download through the signed-in account. To run the API locally against PostgreSQL, set `DATABASE_URL`; Django enforces SSL when `DEBUG=False`.

## Available frontend commands

Run these commands from `frontend/`:

```bash
npm run dev     # Start the development server
npm run build   # Create a production build
npm run lint    # Check the frontend source with Oxlint
npm test        # Run parser, filter, duplicate, and profiling unit tests
npm run preview # Preview a production build locally
```
