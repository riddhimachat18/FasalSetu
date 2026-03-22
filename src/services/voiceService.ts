// Voice Service with Google Cloud Text-to-Speech (Chirp 3) Support
// Supports multiple regional Indian languages with high-quality neural voices

const GOOGLE_TTS_API_KEY = (import.meta as any).env.VITE_GOOGLE_CHIRP3_API_KEY || (import.meta as any).env.VITE_GOOGLE_AI_API_KEY || '';
const USE_GOOGLE_TTS = (import.meta as any).env.VITE_ENABLE_CHIRP3_HD_VOICES === 'true';

export interface VoiceOption {
  id: string;
  name: string;
  gender: 'male' | 'female';
  language: string;
  accent: string;
  personality: string;
  description: string;
  voiceURI: string;
  rate: number;
  volume: number;
}

// Google Cloud Text-to-Speech Voice Configurations
// PRIORITY: Chirp 3 > Journey > Neural2 > Wavenet > Standard
// Chirp 3 is Google's latest generative AI voice model with the most natural quality
export const AVAILABLE_VOICES: VoiceOption[] = [
  // --- English (India) - Chirp 3 Journey Voices (BEST QUALITY) ---
  {
    id: 'sarah-supportive',
    name: 'Sarah',
    gender: 'female',
    language: 'en-IN',
    accent: 'Indian English',
    personality: 'supportive',
    description: 'Warm, caring voice (Chirp 3 Journey)',
    voiceURI: 'en-IN-Journey-F',
    rate: 0.9,
    volume: 0.8,
  },
  {
    id: 'raj-friendly',
    name: 'Raj',
    gender: 'male',
    language: 'en-IN',
    accent: 'Indian English',
    personality: 'friendly',
    description: 'Encouraging friend voice (Chirp 3 Journey)',
    voiceURI: 'en-IN-Journey-D',
    rate: 1.0,
    volume: 0.8,
  },
  
  // --- Hindi - Chirp 3 Journey Voices (BEST QUALITY) ---
  {
    id: 'priya-professional',
    name: 'Dr. Priya',
    gender: 'female',
    language: 'hi-IN',
    accent: 'Hindi',
    personality: 'professional',
    description: 'Professional voice (Chirp 3 Journey Hindi)',
    voiceURI: 'hi-IN-Journey-F',
    rate: 0.9,
    volume: 0.8,
  },
  {
    id: 'arjun-confident',
    name: 'Arjun',
    gender: 'male',
    language: 'hi-IN',
    accent: 'Hindi',
    personality: 'energetic',
    description: 'Confident motivator voice (Chirp 3 Journey Hindi)',
    voiceURI: 'hi-IN-Journey-D',
    rate: 1.0,
    volume: 0.9,
  },
  
  // --- Marathi - Neural2 Voices (High Quality) ---
  {
    id: 'rohan-calm',
    name: 'Rohan',
    gender: 'male',
    language: 'mr-IN',
    accent: 'Marathi',
    personality: 'calm',
    description: 'Calm guide (Neural2 Marathi)',
    voiceURI: 'mr-IN-Neural2-B',
    rate: 0.9,
    volume: 0.8,
  },
  {
    id: 'priya-marathi',
    name: 'Priya',
    gender: 'female',
    language: 'mr-IN',
    accent: 'Marathi',
    personality: 'supportive',
    description: 'Supportive voice (Neural2 Marathi)',
    voiceURI: 'mr-IN-Neural2-A',
    rate: 0.9,
    volume: 0.8,
  },
  
  // --- Tamil - Neural2 Voices (High Quality) ---
  {
    id: 'kavya-supportive',
    name: 'Kavya',
    gender: 'female',
    language: 'ta-IN',
    accent: 'Tamil',
    personality: 'supportive',
    description: 'Warm and caring (Neural2 Tamil)',
    voiceURI: 'ta-IN-Neural2-A',
    rate: 0.9,
    volume: 0.8,
  },
  
  // --- Telugu - Neural2 Voices (High Quality) ---
  {
    id: 'vikram-energetic',
    name: 'Vikram',
    gender: 'male',
    language: 'te-IN',
    accent: 'Telugu',
    personality: 'energetic',
    description: 'Motivational guide (Neural2 Telugu)',
    voiceURI: 'te-IN-Neural2-B',
    rate: 1.0,
    volume: 0.9,
  },
  
  // --- Kannada - Neural2 Voices (High Quality) ---
  {
    id: 'deepa-friendly',
    name: 'Deepa',
    gender: 'female',
    language: 'kn-IN',
    accent: 'Kannada',
    personality: 'friendly',
    description: 'Friendly companion (Neural2 Kannada)',
    voiceURI: 'kn-IN-Neural2-A',
    rate: 0.9,
    volume: 0.8,
  },
];

// Language mapping for voice selection
const LANGUAGE_VOICE_MAP: Record<string, string> = {
  'en': 'en-IN',
  'hi': 'hi-IN',
  'mr': 'mr-IN',
  'ta': 'ta-IN',
  'te': 'te-IN',
  'kn': 'kn-IN',
  'mixed': 'hi-IN', // Default to Hindi for mixed
};

class VoiceService {
  private synthesis: SpeechSynthesis;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private recognition: any = null;
  private isRecognitionActive = false;

  constructor() {
    this.synthesis = window.speechSynthesis;
    this.initializeSpeechRecognition();
  }

  // Initialize Speech Recognition (Voice Input)
  private initializeSpeechRecognition() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
    } else {
      console.warn('Speech Recognition not supported in this browser');
    }
  }

  // Get voice for language
  private getVoiceForLanguage(language: string): VoiceOption {
    const langCode = LANGUAGE_VOICE_MAP[language] || 'hi-IN';
    
    // Get selected voice ID from localStorage
    const selectedVoiceId = localStorage.getItem('selected_voice_id');
    
    // If user selected a specific voice, check if it matches the language
    if (selectedVoiceId) {
      const selectedVoice = AVAILABLE_VOICES.find(v => v.id === selectedVoiceId);
      if (selectedVoice) {
        // If the selected voice language matches current language, use it
        if (selectedVoice.language === langCode) {
          console.log('🎯 Using selected voice from settings:', selectedVoice.name, selectedVoice.id);
          return selectedVoice;
        } else {
          console.log('⚠️ Selected voice language mismatch:', selectedVoice.language, 'vs', langCode, '- using language default');
        }
      }
    }
    
    // Return default voice for language
    const voice = AVAILABLE_VOICES.find(v => v.language === langCode);
    if (voice) {
      console.log('🎯 Using default voice for language:', voice.name, '(', voice.language, ')');
      return voice;
    }
    
    // Fallback to first available voice
    console.log('⚠️ No voice found for language:', langCode, '- using fallback');
    return AVAILABLE_VOICES[0];
  }

  // Google Cloud Text-to-Speech API with fallback voice quality tiers
  private async speakWithGoogleTTS(text: string, voice: VoiceOption): Promise<void> {
    if (!GOOGLE_TTS_API_KEY) {
      console.warn('⚠️ Google TTS API key not configured, falling back to Web Speech API');
      throw new Error('API key not configured');
    }

    // Get custom settings
    const customSpeed = parseFloat(localStorage.getItem('voice_speed') || '1.0');
    
    // Define fallback voice tiers (Chirp 3 Journey > Neural2 > Wavenet > Standard)
    const voiceFallbacks = this.getVoiceFallbacks(voice);
    
    // Try each voice tier until one works
    for (const voiceName of voiceFallbacks) {
      try {
        console.log('🎤 Trying Google Cloud TTS with voice:', voiceName, '(', voice.language, ')');
        
        const response = await fetch(
          `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_API_KEY}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              input: { text },
              voice: {
                languageCode: voice.language,
                name: voiceName,
              },
              audioConfig: {
                audioEncoding: 'MP3',
                speakingRate: customSpeed,
                pitch: 0,
                volumeGainDb: 0,
              },
            }),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          console.warn(`⚠️ Voice ${voiceName} failed:`, error.error?.message || error);
          continue; // Try next fallback
        }

        const data = await response.json();
        const audioContent = data.audioContent;

        console.log('✅ Successfully synthesized with voice:', voiceName);

        // Convert base64 to audio and play
        const audio = new Audio(`data:audio/mp3;base64,${audioContent}`);
        this.currentAudio = audio;
        
        return new Promise((resolve, reject) => {
          audio.onended = () => {
            console.log('✅ Google TTS playback completed');
            this.currentAudio = null;
            resolve();
          };
          audio.onerror = (error) => {
            console.error('❌ Audio playback error:', error);
            this.currentAudio = null;
            reject(error);
          };
          audio.play().catch(reject);
        });
      } catch (error) {
        console.warn(`⚠️ Failed with voice ${voiceName}:`, error);
        // Continue to next fallback
      }
    }
    
    // If all fallbacks failed
    throw new Error('All Google TTS voice options failed');
  }

  // Get fallback voice options in order of quality (Chirp 3 Journey > Neural2 > Wavenet > Standard)
  private getVoiceFallbacks(voice: VoiceOption): string[] {
    const lang = voice.language;
    const gender = voice.gender === 'female' ? 'F' : voice.gender === 'male' ? 'D' : 'F';
    
    // Build fallback list based on language
    const fallbacks: string[] = [];
    
    // 1. Try Chirp 3 Journey voices first (BEST)
    fallbacks.push(`${lang}-Journey-${gender}`);
    if (gender === 'F') fallbacks.push(`${lang}-Journey-O`); // Alternative female
    if (gender === 'D') fallbacks.push(`${lang}-Journey-O`); // Alternative male
    
    // 2. Try Neural2 voices (HIGH QUALITY)
    fallbacks.push(`${lang}-Neural2-A`);
    fallbacks.push(`${lang}-Neural2-B`);
    fallbacks.push(`${lang}-Neural2-C`);
    fallbacks.push(`${lang}-Neural2-D`);
    
    // 3. Try Wavenet voices (GOOD QUALITY)
    fallbacks.push(`${lang}-Wavenet-A`);
    fallbacks.push(`${lang}-Wavenet-B`);
    fallbacks.push(`${lang}-Wavenet-C`);
    fallbacks.push(`${lang}-Wavenet-D`);
    
    // 4. Try Standard voices (BASIC)
    fallbacks.push(`${lang}-Standard-A`);
    fallbacks.push(`${lang}-Standard-B`);
    fallbacks.push(`${lang}-Standard-C`);
    fallbacks.push(`${lang}-Standard-D`);
    
    return fallbacks;
  }

  // Text-to-Speech (Voice Output)
  speak(text: string, language: string = 'hi'): Promise<void> {
    return new Promise(async (resolve, reject) => {
      // Check if voice is enabled
      const voiceEnabled = localStorage.getItem('voice_enabled') !== 'false';
      if (!voiceEnabled) {
        console.log('🔇 Voice is disabled in settings');
        resolve();
        return;
      }

      // Stop any ongoing speech
      this.stop();

      // Get voice settings from localStorage
      const customSpeed = parseFloat(localStorage.getItem('voice_speed') || '1.0');
      const customVolume = parseFloat(localStorage.getItem('voice_volume') || '0.8');
      const customPitch = parseFloat(localStorage.getItem('voice_pitch') || '1.0');
      const selectedVoiceId = localStorage.getItem('selected_voice_id');

      // Get voice - use selected voice if available, otherwise default for language
      let voice = this.getVoiceForLanguage(language);
      
      // If user has selected a specific voice, use it (regardless of language match)
      if (selectedVoiceId) {
        const customVoice = AVAILABLE_VOICES.find(v => v.id === selectedVoiceId);
        if (customVoice) {
          voice = customVoice;
          console.log('🎯 Using user-selected voice:', voice.name, '(', voice.id, ')');
        }
      }

      console.log('🔊 Speaking with language:', language, '→', voice.language, '(', voice.name, ')');
      console.log('🎛️ Settings: Speed', customSpeed, 'Volume', customVolume, 'Pitch', customPitch);
      console.log('🎤 Selected Voice ID from storage:', selectedVoiceId);
      
      // Try Google Cloud TTS first if enabled and voice language matches
      if (USE_GOOGLE_TTS && GOOGLE_TTS_API_KEY) {
        // Check if we should use Google TTS for this language/voice combination
        const shouldUseGoogleTTS = this.shouldUseGoogleTTS(voice, language);
        
        if (shouldUseGoogleTTS) {
          try {
            await this.speakWithGoogleTTS(text, voice);
            resolve();
            return;
          } catch (error) {
            console.warn('⚠️ Google TTS failed, falling back to Web Speech API:', error);
            // Continue to Web Speech API fallback below
          }
        } else {
          console.log('🔊 Using Web Speech API for better quality with this language/voice combination');
        }
      }
      
      // Fallback to Web Speech API
      console.log('🔊 Using Web Speech API (browser TTS)');
      const utterance = new SpeechSynthesisUtterance(text);
      
      // IMPORTANT: Set language FIRST before trying to find voice
      utterance.lang = voice.language;
      
      // Get available voices (may need to wait for them to load)
      let voices = this.synthesis.getVoices();
      
      // If voices not loaded yet, wait for them
      if (voices.length === 0) {
        this.synthesis.onvoiceschanged = () => {
          voices = this.synthesis.getVoices();
          this.setVoiceForUtterance(utterance, voice, voices);
        };
      } else {
        this.setVoiceForUtterance(utterance, voice, voices);
      }

      // Apply custom settings
      utterance.rate = customSpeed;
      utterance.volume = customVolume;
      utterance.pitch = customPitch;

      utterance.onend = () => {
        this.currentUtterance = null;
        console.log('✅ Speech completed');
        resolve();
      };

      utterance.onerror = (error) => {
        console.error('❌ Speech synthesis error:', error);
        this.currentUtterance = null;
        reject(error);
      };

      this.currentUtterance = utterance;
      this.synthesis.speak(utterance);
      console.log('🎤 Started speaking in', utterance.lang, 'with voice:', utterance.voice?.name || 'default');
    });
  }

  // Helper to set voice for utterance
  private setVoiceForUtterance(utterance: SpeechSynthesisUtterance, voiceOption: VoiceOption, voices: SpeechSynthesisVoice[]) {
    console.log('🔍 Total available voices:', voices.length);
    console.log('🎯 Looking for voice:', voiceOption.name, '(', voiceOption.voiceURI, ')', 'Language:', voiceOption.language);
    
    // Strategy 1: Try to find exact match by name (Chirp 3)
    let selectedVoice = voices.find(v => v.name === voiceOption.voiceURI);
    if (selectedVoice) {
      console.log('✅ Found by URI:', selectedVoice.name);
    }
    
    // Strategy 2: Try to find by exact language match
    if (!selectedVoice) {
      selectedVoice = voices.find(v => v.lang === voiceOption.language);
      if (selectedVoice) {
        console.log('✅ Found by exact language:', selectedVoice.name, selectedVoice.lang);
      }
    }
    
    // Strategy 3: Try to find by language prefix and gender (e.g., 'en' from 'en-IN')
    if (!selectedVoice) {
      const langPrefix = voiceOption.language.split('-')[0];
      const matchingVoices = voices.filter(v => v.lang.startsWith(langPrefix));
      console.log('🔍 Voices matching prefix', langPrefix, ':', matchingVoices.map(v => `${v.name} (${v.lang})`).join(', '));
      
      // Try to match gender from voice option
      if (voiceOption.gender === 'female') {
        // Female voice patterns - prioritize by name
        selectedVoice = matchingVoices.find(v => 
          v.name.includes('Heera') ||
          v.name.includes('Swara') ||
          v.name.includes('Zira') ||
          v.name.includes('Susan') ||
          v.name.includes('Linda') ||
          v.name.toLowerCase().includes('female')
        );
        console.log('🔍 Looking for female voice, found:', selectedVoice?.name);
      } else if (voiceOption.gender === 'male') {
        // Male voice patterns - prioritize by name
        selectedVoice = matchingVoices.find(v => 
          v.name.includes('Ravi') ||
          v.name.includes('Prabhat') ||
          v.name.includes('David') ||
          v.name.includes('Mark') ||
          v.name.includes('James') ||
          v.name.includes('George') ||
          v.name.toLowerCase().includes('male')
        );
        console.log('🔍 Looking for male voice, found:', selectedVoice?.name);
        
        // If no male voice found for en-IN, try en-US or en-GB male voices
        if (!selectedVoice) {
          const allEnglishVoices = voices.filter(v => 
            v.lang.startsWith('en-US') || 
            v.lang.startsWith('en-GB') || 
            v.lang.startsWith('en-AU')
          );
          console.log('🔍 Trying other English variants:', allEnglishVoices.map(v => v.name).join(', '));
          
          selectedVoice = allEnglishVoices.find(v => 
            v.name.includes('David') ||
            v.name.includes('Mark') ||
            v.name.includes('James') ||
            v.name.includes('George') ||
            v.name.toLowerCase().includes('male')
          );
          
          if (selectedVoice) {
            console.log('✅ Using alternate English voice:', selectedVoice.name, selectedVoice.lang);
          }
        }
        
        // Last resort: use any voice that's not the first one
        if (!selectedVoice && matchingVoices.length > 1) {
          selectedVoice = matchingVoices[1];
          console.log('🔍 Using alternate voice (last resort):', selectedVoice?.name);
        }
      }
      
      // If still not found, use first matching voice
      if (!selectedVoice && matchingVoices.length > 0) {
        selectedVoice = matchingVoices[0];
      }
      
      if (selectedVoice) {
        console.log('✅ Found by language prefix:', selectedVoice.name, selectedVoice.lang);
      }
    }
    
    if (selectedVoice) {
      utterance.voice = selectedVoice;
      console.log('✅ Final selected voice:', selectedVoice.name, '(', selectedVoice.lang, ')');
    } else {
      console.warn('⚠️ No voice found for', voiceOption.language, '- using browser default');
      console.log('💡 Available voices:', voices.slice(0, 5).map(v => `${v.name} (${v.lang})`).join(', '));
    }
  }

  // Stop current speech
  stop() {
    // Stop Google TTS audio if playing
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    
    // Stop Web Speech API
    if (this.synthesis.speaking) {
      this.synthesis.cancel();
    }
    this.currentUtterance = null;
  }

  // Check if currently speaking
  isSpeaking(): boolean {
    return this.synthesis.speaking || (this.currentAudio !== null && !this.currentAudio.paused);
  }

  // Speech-to-Text (Voice Input)
  startListening(language: string = 'hi'): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.recognition) {
        reject(new Error('Speech recognition not supported'));
        return;
      }

      if (this.isRecognitionActive) {
        reject(new Error('Already listening'));
        return;
      }

      // Set language for recognition
      const langCode = LANGUAGE_VOICE_MAP[language] || 'hi-IN';
      this.recognition.lang = langCode;

      this.recognition.onstart = () => {
        this.isRecognitionActive = true;
        console.log('🎤 Voice recognition started');
      };

      this.recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        console.log('🎤 Recognized:', transcript);
        this.isRecognitionActive = false;
        resolve(transcript);
      };

      this.recognition.onerror = (event: any) => {
        console.error('🎤 Recognition error:', event.error);
        this.isRecognitionActive = false;
        reject(new Error(event.error));
      };

      this.recognition.onend = () => {
        this.isRecognitionActive = false;
      };

      try {
        this.recognition.start();
      } catch (error) {
        this.isRecognitionActive = false;
        reject(error);
      }
    });
  }

  // Stop listening
  stopListening() {
    if (this.recognition && this.isRecognitionActive) {
      this.recognition.stop();
      this.isRecognitionActive = false;
    }
  }

  // Check if recognition is active
  isListeningActive(): boolean {
    return this.isRecognitionActive;
  }

  // Check if speech recognition is supported
  isSpeechRecognitionSupported(): boolean {
    return this.recognition !== null;
  }

  // Get all available voices in browser (for debugging)
  getAvailableVoices(): SpeechSynthesisVoice[] {
    return this.synthesis.getVoices();
  }

  // Determine if we should use Google TTS or Web Speech API
  private shouldUseGoogleTTS(voice: VoiceOption, language: string): boolean {
    // Always use Google Cloud TTS for consistent high-quality Chirp 3 voices
    // This includes English, Hindi, and all other supported languages
    console.log('🎤 Using Google Cloud TTS for all languages (Chirp 3 quality)');
    return true;
  }

  // Log available voices for debugging
  logAvailableVoices(): void {
    const voices = this.getAvailableVoices();
    console.log('📢 Total available voices:', voices.length);
    
    // Group by language
    const byLanguage: Record<string, SpeechSynthesisVoice[]> = {};
    voices.forEach(voice => {
      const lang = voice.lang;
      if (!byLanguage[lang]) {
        byLanguage[lang] = [];
      }
      byLanguage[lang].push(voice);
    });
    
    console.log('📢 Voices by language:');
    Object.keys(byLanguage).sort().forEach(lang => {
      console.log(`  ${lang}:`, byLanguage[lang].map(v => v.name).join(', '));
    });
  }
}

// Export singleton instance
export const voiceService = new VoiceService();
