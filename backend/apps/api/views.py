from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from .serializers import DatasetProfileSerializer
from .services import profile_dataset


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
        serializer = DatasetProfileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = profile_dataset(serializer.validated_data['headers'], serializer.validated_data['rows'])
        return Response(profile, status=status.HTTP_200_OK)
