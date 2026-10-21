from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('insightx_api', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='dataset',
            name='profile',
            field=models.JSONField(blank=True, null=True),
        ),
    ]
