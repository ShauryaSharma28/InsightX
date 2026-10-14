# InsightX

InsightX is a personal data analytics studio built with React and Django REST Framework.

## Project structure

- `frontend/` — React application powered by Vite
- `backend/` — Django project and REST Framework configuration

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
