// Voice Feature Test Component
// Use this to test voice input and output functionality

import { useState } from 'react';
import { Mic, Volume2, VolumeX } from 'lucide-react';
import { voiceService, AVAILABLE_VOICES } from '../services/voiceService';

export default function VoiceTest() {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('hi');
  const [testText, setTestText] = useState('नमस्ते! मैं फसलसेतु एआई हूँ। आज मैं आपकी क्या मदद कर सकता हूँ?');

  const handleVoiceInput = async () => {
    if (isListening) {
      voiceService.stopListening();
      setIsListening(false);
      return;
    }

    try {
      setIsListening(true);
      const result = await voiceService.startListening(selectedLanguage);
      setTranscript(result);
      setIsListening(false);
    } catch (error) {
      console.error('Voice input error:', error);
      setIsListening(false);
      alert('Voice input failed. Please try again.');
    }
  };

  const handleTextToSpeech = async () => {
    if (isSpeaking) {
      voiceService.stop();
      setIsSpeaking(false);
      return;
    }

    try {
      setIsSpeaking(true);
      await voiceService.speak(testText, selectedLanguage);
      setIsSpeaking(false);
    } catch (error) {
      console.error('Text-to-speech error:', error);
      setIsSpeaking(false);
    }
  };

  const languageOptions = [
    { code: 'hi', name: 'Hindi (हिंदी)' },
    { code: 'mr', name: 'Marathi (मराठी)' },
    { code: 'ta', name: 'Tamil (தமிழ்)' },
    { code: 'te', name: 'Telugu (తెలుగు)' },
    { code: 'kn', name: 'Kannada (ಕನ್ನಡ)' },
    { code: 'en', name: 'English' },
  ];

  const sampleTexts: Record<string, string> = {
    hi: 'नमस्ते! मैं फसलसेतु एआई हूँ। आज मैं आपकी क्या मदद कर सकता हूँ?',
    mr: 'नमस्कार! मी फसलसेतु एआय आहे। आज मी तुमची काय मदत करू शकतो?',
    ta: 'வணக்கம்! நான் பசல்சேது AI. இன்று நான் உங்களுக்கு எப்படி உதவ முடியும்?',
    te: 'నమస్కారం! నేను ఫసల్‌సేతు AI. ఈరోజు నేను మీకు ఎలా సహాయం చేయగలను?',
    kn: 'ನಮಸ್ಕಾರ! ನಾನು ಫಸಲ್‌ಸೇತು AI. ಇಂದು ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?',
    en: 'Hello! I am FasalSetu AI. How can I help you today?',
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h1 className="text-2xl font-bold text-green-700 mb-4">
          🎤 Voice Features Test
        </h1>
        
        {/* Language Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Language:
          </label>
          <select
            value={selectedLanguage}
            onChange={(e) => {
              setSelectedLanguage(e.target.value);
              setTestText(sampleTexts[e.target.value]);
            }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          >
            {languageOptions.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        {/* Voice Input Test */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <h2 className="text-lg font-semibold text-blue-900 mb-3">
            1. Voice Input (Speech-to-Text)
          </h2>
          <button
            onClick={handleVoiceInput}
            className={`w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
              isListening
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <Mic className="w-5 h-5" />
            {isListening ? 'Listening... (Click to stop)' : 'Start Voice Input'}
          </button>
          
          {transcript && (
            <div className="mt-3 p-3 bg-white rounded border border-blue-200">
              <p className="text-sm text-gray-600 mb-1">Transcript:</p>
              <p className="text-gray-900">{transcript}</p>
            </div>
          )}
          
          <p className="text-xs text-gray-600 mt-2">
            Click the button and speak in {languageOptions.find(l => l.code === selectedLanguage)?.name}
          </p>
        </div>

        {/* Voice Output Test */}
        <div className="mb-6 p-4 bg-green-50 rounded-lg">
          <h2 className="text-lg font-semibold text-green-900 mb-3">
            2. Voice Output (Text-to-Speech)
          </h2>
          
          <textarea
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3 min-h-[100px]"
            placeholder="Enter text to speak..."
          />
          
          <button
            onClick={handleTextToSpeech}
            className={`w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
              isSpeaking
                ? 'bg-red-500 text-white'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isSpeaking ? (
              <>
                <VolumeX className="w-5 h-5" />
                Stop Speaking
              </>
            ) : (
              <>
                <Volume2 className="w-5 h-5" />
                Read Text Aloud
              </>
            )}
          </button>
          
          <p className="text-xs text-gray-600 mt-2">
            Edit the text above and click to hear it in {languageOptions.find(l => l.code === selectedLanguage)?.name}
          </p>
        </div>

        {/* Available Voices */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            3. Available Voices (Chirp 3 HD)
          </h2>
          <div className="space-y-2">
            {AVAILABLE_VOICES.map((voice) => (
              <div
                key={voice.id}
                className="flex items-center justify-between p-2 bg-white rounded border border-gray-200"
              >
                <div>
                  <p className="font-medium text-gray-900">{voice.name}</p>
                  <p className="text-xs text-gray-600">{voice.description}</p>
                </div>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                  {voice.accent}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Browser Support Info */}
        <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <h3 className="font-semibold text-yellow-900 mb-2">ℹ️ Browser Support</h3>
          <ul className="text-sm text-yellow-800 space-y-1">
            <li>✅ Voice Input: Chrome, Edge, Safari (iOS 14.5+)</li>
            <li>✅ Voice Output: All modern browsers</li>
            <li>⚠️ Best experience: Chrome or Edge</li>
            <li>🔒 Microphone permission required for voice input</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
