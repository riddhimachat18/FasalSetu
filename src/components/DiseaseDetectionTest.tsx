/**
 * Disease Detection Test Component
 * Standalone component to test disease detection functionality
 */

import { useState, useRef } from 'react';
import { Camera, Upload, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { detectDiseaseFromImage, type DiseaseDetectionResult } from '../services/diseaseDetectionService';

export default function DiseaseDetectionTest() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<DiseaseDetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (event: any) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image size should be less than 5MB');
      return;
    }

    setError(null);
    setResult(null);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Convert to base64
    const base64Reader = new FileReader();
    base64Reader.onloadend = () => {
      const base64String = (base64Reader.result as string).split(',')[1];
      setSelectedImage(base64String);
    };
    base64Reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!selectedImage) return;

    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      console.log('🔬 Starting disease detection...');
      const detection = await detectDiseaseFromImage(selectedImage);
      
      if (detection) {
        setResult(detection);
        console.log('✅ Detection complete:', detection);
      } else {
        setError('Failed to analyze image. Please try again.');
      }
    } catch (err: any) {
      console.error('Error during analysis:', err);
      setError(err.message || 'An error occurred during analysis');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-2xl shadow-lg p-6">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            🔬 Crop Disease Detection Test
          </h2>
          <p className="text-gray-600">
            Upload an image of your crop to detect diseases using Google Cloud Vision AI
          </p>
        </div>

        {/* File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />

        {/* Upload Area */}
        {!imagePreview && (
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center">
                <Camera className="w-10 h-10 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  Upload Crop Image
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Take a photo or select from gallery
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.setAttribute('capture', 'environment');
                      fileInputRef.current.click();
                    }
                  }}
                  className="px-6 py-3 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <Camera className="w-5 h-5" />
                  Take Photo
                </button>
                <button
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.removeAttribute('capture');
                      fileInputRef.current.click();
                    }
                  }}
                  className="px-6 py-3 bg-gray-600 text-white rounded-full hover:bg-gray-700 transition-colors flex items-center gap-2"
                >
                  <Upload className="w-5 h-5" />
                  Choose File
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Image Preview */}
        {imagePreview && !result && (
          <div className="space-y-4">
            <div className="relative">
              <img
                src={imagePreview}
                alt="Selected crop"
                className="w-full max-h-96 object-contain rounded-xl border-2 border-gray-200"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Analyze Image
                  </>
                )}
              </button>
              <button
                onClick={handleReset}
                disabled={isAnalyzing}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-red-800">Error</h4>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Analyzed Image */}
            <div className="relative">
              <img
                src={imagePreview || result.image_url}
                alt="Analyzed crop"
                className="w-full max-h-96 object-contain rounded-xl border-2 border-green-200"
              />
              <div className="absolute top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-full text-sm font-semibold">
                ✓ Analyzed
              </div>
            </div>

            {/* Detection Results */}
            <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-xl p-6 space-y-4">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                🔍 Detection Results
              </h3>

              {/* Main Info Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg p-4">
                  <div className="text-xs text-gray-500 mb-1">Disease</div>
                  <div className="font-bold text-gray-800 capitalize">
                    {result.disease_name}
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4">
                  <div className="text-xs text-gray-500 mb-1">Confidence</div>
                  <div className="font-bold text-green-600">
                    {Math.round(result.confidence * 100)}%
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4">
                  <div className="text-xs text-gray-500 mb-1">Severity</div>
                  <div className={`font-bold capitalize ${
                    result.severity === 'severe' ? 'text-red-600' :
                    result.severity === 'moderate' ? 'text-yellow-600' :
                    'text-green-600'
                  }`}>
                    {result.severity}
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4">
                  <div className="text-xs text-gray-500 mb-1">Affected Part</div>
                  <div className="font-bold text-gray-800 capitalize">
                    {result.affected_part}
                  </div>
                </div>
              </div>

              {/* Remedy */}
              <div className="bg-white rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  💊 Recommended Treatment
                </h4>
                <p className="text-gray-700 whitespace-pre-wrap">
                  {result.remedy_suggested}
                </p>
              </div>

              {/* Raw Detection Data */}
              <details className="bg-white rounded-lg p-4">
                <summary className="font-semibold text-gray-800 cursor-pointer hover:text-green-600">
                  📊 View Raw Detection Data
                </summary>
                <div className="mt-4 space-y-3">
                  {/* Labels */}
                  <div>
                    <h5 className="text-sm font-semibold text-gray-700 mb-2">
                      Vision API Labels:
                    </h5>
                    <div className="space-y-1">
                      {result.raw_labels.slice(0, 10).map((label, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-gray-700">{label.description}</span>
                          <span className="text-gray-500">
                            {Math.round(label.score * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Web Entities */}
                  {result.raw_web_entities.length > 0 && (
                    <div>
                      <h5 className="text-sm font-semibold text-gray-700 mb-2">
                        Web Entities:
                      </h5>
                      <div className="space-y-1">
                        {result.raw_web_entities.slice(0, 10).map((entity, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className="text-gray-700">{entity.description}</span>
                            <span className="text-gray-500">
                              {Math.round(entity.score * 100)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </details>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors"
              >
                Analyze Another Image
              </button>
            </div>
          </div>
        )}

        {/* Info Footer */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-semibold text-blue-800 mb-2">💡 Tips for Best Results</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Take clear, well-lit photos of affected plant parts</li>
            <li>• Focus on leaves, stems, or fruits showing symptoms</li>
            <li>• Avoid blurry or dark images</li>
            <li>• Include close-up shots of disease spots or lesions</li>
            <li>• Multiple angles help improve detection accuracy</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
