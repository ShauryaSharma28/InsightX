from django.conf import settings
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import Dataset
from .serializers import DatasetProfileSerializer, DatasetSerializer, UserRegistrationSerializer
from .services import profile_dataset, profile_uploaded_dataset


class AuthRateThrottle(AnonRateThrottle):
    scope = 'auth'


class DatasetUploadRateThrottle(UserRateThrottle):
    scope = 'dataset_upload'


class SavedDatasetProfileRateThrottle(UserRateThrottle):
    scope = 'dataset_profile'


class HealthView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({'status': 'ok', 'service': 'InsightX API'})


class DatasetProfileView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle]

    def post(self, request):
        content_length = request.META.get('CONTENT_LENGTH', '')
        if content_length.isdigit() and int(content_length) > settings.MAX_PROFILE_REQUEST_SIZE:
            return Response({'detail': 'Profile requests are limited to 8 MiB.'}, status=413)
        serializer = DatasetProfileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = profile_dataset(serializer.validated_data['headers'], serializer.validated_data['rows'])
        return Response(profile, status=status.HTTP_200_OK)


class RegisterView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [AuthRateThrottle]

    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response({
            'id': user.pk,
            'username': user.get_username(),
            'email': user.email,
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        }, status=status.HTTP_201_CREATED)


class RateLimitedTokenObtainPairView(TokenObtainPairView):
    throttle_classes = [AuthRateThrottle]


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            'id': request.user.pk,
            'username': request.user.get_username(),
            'email': request.user.email,
        })


class DatasetListCreateView(generics.ListCreateAPIView):
    serializer_class = DatasetSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_throttles(self):
        return [DatasetUploadRateThrottle()] if self.request.method == 'POST' else []

    def get_queryset(self):
        return Dataset.objects.filter(owner=self.request.user)


class DatasetDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = DatasetSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Dataset.objects.filter(owner=self.request.user)


class DatasetDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        dataset = get_object_or_404(Dataset, pk=pk, owner=request.user)
        response = FileResponse(
            dataset.file.open('rb'),
            as_attachment=True,
            filename=dataset.original_filename,
            content_type='application/octet-stream',
        )
        response['Cache-Control'] = 'private, no-store'
        return response


class SavedDatasetProfileView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [SavedDatasetProfileRateThrottle]

    def get(self, request, pk):
        dataset = get_object_or_404(Dataset, pk=pk, owner=request.user)
        if dataset.profile is None:
            try:
                dataset.profile = profile_uploaded_dataset(dataset)
            except ValueError as error:
                return Response({'detail': str(error)}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
            dataset.save(update_fields=['profile'])
        return Response({'status': 'ready', 'profile': dataset.profile})
