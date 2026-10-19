import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import test from 'node:test';
import { parseExcelWorkbook } from './excelUtils.js';

test('parseExcelWorkbook reads the first populated sheet and converts cells to table text', async () => {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('Empty');
  const worksheet = workbook.addWorksheet('Sales');
  worksheet.addRow(['Product', 'Units', 'Double units']);
  worksheet.addRow(['Tea', 12, { formula: 'B2*2', result: 24 }]);

  const rows = await parseExcelWorkbook(await workbook.xlsx.writeBuffer());

  assert.deepEqual(rows, [
    ['Product', 'Units', 'Double units'],
    ['Tea', '12', '24'],
  ]);
});

test('parseExcelWorkbook reports a workbook without worksheet data', async () => {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('Empty');

  await assert.rejects(
    parseExcelWorkbook(await workbook.xlsx.writeBuffer()),
    /Excel workbook does not contain any worksheet data/,
  );
});
