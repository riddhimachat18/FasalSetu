import { useState } from 'react';
import WelcomeHome from './components/WelcomeHome';
import CropPhaseSelection from './components/CropPhaseSelection';
import CropDetails from './components/CropDetails';
import HomePage from './components/HomePage';

type AppScreen = 'welcome' | 'phase-selection' | 'crop-details' | 'home';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('welcome');
  const [selectedPhase, setSelectedPhase] = useState<string>('growth');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [cropName, setCropName] = useState<string>('');
  const [plantingDate, setPlantingDate] = useState<string>('');

  const handleNewCrop = () => setCurrentScreen('phase-selection');

  const handleContinueExisting = () => setCurrentScreen('home');

  const handlePhaseSelection = (phase: string) => {
    setSelectedPhase(phase);
    if (phase === 'pre-planting') {
      setCurrentScreen('home');
    } else {
      setCurrentScreen('crop-details');
    }
  };

  const handleCropDetailsSubmit = (name: string, date: string) => {
    setCropName(name);
    setPlantingDate(date);
    setCurrentScreen('home');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      {currentScreen === 'welcome' && (
        <WelcomeHome
          onNewCrop={handleNewCrop}
          onContinueExisting={handleContinueExisting}
        />
      )}
      {currentScreen === 'phase-selection' && (
        <CropPhaseSelection onPhaseSelect={handlePhaseSelection} />
      )}
      {currentScreen === 'crop-details' && (
        <CropDetails
          selectedPhase={selectedPhase}
          onSubmit={handleCropDetailsSubmit}
        />
      )}
      {currentScreen === 'home' && (
        <HomePage
          selectedPhase={selectedPhase}
          selectedLanguage={selectedLanguage}
          onPhaseChange={setSelectedPhase}
          onLanguageChange={setSelectedLanguage}
          onLogoClick={() => setCurrentScreen('welcome')}
          onAddCrop={() => setCurrentScreen('phase-selection')}
        />
      )}
    </div>
  );
}
