from django.urls import path

from rest_framework_simplejwt.views import TokenRefreshView

from .views import CurrentUserView, DatasetDetailView, DatasetDownloadView, DatasetListCreateView, DatasetProfileView, HealthView, RateLimitedTokenObtainPairView, RegisterView

app_name = 'api'

urlpatterns = [
    path('health/', HealthView.as_view(), name='health'),
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/token/', RateLimitedTokenObtainPairView.as_view(), name='token-obtain-pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('auth/me/', CurrentUserView.as_view(), name='current-user'),
    path('datasets/profile/', DatasetProfileView.as_view(), name='dataset-profile'),
    path('datasets/', DatasetListCreateView.as_view(), name='dataset-list-create'),
    path('datasets/<int:pk>/', DatasetDetailView.as_view(), name='dataset-detail'),
    path('datasets/<int:pk>/download/', DatasetDownloadView.as_view(), name='dataset-download'),
]
