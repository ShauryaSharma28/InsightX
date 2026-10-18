# InsightX

InsightX is a browser based workspace for exploring and cleaning CSV and JSON datasets.

**Live website:** [shubham01-shubh.github.io/InsightX](https://shubham01-shubh.github.io/InsightX/)

## Features

- Open a comma-, semicolon-, or tab-separated CSV or a JSON array of records from your device, or explore the 62-row sales sample in the repository root. It includes multiple products, regions, and statuses, plus missing values and duplicate records for trying the data quality tools.
- Blank or repeated column names receive unique labels when a dataset is opened.
- Uneven rows are aligned to the widest row so extra cells are retained and missing cells stay empty.
- Keep data on your device while you search, sort, filter, and paginate rows; choose 12, 24, or 50 rows per page.
- Filter for empty or filled cells in a selected column or across the whole row.
- Clear an active search with one click or the Escape key.
- Choose visible columns and export the current view as cleaned CSV or JSON records; export buttons show the resulting row count.
- Review missing cells, duplicate rows in the current view, and per-column data quality.
- Filter the column profile to focus on fields with missing values.
- Compare numeric measures across the matching rows and categories using totals or averages.
- Export the values currently shown in the chart as a CSV file.
- Download a column report with types, completeness, distinct counts, numeric ranges, averages, and medians.

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
npm run preview # Preview a production build locally
```
