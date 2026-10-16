import { useState } from 'react';
import './App.css';

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== '')) rows.push(row);
  return rows;
}

function App() {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ column: null, direction: 'asc' });

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    setPreview(null);
    setError('');
    setSearch('');
    setSort({ column: null, direction: 'asc' });
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Choose a CSV file to preview.');
      return;
    }

    try {
      const rows = parseCsv(await file.text());
      if (rows.length < 2) {
        setError('This file needs a header row and at least one data row.');
        return;
      }

      const headers = rows[0].map((header, index) => header.trim() || `Column ${index + 1}`);
      setPreview({
        fileName: file.name,
        headers,
        data: rows.slice(1),
        rowCount: rows.length - 1,
      });
    } catch {
      setError('The file could not be read. Try choosing it again.');
    }
  }

  const filteredData = preview?.data.filter((values) =>
    values.some((value) => value.toLowerCase().includes(search.trim().toLowerCase())),
  ) ?? [];
  const sortedData = sort.column === null ? filteredData : [...filteredData].sort((left, right) => {
    const leftValue = (left[sort.column] ?? '').trim();
    const rightValue = (right[sort.column] ?? '').trim();
    const leftNumber = Number(leftValue);
    const rightNumber = Number(rightValue);
    const bothNumeric = leftValue !== '' && rightValue !== '' && Number.isFinite(leftNumber) && Number.isFinite(rightNumber);
    const comparison = bothNumeric
      ? leftNumber - rightNumber
      : leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: 'base' });
    return sort.direction === 'asc' ? comparison : -comparison;
  });

  function handleSort(column) {
    setSort((current) => ({
      column,
      direction: current.column === column && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <span className="eyebrow">PERSONAL DATA ANALYTICS</span>
        <h1>InsightX</h1>
        <p>Bring your data into focus.</p>
      </header>

      <section className="workspace" aria-labelledby="upload-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">GET STARTED</span>
            <h2 id="upload-title">Preview a dataset</h2>
            <p>Choose a CSV file to check its columns and sample rows.</p>
          </div>
          <span className="file-badge">CSV</span>
        </div>

        <label className="upload-control" htmlFor="csv-file">
          <span className="upload-icon" aria-hidden="true">↑</span>
          <span className="upload-copy"><strong>Choose a CSV file</strong><small>Your file stays in this browser.</small></span>
          <span className="browse-button">Browse files</span>
          <input id="csv-file" type="file" accept=".csv,text/csv" onChange={handleFileChange} />
        </label>

        {error && <p className="error-message" role="alert">{error}</p>}

        {preview && (
          <div className="preview" aria-live="polite">
            <div className="preview-heading">
              <div><h3>{preview.fileName}</h3><p>{search ? `${filteredData.length} matching rows` : `Showing the first ${Math.min(5, preview.rowCount)} rows`}</p></div>
              <div className="dataset-stats"><span><strong>{preview.rowCount}</strong> rows</span><span><strong>{preview.headers.length}</strong> columns</span></div>
            </div>
            <label className="search-control">
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search all columns"
                aria-label="Search all columns"
              />
            </label>
            <div className="table-scroll">
              <table>
                <thead><tr>{preview.headers.map((header, index) => <th key={`${header}-${index}`}>
                  <button className="sort-button" type="button" onClick={() => handleSort(index)} aria-label={`Sort by ${header}${sort.column === index ? `, ${sort.direction}ending` : ''}`}>
                    {header}<span aria-hidden="true">{sort.column === index ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span>
                  </button>
                </th>)}</tr></thead>
                <tbody>{sortedData.slice(0, 5).map((values, rowIndex) => (
                  <tr key={rowIndex}>{preview.headers.map((_, columnIndex) => <td key={columnIndex}>{values[columnIndex] || '—'}</td>)}</tr>
                ))}{sortedData.length === 0 && <tr><td colSpan={preview.headers.length} className="empty-results">No rows match your search.</td></tr>}</tbody>
              </table>
            </div>
          </div>
        )}
      </section>
      <footer>InsightX <span>·</span> A clearer view of your data</footer>
    </main>
  );
}

export default App;
