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

export function parseJsonDataset(text) {
  const records = JSON.parse(text);
  if (!Array.isArray(records) || records.length === 0 || records.some(
    (record) => !record || typeof record !== 'object' || Array.isArray(record),
  )) {
    throw new Error('JSON must contain a non-empty array of objects');
  }

  const headers = [...new Set(records.flatMap((record) => Object.keys(record)))];
  if (headers.length === 0) throw new Error('JSON records do not contain any fields');
  const rows = [
    headers,
    ...records.map((record) => headers.map((header) => {
      const value = record[header];
      if (value == null) return '';
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
    })),
  ];
  return { headers, rows, records };
}

export function parseJson(text) {
  return parseJsonDataset(text).rows;
}

export function getImportErrorMessage(error, extension) {
  if (extension === 'json' && error instanceof SyntaxError) {
    return 'This JSON file is malformed. Check its brackets, commas, and quoted strings.';
  }
  if (extension === 'xlsx') {
    if (error instanceof Error && /^Excel\b/.test(error.message)) return error.message;
    return 'This Excel workbook could not be read. Check that it is a valid .xlsx file.';
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
  filterRules = [],
  filterMode = 'all',
} = {}) {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const target = filterValue.trim();

  function matchesRule(values, rule) {
    const cells = rule.column === '' ? values : [values[Number(rule.column)] ?? ''];
    const ruleTarget = String(rule.value ?? '').trim();
    if (rule.operator === 'empty') return cells.some((value) => !(value ?? '').trim());
    if (rule.operator === 'notEmpty') return cells.every((value) => (value ?? '').trim() !== '');
    if (ruleTarget === '') return true;

    if (rule.operator.startsWith('date')) {
      const targetDate = parseIsoDate(ruleTarget);
      if (!targetDate) return false;
      return cells.some((value) => {
        const cellDate = parseIsoDate((value ?? '').trim());
        if (!cellDate) return false;
        if (rule.operator === 'dateAfter') return cellDate.timestamp > targetDate.timestamp;
        if (rule.operator === 'dateBefore') return cellDate.timestamp < targetDate.timestamp;
        if (rule.operator === 'dateOnOrAfter') return cellDate.timestamp >= targetDate.timestamp;
        if (rule.operator === 'dateOnOrBefore') return cellDate.timestamp <= targetDate.timestamp;
        return false;
      });
    }

    return rule.operator === 'notEquals'
      ? cells.every((value) => (value ?? '').trim().toLowerCase() !== ruleTarget.toLowerCase())
      : cells.some((value) => {
        const cell = (value ?? '').trim();
        if (rule.operator === 'contains') return cell.toLowerCase().includes(ruleTarget.toLowerCase());
        if (rule.operator === 'startsWith') return cell.toLowerCase().startsWith(ruleTarget.toLowerCase());
        if (rule.operator === 'endsWith') return cell.toLowerCase().endsWith(ruleTarget.toLowerCase());
        if (rule.operator === 'equals') return cell.toLowerCase() === ruleTarget.toLowerCase();
        const number = Number(cell);
        const comparison = Number(ruleTarget);
        if (!Number.isFinite(number) || !Number.isFinite(comparison)) return false;
        return rule.operator === 'greater' ? number > comparison : number < comparison;
      });
  }

  const activeFilterRules = filterRules.filter((rule) =>
    ['empty', 'notEmpty'].includes(rule.operator) || String(rule.value ?? '').trim() !== '',
  );
  const matchesFilters = activeFilterRules.length > 0
    ? (values) => filterMode === 'any'
      ? activeFilterRules.some((rule) => matchesRule(values, rule))
      : activeFilterRules.every((rule) => matchesRule(values, rule))
    : (values) => filterOperator === 'empty' || filterOperator === 'notEmpty'
      ? (() => {
        const cells = filterColumn === '' ? values : [values[Number(filterColumn)] ?? ''];
        return filterOperator === 'empty'
          ? cells.some((value) => !(value ?? '').trim())
          : cells.every((value) => (value ?? '').trim() !== '');
      })()
      : filterColumn === '' || target === '' || (() => {
        const cell = (values[Number(filterColumn)] ?? '').trim();
        if (filterOperator === 'contains') return cell.toLowerCase().includes(target.toLowerCase());
        if (filterOperator === 'startsWith') return cell.toLowerCase().startsWith(target.toLowerCase());
        if (filterOperator === 'endsWith') return cell.toLowerCase().endsWith(target.toLowerCase());
        if (filterOperator === 'equals') return cell.toLowerCase() === target.toLowerCase();
        if (filterOperator === 'notEquals') return cell.toLowerCase() !== target.toLowerCase();
        const number = Number(cell);
        const comparison = Number(target);
        if (!Number.isFinite(number) || !Number.isFinite(comparison)) return false;
        return filterOperator === 'greater' ? number > comparison : number < comparison;
      })();

  return rows.filter((values) =>
    values.some((value) => (value ?? '').toLowerCase().includes(normalizedSearch)) &&
    (!hideEmpty || values.every((value) => (value ?? '').trim() !== '')) &&
    matchesFilters(values),
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

export function aggregateDateRows(rows, dateIndex, measureIndex, aggregate = 'sum', bucket = 'month') {
  const groups = new Map();
  rows.forEach((row) => {
    const dateValue = (row[dateIndex] ?? '').trim();
    if (!parseIsoDate(dateValue)) return;

    const date = dateValue.slice(0, 10);
    const label = bucket === 'year' ? date.slice(0, 4) : bucket === 'day' ? date : date.slice(0, 7);
    const rawMeasure = (row[measureIndex] ?? '').trim();
    const measure = Number(rawMeasure);
    if (!rawMeasure || !Number.isFinite(measure)) return;

    const group = groups.get(label) ?? { total: 0, count: 0 };
    group.total += measure;
    group.count += 1;
    groups.set(label, group);
  });

  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([label, group]) => ({
    label,
    value: aggregate === 'average' ? group.total / group.count : group.total,
  }));
}

export function getColumnProfiles(headers, data) {
  return headers.map((header, index) => {
    const values = data.map((row) => (row[index] ?? '').trim());
    const filled = values.filter(Boolean);
    const nums = filled.map(Number).filter(Number.isFinite);
    const distinct = new Set(filled).size;
    const frequencies = new Map();
    filled.forEach((value) => frequencies.set(value, (frequencies.get(value) ?? 0) + 1));
    const commonValues = [...frequencies.entries()]
      .filter(([, count]) => count > 1)
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], undefined, { numeric: true, sensitivity: 'base' }))
      .slice(0, 3)
      .map(([value, count]) => ({ value, count }));
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
      commonValues,
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

export function getAutomaticInsights(headers, rows) {
  if (rows.length === 0 || headers.length === 0) return [];

  const profiles = getColumnProfiles(headers, rows);
  const insights = [];
  const incompleteColumn = profiles
    .map((profile, index) => ({ ...profile, index }))
    .filter((profile) => profile.missing > 0)
    .sort((left, right) => right.missing - left.missing)[0];

  if (incompleteColumn) {
    insights.push({
      title: 'Most incomplete column',
      field: incompleteColumn.header,
      summary: `${incompleteColumn.missing} of ${rows.length} matching rows have empty cells (${(incompleteColumn.missing * 100 / rows.length).toFixed(1)}%).`,
    });
  }

  const commonCategory = profiles
    .map((profile) => ({ ...profile, frequent: profile.commonValues[0] }))
    .filter((profile) => profile.type === 'Text' && profile.frequent)
    .sort((left, right) => right.frequent.count - left.frequent.count)[0];

  if (commonCategory) {
    const { value, count } = commonCategory.frequent;
    insights.push({
      title: 'Most common category',
      field: commonCategory.header,
      summary: `${value} appears in ${count} of ${rows.length} matching rows (${(count * 100 / rows.length).toFixed(1)}%).`,
    });
  }

  const outlier = profiles.flatMap((profile, index) => {
    if (profile.type !== 'Number') return [];
    const values = rows.map((row) => (row[index] ?? '').trim()).filter(Boolean).map(Number).sort((left, right) => left - right);
    if (values.length < 4) return [];
    function percentile(fraction) {
      const position = (values.length - 1) * fraction;
      const lowerIndex = Math.floor(position);
      const upperIndex = Math.ceil(position);
      return values[lowerIndex] + (values[upperIndex] - values[lowerIndex]) * (position - lowerIndex);
    }
    const lowerQuartile = percentile(0.25);
    const upperQuartile = percentile(0.75);
    const spread = upperQuartile - lowerQuartile;
    const lowerBound = lowerQuartile - spread * 1.5;
    const upperBound = upperQuartile + spread * 1.5;
    const count = values.filter((value) => value < lowerBound || value > upperBound).length;
    return count > 0 ? [{ header: profile.header, count, lowerBound, upperBound }] : [];
  }).sort((left, right) => right.count - left.count)[0];

  if (outlier) {
    insights.push({
      title: 'Possible outliers',
      field: outlier.header,
      summary: `${outlier.count} of ${rows.length} values fall outside the 1.5x IQR range (${outlier.lowerBound} to ${outlier.upperBound}).`,
    });
  }

  return insights;
}
