from rest_framework import generics, permissions
from .models import SavedDataset
from .serializers import SavedDatasetSerializer, SavedDatasetSummarySerializer


class SavedDatasetListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return SavedDataset.objects.filter(owner=self.request.user)

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return SavedDatasetSummarySerializer
        return SavedDatasetSerializer

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class SavedDatasetDetailView(generics.RetrieveDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SavedDatasetSerializer

    def get_queryset(self):
        return SavedDataset.objects.filter(owner=self.request.user)
