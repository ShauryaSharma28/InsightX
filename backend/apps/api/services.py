from collections import Counter
from datetime import date, datetime, time, timezone
import csv
from io import StringIO
import json
import math
from pathlib import Path
import zipfile

import pandas as pd
from openpyxl import load_workbook
from django.conf import settings


def _iso_timestamp(value):
    try:
        if len(value) == 10:
            parsed = datetime.combine(date.fromisoformat(value), time.min, tzinfo=timezone.utc)
        else:
            parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.timestamp()
    except (OSError, ValueError, OverflowError):
        return None


def profile_dataset(headers, rows):
    """Return lightweight quality statistics without storing submitted data."""
    columns = []
    for index, header in enumerate(headers):
        values = [str(row[index] if row[index] is not None else '').strip() for row in rows]
        filled = [value for value in values if value]
        frequencies = Counter(filled)
        common_values = [
            {'value': value, 'count': count}
            for value, count in sorted(frequencies.items(), key=lambda item: (-item[1], item[0].casefold()))
            if count > 1
        ][:3]

        numbers = []
        for value in filled:
            try:
                number = float(value)
            except ValueError:
                numbers = []
                break
            if not math.isfinite(number):
                numbers = []
                break
            numbers.append(number)

        date_values = [(value, _iso_timestamp(value)) for value in filled]
        is_date = bool(filled) and not numbers and all(timestamp is not None for _, timestamp in date_values)
        is_numeric = bool(filled) and len(numbers) == len(filled)
        ordered_numbers = sorted(numbers) if is_numeric else []
        date_range = sorted(date_values, key=lambda item: item[1]) if is_date else []

        column = {
            'name': header,
            'type': 'Number' if is_numeric else 'Date' if is_date else 'Text',
            'filled': len(filled),
            'missing': len(values) - len(filled),
            'distinct': len(frequencies),
            'completeness': round(len(filled) * 100 / len(values), 1) if values else 0,
            'commonValues': common_values,
        }
        if is_numeric:
            middle = len(ordered_numbers) // 2
            median = ordered_numbers[middle] if len(ordered_numbers) % 2 else ordered_numbers[middle - 1] / 2 + ordered_numbers[middle] / 2
            column.update({
                'min': min(ordered_numbers),
                'max': max(ordered_numbers),
                'average': sum(number / len(ordered_numbers) for number in ordered_numbers),
                'median': median,
            })
        elif is_date:
            column.update({'min': date_range[0][0], 'max': date_range[-1][0]})
        columns.append(column)

    duplicate_rows = len(rows) - len({tuple(str(value if value is not None else '').strip() for value in row) for row in rows})
    return {
        'rowCount': len(rows),
        'columnCount': len(headers),
        'duplicateRows': duplicate_rows,
        'columns': columns,
    }


def _cell_as_text(value):
    if value is None:
        return ''
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, separators=(',', ':'))
    try:
        missing = pd.isna(value)
        if not hasattr(missing, '__len__') and bool(missing):
            return ''
    except (TypeError, ValueError):
        pass
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return str(value)


def profile_uploaded_dataset(dataset):
    """Read a private uploaded dataset and return the same profile shape as the JSON API."""
    extension = Path(dataset.original_filename).suffix.lower()
    try:
        with dataset.file.open('rb') as source:
            if extension == '.csv':
                rows = _parse_csv_bytes(source.read())
                if not rows:
                    raise ValueError('The uploaded CSV does not contain a header row.')
                width = max(len(row) for row in rows)
                headers = _unique_headers(rows[0], width)
                frame = pd.DataFrame(
                    [row + [''] * (width - len(row)) for row in rows[1:]],
                    columns=headers,
                )
            elif extension == '.json':
                records = json.load(source)
                if not isinstance(records, list) or any(not isinstance(record, dict) for record in records):
                    raise ValueError('JSON must contain an array of objects.')
                frame = pd.DataFrame.from_records(records)
            elif extension == '.xlsx':
                workbook = load_workbook(source, read_only=True, data_only=True)
                try:
                    worksheet = next((sheet for sheet in workbook.worksheets if sheet.max_row), None)
                    rows = list(worksheet.iter_rows(values_only=True)) if worksheet else []
                    if not rows:
                        raise ValueError('The Excel workbook does not contain a populated worksheet.')
                    width = max(len(row) for row in rows)
                    headers = _unique_headers(rows[0], width)
                    frame = pd.DataFrame(
                        [list(row) + [''] * (width - len(row)) for row in rows[1:]],
                        columns=headers,
                    )
                finally:
                    workbook.close()
            else:
                raise ValueError('Only CSV, JSON, and XLSX datasets can be profiled.')
    except ValueError:
        raise
    except Exception as error:
        raise ValueError('The uploaded dataset could not be parsed.') from error

    headers = _unique_headers(frame.columns, len(frame.columns))

    rows = [
        [_cell_as_text(value) for value in row]
        for row in frame.itertuples(index=False, name=None)
    ]
    return profile_dataset(headers, rows)


def _unique_headers(values, width):
    headers = []
    used_headers = set()
    for index in range(width):
        raw_header = values[index] if index < len(values) else ''
        base = str(raw_header).strip() or f'Column {index + 1}'
        candidate = base
        suffix = 2
        while candidate in used_headers:
            candidate = f'{base} ({suffix})'
            suffix += 1
        headers.append(candidate)
        used_headers.add(candidate)
    return headers


def _parse_csv_bytes(payload):
    text = payload.decode('utf-8-sig')
    sample = text[:8192]
    try:
        delimiter = csv.Sniffer().sniff(sample, delimiters=',;\t').delimiter
    except csv.Error:
        delimiter = ','
    parsed = []
    for row in csv.reader(StringIO(text, newline=''), delimiter=delimiter, strict=True):
        if any(str(value).strip() for value in row):
            parsed.append(row)
    return parsed


def _validate_table_dimensions(rows, max_columns, max_rows, max_cells, max_cell_length):
    if not rows:
        raise ValueError('The dataset does not contain a header row.')
    width = max(len(row) for row in rows)
    if width == 0 or width > max_columns:
        raise ValueError(f'Datasets may have at most {max_columns} columns.')
    if len(rows) - 1 > max_rows:
        raise ValueError(f'Datasets may have at most {max_rows:,} data rows.')
    if width * len(rows) > max_cells:
        raise ValueError(f'Datasets may have at most {max_cells:,} cells.')
    if any(len(str(value)) > max_cell_length for row in rows for value in row):
        raise ValueError(f'Dataset cells may be at most {max_cell_length:,} characters long.')


def validate_dataset_upload(uploaded_file, full_validation=True):
    """Check the declared file type against its content and bound parser work."""
    extension = Path(uploaded_file.name.replace('\\', '/')).suffix.lower()
    if extension not in {'.csv', '.json', '.xlsx'}:
        raise ValueError('Choose a CSV, JSON, or XLSX file.')

    uploaded_file.seek(0)
    sample = uploaded_file.read(8192)
    uploaded_file.seek(0)


    if extension == '.csv':
        if b'\x00' in sample:
            raise ValueError('The uploaded CSV is not valid UTF-8 text.')
        try:
            sample.decode('utf-8-sig', errors='ignore')
        except UnicodeDecodeError as error:
            raise ValueError('The uploaded CSV must use UTF-8 encoding.') from error
        if full_validation:
            try:
                rows = _parse_csv_bytes(uploaded_file.read())
            except (UnicodeDecodeError, csv.Error) as error:
                raise ValueError('The uploaded CSV is malformed or is not valid UTF-8.') from error
            _validate_table_dimensions(
                rows,
                settings.MAX_DATASET_COLUMNS,
                settings.MAX_DATASET_ROWS,
                settings.MAX_DATASET_CELLS,
                settings.MAX_DATASET_CELL_LENGTH,
            )
    elif extension == '.json':
        if sample.removeprefix(b'\xef\xbb\xbf').lstrip().startswith(b'[') is False:
            raise ValueError('JSON datasets must contain an array of records.')
        if full_validation:
            try:
                records = json.loads(uploaded_file.read().decode('utf-8-sig'))
            except (UnicodeDecodeError, json.JSONDecodeError) as error:
                raise ValueError('The uploaded JSON is malformed or is not valid UTF-8.') from error
            if not isinstance(records, list) or not records or any(not isinstance(record, dict) for record in records):
                raise ValueError('JSON datasets must contain a non-empty array of objects.')
            headers = list(dict.fromkeys(key for record in records for key in record))
            rows = [headers] + [[record.get(header) for header in headers] for record in records]
            _validate_table_dimensions(
                rows,
                settings.MAX_DATASET_COLUMNS,
                settings.MAX_DATASET_ROWS,
                settings.MAX_DATASET_CELLS,
                settings.MAX_DATASET_CELL_LENGTH,
            )
    else:
        if not sample.startswith(b'PK'):
            raise ValueError('The uploaded XLSX file is not a valid Excel workbook.')
        try:
            with zipfile.ZipFile(uploaded_file) as workbook_zip:
                entries = workbook_zip.infolist()
                names = {item.filename for item in entries}
                total_size = sum(item.file_size for item in entries)
                if '[Content_Types].xml' not in names or 'xl/workbook.xml' not in names:
                    raise ValueError('The uploaded XLSX file is not a valid Excel workbook.')
                if len(entries) > settings.MAX_XLSX_ZIP_ENTRIES or total_size > settings.MAX_XLSX_UNCOMPRESSED_SIZE:
                    raise ValueError('The Excel workbook expands beyond the allowed processing limit.')
                if any(item.file_size > max(item.compress_size, 1) * settings.MAX_XLSX_MAX_COMPRESSION_RATIO for item in entries):
                    raise ValueError('The Excel workbook has an unsafe compression ratio.')
        except (zipfile.BadZipFile, OSError) as error:
            raise ValueError('The uploaded XLSX file is not a valid Excel workbook.') from error
        if full_validation:
            try:
                uploaded_file.seek(0)
                workbook = load_workbook(uploaded_file, read_only=True, data_only=True)
                try:
                    worksheet = next((sheet for sheet in workbook.worksheets if sheet.max_row), None)
                    if worksheet is None:
                        raise ValueError('The Excel workbook does not contain a populated worksheet.')
                    row_count = 0
                    cell_count = 0
                    for row in worksheet.iter_rows(values_only=True):
                        row_count += 1
                        cell_count += len(row)
                        if row_count - 1 > settings.MAX_DATASET_ROWS:
                            raise ValueError(f'Datasets may have at most {settings.MAX_DATASET_ROWS:,} data rows.')
                        if len(row) > settings.MAX_DATASET_COLUMNS:
                            raise ValueError(f'Datasets may have at most {settings.MAX_DATASET_COLUMNS} columns.')
                        if cell_count > settings.MAX_DATASET_CELLS:
                            raise ValueError(f'Datasets may have at most {settings.MAX_DATASET_CELLS:,} cells.')
                        if any(len(str(value)) > settings.MAX_DATASET_CELL_LENGTH for value in row if value is not None):
                            raise ValueError(f'Dataset cells may be at most {settings.MAX_DATASET_CELL_LENGTH:,} characters long.')
                finally:
                    workbook.close()
            except ValueError:
                raise
            except Exception as error:
                raise ValueError('The uploaded XLSX file could not be read.') from error
    uploaded_file.seek(0)


def start_dataset_profile(dataset):
    """Profile small datasets inline and queue larger files for a Celery worker."""
    from django.db import transaction

    dataset.profile = None
    dataset.profile_error = ''
    if dataset.file_size <= settings.DATASET_BACKGROUND_THRESHOLD_BYTES:
        dataset.profile_status = 'processing'
        dataset.save(update_fields=['profile', 'profile_error', 'profile_status'])
        try:
            with dataset.file.open('rb') as source:
                validate_dataset_upload(source, full_validation=True)
            dataset.profile = profile_uploaded_dataset(dataset)
            dataset.profile_status = 'ready'
        except Exception:
            dataset.profile_status = 'failed'
            dataset.profile_error = 'Profiling failed. Check that the uploaded file contains a valid supported table.'
        dataset.save(update_fields=['profile', 'profile_error', 'profile_status'])
        return dataset

    dataset.profile_status = 'pending'
    dataset.save(update_fields=['profile', 'profile_error', 'profile_status'])
    from .tasks import process_saved_dataset_profile

    try:
        transaction.on_commit(lambda: process_saved_dataset_profile.delay(dataset.pk))
    except Exception:
        dataset.profile_status = 'failed'
        dataset.profile_error = 'Background profiling is unavailable. Configure Redis and start a Celery worker.'
        dataset.save(update_fields=['profile_status', 'profile_error'])
    return dataset
