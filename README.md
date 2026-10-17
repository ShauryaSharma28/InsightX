# InsightX

InsightX is a browser based workspace for exploring and cleaning CSV datasets.

**Live website:** [shubham01-shubh.github.io/InsightX](https://shubham01-shubh.github.io/InsightX/)

## Features

- Open a CSV from your device or explore the 62-row sales sample in the repository root. It includes multiple products, regions, and statuses, plus missing values and duplicate records for trying the data quality tools.
- Keep data on your device while you search, sort, filter, and paginate rows.
- Choose visible columns and export the current view as a cleaned CSV.
- Review missing cells, duplicate rows, and per-column data quality.
- Compare numeric measures across categories using totals or averages.
- Download a column report with types, completeness, distinct counts, and numeric ranges.

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
