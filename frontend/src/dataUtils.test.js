import assert from 'node:assert/strict';
import test from 'node:test';
import {
  countDuplicateRows,
  filterRows,
  getColumnProfiles,
  normalizeRows,
  parseCsv,
  parseJson,
  previewValueReplacement,
} from './dataUtils.js';

test('parseCsv detects semicolon separators and preserves quoted delimiters and line breaks', () => {
  const rows = parseCsv('Name;Notes\r\nAda;"said ""hello""; later"\r\nLin;"first line\nsecond line"');

  assert.deepEqual(rows, [
    ['Name', 'Notes'],
    ['Ada', 'said "hello"; later'],
    ['Lin', 'first line\nsecond line'],
  ]);
});

test('parseCsv supports tab separators and strips a UTF-8 BOM', () => {
  assert.deepEqual(parseCsv('\uFEFFName\tScore\nAda\t8'), [['Name', 'Score'], ['Ada', '8']]);
});

test('parseJson unions record fields and converts values to table cells', () => {
  assert.deepEqual(parseJson('[{"id":7,"label":"A","meta":{"x":1}},{"id":null,"extra":true}]'), [
    ['id', 'label', 'meta', 'extra'],
    ['7', 'A', '{"x":1}', ''],
    ['', '', '', 'true'],
  ]);
});

test('parseJson rejects empty arrays and non-object records', () => {
  assert.throws(() => parseJson('[]'), /non-empty array of objects/);
  assert.throws(() => parseJson('[1]'), /non-empty array of objects/);
});

test('normalizeRows retains extra cells and pads short rows', () => {
  assert.deepEqual(normalizeRows([
    ['Name', 'Name'],
    ['Ada'],
    ['Lin', 'Lee', 'analyst'],
  ]), {
    headers: ['Name', 'Name (2)', 'Column 3'],
    data: [['Ada', '', ''], ['Lin', 'Lee', 'analyst']],
  });
});

test('filterRows handles search, numeric comparisons, and empty-cell conditions', () => {
  const rows = [['Ada', '10'], ['', '20'], ['Lin', ''], ['Sam', '30']];

  assert.deepEqual(filterRows(rows, { searchTerm: 'a' }), [['Ada', '10'], ['Sam', '30']]);
  assert.deepEqual(filterRows(rows, { filterColumn: '1', filterOperator: 'greater', filterValue: '15' }), [['', '20'], ['Sam', '30']]);
  assert.deepEqual(filterRows(rows, { filterColumn: '0', filterOperator: 'empty' }), [['', '20']]);
  assert.deepEqual(filterRows(rows, { filterOperator: 'notEmpty' }), [['Ada', '10'], ['Sam', '30']]);
});

test('countDuplicateRows counts repeated complete records', () => {
  assert.equal(countDuplicateRows([['Ada', '10'], ['Ada', '10'], ['Ada', '12'], ['', '']], ['Name', 'Score']), 1);
});

test('previewValueReplacement changes exact matches only in selected columns', () => {
  const rows = [['open', 'open'], ['closed', 'open']];
  const preview = previewValueReplacement(rows, [1], 'open', 'active');

  assert.deepEqual(preview.rows, [['open', 'active'], ['closed', 'active']]);
  assert.equal(preview.count, 2);
  assert.deepEqual(preview.examples[0], { row: 1, column: 1, before: 'open', after: 'active' });
  assert.deepEqual(rows, [['open', 'open'], ['closed', 'open']]);
});

test('getColumnProfiles reports completeness and numeric summary statistics', () => {
  const profiles = getColumnProfiles(['Score', 'Name'], [['1', 'Ada'], ['3', ''], ['5', 'Bob'], ['', 'Ada']]);

  assert.deepEqual(profiles[0], {
    header: 'Score', filled: 3, missing: 1, completeness: 75, distinct: 3,
    type: 'Number', min: 1, max: 5, average: 3, median: 3,
  });
  assert.equal(profiles[1].missing, 1);
  assert.equal(profiles[1].distinct, 2);
  assert.equal(profiles[1].type, 'Text');
  assert.equal(profiles[1].average, null);
});
