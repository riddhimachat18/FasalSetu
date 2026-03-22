import { Plus, BookOpen, ArrowRight } from 'lucide-react';
import fasalSetuLogo from 'figma:asset/f2d8d5eb903b36577f41dfa3a338cd5f372d0106.png';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface WelcomeHomeProps {
  onNewCrop: () => void;
  onContinueExisting: () => void;
}

export default function WelcomeHome({ onNewCrop, onContinueExisting }: WelcomeHomeProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center mb-4">
            <ImageWithFallback src={fasalSetuLogo} alt="FasalSetu Logo" className="w-24 h-24" />
          </div>
          <h1 className="text-green-800">Namaste! 🙏</h1>
          <p className="text-gray-600">How would you like to proceed?</p>
        </div>

        {/* Action Cards */}
        <div className="space-y-4">
          {/* New Crop Button */}
          <button
            onClick={onNewCrop}
            className="w-full bg-white p-8 rounded-3xl shadow-lg border-2 border-green-100 hover:border-green-300 hover:shadow-xl transition-all duration-200 active:scale-98"
          >
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md">
                <Plus className="w-10 h-10 text-white" />
              </div>
              <div className="flex-1 text-left">
                <h2 className="text-gray-800 mb-2">Log New Crop</h2>
                <p className="text-gray-500 text-sm">
                  Start tracking a new crop from planting to harvest
                </p>
              </div>
              <ArrowRight className="w-6 h-6 text-green-600 flex-shrink-0" />
            </div>
          </button>

          {/* Continue with Existing Button */}
          <button
            onClick={onContinueExisting}
            className="w-full bg-white p-8 rounded-3xl shadow-lg border-2 border-green-100 hover:border-green-300 hover:shadow-xl transition-all duration-200 active:scale-98"
          >
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md">
                <BookOpen className="w-10 h-10 text-white" />
              </div>
              <div className="flex-1 text-left">
                <h2 className="text-gray-800 mb-2">Continue with Existing Crops</h2>
                <p className="text-gray-500 text-sm">
                  Manage and monitor your current crops
                </p>
              </div>
              <ArrowRight className="w-6 h-6 text-blue-600 flex-shrink-0" />
            </div>
          </button>
        </div>

        {/* Info */}
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
          <p className="text-green-800 text-center text-sm">
            💡 You can always add new crops or switch between them from the Crop Log section
          </p>
        </div>
      </div>
    </div>
  );
}
