import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

import apps.api.models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Dataset',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255)),
                ('original_filename', models.CharField(max_length=255)),
                ('file', models.FileField(max_length=255, upload_to=apps.api.models.dataset_upload_path)),
                ('file_size', models.PositiveBigIntegerField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='datasets', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at', '-id'],
            },
        ),
    ]
