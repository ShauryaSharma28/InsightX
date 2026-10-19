from collections import Counter
from datetime import date, datetime, time, timezone
import math


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
