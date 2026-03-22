import { useState } from 'react';
import { Calendar, Sprout, ArrowRight } from 'lucide-react';
import fasalSetuLogo from 'figma:asset/f2d8d5eb903b36577f41dfa3a338cd5f372d0106.png';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { addCropCycle } from '../lib/crop-db';

interface CropDetailsProps {
  selectedPhase: string;
  onSubmit: (cropName: string, plantingDate: string) => void;
}

const commonCrops = [
  'Wheat', 'Rice', 'Maize', 'Mustard', 'Chickpea', 'Lentil', 
  'Cotton', 'Sugarcane', 'Tomato', 'Potato', 'Onion', 'Other'
];

export default function CropDetails({ selectedPhase, onSubmit }: CropDetailsProps) {
  const [cropName, setCropName] = useState('');
  const [customCropName, setCustomCropName] = useState('');
  const [plantingDate, setPlantingDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    const finalCropName = cropName === 'Other' ? customCropName : cropName;
    if (!finalCropName || !plantingDate) return;

    setIsLoading(true);
    setError('');

    try {
      // Save to database
      const result = await addCropCycle({
        crop_name: finalCropName,
        sowing_date: plantingDate,
        current_stage: selectedPhase,
      });

      if (result) {
        // Success - proceed to next screen
        onSubmit(finalCropName, plantingDate);
      } else {
        setError('Failed to save crop details. Please try again.');
      }
    } catch (err) {
      console.error('Error saving crop:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = () => {
    const hasCropName = cropName === 'Other' ? customCropName.trim() !== '' : cropName !== '';
    return hasCropName && plantingDate !== '';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center mb-4">
            <ImageWithFallback src={fasalSetuLogo} alt="FasalSetu Logo" className="w-20 h-20" />
          </div>
          <h1 className="text-green-800">Crop Details</h1>
          <p className="text-gray-600">Tell us about your crop</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-3xl p-8 shadow-lg border border-green-100 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm">
              {error}
            </div>
          )}

          {/* Crop Type Selection */}
          <div className="space-y-3">
            <label className="text-gray-700 flex items-center gap-2">
              <Sprout className="w-5 h-5 text-green-600" />
              Select Crop Type
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {commonCrops.map((crop) => (
                <button
                  key={crop}
                  onClick={() => setCropName(crop)}
                  className={`p-3 rounded-xl border-2 transition-all ${
                    cropName === crop
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-green-200'
                  }`}
                >
                  {crop}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Crop Name Input */}
          {cropName === 'Other' && (
            <div className="space-y-3">
              <label className="text-gray-700">Enter Crop Name</label>
              <input
                type="text"
                value={customCropName}
                onChange={(e) => setCustomCropName(e.target.value)}
                placeholder="e.g., Barley, Sorghum..."
                className="w-full px-4 py-4 bg-gray-50 rounded-2xl border-2 border-gray-200 focus:border-green-500 focus:outline-none transition-colors"
              />
            </div>
          )}

          {/* Planting Date */}
          <div className="space-y-3">
            <label className="text-gray-700 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-green-600" />
              Date of Planting
            </label>
            <input
              type="date"
              value={plantingDate}
              onChange={(e) => setPlantingDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-4 bg-gray-50 rounded-2xl border-2 border-gray-200 focus:border-green-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={!isFormValid() || isLoading}
            className="w-full bg-green-600 text-white py-4 rounded-2xl hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
          >
            {isLoading ? (
              <span>Saving...</span>
            ) : (
              <>
                <span>Continue</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>

        {/* Phase Info */}
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
          <p className="text-green-800 text-sm">
            Phase: <span className="font-medium">{selectedPhase.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
