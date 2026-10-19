import math

from rest_framework import serializers


class CellValueField(serializers.Field):
    default_error_messages = {
        'invalid': 'Cells must be strings, numbers, booleans, or null.',
        'non_finite': 'Numeric cell values must be finite.',
    }

    def __init__(self, **kwargs):
        kwargs['allow_null'] = True
        super().__init__(**kwargs)

    def to_internal_value(self, value):
        if value is None:
            return ''
        if isinstance(value, bool):
            return str(value).lower()
        if isinstance(value, (str, int)):
            result = str(value)
        elif isinstance(value, float):
            if not math.isfinite(value):
                self.fail('non_finite')
            result = str(value)
        else:
            self.fail('invalid')
        if len(result) > 10_000:
            raise serializers.ValidationError('Cell values must be at most 10,000 characters.')
        return result

    def to_representation(self, value):
        return value


class DatasetProfileSerializer(serializers.Serializer):
    headers = serializers.ListField(
        child=serializers.CharField(max_length=255, allow_blank=False, trim_whitespace=True),
        allow_empty=False,
        max_length=100,
    )
    rows = serializers.ListField(
        child=serializers.ListField(child=CellValueField(), allow_empty=True, max_length=100),
        allow_empty=True,
        max_length=10_000,
    )

    def validate(self, attrs):
        headers = attrs['headers']
        if len(set(headers)) != len(headers):
            raise serializers.ValidationError({'headers': 'Column names must be unique.'})
        width = len(headers)
        for row_number, row in enumerate(attrs['rows'], start=1):
            if len(row) != width:
                raise serializers.ValidationError({
                    'rows': f'Row {row_number} has {len(row)} cells; expected {width}.'
                })
        return attrs
