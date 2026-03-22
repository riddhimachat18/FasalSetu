import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Languages, MapPin, Check, Loader2, Sprout, LogOut, Volume2, Mic } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './ui/sheet';
import { updateUserLocation, resetPermissionDenied, formatLocation } from '../lib/user-location';
import { fetchAndSaveSoilData } from '../lib/soil-db';
import { signOut } from '../lib/auth-helpers';
import { voiceService, AVAILABLE_VOICES, type VoiceOption } from '../services/voiceService';

interface SettingsProps {
  currentLanguage: string;
  onLanguageChange: (language: string) => void;
}

const languages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'mixed', name: 'Hinglish', nativeName: 'Hinglish' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
];

export default function Settings({
  currentLanguage,
  onLanguageChange,
}: SettingsProps) {
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string>('');
  const [isFetchingSoil, setIsFetchingSoil] = useState(false);
  const [soilStatus, setSoilStatus] = useState<string>('');
  
  // Voice settings state
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    return localStorage.getItem('voice_enabled') !== 'false';
  });
  const [selectedVoiceId, setSelectedVoiceId] = useState(() => {
    return localStorage.getItem('selected_voice_id') || 'priya-professional';
  });
  const [voiceSpeed, setVoiceSpeed] = useState(() => {
    return parseFloat(localStorage.getItem('voice_speed') || '1.0');
  });
  const [voiceVolume, setVoiceVolume] = useState(() => {
    return parseFloat(localStorage.getItem('voice_volume') || '0.8');
  });
  const [voicePitch, setVoicePitch] = useState(() => {
    return parseFloat(localStorage.getItem('voice_pitch') || '1.0');
  });
  const [isTestingVoice, setIsTestingVoice] = useState(false);

  // Get voices for current language
  const getVoicesForLanguage = (langCode: string): VoiceOption[] => {
    const langMap: Record<string, string[]> = {
      'en': ['en-IN', 'en-US', 'en-GB'], // Include all English variants
      'hi': ['hi-IN'],
      'mr': ['mr-IN'],
      'ta': ['ta-IN'],
      'te': ['te-IN'],
      'kn': ['kn-IN'],
      'mixed': ['hi-IN'],
    };
    const targetLangs = langMap[langCode] || ['hi-IN'];
    return AVAILABLE_VOICES.filter(v => targetLangs.includes(v.language));
  };

  // Save voice settings to localStorage
  useEffect(() => {
    localStorage.setItem('voice_enabled', voiceEnabled.toString());
    localStorage.setItem('selected_voice_id', selectedVoiceId);
    localStorage.setItem('voice_speed', voiceSpeed.toString());
    localStorage.setItem('voice_volume', voiceVolume.toString());
    localStorage.setItem('voice_pitch', voicePitch.toString());
  }, [voiceEnabled, selectedVoiceId, voiceSpeed, voiceVolume, voicePitch]);

  const handleLanguageChange = (newLanguage: string) => {
    // Update parent component
    onLanguageChange(newLanguage);
    
    // Save to localStorage
    localStorage.setItem('chatbot_language', newLanguage);
    
    // Dispatch custom event for same-tab synchronization
    window.dispatchEvent(new CustomEvent('languageChanged', { 
      detail: { language: newLanguage } 
    }));
    
    console.log('🌐 Language changed in Settings:', newLanguage);
  };

  const handleFetchLocation = async () => {
    setIsFetchingLocation(true);
    setLocationStatus('Requesting location access...');
    
    try {
      // Reset permission denied flag to allow fresh request
      resetPermissionDenied();
      
      // Force update location (recalculates coordinates)
      const location = await updateUserLocation();
      
      if (location && location.latitude && location.longitude) {
        const locationText = formatLocation(location);
        setLocationStatus(`✅ Location updated: ${locationText}`);
        setTimeout(() => setLocationStatus(''), 5000);
      } else {
        setLocationStatus('❌ Failed to get location. Please enable location access in your browser.');
        setTimeout(() => setLocationStatus(''), 5000);
      }
    } catch (error) {
      console.error('Error fetching location:', error);
      setLocationStatus('❌ Error fetching location');
      setTimeout(() => setLocationStatus(''), 5000);
    } finally {
      setIsFetchingLocation(false);
    }
  };

  const handleFetchSoilData = async () => {
    setIsFetchingSoil(true);
    setSoilStatus('Fetching soil data...');
    
    try {
      const soilData = await fetchAndSaveSoilData();
      
      if (soilData) {
        setSoilStatus(`✅ Soil data updated! Type: ${soilData.soilType}, pH: ${soilData.pH.toFixed(1)}`);
        setTimeout(() => setSoilStatus(''), 5000);
      } else {
        setSoilStatus('❌ Failed to fetch soil data. Check location settings.');
        setTimeout(() => setSoilStatus(''), 5000);
      }
    } catch (error) {
      console.error('Error fetching soil data:', error);
      setSoilStatus('❌ Error fetching soil data');
      setTimeout(() => setSoilStatus(''), 5000);
    } finally {
      setIsFetchingSoil(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleTestVoice = async () => {
    if (isTestingVoice) {
      voiceService.stop();
      setIsTestingVoice(false);
      return;
    }

    const testTexts: Record<string, string> = {
      'en': 'Hello! I am FasalSetu AI. How can I help you today?',
      'hi': 'नमस्ते! मैं फसलसेतु एआई हूँ। आज मैं आपकी क्या मदद कर सकता हूँ?',
      'mr': 'नमस्कार! मी फसलसेतु एआय आहे। आज मी तुमची काय मदत करू शकतो?',
      'ta': 'வணக்கம்! நான் பசல்சேது AI. இன்று நான் உங்களுக்கு எப்படி உதவ முடியும்?',
      'te': 'నమస్కారం! నేను ఫసల్‌సేతు AI. ఈరోజు నేను మీకు ఎలా సహాయం చేయగలను?',
      'kn': 'ನಮಸ್ಕಾರ! ನಾನು ಫಸಲ್‌ಸೇತು AI. ಇಂದು ನಾನು ನಿಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?',
      'mixed': 'नमस्ते! मैं फसलसेतु एआई हूँ। आज मैं आपकी क्या मदद कर सकता हूँ?',
    };

    setIsTestingVoice(true);
    try {
      const testText = testTexts[currentLanguage] || testTexts['hi'];
      await voiceService.speak(testText, currentLanguage);
    } catch (error) {
      console.error('Voice test error:', error);
    } finally {
      setIsTestingVoice(false);
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button className="w-10 h-10 rounded-full bg-green-50 hover:bg-green-100 flex items-center justify-center transition-colors">
          <SettingsIcon className="w-5 h-5 text-green-700" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5" />
            Settings
          </SheetTitle>
          <SheetDescription>
            Customize your FasalSetu experience
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-2">
          {/* Language Selection */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Languages className="w-5 h-5 text-green-600" />
              <h3 className="text-gray-800 font-medium">Chatbot Language</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">Select your preferred language for AI conversations</p>
            <div className="space-y-2 max-w-sm mx-auto">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${
                    currentLanguage === lang.code
                      ? 'border-green-500 bg-green-50 shadow-sm'
                      : 'border-gray-200 hover:border-green-300 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="text-left">
                    <div className="text-gray-800 font-medium">{lang.nativeName}</div>
                    <div className="text-xs text-gray-500">{lang.name}</div>
                  </div>
                  {currentLanguage === lang.code && (
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Fetch Location Button */}
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-5 h-5 text-green-600" />
              <h3 className="text-gray-800 font-medium">Location</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">Update your location coordinates for accurate weather data</p>
            <div className="max-w-sm mx-auto">
              <button
                onClick={handleFetchLocation}
                disabled={isFetchingLocation}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-green-500 bg-white hover:bg-green-50 transition-all text-green-600 font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {isFetchingLocation ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Fetching Location...</span>
                  </>
                ) : (
                  <>
                    <MapPin className="w-5 h-5" />
                    <span>Update Location</span>
                  </>
                )}
              </button>
              {locationStatus && (
                <p className="mt-3 text-sm text-center text-gray-600 px-2">{locationStatus}</p>
              )}
            </div>
          </div>

          {/* Fetch Soil Data Button */}
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <Sprout className="w-5 h-5 text-green-600" />
              <h3 className="text-gray-800 font-medium">Soil Data</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">Fetch soil properties for your farm location</p>
            <div className="max-w-sm mx-auto">
              <button
                onClick={handleFetchSoilData}
                disabled={isFetchingSoil}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-green-500 bg-white hover:bg-green-50 transition-all text-green-600 font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {isFetchingSoil ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Fetching Soil Data...</span>
                  </>
                ) : (
                  <>
                    <Sprout className="w-5 h-5" />
                    <span>Fetch Soil Data</span>
                  </>
                )}
              </button>
              {soilStatus && (
                <p className="mt-3 text-sm text-center text-gray-600 px-2">{soilStatus}</p>
              )}
            </div>
          </div>

          {/* Voice Settings */}
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <Volume2 className="w-5 h-5 text-green-600" />
              <h3 className="text-gray-800 font-medium">Voice Settings</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">Customize voice input and output</p>
            
            <div className="space-y-4 max-w-sm mx-auto">
              {/* Enable/Disable Voice */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border border-green-100 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <Mic className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-gray-800 block">Enable Voice Features</span>
                    <span className="text-xs text-gray-500">Voice input & output</span>
                  </div>
                </div>
                <button
                  onClick={() => setVoiceEnabled(!voiceEnabled)}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2 shadow-md ${
                    voiceEnabled 
                      ? 'bg-gradient-to-r from-green-500 to-green-600' 
                      : 'bg-gray-300'
                  }`}
                  aria-label="Toggle voice features"
                  role="switch"
                  aria-checked={voiceEnabled}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-all duration-300 ease-in-out ${
                      voiceEnabled ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  >
                    {voiceEnabled && (
                      <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </span>
                </button>
              </div>

              {voiceEnabled && (
                <>
                  {/* Voice Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Voice Profile
                    </label>
                    <div className="relative">
                      <select
                        value={selectedVoiceId}
                        onChange={(e) => setSelectedVoiceId(e.target.value)}
                        className="w-full px-3 py-2 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white text-sm font-medium"
                      >
                        {getVoicesForLanguage(currentLanguage).map((voice) => (
                          <option key={voice.id} value={voice.id}>
                            {voice.gender === 'male' ? '👨' : '👩'} {voice.name} ({voice.gender}) - {voice.personality}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-2 p-2 bg-green-50 rounded border border-green-200">
                      <p className="text-xs text-green-800 font-medium">
                        ✓ Selected: {AVAILABLE_VOICES.find(v => v.id === selectedVoiceId)?.name}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {AVAILABLE_VOICES.find(v => v.id === selectedVoiceId)?.description}
                      </p>
                    </div>
                  </div>

                  {/* Voice Speed */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700">
                        Speed
                      </label>
                      <span className="text-sm text-gray-600">{voiceSpeed.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={voiceSpeed}
                      onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Slow</span>
                      <span>Normal</span>
                      <span>Fast</span>
                    </div>
                  </div>

                  {/* Voice Volume */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700">
                        Volume
                      </label>
                      <span className="text-sm text-gray-600">{Math.round(voiceVolume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={voiceVolume}
                      onChange={(e) => setVoiceVolume(parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Quiet</span>
                      <span>Medium</span>
                      <span>Loud</span>
                    </div>
                  </div>

                  {/* Voice Pitch */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700">
                        Pitch
                      </label>
                      <span className="text-sm text-gray-600">{voicePitch.toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={voicePitch}
                      onChange={(e) => setVoicePitch(parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Low</span>
                      <span>Normal</span>
                      <span>High</span>
                    </div>
                  </div>

                  {/* Test Voice Button */}
                  <button
                    onClick={handleTestVoice}
                    disabled={isTestingVoice}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-green-500 bg-white hover:bg-green-50 transition-all text-green-600 font-medium disabled:opacity-50 shadow-sm"
                  >
                    {isTestingVoice ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Playing...</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-5 h-5" />
                        <span>Test Voice</span>
                      </>
                    )}
                  </button>

                  {/* Save Settings Button */}
                  <button
                    onClick={() => {
                      // Force save to localStorage
                      localStorage.setItem('voice_enabled', voiceEnabled.toString());
                      localStorage.setItem('selected_voice_id', selectedVoiceId);
                      localStorage.setItem('voice_speed', voiceSpeed.toString());
                      localStorage.setItem('voice_volume', voiceVolume.toString());
                      localStorage.setItem('voice_pitch', voicePitch.toString());
                      
                      // Dispatch event to notify other components
                      window.dispatchEvent(new CustomEvent('voiceSettingsChanged', {
                        detail: { selectedVoiceId, voiceSpeed, voiceVolume, voicePitch }
                      }));
                      
                      // Show success message in button (no alert)
                      const button = document.activeElement as HTMLButtonElement;
                      const originalText = button.innerHTML;
                      button.innerHTML = '<svg class="w-5 h-5 inline" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg> <span>Saved!</span>';
                      button.classList.add('bg-green-700');
                      
                      setTimeout(() => {
                        button.innerHTML = originalText;
                        button.classList.remove('bg-green-700');
                      }, 2000);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-green-600 hover:bg-green-700 transition-all text-white font-semibold shadow-md"
                  >
                    <Check className="w-5 h-5" />
                    <span>Save Voice Settings</span>
                  </button>

                  {/* Voice Info */}
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-xs text-blue-800">
                      <strong>💡 Tip:</strong> Click "Save Voice Settings" to apply changes. 
                      Voice settings will be used for all "Read it" buttons in chat.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Logout Button */}
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <LogOut className="w-5 h-5 text-red-600" />
              <h3 className="text-gray-800 font-medium">Account</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">Sign out of your FasalSetu account</p>
            <div className="max-w-sm mx-auto">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-red-500 bg-white hover:bg-red-50 transition-all text-red-600 font-medium shadow-sm"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}