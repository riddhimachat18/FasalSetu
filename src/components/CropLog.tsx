import { useState, useEffect } from 'react';
import { Plus, Calendar, Sprout, Loader2, Trash2 } from 'lucide-react';
import { getActiveCrops, getCropStatus, deleteCropCycle, type CropCycle } from '../lib/crop-db';

interface CropLogProps {
  onAddCrop?: () => void;
}

// Separate component for each crop card to handle async status
function CropCard({ crop, refreshKey, onDelete }: { crop: CropCycle; refreshKey?: number; onDelete: (cropId: number) => void }) {
  const [status, setStatus] = useState<'healthy' | 'attention' | 'critical'>('healthy');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const loadStatus = async () => {
      setIsRefreshing(true);
      try {
        console.log(`🔄 [${new Date().toLocaleTimeString()}] Re-evaluating ${crop.crop_name} status from database...`);
        const cropStatus = await getCropStatus(crop);
        console.log(`✅ [${new Date().toLocaleTimeString()}] ${crop.crop_name} status: ${cropStatus}`);
        setStatus(cropStatus);
        setLastUpdated(new Date());
      } catch (error) {
        console.error('Error loading crop status:', error);
      } finally {
        setIsRefreshing(false);
      }
    };
    loadStatus();
  }, [crop.crop_id, refreshKey]); // Refresh when refreshKey changes

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const getStatusColor = (status: 'healthy' | 'attention' | 'critical') => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'attention':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'critical':
        return 'bg-red-100 text-red-700 border-red-200';
    }
  };

  const getStatusLabel = (status: 'healthy' | 'attention' | 'critical') => {
    switch (status) {
      case 'healthy':
        return 'Healthy';
      case 'attention':
        return 'Attention';
      case 'critical':
        return 'Urgent Action';
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${crop.crop_name}?`)) {
      return;
    }
    
    setIsDeleting(true);
    try {
      const success = await deleteCropCycle(crop.crop_id);
      if (success) {
        console.log(`✅ Deleted crop: ${crop.crop_name}`);
        onDelete(crop.crop_id);
      } else {
        alert('Failed to delete crop. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting crop:', error);
      alert('Error deleting crop. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-green-100 hover:shadow-md transition-shadow relative group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center">
            <Sprout className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h3 className="text-gray-800">{crop.crop_name}</h3>
            <div className="flex items-center gap-1.5 text-gray-500 text-sm mt-1">
              <span className="capitalize">{crop.current_stage.replace('-', ' ')}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`px-3 py-1 rounded-full text-xs border ${getStatusColor(status)}`}
          >
            {getStatusLabel(status)}
          </div>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
            title="Delete crop"
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 text-red-600 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 text-red-600" />
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100">
        <div>
          <div className="flex items-center gap-1.5 text-gray-500 text-sm mb-1">
            <Calendar className="w-3.5 h-3.5" />
            <span>Planted</span>
          </div>
          <p className="text-gray-700">{formatDate(crop.sowing_date)}</p>
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-gray-500 text-sm mb-1">
            <Calendar className="w-3.5 h-3.5" />
            <span>Harvest</span>
          </div>
          <p className="text-gray-700">
            {crop.expected_harvest_date ? formatDate(crop.expected_harvest_date) : 'TBD'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function CropLog({ onAddCrop }: CropLogProps) {
  const [crops, setCrops] = useState<CropCycle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadCrops();
    
    // Set up polling to refresh status every 5 seconds (faster for testing)
    const pollInterval = setInterval(() => {
      console.log('🔄 Auto-refreshing crop status...');
      setRefreshKey(prev => prev + 1);
    }, 5000); // Refresh every 5 seconds

    // Listen for visibility change to refresh when user returns to tab
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('👁️ Tab visible, refreshing crop status...');
        setRefreshKey(prev => prev + 1);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Listen for custom disease detection event
    const handleDiseaseDetected = () => {
      console.log('🦠 Disease detected event, refreshing crop status...');
      setRefreshKey(prev => prev + 1);
    };
    window.addEventListener('diseaseDetected', handleDiseaseDetected);

    return () => {
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('diseaseDetected', handleDiseaseDetected);
    };
  }, []);

  const loadCrops = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await getActiveCrops();
      setCrops(data);
    } catch (err) {
      console.error('Error loading crops:', err);
      setError('Failed to load crops');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCrop = (cropId: number) => {
    // Remove crop from local state immediately
    setCrops(prevCrops => prevCrops.filter(c => c.crop_id !== cropId));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-gray-800">My Crops</h2>
          <p className="text-gray-500 text-sm mt-1">Track your planted crops</p>
        </div>
        <button 
          onClick={onAddCrop}
          className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center hover:bg-green-700 transition-colors shadow-md active:scale-95"
        >
          <Plus className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm">
          {error}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
        </div>
      )}

      {/* Crops List */}
      {!isLoading && crops.length > 0 && (
        <div className="space-y-3">
          {crops.map((crop) => (
            <CropCard key={crop.crop_id} crop={crop} refreshKey={refreshKey} onDelete={handleDeleteCrop} />
          ))}
        </div>
      )}

      {/* Empty State for new users */}
      {!isLoading && crops.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center border border-green-100">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Sprout className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-gray-700 mb-2">No crops logged yet</h3>
          <p className="text-gray-500 text-sm mb-6">
            Start by adding your first crop
          </p>
          <button 
            onClick={onAddCrop}
            className="px-6 py-3 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors"
          >
            Add First Crop
          </button>
        </div>
      )}
    </div>
  );
}


