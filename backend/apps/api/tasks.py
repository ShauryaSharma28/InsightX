from celery import shared_task
from django.db import DatabaseError

from .models import Dataset
from .services import profile_uploaded_dataset, validate_dataset_upload


@shared_task(name='insightx.profile_saved_dataset')
def process_saved_dataset_profile(dataset_id):
    dataset = Dataset.objects.filter(pk=dataset_id).first()
    if dataset is None:
        return

    Dataset.objects.filter(pk=dataset_id).update(profile_status='processing', profile_error='')
    try:
        with dataset.file.open('rb') as source:
            validate_dataset_upload(source, full_validation=True)
        profile = profile_uploaded_dataset(dataset)
    except Exception:
        Dataset.objects.filter(pk=dataset_id).update(
            profile_status='failed',
            profile_error='Profiling failed. Check that the uploaded file contains a valid supported table.',
        )
        return

    try:
        Dataset.objects.filter(pk=dataset_id).update(
            profile=profile,
            profile_status='ready',
            profile_error='',
        )
    except DatabaseError:
        Dataset.objects.filter(pk=dataset_id).update(
            profile_status='failed',
            profile_error='The profile could not be saved. Try profiling the dataset again.',
        )
