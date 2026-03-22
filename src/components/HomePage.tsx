import { useState } from 'react';
import { MessageCircle, BookOpen, Lightbulb, Calendar, Sprout } from 'lucide-react';
import Chatbot from './Chatbot';
import CropLog from './CropLog';
import CropSuggestions from './CropSuggestions';
import CalendarAlerts from './CalendarAlerts';
import Settings from './Settings';
import fasalSetuLogo from 'figma:asset/f2d8d5eb903b36577f41dfa3a338cd5f372d0106.png';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface HomePageProps {
  selectedPhase: string;
  selectedLanguage: string;
  onPhaseChange: (phase: string) => void;
  onLanguageChange: (language: string) => void;
  onLogoClick: () => void;
  onAddCrop?: () => void;
}

type ActiveTab = 'chatbot' | 'crop-log' | 'suggestions' | 'calendar';

export default function HomePage({ selectedPhase, selectedLanguage, onPhaseChange, onLanguageChange, onLogoClick, onAddCrop }: HomePageProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('chatbot');

  const tabs = [
    { id: 'chatbot' as ActiveTab, name: 'AI Advisor', icon: MessageCircle },
    { id: 'crop-log' as ActiveTab, name: 'Crop Log', icon: BookOpen },
    { id: 'suggestions' as ActiveTab, name: 'Suggestions', icon: Lightbulb },
    { id: 'calendar' as ActiveTab, name: 'Calendar', icon: Calendar },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-green-100 sticky top-0 z-10">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <button 
              onClick={onLogoClick}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <ImageWithFallback src={fasalSetuLogo} alt="FasalSetu Logo" className="w-8 h-8" />
              <div>
                <h1 className="text-green-800">FasalSetu</h1>
              </div>
            </button>
            <div className="flex items-center gap-3">
              <Settings
                currentLanguage={selectedLanguage}
                onLanguageChange={onLanguageChange}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6">
        {activeTab === 'chatbot' && <Chatbot />}
        {activeTab === 'crop-log' && <CropLog onAddCrop={onAddCrop} />}
        {activeTab === 'suggestions' && <CropSuggestions />}
        {activeTab === 'calendar' && <CalendarAlerts />}
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-white border-t border-green-100 sticky bottom-0">
        <div className="max-w-4xl mx-auto px-2 py-2">
          <div className="grid grid-cols-4 gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl transition-all ${
                    isActive
                      ? 'bg-green-50 text-green-700'
                      : 'text-gray-500 hover:text-green-600'
                  }`}
                >
                  <Icon className={`w-6 h-6 ${isActive ? 'scale-110' : ''} transition-transform`} />
                  <span className="text-xs">{tab.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}