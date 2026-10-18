function detectCsvDelimiter(text) {
  const delimiters = [',', ';', '\t'];
  const counts = new Map(delimiters.map((delimiter) => [delimiter, 0]));
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted && (character === '\n' || character === '\r')) {
      break;
    } else if (!quoted && counts.has(character)) {
      counts.set(character, counts.get(character) + 1);
    }
  }

  return delimiters.reduce((best, delimiter) => counts.get(delimiter) > counts.get(best) ? delimiter : best, ',');
}

export function parseCsv(text) {
  // UTF-8 CSV exports often start with a BOM, which otherwise becomes part of
  // the first column name.
  text = text.replace(/^\uFEFF/, '');
  const delimiter = detectCsvDelimiter(text);
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  let lineNumber = 1;
  let quoteStartLine = null;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
        if (quoted) quoteStartLine = lineNumber;
      }
    } else if (character === delimiter && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
      lineNumber += 1;
    } else {
      cell += character;
      if (character === '\n' || (character === '\r' && text[index + 1] !== '\n')) lineNumber += 1;
    }
  }

  if (quoted) throw new Error(`CSV contains an unclosed quoted value starting on line ${quoteStartLine}.`);
  row.push(cell);
  if (row.some((value) => value.trim() !== '')) rows.push(row);
  return rows;
}

export function parseJson(text) {
  const records = JSON.parse(text);
  if (!Array.isArray(records) || records.length === 0 || records.some(
    (record) => !record || typeof record !== 'object' || Array.isArray(record),
  )) {
    throw new Error('JSON must contain a non-empty array of objects');
  }

  const headers = [...new Set(records.flatMap((record) => Object.keys(record)))];
  if (headers.length === 0) throw new Error('JSON records do not contain any fields');
  return [
    headers,
    ...records.map((record) => headers.map((header) => {
      const value = record[header];
      if (value == null) return '';
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
    })),
  ];
}

export function getImportErrorMessage(error, extension) {
  if (extension === 'json' && error instanceof SyntaxError) {
    return 'This JSON file is malformed. Check its brackets, commas, and quoted strings.';
  }
  if (error instanceof Error && /^(CSV|JSON)\b/.test(error.message)) return error.message;
  return 'The file could not be read. Try choosing it again.';
}

export function uniqueHeaders(headers) {
  const used = new Set();
  return headers.map((header) => {
    let uniqueHeader = header;
    let suffix = 2;
    while (used.has(uniqueHeader)) {
      uniqueHeader = `${header} (${suffix})`;
      suffix += 1;
    }
    used.add(uniqueHeader);
    return uniqueHeader;
  });
}

export function normalizeRows(rows) {
  const columnCount = rows.reduce((width, row) => Math.max(width, row.length), 0);
  const headers = uniqueHeaders(Array.from(
    { length: columnCount },
    (_, index) => rows[0][index]?.trim() || `Column ${index + 1}`,
  ));
  const data = rows.slice(1).map((row) => headers.map((_, index) => row[index] ?? ''));
  return { headers, data };
}

export function filterRows(rows, {
  searchTerm = '',
  hideEmpty = false,
  filterColumn = '',
  filterOperator = 'contains',
  filterValue = '',
} = {}) {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const target = filterValue.trim();

  return rows.filter((values) =>
    values.some((value) => (value ?? '').toLowerCase().includes(normalizedSearch)) &&
    (!hideEmpty || values.every((value) => (value ?? '').trim() !== '')) &&
    (filterOperator === 'empty' || filterOperator === 'notEmpty'
      ? (() => {
        const cells = filterColumn === '' ? values : [values[Number(filterColumn)] ?? ''];
        return filterOperator === 'empty'
          ? cells.some((value) => !value.trim())
          : cells.every((value) => value.trim() !== '');
      })()
      : filterColumn === '' || target === '' || (() => {
        const cell = (values[Number(filterColumn)] ?? '').trim();
        if (filterOperator === 'contains') return cell.toLowerCase().includes(target.toLowerCase());
        if (filterOperator === 'equals') return cell.toLowerCase() === target.toLowerCase();
        const number = Number(cell);
        const comparison = Number(target);
        if (!Number.isFinite(number) || !Number.isFinite(comparison)) return false;
        return filterOperator === 'greater' ? number > comparison : number < comparison;
      })()),
  );
}

export function previewValueReplacement(rows, columnIndexes, findValue, replacementValue) {
  if (findValue === '' || findValue === replacementValue) return { rows, count: 0, examples: [] };

  const selectedIndexes = new Set(columnIndexes);
  const examples = [];
  let count = 0;
  const replacedRows = rows.map((row, rowIndex) => {
    let changed = false;
    const replacedRow = row.map((value, columnIndex) => {
      if (!selectedIndexes.has(columnIndex) || value !== findValue) return value;
      count += 1;
      changed = true;
      if (examples.length < 3) examples.push({ row: rowIndex + 1, column: columnIndex, before: value, after: replacementValue });
      return replacementValue;
    });
    return changed ? replacedRow : row;
  });

  return { rows: replacedRows, count, examples };
}

export function countDuplicateRows(rows, headers) {
  return rows.length - new Set(
    rows.map((values) => headers.map((_, index) => (values[index] ?? '').trim()).join('\u0000')),
  ).size;
}

function parseIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|[Tt ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)$/.exec(value);
  if (!match) return null;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const calendarDate = new Date(0);
  calendarDate.setUTCFullYear(year, month - 1, day);
  calendarDate.setUTCHours(0, 0, 0, 0);
  if (calendarDate.getUTCFullYear() !== year || calendarDate.getUTCMonth() !== month - 1 || calendarDate.getUTCDate() !== day) return null;

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? { value, timestamp } : null;
}

export function getColumnProfiles(headers, data) {
  return headers.map((header, index) => {
    const values = data.map((row) => (row[index] ?? '').trim());
    const filled = values.filter(Boolean);
    const nums = filled.map(Number).filter(Number.isFinite);
    const distinct = new Set(filled).size;
    const isNumeric = nums.length === filled.length && filled.length > 0;
    const dates = filled.map(parseIsoDate);
    const isDate = !isNumeric && dates.length > 0 && dates.every(Boolean);
    const sortedNums = isNumeric ? [...nums].sort((left, right) => left - right) : [];
    const sortedDates = isDate ? [...dates].sort((left, right) => left.timestamp - right.timestamp) : [];
    const numericStats = isNumeric ? nums.reduce((stats, value) => ({
      min: Math.min(stats.min, value),
      max: Math.max(stats.max, value),
      sum: stats.sum + value,
    }), { min: Infinity, max: -Infinity, sum: 0 }) : null;

    return {
      header,
      filled: filled.length,
      missing: values.length - filled.length,
      completeness: values.length ? (filled.length / values.length) * 100 : 0,
      distinct,
      type: isNumeric ? 'Number' : isDate ? 'Date' : 'Text',
      min: numericStats?.min ?? sortedDates[0]?.value ?? null,
      max: numericStats?.max ?? sortedDates.at(-1)?.value ?? null,
      average: numericStats ? numericStats.sum / nums.length : null,
      median: sortedNums.length
        ? (sortedNums[Math.floor((sortedNums.length - 1) / 2)] + sortedNums[Math.ceil((sortedNums.length - 1) / 2)]) / 2
        : null,
    };
  });
}
