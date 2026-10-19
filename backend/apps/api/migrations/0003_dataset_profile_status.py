from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('insightx_api', '0002_dataset_profile'),
    ]

    operations = [
        migrations.AddField(
            model_name='dataset',
            name='profile_status',
            field=models.CharField(
                choices=[
                    ('not_started', 'Not started'),
                    ('pending', 'Pending'),
                    ('processing', 'Processing'),
                    ('ready', 'Ready'),
                    ('failed', 'Failed'),
                ],
                default='not_started',
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name='dataset',
            name='profile_error',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
    ]
