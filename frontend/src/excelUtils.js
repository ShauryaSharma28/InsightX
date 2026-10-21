function cellToText(value) {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().replace(/\.000Z$/, 'Z');
  if (typeof value !== 'object') return String(value);
  if (Array.isArray(value.richText)) return value.richText.map((part) => part.text ?? '').join('');
  if (typeof value.text === 'string') return value.text;
  if (Object.hasOwn(value, 'result')) return cellToText(value.result);
  if (typeof value.error === 'string') return value.error;
  return JSON.stringify(value);
}

export async function parseExcelWorkbook(buffer) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets.find((sheet) => {
    let hasValues = false;
    sheet.eachRow({ includeEmpty: false }, (row) => {
      if (row.values.slice(1).some((value) => value !== null && value !== undefined && value !== '')) {
        hasValues = true;
      }
    });
    return hasValues;
  });

  if (!worksheet) throw new Error('Excel workbook does not contain any worksheet data.');

  const rows = [];
  worksheet.eachRow({ includeEmpty: true }, (row) => {
    rows.push(Array.from(
      { length: worksheet.columnCount },
      (_, index) => cellToText(row.getCell(index + 1).value),
    ));
  });
  return rows;
}
