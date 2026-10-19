from django.urls import path

from .views import DatasetProfileView, HealthView

app_name = 'api'

urlpatterns = [
    path('health/', HealthView.as_view(), name='health'),
    path('datasets/profile/', DatasetProfileView.as_view(), name='dataset-profile'),
]
