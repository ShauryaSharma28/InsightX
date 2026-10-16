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

function csvCell(value) {
  const text = value ?? '';
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function App() {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ column: null, direction: 'asc' });
  const [isDragging, setIsDragging] = useState(false);

  async function loadFile(file) {
    setPreview(null);
    setError('');
    setSearch('');
    setSort({ column: null, direction: 'asc' });
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('That file type is not supported. Choose a CSV file.');
      return;
    }

    try {
      const rows = parseCsv(await file.text());
      if (rows.length < 2) {
        setError('This file needs a header row and at least one data row.');
        return;
      }

      const headers = rows[0].map((header, index) => header.trim() || `Column ${index + 1}`);
      setPreview({ fileName: file.name, headers, data: rows.slice(1), rowCount: rows.length - 1 });
    } catch {
      setError('The file could not be read. Try choosing it again.');
    }
  }

  function handleFileChange(event) {
    loadFile(event.target.files?.[0]);
    event.target.value = '';
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    loadFile(event.dataTransfer.files?.[0]);
  }

  const searchTerm = search.trim().toLowerCase();
  const filteredData = preview?.data.filter((values) =>
    values.some((value) => value.toLowerCase().includes(searchTerm)),
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

  const missingCells = preview?.data.reduce((count, values) => count + preview.headers.reduce(
    (rowCount, _, index) => rowCount + ((values[index] ?? '').trim() === '' ? 1 : 0), 0,
  ), 0) ?? 0;
  const duplicateRows = preview ? preview.data.length - new Set(
    preview.data.map((values) => preview.headers.map((_, index) => (values[index] ?? '').trim()).join('\u0000')),
  ).size : 0;

  function handleSort(column) {
    setSort((current) => ({
      column,
      direction: current.column === column && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  }

  function downloadCsv() {
    if (!preview) return;
    const content = [preview.headers, ...sortedData].map((row) => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${preview.fileName.replace(/\.csv$/i, '')}-filtered.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="InsightX home">
          <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
          <span>insight<span className="brand-light">x</span></span>
        </a>
        <div className="local-status"><span /> PRIVATE WORKSPACE</div>
      </header>

      <section className="intro" id="top">
        <div className="intro-copy">
          <span className="eyebrow">YOUR DATA, IN A NEW LIGHT</span>
          <h1>Make sense<br />of <em>every row.</em></h1>
          <p>A calm, clear space to explore your spreadsheets.<br className="desktop-break" /> Drop in a CSV and see what’s inside.</p>
        </div>
        <div className="intro-art" aria-hidden="true">
          <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
          <div className="art-card"><span className="art-card-label">DATA, AT A GLANCE</span><div className="art-bars"><i /><i /><i /><i /><i /><i /><i /></div><div className="art-card-foot"><span>YOUR NEXT INSIGHT</span><b>↗</b></div></div>
          <span className="art-spark spark-one">✳</span><span className="art-spark spark-two">✳</span>
        </div>
      </section>

      <section className="workspace" aria-labelledby="upload-title">
        <div className="workspace-heading">
          <div><span className="section-kicker">01 <i /> START WITH A DATASET</span><h2 id="upload-title">Bring your data in</h2></div>
          <div className="csv-pill"><span>↳</span> CSV FILE</div>
        </div>

        <label
          className={`upload-control${isDragging ? ' is-dragging' : ''}`}
          htmlFor="csv-file"
          onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false); }}
          onDrop={handleDrop}
        >
          <span className="upload-icon" aria-hidden="true"><span>↑</span></span>
          <span className="upload-copy"><strong>Drop your CSV here</strong><small>or browse files from your device</small></span>
          <span className="browse-button">Choose a file <span aria-hidden="true">↗</span></span>
          <input id="csv-file" type="file" accept=".csv,text/csv" onChange={handleFileChange} />
        </label>
        <div className="privacy-note"><span aria-hidden="true">◈</span> Your data stays on this device. Nothing is uploaded.</div>

        {error && <p className="error-message" role="alert">{error}</p>}

        {preview && (
          <div className="dataset-area" aria-live="polite">
            <div className="dataset-title-row">
              <div className="dataset-file-icon" aria-hidden="true">▤</div>
              <div className="dataset-name"><h3>{preview.fileName}</h3><p>Dataset overview <span>·</span> {preview.rowCount.toLocaleString()} records</p></div>
              <button className="download-button" type="button" onClick={downloadCsv} disabled={sortedData.length === 0}>
                <span aria-hidden="true">↓</span> Export {search ? 'results' : 'CSV'}
              </button>
            </div>

            <div className="insight-grid" aria-label="Dataset quality summary">
              <article className="insight-card"><span className="insight-label">TOTAL RECORDS</span><strong>{preview.rowCount.toLocaleString()}</strong><span className="insight-caption">rows in your file</span><span className="insight-icon purple">▤</span></article>
              <article className="insight-card"><span className="insight-label">COLUMNS</span><strong>{preview.headers.length}</strong><span className="insight-caption">fields to explore</span><span className="insight-icon blue">◫</span></article>
              <article className="insight-card"><span className="insight-label">EMPTY CELLS</span><strong>{missingCells.toLocaleString()}</strong><span className="insight-caption">{missingCells === 0 ? 'looking complete' : 'worth a closer look'}</span><span className="insight-icon yellow">◌</span></article>
              <article className="insight-card"><span className="insight-label">DUPLICATE ROWS</span><strong>{duplicateRows.toLocaleString()}</strong><span className="insight-caption">{duplicateRows === 0 ? 'no repeats found' : 'repeated records'}</span><span className="insight-icon green">⧉</span></article>
            </div>

            <div className="table-heading">
              <div><span className="section-kicker">02 <i /> EXPLORE YOUR DATA</span><h3>Rows &amp; columns</h3></div>
              <label className="search-control">
                <span aria-hidden="true">⌕</span>
                <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search this dataset" aria-label="Search all columns" />
                {search && <span className="result-count">{filteredData.length} found</span>}
              </label>
            </div>

            <div className="table-scroll">
              <table>
                <thead><tr>{preview.headers.map((header, index) => <th key={`${header}-${index}`}>
                  <button className="sort-button" type="button" onClick={() => handleSort(index)} aria-label={`Sort by ${header}${sort.column === index ? `, ${sort.direction}ending` : ''}`}>
                    {header}<span aria-hidden="true">{sort.column === index ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
                  </button>
                </th>)}</tr></thead>
                <tbody>{sortedData.slice(0, 8).map((values, rowIndex) => (
                  <tr key={rowIndex}>{preview.headers.map((_, columnIndex) => <td key={columnIndex}>{values[columnIndex]?.trim() || <span className="empty-cell">Empty</span>}</td>)}</tr>
                ))}{sortedData.length === 0 && <tr><td colSpan={preview.headers.length} className="empty-results">No rows match your search. Try another term.</td></tr>}</tbody>
              </table>
            </div>
            <div className="table-footnote">Showing {Math.min(8, sortedData.length)} of {sortedData.length.toLocaleString()} matching records <span>·</span> Select a column heading to sort</div>
          </div>
        )}
      </section>
      <footer><span>© INSIGHTX</span><span>MADE FOR CLEARER THINKING <i>✳</i></span></footer>
    </main>
  );
}

export default App;
