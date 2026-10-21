from rest_framework import serializers
from .models import SavedDataset


class SavedDatasetSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedDataset
        fields = ['id', 'file_name', 'file_size', 'created_at', 'updated_at']


class SavedDatasetSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedDataset
        fields = ['id', 'file_name', 'file_size', 'headers', 'data', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_headers(self, value):
        if not isinstance(value, list) or not all(isinstance(header, str) for header in value):
            raise serializers.ValidationError('Headers must be a list of text values.')
        return value

    def validate_data(self, value):
        if not isinstance(value, list) or not all(
            isinstance(row, list) and all(isinstance(cell, str) for cell in row) for row in value
        ):
            raise serializers.ValidationError('Dataset rows must be lists of text values.')
        return value
