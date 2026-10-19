import math
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model, password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Sum
from django.urls import reverse
from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from .models import Dataset
from .services import validate_dataset_upload


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


class UserRegistrationSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True, max_length=254)
    password = serializers.CharField(write_only=True, min_length=8, trim_whitespace=False)

    def validate_username(self, value):
        user_model = get_user_model()
        if user_model._default_manager.filter(username__iexact=value).exists():
            raise serializers.ValidationError('A user with this username already exists.')
        return value

    def validate(self, attrs):
        user_model = get_user_model()
        prospective_user = user_model(username=attrs['username'], email=attrs.get('email', ''))
        try:
            password_validation.validate_password(attrs['password'], prospective_user)
        except DjangoValidationError as error:
            raise serializers.ValidationError(error.messages) from error
        return attrs

    def create(self, validated_data):
        user_model = get_user_model()
        return user_model.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
        )


class DatasetSerializer(serializers.ModelSerializer):
    name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    file = serializers.FileField(write_only=True)
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = Dataset
        fields = ['id', 'name', 'original_filename', 'file_size', 'created_at', 'download_url', 'file']
        read_only_fields = ['id', 'original_filename', 'file_size', 'created_at', 'download_url']

    def validate_file(self, uploaded_file):
        filename = Path(uploaded_file.name.replace('\\', '/')).name
        if uploaded_file.size == 0:
            raise serializers.ValidationError('The uploaded file is empty.')
        if uploaded_file.size > settings.MAX_DATASET_UPLOAD_SIZE:
            limit_mb = settings.MAX_DATASET_UPLOAD_SIZE // (1024 * 1024)
            raise serializers.ValidationError(f'Files must be {limit_mb} MiB or smaller.')
        try:
            validate_dataset_upload(uploaded_file)
        except ValueError as error:
            raise serializers.ValidationError(str(error)) from error
        return uploaded_file

    def create(self, validated_data):
        uploaded_file = validated_data.pop('file')
        original_filename = Path(uploaded_file.name.replace('\\', '/')).name
        supplied_name = validated_data.get('name', '').strip()
        owner = self.context['request'].user
        with transaction.atomic():
            get_user_model().objects.select_for_update().only('pk').get(pk=owner.pk)
            owner_datasets = Dataset.objects.filter(owner_id=owner.pk)
            usage = owner_datasets.aggregate(total=Sum('file_size'))['total'] or 0
            if owner_datasets.count() >= settings.MAX_DATASETS_PER_USER:
                raise ValidationError({'file': f'Each account can store at most {settings.MAX_DATASETS_PER_USER} datasets.'})
            if usage + uploaded_file.size > settings.MAX_DATASET_STORAGE_PER_USER:
                limit_mb = settings.MAX_DATASET_STORAGE_PER_USER // (1024 * 1024)
                raise ValidationError({'file': f'Your account storage quota is {limit_mb} MiB.'})
            return Dataset.objects.create(
                owner=owner,
                name=(supplied_name or Path(original_filename).stem or 'Untitled dataset')[:255],
                original_filename=original_filename[:255],
                file_size=uploaded_file.size,
                file=uploaded_file,
            )

    def get_download_url(self, instance):
        path = reverse('api:dataset-download', kwargs={'pk': instance.pk})
        request = self.context.get('request')
        return request.build_absolute_uri(path) if request else path
