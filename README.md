# InsightX

InsightX is a browser based workspace for exploring and cleaning CSV and JSON datasets.

**Live website:** [shubham01-shubh.github.io/InsightX](https://shubham01-shubh.github.io/InsightX/)

## Features

- Open a comma-, semicolon-, or tab-separated CSV or a JSON array of records from your device, or explore the 62-row sales sample in the repository root. It includes multiple products, regions, and statuses, plus missing values and duplicate records for trying the data quality tools.
- Get actionable import errors for malformed JSON and unclosed CSV quotes.
- Blank or repeated column names receive unique labels when a dataset is opened.
- Uneven rows are aligned to the widest row so extra cells are retained and missing cells stay empty.
- Keep data on your device while you search, sort, filter, and paginate rows; choose 12, 24, or 50 rows per page.
- Filter for empty or filled cells in a selected column or across the whole row; match text by exact value, exclusion, prefix, or suffix.
- Clear an active search with one click or the Escape key.
- Choose visible columns, copy the filtered view into a spreadsheet, and export cleaned CSV or JSON records; exports can trim whitespace and remove duplicates.
- Review missing cells, duplicate rows in the current view, and per-column data quality.
- Profile columns for either the full dataset or the current filtered view, and export rows with missing values for follow-up cleanup.
- Preview exact value replacements and optionally apply them to exported rows.
- Filter the column profile to focus on fields with missing values.
- Identify ISO date columns and inspect their earliest and latest values.
- Compare numeric measures across the matching rows and categories using totals or averages.
- Export the current chart as CSV data or a PNG image.
- Inspect frequent repeated values in column profiles, and download a report with types, completeness, distinct counts, numeric ranges, averages, and medians.

## Project structure

- `frontend/` — React application powered by Vite
- `backend/` - Optional Django REST API for health checks and dataset profiling
- `sample-sales.csv` — sample dataset shown on the GitHub repository home and used by the website

## Run the project locally

### Backend

The frontend works on its own and keeps imported files in the browser. The optional API does not store submitted rows; it calculates a profile for each request and returns the summary.

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

On Windows PowerShell, activate the environment with `.venv\Scripts\Activate.ps1` and copy the template with `Copy-Item .env.example .env`. Django creates a local SQLite database on the first migration; it is ignored by Git. Set `DEBUG=False`, a unique `SECRET_KEY`, and production `ALLOWED_HOSTS` before deploying the API.

#### Backend API

- `GET /api/v1/health/` returns the service health status.
- `POST /api/v1/datasets/profile/` profiles a JSON table. Send `headers` (1–100 unique names) and `rows` (up to 10,000 rows, each matching the header width). Responses include row and column counts, duplicate rows, missing values, frequent values, and numeric or ISO date summaries. Anonymous requests are rate-limited.

Example request body:

```json
{
  "headers": ["Region", "Revenue"],
  "rows": [["West", 120], ["East", 95], ["West", 140]]
}
```

The current browser app continues to analyze files locally and does not call this API.

### Frontend

In a second terminal, install dependencies and start the Vite development server:

```bash
cd frontend
npm install
npm run dev
```

Vite prints the local URL when the development server starts.

## Available frontend commands

Run these commands from `frontend/`:

```bash
npm run dev     # Start the development server
npm run build   # Create a production build
npm run lint    # Check the frontend source with Oxlint
npm test        # Run parser, filter, duplicate, and profiling unit tests
npm run preview # Preview a production build locally
```
