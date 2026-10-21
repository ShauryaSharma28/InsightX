from django.urls import path

from .views import CurrentUserView, DatasetDetailView, DatasetDownloadView, DatasetListCreateView, DatasetProfileView, HealthView, LogoutView, RateLimitedTokenObtainPairView, RateLimitedTokenRefreshView, RegisterView, SavedDatasetProfileView

app_name = 'api'

urlpatterns = [
    path('health/', HealthView.as_view(), name='health'),
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/token/', RateLimitedTokenObtainPairView.as_view(), name='token-obtain-pair'),
    path('auth/token/refresh/', RateLimitedTokenRefreshView.as_view(), name='token-refresh'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/me/', CurrentUserView.as_view(), name='current-user'),
    path('datasets/profile/', DatasetProfileView.as_view(), name='dataset-profile'),
    path('datasets/', DatasetListCreateView.as_view(), name='dataset-list-create'),
    path('datasets/<int:pk>/', DatasetDetailView.as_view(), name='dataset-detail'),
    path('datasets/<int:pk>/download/', DatasetDownloadView.as_view(), name='dataset-download'),
    path('datasets/<int:pk>/profile/', SavedDatasetProfileView.as_view(), name='dataset-saved-profile'),
]
