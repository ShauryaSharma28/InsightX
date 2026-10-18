import { useMemo, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import sampleCsv from '../../sample-sales.csv?raw';
import { countDuplicateRows, filterRows, getColumnProfiles, getImportErrorMessage, normalizeRows, parseCsv, parseJson, previewValueReplacement, uniqueHeaders } from './dataUtils.js';
import './App.css';

function csvCell(value) {
  const text = value ?? '';
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = bytes / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${units[unit]}`;
}

function downloadCsvFile(fileName, content) {
  const csv = content.startsWith('\uFEFF') ? content : `\uFEFF${content}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadJsonFile(fileName, records) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(records, null, 2)], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function App() {
  const chartRef = useRef(null);
  const importRequest = useRef(0);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ column: null, direction: 'asc' });
  const [isDragging, setIsDragging] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(12);
  const [chartColumn, setChartColumn] = useState(null);
  const [chartGroupColumn, setChartGroupColumn] = useState('');
  const [chartAggregate, setChartAggregate] = useState('sum');
  const [hideEmpty, setHideEmpty] = useState(false);
  const [removeDuplicates, setRemoveDuplicates] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState([]);
  const [filterColumn, setFilterColumn] = useState('');
  const [filterOperator, setFilterOperator] = useState('contains');
  const [filterValue, setFilterValue] = useState('');
  const [showIncompleteColumns, setShowIncompleteColumns] = useState(false);
  const [replacementColumn, setReplacementColumn] = useState('');
  const [replacementFind, setReplacementFind] = useState('');
  const [replacementValue, setReplacementValue] = useState('');
  const [replacementEnabled, setReplacementEnabled] = useState(false);

  function setDataset(fileName, rows, fileSize) {
    const { headers, data } = normalizeRows(rows);
    const firstCategory = headers.findIndex((_, index) => {
      const values = data.map((row) => (row[index] ?? '').trim()).filter(Boolean);
      return values.length > 1 && new Set(values).size < values.length && new Set(values).size <= 24;
    });
    setPreview({ fileName, fileSize, headers, data, rowCount: data.length });
    setVisibleColumns(headers.map((_, index) => index));
    setChartColumn(null);
    setChartGroupColumn(firstCategory < 0 ? '' : String(firstCategory));
    setChartAggregate('sum');
    setPage(0);
    setFilterColumn('');
    setFilterValue('');
    setReplacementColumn('');
    setReplacementFind('');
    setReplacementValue('');
    setReplacementEnabled(false);
  }

  function loadSampleDataset() {
    importRequest.current += 1;
    setIsLoading(false);
    setError('');
    try {
      const rows = parseCsv(sampleCsv);
      if (rows.length < 2) throw new Error('Sample file is empty');
      setSearch('');
      setSort({ column: null, direction: 'asc' });
      setDataset('sample-sales.csv', rows, new Blob([sampleCsv]).size);
    } catch {
      setError('The sample dataset could not be loaded. Try downloading the CSV instead.');
    }
  }

  async function loadFile(file) {
    const requestId = importRequest.current + 1;
    importRequest.current = requestId;
    setError('');
    if (!file) {
      setIsLoading(false);
      return;
    }

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'csv' && extension !== 'json') {
      setIsLoading(false);
      setError('That file type is not supported. Choose a CSV or JSON file.');
      return;
    }

    setIsLoading(true);
    try {
      const fileText = await file.text();
      if (requestId !== importRequest.current) return;
      const rows = extension === 'json' ? parseJson(fileText) : parseCsv(fileText);
      if (rows.length < 2) {
        setError('This file needs field names and at least one data row.');
        return;
      }

      setSearch('');
      setSort({ column: null, direction: 'asc' });
      setDataset(file.name, rows, file.size);
    } catch (cause) {
      if (requestId === importRequest.current) setError(getImportErrorMessage(cause, extension));
    } finally {
      if (requestId === importRequest.current) setIsLoading(false);
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
  const filteredData = useMemo(() => filterRows(preview?.data ?? [], {
    searchTerm,
    hideEmpty,
    filterColumn,
    filterOperator,
    filterValue,
  }), [filterColumn, filterOperator, filterValue, hideEmpty, preview, searchTerm]);
  const sortedData = useMemo(() => sort.column === null ? filteredData : [...filteredData].sort((left, right) => {
    const leftValue = (left[sort.column] ?? '').trim();
    const rightValue = (right[sort.column] ?? '').trim();
    const leftNumber = Number(leftValue);
    const rightNumber = Number(rightValue);
    const bothNumeric = leftValue !== '' && rightValue !== '' && Number.isFinite(leftNumber) && Number.isFinite(rightNumber);
    const comparison = bothNumeric
      ? leftNumber - rightNumber
      : leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: 'base' });
    return sort.direction === 'asc' ? comparison : -comparison;
  }), [filteredData, sort]);

  const missingCells = useMemo(() => preview?.data.reduce((count, values) => count + preview.headers.reduce(
    (rowCount, _, index) => rowCount + ((values[index] ?? '').trim() === '' ? 1 : 0), 0,
  ), 0) ?? 0, [preview]);
  const duplicateRows = useMemo(() => preview ? countDuplicateRows(preview.data, preview.headers) : 0, [preview]);
  const duplicateRowsInView = useMemo(() => preview ? countDuplicateRows(sortedData, preview.headers) : 0, [preview, sortedData]);
  const exportRows = useMemo(() => removeDuplicates && preview
    ? [...new Map(sortedData.map((values) => [preview.headers.map((_, index) => (values[index] ?? '').trim()).join('\u0000'), values])).values()]
    : sortedData, [preview, removeDuplicates, sortedData]);
  const selectedColumns = useMemo(() => preview?.headers.map((_, index) => index).filter((index) => visibleColumns.includes(index)) ?? [], [preview, visibleColumns]);
  const effectiveReplacementColumn = replacementColumn !== '' && selectedColumns.includes(Number(replacementColumn))
    ? replacementColumn
    : '';
  const replacementColumns = useMemo(() => effectiveReplacementColumn === ''
    ? selectedColumns
    : [Number(effectiveReplacementColumn)], [effectiveReplacementColumn, selectedColumns]);
  const replacementPreview = useMemo(() => previewValueReplacement(
    exportRows, replacementColumns, replacementFind, replacementValue,
  ), [exportRows, replacementColumns, replacementFind, replacementValue]);
  const downloadableRows = useMemo(() => replacementEnabled ? replacementPreview.rows : exportRows, [exportRows, replacementEnabled, replacementPreview]);
  const numericColumns = useMemo(() => preview?.headers.map((header, index) => ({ header, index })).filter(({ index }) => {
    const values = preview.data.map((row) => Number((row[index] ?? '').trim())).filter(Number.isFinite);
    return values.length > 0 && values.length >= preview.data.filter((row) => (row[index] ?? '').trim()).length * 0.7;
  }) ?? [], [preview]);
  const categoricalColumns = useMemo(() => preview?.headers.map((header, index) => ({ header, index })).filter(({ index }) => {
    const values = preview.data.map((row) => (row[index] ?? '').trim()).filter(Boolean);
    const distinct = new Set(values).size;
    return distinct > 1 && distinct < values.length && distinct <= 24;
  }) ?? [], [preview]);
  const activeChartColumn = chartColumn ?? numericColumns[0]?.index;
  const chartData = useMemo(() => {
    if (!preview || activeChartColumn === undefined) return [];
    if (chartGroupColumn === '') return filteredData.map((row, index) => ({ row, index }))
      .filter(({ row }) => {
        const value = (row[activeChartColumn] ?? '').trim();
        return value !== '' && Number.isFinite(Number(value));
      })
      .slice(0, 12)
      .map(({ row, index }) => ({
        label: row.find((value, columnIndex) => columnIndex !== activeChartColumn && (value ?? '').trim()) || `Row ${index + 1}`,
        value: Number((row[activeChartColumn] ?? '').trim()),
      }));
    const groups = new Map();
    filteredData.forEach((row) => {
      const value = Number((row[activeChartColumn] ?? '').trim());
      if (!Number.isFinite(value) || (row[activeChartColumn] ?? '').trim() === '') return;
      const label = (row[Number(chartGroupColumn)] ?? '').trim() || '(empty)';
      const group = groups.get(label) ?? { label, value: 0, count: 0 };
      group.value += value;
      group.count += 1;
      groups.set(label, group);
    });
    return [...groups.values()].map((group) => ({
      label: group.label,
      value: chartAggregate === 'average' ? group.value / group.count : group.value,
    })).sort((left, right) => right.value - left.value).slice(0, 12);
  }, [activeChartColumn, chartAggregate, chartGroupColumn, filteredData, preview]);
  const pageCount = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const visibleData = sortedData.slice(page * pageSize, (page + 1) * pageSize);
  const columnProfiles = useMemo(() => getColumnProfiles(preview?.headers ?? [], preview?.data ?? []), [preview]);
  const displayedColumnProfiles = useMemo(() => showIncompleteColumns
    ? columnProfiles.filter((column) => column.missing > 0)
    : columnProfiles, [columnProfiles, showIncompleteColumns]);

  function handleSort(column) {
    setSort((current) => ({
      column,
      direction: current.column === column && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  }

  function downloadCsv() {
    if (!preview) return;
    const content = [[...selectedColumns.map((index) => preview.headers[index])], ...downloadableRows.map((row) => selectedColumns.map((index) => row[index] ?? ''))].map((row) => row.map(csvCell).join(',')).join('\r\n');
    downloadCsvFile(`${preview.fileName.replace(/\.(csv|json)$/i, '')}${removeDuplicates ? '-deduplicated' : ''}-cleaned.csv`, content);
  }

  function downloadJson() {
    if (!preview) return;
    const headers = uniqueHeaders(selectedColumns.map((index) => preview.headers[index]));
    const records = downloadableRows.map((row) => Object.fromEntries(
      headers.map((header, index) => [header, row[selectedColumns[index]] ?? '']),
    ));
    downloadJsonFile(`${preview.fileName.replace(/\.(csv|json)$/i, '')}${removeDuplicates ? '-deduplicated' : ''}-cleaned.json`, records);
  }

  function downloadChartData() {
    if (!preview || activeChartColumn === undefined || chartData.length === 0) return;
    const labelHeader = chartGroupColumn === '' ? 'Label' : preview.headers[Number(chartGroupColumn)];
    const report = [
      [labelHeader, preview.headers[activeChartColumn]],
      ...chartData.map(({ label, value }) => [label, value]),
    ];
    const content = report.map((row) => row.map(csvCell).join(',')).join('\r\n');
    downloadCsvFile(`${preview.fileName.replace(/\.(csv|json)$/i, '')}-chart-data.csv`, content);
  }

  function downloadChartPng() {
    const svg = chartRef.current?.querySelector('svg');
    if (!svg) return;

    const { width, height } = svg.getBoundingClientRect();
    if (!width || !height) return;

    const chartSvg = svg.cloneNode(true);
    chartSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    chartSvg.setAttribute('width', String(width));
    chartSvg.setAttribute('height', String(height));
    const svgUrl = URL.createObjectURL(new Blob(
      [new XMLSerializer().serializeToString(chartSvg)],
      { type: 'image/svg+xml;charset=utf-8' },
    ));
    const image = new Image();
    image.onload = () => {
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const context = canvas.getContext('2d');
      if (!context) {
        URL.revokeObjectURL(svgUrl);
        return;
      }

      context.fillStyle = '#111814';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(svgUrl);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const pngUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = `${preview.fileName.replace(/\.(csv|json)$/i, '')}-chart.png`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
      }, 'image/png');
    };
    image.onerror = () => URL.revokeObjectURL(svgUrl);
    image.src = svgUrl;
  }

  function downloadColumnReport() {
    if (!preview) return;
    const report = [
      ['Column', 'Type', 'Filled', 'Missing', 'Completeness (%)', 'Distinct values', 'Minimum', 'Maximum', 'Average', 'Median'],
      ...columnProfiles.map((column) => [column.header, column.type, column.filled, column.missing, column.completeness, column.distinct, column.min ?? '', column.max ?? '', column.average ?? '', column.median ?? '']),
    ];
    const content = report.map((row) => row.map(csvCell).join(',')).join('\r\n');
    downloadCsvFile(`${preview.fileName.replace(/\.(csv|json)$/i, '')}-column-report.csv`, content);
  }

  function downloadSampleCsv() {
    downloadCsvFile('sample-sales.csv', sampleCsv);
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
          <p>A calm, clear space to explore your data.<br className="desktop-break" /> Drop in a CSV or JSON file and see what’s inside.</p>
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
          <div className="csv-pill"><span>↳</span> CSV / JSON</div>
        </div>

        <label
          className={`upload-control${isDragging ? ' is-dragging' : ''}`}
          htmlFor="dataset-file"
          onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false); }}
          onDrop={handleDrop}
        >
          <span className="upload-icon" aria-hidden="true"><span>↑</span></span>
          <span className="upload-copy"><strong>Drop your CSV or JSON here</strong><small>or browse files from your device</small></span>
          <span className="browse-button">Choose a file <span aria-hidden="true">↗</span></span>
          <input id="dataset-file" type="file" accept=".csv,.json,text/csv,application/json" onChange={handleFileChange} />
        </label>
        <div className="privacy-note"><span aria-hidden="true">◈</span> Your data stays on this device. Nothing is uploaded. CSV and JSON files are supported.</div>
        <div className="sample-actions"><button className="sample-button" type="button" onClick={loadSampleDataset}>Explore the 62-row sample <span>↗</span></button><button className="sample-download" type="button" onClick={downloadSampleCsv}>Download sample CSV ↓</button></div>

        {isLoading && <p className="import-status" role="status">Reading your file…</p>}
        {error && <p className="error-message" role="alert">{error}</p>}

        {preview && (
          <div className="dataset-area" aria-live="polite">
            <div className="dataset-title-row">
              <div className="dataset-file-icon" aria-hidden="true">▤</div>
              <div className="dataset-name"><h3>{preview.fileName}</h3><p>Dataset overview <span>·</span> {preview.rowCount.toLocaleString()} records <span>·</span> {formatFileSize(preview.fileSize)}</p></div>
              <button className="download-button export-json-button" type="button" onClick={downloadJson} disabled={downloadableRows.length === 0}>
                Export {removeDuplicates || replacementEnabled ? 'cleaned JSON' : 'JSON'} ({downloadableRows.length.toLocaleString()})
              </button>
              <button className="download-button" type="button" onClick={downloadCsv} disabled={downloadableRows.length === 0}>
                <span aria-hidden="true">↓</span> Export {removeDuplicates || replacementEnabled ? 'cleaned CSV' : 'CSV'} ({downloadableRows.length.toLocaleString()})
              </button>
            </div>

            <div className="analysis-grid">
              <section className="analysis-card chart-card">
                <div className="analysis-heading"><div><span className="section-kicker">03 <i /> QUICK VISUAL</span><h3>Compare values across groups</h3></div><span className="chart-badge">✳ LIVE SUMMARY</span></div>
                <div className="chart-controls">
                  {numericColumns.length > 0 && <label>MEASURE<select aria-label="Choose chart measure" value={activeChartColumn} onChange={(event) => setChartColumn(Number(event.target.value))}>{numericColumns.map(({ header, index }) => <option key={index} value={index}>{header}</option>)}</select></label>}
                  <label>GROUP BY<select aria-label="Group chart by" value={chartGroupColumn} onChange={(event) => setChartGroupColumn(event.target.value)}><option value="">Each row</option>{categoricalColumns.map(({ header, index }) => <option key={index} value={index}>{header}</option>)}</select></label>
                  {chartGroupColumn !== '' && <label>CALCULATION<select aria-label="Choose chart calculation" value={chartAggregate} onChange={(event) => setChartAggregate(event.target.value)}><option value="sum">Total</option><option value="average">Average</option></select></label>}
                </div>
                {chartData.length ? <div className="chart-wrap" ref={chartRef}><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}><CartesianGrid vertical={false} stroke="#2b3930" /><XAxis dataKey="label" tick={{ fill: '#a1ada2', fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: '#a1ada2', fontSize: 10 }} axisLine={false} tickLine={false} width={42} /><Tooltip cursor={{ fill: '#1d2a20' }} contentStyle={{ border: '1px solid #344335', borderRadius: 8, background: '#18221c', color: '#e4eadf', fontSize: 12 }} /><Bar dataKey="value" name={preview.headers[activeChartColumn]} fill="#b4d27c" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div> : <p className="no-chart">{numericColumns.length ? 'No matching rows with numeric values for these filters.' : 'No numeric column found. Add numeric values to create a chart.'}</p>}
                <div className="chart-footer"><p className="chart-note">{chartGroupColumn === '' ? 'First 12 rows matching current filters' : `${chartAggregate === 'sum' ? 'Totals' : 'Averages'} across matching rows · highest values first`}</p>{chartData.length > 0 && <div className="chart-export-actions"><button className="report-button" type="button" onClick={downloadChartData}>Export chart CSV</button><button className="report-button" type="button" onClick={downloadChartPng}>Export chart PNG</button></div>}</div>
              </section>
              <section className="analysis-card quality-card"><div className="analysis-heading"><div><span className="section-kicker">DATA HYGIENE</span><h3>Clean up your export</h3></div></div>
                <label className="toggle-row"><span><strong>Hide incomplete rows</strong><small>Exclude rows with empty cells from the table</small></span><input type="checkbox" checked={hideEmpty} onChange={(event) => { setHideEmpty(event.target.checked); setPage(0); }} /></label>
                <label className="toggle-row"><span><strong>Remove duplicate rows</strong><small>{duplicateRowsInView.toLocaleString()} repeated {duplicateRowsInView === 1 ? 'row' : 'rows'} in current view</small></span><input type="checkbox" checked={removeDuplicates} onChange={(event) => setRemoveDuplicates(event.target.checked)} /></label>
                <div className="replacement-tool">
                  <div className="replacement-heading"><strong>Find and replace</strong><small>Preview exact cell matches in exported rows</small></div>
                  <div className="replacement-fields">
                    <label>Column<select value={effectiveReplacementColumn} onChange={(event) => { setReplacementColumn(event.target.value); setReplacementEnabled(false); }}><option value="">All visible columns</option>{selectedColumns.map((index) => <option key={index} value={index}>{preview.headers[index]}</option>)}</select></label>
                    <label>Find exact value<input value={replacementFind} onChange={(event) => { setReplacementFind(event.target.value); setReplacementEnabled(false); }} placeholder="Value to find" /></label>
                    <label>Replace with<input value={replacementValue} onChange={(event) => { setReplacementValue(event.target.value); setReplacementEnabled(false); }} placeholder="New value" /></label>
                  </div>
                  <div className="replacement-status"><small>{replacementPreview.count.toLocaleString()} exact {replacementPreview.count === 1 ? 'match' : 'matches'} in export rows</small><button className="report-button" type="button" aria-pressed={replacementEnabled} disabled={replacementPreview.count === 0} onClick={() => setReplacementEnabled((current) => !current)}>{replacementEnabled ? 'Disable replacement' : 'Use in export'}</button></div>
                  {replacementPreview.examples.length > 0 && <ul className="replacement-examples">{replacementPreview.examples.map((example) => <li key={`${example.row}-${example.column}`}><span>{preview.headers[example.column]} · export row {example.row}</span><code>{example.before || '(empty)'}</code><span aria-hidden="true">→</span><code>{example.after || '(empty)'}</code></li>)}</ul>}
                </div>
              </section>
            </div>

            <section className="column-section">
              <div className="analysis-heading">
                <div><span className="section-kicker">COLUMN PROFILE</span><h3>Know what each field contains</h3></div>
                <div className="profile-actions">
                  <button className="report-button" type="button" aria-pressed={showIncompleteColumns} onClick={() => setShowIncompleteColumns((current) => !current)}>{showIncompleteColumns ? 'Show all columns' : 'Show incomplete only'}</button>
                  <button className="report-button" type="button" onClick={downloadColumnReport}>Download report</button>
                </div>
              </div>
              <div className="profile-grid">
                {displayedColumnProfiles.map((column) => <article className="profile-card" key={column.header}><div className="profile-title"><strong>{column.header}</strong><span>{column.type}</span></div><div className="profile-stats"><span><b>{column.filled.toLocaleString()}</b> filled</span><span><b>{column.distinct.toLocaleString()}</b> unique</span><span><b>{column.missing.toLocaleString()}</b> empty</span><span><b>{column.completeness.toLocaleString(undefined, { maximumFractionDigits: 1 })}%</b> complete</span>{column.type === 'Date' && <><span><b>{column.min}</b> earliest</span><span><b>{column.max}</b> latest</span></>}{column.average !== null && <><span><b>{column.min.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b> min</span><span><b>{column.max.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b> max</span><span><b>{column.average.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b> average</span><span><b>{column.median.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b> median</span></>}</div><div className="profile-meter"><i style={{ width: `${column.completeness}%` }} /></div></article>)}
                {displayedColumnProfiles.length === 0 && <p className="profile-empty">Every column is complete. No columns have missing values.</p>}
              </div>
            </section>

            <div className="insight-grid" aria-label="Dataset quality summary">
              <article className="insight-card"><span className="insight-label">TOTAL RECORDS</span><strong>{preview.rowCount.toLocaleString()}</strong><span className="insight-caption">rows in your file</span><span className="insight-icon purple">▤</span></article>
              <article className="insight-card"><span className="insight-label">COLUMNS</span><strong>{preview.headers.length}</strong><span className="insight-caption">fields to explore</span><span className="insight-icon blue">◫</span></article>
              <article className="insight-card"><span className="insight-label">EMPTY CELLS</span><strong>{missingCells.toLocaleString()}</strong><span className="insight-caption">{missingCells === 0 ? 'looking complete' : 'worth a closer look'}</span><span className="insight-icon yellow">◌</span></article>
              <article className="insight-card"><span className="insight-label">DUPLICATE ROWS</span><strong>{duplicateRows.toLocaleString()}</strong><span className="insight-caption">{duplicateRows === 0 ? 'no repeats found' : 'repeated records'}</span><span className="insight-icon green">⧉</span></article>
            </div>

            <div className="table-heading">
              <div><span className="section-kicker">02 <i /> EXPLORE YOUR DATA</span><h3>Rows &amp; columns</h3></div>
              <div className="search-control">
                <span aria-hidden="true">⌕</span>
                <input type="search" value={search} onKeyDown={(event) => { if (event.key === 'Escape') { setSearch(''); setPage(0); } }} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder="Search this dataset" aria-label="Search all columns" />
                {search && <span className="result-count">{filteredData.length} found</span>}
                {search && <button className="clear-search" type="button" onClick={() => { setSearch(''); setPage(0); }} aria-label="Clear search">×</button>}
              </div>
            </div>
            <div className="filter-toolbar">
              <label>Filter column<select value={filterColumn} onChange={(event) => { setFilterColumn(event.target.value); setPage(0); }}><option value="">All columns</option>{preview.headers.map((header, index) => <option value={index} key={index}>{header}</option>)}</select></label>
              <label>Condition<select value={filterOperator} onChange={(event) => { setFilterOperator(event.target.value); setPage(0); }}><option value="contains">contains</option><option value="equals">equals</option><option value="greater">greater than</option><option value="less">less than</option><option value="empty">is empty</option><option value="notEmpty">is not empty</option></select></label>
              <label className="filter-value">Value<input value={filterValue} disabled={filterOperator === 'empty' || filterOperator === 'notEmpty'} onChange={(event) => { setFilterValue(event.target.value); setPage(0); }} placeholder={filterOperator === 'empty' || filterOperator === 'notEmpty' ? 'Not needed' : 'Type a value'} /></label>
              <details className="column-picker"><summary>Columns ({selectedColumns.length}/{preview.headers.length})</summary><div className="column-picker-menu">{preview.headers.map((header, index) => <label key={index}><input type="checkbox" checked={visibleColumns.includes(index)} disabled={visibleColumns.length === 1 && visibleColumns.includes(index)} onChange={(event) => setVisibleColumns((current) => event.target.checked ? [...current, index].sort((a, b) => a - b) : current.filter((column) => column !== index))} />{header}</label>)}</div></details>
            </div>
            <div className="table-controls"><span>{sortedData.length.toLocaleString()} rows match current view</span><div className="table-control-actions"><label>Rows per page<select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0); }}><option value={12}>12</option><option value={24}>24</option><option value={50}>50</option></select></label><button type="button" onClick={() => { setSearch(''); setHideEmpty(false); setSort({ column: null, direction: 'asc' }); setFilterColumn(''); setFilterValue(''); setFilterOperator('contains'); setPage(0); }}>Reset view</button></div></div>

            <div className="table-scroll">
              <table>
                <thead><tr>{selectedColumns.map((index) => { const header = preview.headers[index]; return <th key={`${header}-${index}`} aria-sort={sort.column === index ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button className="sort-button" type="button" onClick={() => handleSort(index)} aria-label={`Sort by ${header}${sort.column === index ? `, ${sort.direction}ending` : ''}`}>
                    {header}<span aria-hidden="true">{sort.column === index ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
                  </button>
                </th>; })}</tr></thead>
                <tbody>{visibleData.map((values, rowIndex) => (
                  <tr key={page * pageSize + rowIndex}>{selectedColumns.map((columnIndex) => <td key={columnIndex}>{values[columnIndex]?.trim() || <span className="empty-cell">Empty</span>}</td>)}</tr>
                ))}{sortedData.length === 0 && <tr><td colSpan={Math.max(1, selectedColumns.length)} className="empty-results">No rows match your filters. Try changing the search or filter.</td></tr>}</tbody>
              </table>
            </div>
            <div className="table-footnote">Showing {visibleData.length} of {sortedData.length.toLocaleString()} matching records <span>·</span> Select a column heading to sort<div className="pagination"><button type="button" disabled={page === 0} onClick={() => setPage((current) => current - 1)}>← Previous</button><span>Page {page + 1} of {pageCount}</span><button type="button" disabled={page + 1 >= pageCount} onClick={() => setPage((current) => current + 1)}>Next →</button></div></div>
          </div>
        )}
      </section>
      <footer><span>© INSIGHTX</span><span>MADE FOR CLEARER THINKING <i>✳</i></span></footer>
    </main>
  );
}

export default App;
