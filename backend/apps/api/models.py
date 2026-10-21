from pathlib import Path
import uuid

from django.conf import settings
from django.db import models
from django.db.models.signals import post_delete
from django.dispatch import receiver


def dataset_upload_path(instance, filename):
    extension = Path(filename.replace('\\', '/')).suffix.lower()
    if extension not in {'.csv', '.json', '.xlsx'}:
        extension = '.bin'
    return f'users/{instance.owner_id}/datasets/{uuid.uuid4().hex}{extension}'


class Dataset(models.Model):
    PROFILE_STATUS_CHOICES = [
        ('not_started', 'Not started'),
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('ready', 'Ready'),
        ('failed', 'Failed'),
    ]

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='datasets')
    name = models.CharField(max_length=255)
    original_filename = models.CharField(max_length=255)
    file = models.FileField(upload_to=dataset_upload_path, max_length=255)
    file_size = models.PositiveBigIntegerField()
    profile = models.JSONField(blank=True, null=True)
    profile_status = models.CharField(max_length=16, choices=PROFILE_STATUS_CHOICES, default='not_started')
    profile_error = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']

    def __str__(self):
        return self.name


@receiver(post_delete, sender=Dataset)
def remove_dataset_file(sender, instance, **kwargs):
    if instance.file and instance.file.name:
        instance.file.delete(save=False)
