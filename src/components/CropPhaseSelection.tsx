import { Sprout, Wheat, TreePine, Leaf, Warehouse } from 'lucide-react';
import fasalSetuLogo from 'figma:asset/f2d8d5eb903b36577f41dfa3a338cd5f372d0106.png';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface CropPhaseSelectionProps {
  onPhaseSelect: (phase: string) => void;
}

const phases = [
  { id: 'pre-planting', name: 'Pre-Planting', icon: Sprout, description: 'Preparing soil & field' },
  { id: 'planting', name: 'Planting', icon: Wheat, description: 'Sowing seeds' },
  { id: 'post-planting', name: 'Post-Planting', icon: TreePine, description: 'Early crop care' },
  { id: 'growth', name: 'Plant Growth', icon: Leaf, description: 'Crop development' },
  { id: 'harvest', name: 'Harvest', icon: Warehouse, description: 'Ready to harvest' },
];

export default function CropPhaseSelection({ onPhaseSelect }: CropPhaseSelectionProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2 mb-4">
            <ImageWithFallback src={fasalSetuLogo} alt="FasalSetu Logo" className="w-24 h-24" />
          </div>
          <h1 className="text-green-800">FasalSetu</h1>
          <p className="text-gray-600">Your farming companion</p>
        </div>

        {/* Phase Selection */}
        <div className="space-y-4">
          <h2 className="text-center text-green-700">Select your crop phase</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
            {phases.slice(0, 4).map((phase) => {
              const Icon = phase.icon;
              return (
                <button
                  key={phase.id}
                  onClick={() => onPhaseSelect(phase.id)}
                  className="bg-white p-5 rounded-2xl shadow-sm border-2 border-green-100 hover:border-green-300 hover:shadow-md transition-all duration-200 active:scale-95"
                >
                  <div className="flex flex-col items-center gap-2.5 text-center">
                    <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center">
                      <Icon className="w-8 h-8 text-green-600" />
                    </div>
                    <div>
                      <div className="text-gray-800">{phase.name}</div>
                      <div className="text-gray-500 text-sm mt-0.5">{phase.description}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          
          {/* Fifth button centered */}
          <div className="flex justify-center">
            {phases.slice(4).map((phase) => {
              const Icon = phase.icon;
              return (
                <button
                  key={phase.id}
                  onClick={() => onPhaseSelect(phase.id)}
                  className="bg-white p-5 rounded-2xl shadow-sm border-2 border-green-100 hover:border-green-300 hover:shadow-md transition-all duration-200 active:scale-95 w-full md:w-1/2"
                >
                  <div className="flex flex-col items-center gap-2.5 text-center">
                    <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center">
                      <Icon className="w-8 h-8 text-green-600" />
                    </div>
                    <div>
                      <div className="text-gray-800">{phase.name}</div>
                      <div className="text-gray-500 text-sm mt-0.5">{phase.description}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer message */}
        <p className="text-center text-gray-500 text-sm">
          Select the current phase to get personalized advice
        </p>
      </div>
    </div>
  );
}