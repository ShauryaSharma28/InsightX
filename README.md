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
- Use the workspace without an account; files stay in the browser unless the user explicitly saves a dataset to an account.
- Save chosen datasets to an account and load them later from the private saved dataset list.

## Accounts

Accounts are optional. Upload, filter, clean, and export data without signing in; those actions stay in the browser. Choose **Save to account** to upload a snapshot of the current export rows to your account. Sign-in is only needed for saving and loading account datasets. Each account can only list, load, or delete its own saved datasets. Registration uses Django's configured password validators. The frontend stores JWT tokens in browser storage for the current site.

The API provides `POST /api/auth/register/`, `POST /api/auth/login/`, and authenticated `/api/saved-datasets/` endpoints. Apply the Django migrations before starting the backend so the saved dataset table is created.

For a frontend pointed at a deployed backend, set `VITE_API_URL` to the API base URL (for example, `https://api.example.com/api`) in the frontend build environment. The local default in `frontend/.env.example` targets `http://127.0.0.1:8000/api`.

## Project structure

- `frontend/` — React application powered by Vite
- `backend/` — Django project and REST Framework configuration
- `sample-sales.csv` — sample dataset shown on the GitHub repository home and used by the website

## Run the project locally

### Backend

From the repository root, create and activate a Python virtual environment, then install the backend requirements:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

The current Django settings use the included SQLite database (`backend/db.sqlite3`). The `backend/.env.example` file is a reference for database settings; those values are not currently read by the Django settings.

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
