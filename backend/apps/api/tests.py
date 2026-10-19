from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import Dataset
from .tasks import process_saved_dataset_profile


class AuthenticationAndDatasetTests(TestCase):
    def setUp(self):
        self.media_dir = TemporaryDirectory()
        self.media_settings = override_settings(MEDIA_ROOT=self.media_dir.name)
        self.media_settings.enable()
        self.client = APIClient()

    def tearDown(self):
        self.media_settings.disable()
        self.media_dir.cleanup()

    def test_registration_returns_tokens_and_current_user_is_protected(self):
        response = self.client.post('/api/v1/auth/register/', {
            'username': 'analytics-user',
            'email': 'analytics@example.com',
            'password': 'Strong-Passphrase-572!',
        }, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        login = self.client.post('/api/v1/auth/token/', {
            'username': 'analytics-user',
            'password': 'Strong-Passphrase-572!',
        }, format='json')
        self.assertEqual(login.status_code, 200)
        self.assertIn('access', login.data)
        refresh = self.client.post('/api/v1/auth/token/refresh/', {'refresh': login.data['refresh']}, format='json')
        self.assertEqual(refresh.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        profile = self.client.get('/api/v1/auth/me/')
        self.assertEqual(profile.status_code, 200)
        self.assertEqual(profile.data['username'], 'analytics-user')

        weak_password = self.client.post('/api/v1/auth/register/', {
            'username': 'weak-password-user',
            'password': 'password',
        }, format='json')
        self.assertEqual(weak_password.status_code, 400)

    def test_dataset_files_are_owner_scoped_and_deleted_with_the_record(self):
        user_model = get_user_model()
        owner = user_model.objects.create_user(username='owner', password='Owner-pass-573!')
        other_user = user_model.objects.create_user(username='other', password='Other-pass-573!')
        self.client.force_authenticate(user=owner)
        upload = SimpleUploadedFile('sales.csv', b'Region,Sales\nWest,10\n', content_type='text/csv')
        created = self.client.post('/api/v1/datasets/', {'name': 'Sales sample', 'file': upload}, format='multipart')

        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data['original_filename'], 'sales.csv')
        dataset = Dataset.objects.get(pk=created.data['id'])
        stored_file = Path(dataset.file.path)
        self.assertTrue(stored_file.exists())

        self.client.force_authenticate(user=other_user)
        self.assertEqual(self.client.get('/api/v1/datasets/').data, [])
        self.assertEqual(self.client.get(f"/api/v1/datasets/{dataset.pk}/").status_code, 404)
        self.assertEqual(self.client.get(f"/api/v1/datasets/{dataset.pk}/download/").status_code, 404)
        self.assertEqual(self.client.delete(f"/api/v1/datasets/{dataset.pk}/").status_code, 404)

        self.client.force_authenticate(user=owner)
        download = self.client.get(f"/api/v1/datasets/{dataset.pk}/download/")
        self.assertEqual(download.status_code, 200)
        self.assertEqual(b''.join(download.streaming_content), b'Region,Sales\nWest,10\n')
        self.assertEqual(self.client.delete(f"/api/v1/datasets/{dataset.pk}/").status_code, 204)
        self.assertFalse(stored_file.exists())

    def test_dataset_upload_requires_authentication_and_allowed_file_type(self):
        denied = self.client.post('/api/v1/datasets/', {
            'file': SimpleUploadedFile('program.exe', b'not a dataset'),
        }, format='multipart')
        self.assertEqual(denied.status_code, 401)

        user = get_user_model().objects.create_user(username='uploader', password='Uploader-pass-573!')
        self.client.force_authenticate(user=user)
        rejected = self.client.post('/api/v1/datasets/', {
            'file': SimpleUploadedFile('program.exe', b'not a dataset'),
        }, format='multipart')
        self.assertEqual(rejected.status_code, 400)
        self.assertIn('Choose a CSV, JSON, or XLSX file.', str(rejected.data))

    def test_saved_dataset_profile_is_authenticated_cached_and_owner_scoped(self):
        owner = get_user_model().objects.create_user(username='profile-owner', password='Owner-pass-573!')
        other_user = get_user_model().objects.create_user(username='profile-other', password='Other-pass-573!')
        self.client.force_authenticate(user=owner)
        created = self.client.post('/api/v1/datasets/', {
            'file': SimpleUploadedFile('scores.csv', b'Name,Score\nAda,10\nLin,20\n', content_type='text/csv'),
        }, format='multipart')
        self.assertEqual(created.status_code, 201)
        url = f"/api/v1/datasets/{created.data['id']}/profile/"

        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'ready')
        self.assertEqual(response.data['profile']['rowCount'], 2)
        self.assertEqual(Dataset.objects.get(pk=created.data['id']).profile['columnCount'], 2)

        self.client.force_authenticate(user=other_user)
        self.assertEqual(self.client.get(url).status_code, 404)

    def test_saved_dataset_profile_requires_authentication(self):
        self.assertEqual(self.client.get('/api/v1/datasets/1/profile/').status_code, 401)

    def test_dataset_upload_checks_file_content_not_only_extension(self):
        user = get_user_model().objects.create_user(username='content-check', password='Content-pass-573!')
        self.client.force_authenticate(user=user)
        response = self.client.post('/api/v1/datasets/', {
            'file': SimpleUploadedFile('report.csv', b'\x00\xffnot text'),
        }, format='multipart')
        self.assertEqual(response.status_code, 400)

    @override_settings(MAX_DATASET_STORAGE_PER_USER=10, MAX_DATASETS_PER_USER=5)
    def test_dataset_storage_quota_is_enforced_per_account(self):
        user = get_user_model().objects.create_user(username='quota-user', password='Quota-pass-573!')
        self.client.force_authenticate(user=user)
        response = self.client.post('/api/v1/datasets/', {
            'file': SimpleUploadedFile('small.csv', b'A\n1234567890\n'),
        }, format='multipart')
        self.assertEqual(response.status_code, 400)
        self.assertIn('storage quota', str(response.data).lower())

    @override_settings(DATASET_BACKGROUND_THRESHOLD_BYTES=1)
    @patch('apps.api.tasks.process_saved_dataset_profile.delay')
    def test_larger_dataset_upload_queues_profiling(self, enqueue_profile):
        user = get_user_model().objects.create_user(username='queue-user', password='Queue-pass-573!')
        self.client.force_authenticate(user=user)
        response = self.client.post('/api/v1/datasets/', {
            'file': SimpleUploadedFile('queued.csv', b'Region,Sales\nWest,10\n'),
        }, format='multipart')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['profile_status'], 'pending')
        enqueue_profile.assert_called_once_with(response.data['id'])

        profile_url = f"/api/v1/datasets/{response.data['id']}/profile/"
        pending_profile = self.client.get(profile_url)
        self.assertEqual(pending_profile.status_code, 202)
        process_saved_dataset_profile.run(response.data['id'])
        ready_profile = self.client.get(profile_url)
        self.assertEqual(ready_profile.status_code, 200)
        self.assertEqual(ready_profile.data['profile']['rowCount'], 1)

    @override_settings(DATASET_BACKGROUND_THRESHOLD_BYTES=1)
    @patch('apps.api.tasks.process_saved_dataset_profile.delay', side_effect=RuntimeError('Redis is unavailable'))
    def test_upload_survives_unavailable_background_queue(self, enqueue_profile):
        user = get_user_model().objects.create_user(username='queue-fallback', password='Queue-pass-573!')
        self.client.force_authenticate(user=user)
        response = self.client.post('/api/v1/datasets/', {
            'file': SimpleUploadedFile('queued.csv', b'Region,Sales\nWest,10\n'),
        }, format='multipart')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['profile_status'], 'failed')
        enqueue_profile.assert_called_once()

    def test_public_profile_and_health_endpoints_remain_available(self):
        self.assertEqual(self.client.get('/api/v1/health/').status_code, 200)
        response = self.client.post('/api/v1/datasets/profile/', {
            'headers': ['Region', 'Revenue'],
            'rows': [['West', 120], ['East', 95]],
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['rowCount'], 2)
