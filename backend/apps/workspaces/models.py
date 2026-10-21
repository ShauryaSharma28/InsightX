from django.conf import settings
from django.db import models


class SavedDataset(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='saved_datasets')
    file_name = models.CharField(max_length=255)
    file_size = models.PositiveBigIntegerField(default=0)
    headers = models.JSONField(default=list)
    data = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return self.file_name
