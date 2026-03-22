import { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Mic, Camera, Paperclip, Bug, Droplet, Sun, Sprout, Volume2, VolumeX } from 'lucide-react';
import { cropAdvisoryAI, FarmerContext, CropAdvisoryResponse } from '../services/cropAdvisoryAI';
import { getSoilDataFromDatabase, type SoilData } from '../lib/soil-db';
import { detectDiseaseFromImage, type DiseaseDetectionResult } from '../services/diseaseDetectionService';
import { getCurrentUser } from '../lib/auth-helpers';
import { supabase } from '../lib/supabase';
import { voiceService } from '../services/voiceService';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  response?: CropAdvisoryResponse; // Store full AI response for rich display
  diseaseDetection?: DiseaseDetectionResult; // Store disease detection result
  imageUrl?: string; // Store image URL if message has image
}

const quickActions = [
  { id: 'disease', label: 'Check Disease', icon: Bug },
  { id: 'sow', label: 'What to Sow', icon: Sprout },
  { id: 'water', label: 'Watering Guide', icon: Droplet },
  { id: 'weather', label: 'Weather Alert', icon: Sun },
];

// Helper function to extract disease information from AI response
function extractDiseaseInfo(aiResponse: string): {
  diseaseName: string;
  severity: 'mild' | 'moderate' | 'severe' | 'unknown';
  affectedPart: string;
} {
  let diseaseName = 'Unknown';
  let severity: 'mild' | 'moderate' | 'severe' | 'unknown' = 'unknown';
  let affectedPart = 'leaves';

  // Extract disease name (first line usually contains it)
  const firstLine = aiResponse.split('\n')[0];
  const diseaseMatch = firstLine.match(/\*\*(.*?)\*\*/);
  if (diseaseMatch) {
    diseaseName = diseaseMatch[1].replace(/\(.*?\)/g, '').trim();
  }

  // Extract severity from text
  const lowerText = aiResponse.toLowerCase();
  if (lowerText.includes('severe') || lowerText.includes('गंभीर') || 
      lowerText.includes('critical') || lowerText.includes('serious') ||
      lowerText.includes('extreme') || lowerText.includes('high')) {
    severity = 'severe';
  } else if (lowerText.includes('moderate') || lowerText.includes('मध्यम') ||
             lowerText.includes('medium')) {
    severity = 'moderate';
  } else if (lowerText.includes('mild') || lowerText.includes('हल्का') ||
             lowerText.includes('light') || lowerText.includes('low')) {
    severity = 'mild';
  } else {
    // Default to moderate if severity not explicitly mentioned
    severity = 'moderate';
    console.log('⚠️ Severity not found in response, defaulting to moderate');
  }

  // Extract affected part
  if (lowerText.includes('leaves') || lowerText.includes('पत्ती')) {
    affectedPart = 'leaves';
  } else if (lowerText.includes('stem') || lowerText.includes('तना')) {
    affectedPart = 'stems';
  } else if (lowerText.includes('root') || lowerText.includes('जड़')) {
    affectedPart = 'roots';
  } else if (lowerText.includes('fruit') || lowerText.includes('फल')) {
    affectedPart = 'fruits';
  } else if (lowerText.includes('panicle') || lowerText.includes('बाली')) {
    affectedPart = 'panicles';
  }

  return { diseaseName, severity, affectedPart };
}

// Helper function to save disease detection to database
async function saveDiseaseToDatabase(
  userId: string,
  diseaseName: string,
  severity: string,
  imageUrl: string,
  fullResponse: string,
  selectedCropName?: string
): Promise<boolean> {
  try {
    console.log('💾 Saving disease detection to database...');
    console.log('Disease:', diseaseName, 'Severity:', severity);
    console.log('Selected crop:', selectedCropName);

    // Get active crop cycle for the SELECTED crop
    let cropCycleId: number | null = null;
    
    if (selectedCropName) {
      // Find the specific crop that matches the selected crop name
      const { data: cropData, error: cropError } = await supabase
        .from('crop_cycles')
        .select('crop_id, crop_name')
        .eq('user_id', userId)
        .eq('crop_name', selectedCropName)
        .eq('is_active', true)
        .order('sowing_date', { ascending: false })
        .limit(1);

      if (cropError) {
        console.warn('Error fetching crop cycle:', cropError);
      }

      if (cropData && cropData.length > 0) {
        cropCycleId = cropData[0].crop_id;
        console.log(`✅ Found crop cycle for ${selectedCropName}:`, cropCycleId);
      } else {
        console.warn(`⚠️ No active crop cycle found for ${selectedCropName}`);
      }
    }
    
    // Fallback: If no selected crop or not found, get most recent active crop
    if (!cropCycleId) {
      const { data: cropData, error: cropError } = await supabase
        .from('crop_cycles')
        .select('crop_id, crop_name')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('sowing_date', { ascending: false })
        .limit(1);

      if (cropError) {
        console.warn('Error fetching crop cycle:', cropError);
      }

      cropCycleId = cropData && cropData.length > 0 ? cropData[0].crop_id : null;
      console.log('Fallback crop cycle ID:', cropCycleId);
    }

    // Extract remedy from response (keep it short)
    const remedyMatch = fullResponse.match(/🧪.*?Immediate Action([\s\S]*?)(?=🚫|$)/);
    const remedy = remedyMatch 
      ? remedyMatch[1].substring(0, 400).trim() 
      : fullResponse.substring(0, 400).trim();

    // Prepare insert data with all fields
    const insertData = {
      user_id: userId,
      crop_cycle_id: cropCycleId,
      detection_date: new Date().toISOString(),
      disease_name: diseaseName.substring(0, 200),
      severity: severity,
      image_s3_url: imageUrl,
      confidence_score: 0.85,
      remedy_suggested: remedy,
      notes: 'Detected via Gemini AI with image analysis'
    };

    console.log('Insert data:', insertData);

    const { data, error } = await supabase
      .from('disease_logs')
      .insert(insertData)
      .select();

    if (error) {
      console.error('❌ Error saving disease log:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return false;
    }

    console.log('✅ Disease detection saved to database:', data);
    
    // Dispatch custom event to notify CropLog to refresh
    window.dispatchEvent(new CustomEvent('diseaseDetected', { 
      detail: { cropCycleId, diseaseName, severity } 
    }));
    console.log('📢 Dispatched diseaseDetected event');
    
    return true;
  } catch (error) {
    console.error('❌ Exception in saveDiseaseToDatabase:', error);
    return false;
  }
}

export default function Chatbot() {
  // Load messages from localStorage on mount
  const loadMessagesFromStorage = () => {
    try {
      const stored = localStorage.getItem('chatbot_messages');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert timestamp strings back to Date objects
        return parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      }
    } catch (error) {
      console.error('Error loading messages from storage:', error);
    }
    return [
      {
        id: '1',
        text: 'Namaste! 🙏 I am FasalSetu AI. How can I help you today?',
        sender: 'bot' as const,
        timestamp: new Date(),
      },
    ];
  };

  const [messages, setMessages] = useState<Message[]>(loadMessagesFromStorage());
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [language, setLanguage] = useState<'hi' | 'mr' | 'te' | 'ta' | 'en' | 'mixed'>(() => {
    // Load language preference from localStorage
    const stored = localStorage.getItem('chatbot_language');
    return (stored as any) || 'mixed';
  });
  const [selectedCrop, setSelectedCrop] = useState<string>(() => {
    // Load selected crop from localStorage
    const stored = localStorage.getItem('chatbot_selected_crop');
    console.log('🌾 Initializing selectedCrop from localStorage:', stored);
    return stored || '';
  });
  const [userCrops, setUserCrops] = useState<string[]>([]);
  const [soilData, setSoilData] = useState<SoilData | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('chatbot_messages', JSON.stringify(messages));
    } catch (error) {
      console.error('Error saving messages to storage:', error);
    }
  }, [messages]);

  // Save language preference to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('chatbot_language', language);
    } catch (error) {
      console.error('Error saving language to storage:', error);
    }
  }, [language]);

  // Listen for language changes from Settings (via localStorage)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'chatbot_language' && e.newValue) {
        console.log('🌐 Language changed from Settings:', e.newValue);
        setLanguage(e.newValue as any);
      }
    };
    
    // Also listen for custom event (for same-tab updates)
    const handleLanguageChange = (e: CustomEvent) => {
      if (e.detail?.language) {
        console.log('🌐 Language changed via custom event:', e.detail.language);
        setLanguage(e.detail.language);
      }
    };
    
    window.addEventListener('storage', handleStorageChange as any);
    window.addEventListener('languageChanged', handleLanguageChange as any);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange as any);
      window.removeEventListener('languageChanged', handleLanguageChange as any);
    };
  }, []);

  // Save selected crop to localStorage
  useEffect(() => {
    try {
      if (selectedCrop) {
        localStorage.setItem('chatbot_selected_crop', selectedCrop);
      }
    } catch (error) {
      console.error('Error saving selected crop to storage:', error);
    }
  }, [selectedCrop]);

  // Add weather data state
  const [weatherData, setWeatherData] = useState<any>(null);

  // Fetch soil data, user crops, and weather data on component mount
  useEffect(() => {
    const loadData = async () => {
      // Load soil data
      const data = await getSoilDataFromDatabase();
      if (data) {
        console.log('🌱 Loaded soil data for chatbot:', data);
        setSoilData(data);
      }

      // Load weather data
      try {
        const { getUserLocation } = await import('../lib/user-location');
        const { weatherService } = await import('../services/weatherService');
        
        const location = await getUserLocation();
        if (location && location.latitude && location.longitude) {
          const weather = await weatherService.getWeatherByCoordinates(
            location.latitude,
            location.longitude
          );
          if (weather) {
            console.log('� ️ Loaded weather data for chatbot:', weather);
            setWeatherData(weather);
          }
        }
      } catch (error) {
        console.error('Error loading weather data:', error);
      }

      // Load user's crops from crop_cycles
      try {
        const user = await getCurrentUser();
        if (user) {
          const { data: cropsData, error } = await supabase
            .from('crop_cycles')
            .select('crop_name')
            .eq('user_id', user.id)
            .order('sowing_date', { ascending: false });

          if (!error && cropsData) {
            // Get unique crop names
            const uniqueCrops = [...new Set(cropsData.map(c => c.crop_name))];
            setUserCrops(uniqueCrops);
            console.log('🌾 Loaded user crops:', uniqueCrops);
            console.log('🌾 Current selected crop:', selectedCrop);

            // If user has crops but none selected, auto-select the most recent
            if (uniqueCrops.length > 0 && !selectedCrop) {
              console.log('🌾 Auto-selecting first crop:', uniqueCrops[0]);
              setSelectedCrop(uniqueCrops[0]);
            }
          }
        }
      } catch (error) {
        console.error('Error loading user crops:', error);
      }
    };
    loadData();
  }, []);

  // Farmer context - memoized to update when language or messages change
  // Note: AI service will automatically fetch and enrich this context from database
  const farmerContext: FarmerContext = useMemo(() => ({
    farmerId: 'farmer_123', // Will be replaced by actual user ID from database
    sessionId: `session_${Date.now()}`,
    farmerProfile: {
      name: 'Farmer', // Will be loaded from database
      location: 'Unknown', // Will be loaded from database (city, state, country)
      farmSize: undefined, // Will be loaded from database
      preferredLanguage: language, // This will update when language changes
      experienceLevel: 'intermediate'
    },
    farmData: {
      farmSize: undefined, // Will be loaded from database
      // Use loaded soil data from UI (handle both database and generated formats)
      soilType: soilData?.soil_type_name || soilData?.soilType || undefined,
      soilPH: soilData?.ph_level || soilData?.pH || undefined,
      soilNPK: soilData ? {
        nitrogen: soilData.total_nitrogen || soilData.nitrogen || 0,
        phosphorus: 45, // Not available from SoilGrids
        potassium: 180  // Not available from SoilGrids
      } : undefined,
      currentCrop: selectedCrop || undefined, // User-selected crop from dropdown
      cropStage: undefined, // Will be loaded from database
      irrigationType: undefined, // Will be loaded from database
      // Detailed soil properties from loaded data (handle both formats)
      soilOrganicCarbon: soilData?.organic_carbon || soilData?.organicCarbon || undefined,
      soilCEC: soilData?.cec || undefined,
      soilTexture: soilData ? {
        clay: soilData.clay_pct || soilData.clay || 0,
        sand: soilData.sand_pct || soilData.sand || 0,
        silt: soilData.silt_pct || soilData.silt || 0
      } : undefined,
      soilBulkDensity: soilData?.bulk_density || soilData?.bulkDensity || undefined
    },
    weatherData: weatherData ? {
      temperature: weatherData.temperature,
      humidity: weatherData.humidity,
      rainfall: weatherData.rainfall,
      forecast: weatherData.forecast || weatherData.condition
    } : {
      temperature: 28, // Fallback values
      humidity: 65,
      rainfall: 0,
      forecast: 'Weather data loading...'
    },
    conversationHistory: messages
      .filter((msg: Message) => msg.sender === 'user' || msg.sender === 'bot')
      .map((msg: Message) => ({
        role: msg.sender === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.text,
        timestamp: msg.timestamp
      }))
  }), [language, messages, soilData, selectedCrop, weatherData]); // Re-create context when any dependency changes

  // Debug log for context
  useEffect(() => {
    console.log('🔍 Chatbot Context Debug:', {
      soilType: farmerContext.farmData?.soilType,
      soilPH: farmerContext.farmData?.soilPH,
      soilTexture: farmerContext.farmData?.soilTexture,
      organicCarbon: farmerContext.farmData?.soilOrganicCarbon,
      currentCrop: farmerContext.farmData?.currentCrop,
      weather: farmerContext.weatherData,
      hasWeatherData: !!weatherData,
      hasSoilData: !!soilData
    });
    
    // Detailed soil data debug
    if (soilData) {
      console.log('🌱 Raw Soil Data from Database:', {
        // Database format
        soil_type_name: soilData.soil_type_name,
        ph_level: soilData.ph_level,
        clay_pct: soilData.clay_pct,
        sand_pct: soilData.sand_pct,
        silt_pct: soilData.silt_pct,
        organic_carbon: soilData.organic_carbon,
        cec: soilData.cec,
        total_nitrogen: soilData.total_nitrogen,
        bulk_density: soilData.bulk_density,
        // Generated format
        soilType: soilData.soilType,
        pH: soilData.pH,
        clay: soilData.clay,
        sand: soilData.sand,
        silt: soilData.silt,
        organicCarbon: soilData.organicCarbon,
        nitrogen: soilData.nitrogen,
        bulkDensity: soilData.bulkDensity
      });
    } else {
      console.log('❌ No soil data loaded in chatbot');
    }
  }, [farmerContext, weatherData, soilData]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleImageSelect = (event: any) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size should be less than 5MB');
      return;
    }

    console.log('📸 Image selected:', file.name);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
      console.log('✅ Image preview created');
    };
    reader.readAsDataURL(file);

    // Convert to base64 for API
    const base64Reader = new FileReader();
    base64Reader.onloadend = () => {
      const base64String = (base64Reader.result as string).split(',')[1];
      setSelectedImage(base64String);
      console.log('✅ Image converted to base64');
    };
    base64Reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    console.log('🗑️ Image removed');
  };

  const handleSendMessage = async (text?: string) => {
    const messageText = text || inputText.trim();
    if ((!messageText && !selectedImage) || isLoading) return;

    // Store image data before clearing
    const imageUrlForMessage = imagePreview;
    const imageDataForProcessing = selectedImage;
    const hasImage = !!selectedImage;

    const displayText = hasImage 
      ? `${messageText || (language === 'en' ? 'Please analyze this image' : 'इस छवि का विश्लेषण करें')}`
      : messageText;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: displayText,
      sender: 'user',
      timestamp: new Date(),
      imageUrl: imageUrlForMessage || undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    
    // Clear image preview
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview(null);
    setSelectedImage(null);
  
    setIsLoading(true);

    console.log('📤 Sending message:', { hasImage, messageText: messageText || 'image only' });

    try {
      // If image is provided, use AI-powered disease detection
      if (selectedImage) {
        console.log('🔬 Running AI disease detection on image...');
        
        // First, upload image to Supabase and get URL
        const user = await getCurrentUser();
        let imageUrl: string | null = null;
        
        if (user) {
          imageUrl = await cropAdvisoryAI.uploadImageToSupabase(selectedImage, user.id);
          console.log('📸 Image uploaded for disease detection:', imageUrl);
        }
        
        // Use Gemini AI for detailed disease analysis with image
        console.log('🌾 Chatbot - Selected crop before AI call:', selectedCrop);
        console.log('🌾 Chatbot - farmerContext.farmData.currentCrop:', farmerContext.farmData?.currentCrop);
        
        const cropInfo = selectedCrop ? (language === 'en' ? ` for ${selectedCrop}` : ` ${selectedCrop} के लिए`) : '';
        const detailedPrompt = messageText || (language === 'en' 
          ? `Analyze this ${selectedCrop || 'crop'} image for diseases. This is a ${selectedCrop || 'crop'} plant. Provide detailed diagnosis with symptoms, causes, treatment, and prevention specific to ${selectedCrop || 'this crop'}.`
          : `इस ${selectedCrop || 'फसल'} की छवि का रोग विश्लेषण करें। यह ${selectedCrop || 'फसल'} का पौधा है। ${selectedCrop || 'इस फसल'} के लिए विशिष्ट लक्षण, कारण, उपचार और रोकथाम के साथ विस्तृत निदान प्रदान करें।`);
        
        const aiResponse = await cropAdvisoryAI.generateAdvice(
          detailedPrompt,
          farmerContext,
          undefined,
          selectedImage
        );
        
        // Extract disease information from AI response
        const diseaseInfo = extractDiseaseInfo(aiResponse.message);
        
        // Save to disease_logs database
        if (user && imageUrl && diseaseInfo.diseaseName) {
          await saveDiseaseToDatabase(
            user.id,
            diseaseInfo.diseaseName,
            diseaseInfo.severity,
            imageUrl,
            aiResponse.message,
            selectedCrop // Pass the selected crop name
          );
        }
        
        // Clear image after sending (before showing result)
        handleRemoveImage();

        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: aiResponse.message,
          sender: 'bot',
          timestamp: new Date(),
          response: aiResponse,
        };
        setMessages((prev) => [...prev, botMessage]);
      } else {
        // Check if farmer is reporting crop as healthy
        const healthyKeywords = [
          'healthy', 'स्वस्थ', 'ठीक है', 'theek hai', 'good', 'fine', 'recovered', 'better',
          'no problem', 'कोई समस्या नहीं', 'सुधर गया', 'अच्छा है'
        ];
        const isHealthyReport = healthyKeywords.some(keyword => 
          messageText.toLowerCase().includes(keyword.toLowerCase())
        );

        // If farmer says crop is healthy, update status
        if (isHealthyReport && (messageText.toLowerCase().includes('crop') || 
            messageText.toLowerCase().includes('फसल') ||
            messageText.toLowerCase().includes('plant') ||
            messageText.toLowerCase().includes('पौधा'))) {
          
          console.log('🌱 Farmer reporting crop as healthy, updating status...');
          
          // Get active crop and update status
          const user = await getCurrentUser();
          if (user) {
            const { data: cropData } = await supabase
              .from('crop_cycles')
              .select('crop_id, crop_name')
              .eq('user_id', user.id)
              .eq('is_active', true)
              .order('sowing_date', { ascending: false })
              .limit(1);

            if (cropData && cropData.length > 0) {
              const { updateCropStatus } = await import('../lib/crop-db');
              const success = await updateCropStatus(cropData[0].crop_id, 'healthy');
              
              if (success) {
                console.log(`✅ Updated ${cropData[0].crop_name} status to healthy`);
              }
            }
          }
        }

        // Text-only message - use Gemini AI
        const aiResponse = await cropAdvisoryAI.generateAdvice(
          messageText, 
          farmerContext,
          undefined,
          undefined
        );

        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: aiResponse.message,
          sender: 'bot',
          timestamp: new Date(),
          response: aiResponse,
        };
        setMessages((prev) => [...prev, botMessage]);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: language === 'en' 
          ? '❌ Sorry, something went wrong. Please try again or upload a clearer image.'
          : '❌ क्षमा करें, कुछ गलत हो गया। कृपया फिर से प्रयास करें या स्पष्ट छवि अपलोड करें।',
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      
      // Clear image on error too
      handleRemoveImage();
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (actionId: string) => {
    const actionTexts: Record<string, string> = {
      disease: language === 'en' ? 'My crop leaves are turning yellow. What should I do?' : 'मेरी फसल की पत्तियां पीली हो रही हैं। मुझे क्या करना चाहिए?',
      sow: language === 'en' ? 'Which crop should I grow this season?' : 'मुझे इस मौसम में कौन सी फसल उगानी चाहिए?',
      water: language === 'en' ? 'When and how much should I water my crops?' : 'मुझे अपनी फसल को कब और कितना पानी देना चाहिए?',
      weather: language === 'en' ? 'What is the weather forecast? Should I irrigate today?' : 'मौसम का पूर्वानुमान क्या है? क्या मुझे आज सिंचाई करनी चाहिए?',
    };
    handleSendMessage(actionTexts[actionId]);
  };

  const handleVoiceInput = async () => {
    if (isListening) {
      // Stop listening
      voiceService.stopListening();
      setIsListening(false);
      return;
    }

    // Check if speech recognition is supported
    if (!voiceService.isSpeechRecognitionSupported()) {
      alert(language === 'en' 
        ? 'Voice input is not supported in your browser. Please use Chrome or Edge.'
        : 'आपके ब्राउज़र में वॉइस इनपुट समर्थित नहीं है। कृपया Chrome या Edge का उपयोग करें।');
      return;
    }

    try {
      setIsListening(true);
      const transcript = await voiceService.startListening(language);
      setInputText(transcript);
      setIsListening(false);
    } catch (error: any) {
      console.error('Voice input error:', error);
      setIsListening(false);
      
      if (error.message !== 'no-speech' && error.message !== 'aborted') {
        alert(language === 'en' 
          ? 'Could not recognize speech. Please try again.'
          : 'वाणी पहचानी नहीं जा सकी। कृपया पुनः प्रयास करें।');
      }
    }
  };

  const handleTextToSpeech = async (messageId: string, text: string) => {
    // If already speaking this message, stop it
    if (speakingMessageId === messageId && isSpeaking) {
      voiceService.stop();
      setIsSpeaking(false);
      setSpeakingMessageId(null);
      return;
    }

    // Stop any ongoing speech
    if (isSpeaking) {
      voiceService.stop();
    }

    try {
      setIsSpeaking(true);
      setSpeakingMessageId(messageId);
      
      console.log('🔊 Chatbot: Speaking with language:', language);
      
      // Clean text for better speech (remove markdown, emojis, etc.)
      const cleanText = text
        .replace(/\*\*/g, '')
        .replace(/[🔍🌱🧪🚫✨💡📊🎯⚠️✔•]/g, '')
        .replace(/\|/g, ' ')
        .replace(/\n+/g, '. ')
        .trim();
      
      await voiceService.speak(cleanText, language);
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    } catch (error) {
      console.error('Text-to-speech error:', error);
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    }
  };

  const handleImageCapture = () => {
    // Trigger file input for camera
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute('capture', 'environment');
      fileInputRef.current.click();
      console.log('📷 Camera triggered');
    }
  };

  const handleImageAttachment = () => {
    // Trigger file input for gallery
    if (fileInputRef.current) {
      fileInputRef.current.removeAttribute('capture');
      fileInputRef.current.click();
      console.log('📎 Gallery triggered');
    }
  };

  const handleClearChat = () => {
    if (window.confirm(language === 'en' 
      ? 'Clear all chat history?' 
      : 'सभी चैट इतिहास साफ़ करें?')) {
      const welcomeMessage: Message = {
        id: Date.now().toString(),
        text: language === 'en'
          ? 'Namaste! 🙏 I am FasalSetu AI. How can I help you today?'
          : 'नमस्ते! 🙏 मैं फसलसेतु एआई हूँ। आज मैं आपकी क्या मदद कर सकता हूँ?',
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
      localStorage.removeItem('chatbot_messages');
      console.log('🗑️ Chat history cleared');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      {/* Language & Crop Selector */}
      <div className="mb-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">🌐 Language:</span>
            <select
              value={language}
              onChange={(e) => {
                const newLanguage = e.target.value as any;
                setLanguage(newLanguage);
                
                // Save to localStorage
                localStorage.setItem('chatbot_language', newLanguage);
                
                // Dispatch custom event for same-tab synchronization
                window.dispatchEvent(new CustomEvent('languageChanged', { 
                  detail: { language: newLanguage } 
                }));
                
                console.log('🌐 Language changed in Chatbot:', newLanguage);
              }}
              className="text-sm bg-white border border-green-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-300"
            >
              <option value="mixed">हिंग्लिश (Mixed)</option>
              <option value="hi">हिंदी (Hindi)</option>
              <option value="mr">मराठी (Marathi)</option>
              <option value="te">తెలుగు (Telugu)</option>
              <option value="ta">தமிழ் (Tamil)</option>
              <option value="en">English</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClearChat}
              className="text-xs text-gray-500 hover:text-red-600 transition-colors px-2 py-1 rounded hover:bg-red-50"
              title={language === 'en' ? 'Clear chat history' : 'चैट इतिहास साफ़ करें'}
            >
              🗑️ {language === 'en' ? 'Clear' : 'साफ़ करें'}
            </button>
          </div>
        </div>
        
        {/* Crop Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">🌾 {language === 'en' ? 'My Crop:' : 'मेरी फसल:'}</span>
          <select
            value={selectedCrop}
            onChange={(e) => {
              const newCrop = e.target.value;
              console.log('🌾 Crop selector changed:', { from: selectedCrop, to: newCrop });
              setSelectedCrop(newCrop);
            }}
            className="text-sm bg-white border border-green-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-300 flex-1"
          >
            <option value="">
              {userCrops.length === 0 
                ? (language === 'en' ? 'No crops logged yet' : 'अभी तक कोई फसल नहीं')
                : (language === 'en' ? 'Select crop...' : 'फसल चुनें...')}
            </option>
            {userCrops.map((crop) => (
              <option key={crop} value={crop}>
                🌾 {crop}
              </option>
            ))}
          </select>
          {userCrops.length === 0 && (
            <span className="text-xs text-gray-500">
              {language === 'en' ? '(Add crops in Crop Log)' : '(क्रॉप लॉग में जोड़ें)'}
            </span>
          )}
        </div>

        {/* Context Status Indicator */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${soilData ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            <span className={soilData ? 'text-green-600' : 'text-gray-500'}>
              {language === 'en' ? 'Soil Data' : 'मिट्टी डेटा'}
              {soilData && (
                <span className="ml-1">
                  ({soilData.soil_type_name || soilData.soilType || 'Unknown'}, pH {(soilData.ph_level || soilData.pH)?.toFixed(1)})
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${weatherData ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
            <span className={weatherData ? 'text-blue-600' : 'text-gray-500'}>
              {language === 'en' ? 'Weather' : 'मौसम'}
              {weatherData && (
                <span className="ml-1">
                  ({Math.round(weatherData.temperature)}°C, {weatherData.humidity}%)
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-4">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => handleQuickAction(action.id)}
                disabled={isLoading}
                className="flex items-center gap-2 p-3 bg-white rounded-xl border border-green-100 hover:border-green-300 hover:shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-green-600" />
                </div>
                <span className="text-sm text-gray-700">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 bg-white rounded-2xl p-4 border border-green-50">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                message.sender === 'user'
                  ? 'bg-green-600 text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-800 rounded-bl-sm'
              }`}
            >
              {/* Show small thumbnail if user message has image */}
              {message.sender === 'user' && message.imageUrl && (
                <div className="mb-2 flex items-center gap-2">
                  <img 
                    src={message.imageUrl} 
                    alt="Uploaded crop" 
                    className="w-12 h-12 object-cover rounded-lg border-2 border-white shadow-sm"
                  />
                  <span className="text-xs opacity-80">
                    {language === 'en' ? '📸 Image attached' : '📸 छवि संलग्न'}
                  </span>
                </div>
              )}
              
              {/* Render message with markdown-style formatting */}
              <div className="break-words space-y-1">
                {message.text.split('\n').map((line, idx) => {
                  // Main disease title (first line) - handle bold text
                  if (idx === 0 && (line.includes('matches') || line.includes('looks like'))) {
                    const parts = line.split(/(\*\*.*?\*\*)/g);
                    return (
                      <div key={idx} className="mb-3">
                        <p className="text-base font-semibold leading-relaxed">
                          {parts.map((part, i) => 
                            part.startsWith('**') && part.endsWith('**') ? (
                              <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>
                            ) : (
                              <span key={i}>{part}</span>
                            )
                          )}
                        </p>
                      </div>
                    );
                  }
                  
                  // Section headers with emojis (🔍, 🌱, 🧪, 🚫)
                  if (line.match(/^[🔍🌱🧪🚫✨💡📊🎯⚠️]\s*\*\*.*?\*\*/)) {
                    const text = line.replace(/\*\*/g, '');
                    return (
                      <div key={idx} className="mt-4 mb-2">
                        <h3 className="font-bold text-base bg-opacity-10 bg-gray-800 px-2 py-1 rounded inline-block">
                          {text}
                        </h3>
                      </div>
                    );
                  }
                  
                  // Subsection headers like "Organic Control:" or "Chemical Control:"
                  if (line.match(/^\*\*[A-Za-z\s]+:\*\*$/)) {
                    return (
                      <h4 key={idx} className="font-semibold text-sm mt-2 mb-1">
                        {line.replace(/\*\*/g, '')}
                      </h4>
                    );
                  }
                  
                  // Numbered sections (1️⃣, 2️⃣, 3️⃣)
                  if (line.match(/^\*\*[1-9]️⃣/)) {
                    return (
                      <h4 key={idx} className="font-semibold text-sm mt-3 mb-1 pl-2 border-l-2 border-gray-400">
                        {line.replace(/\*\*/g, '')}
                      </h4>
                    );
                  }
                  
                  // Bold text (inline) - any line with **text**
                  if (line.includes('**')) {
                    const parts = line.split(/(\*\*.*?\*\*)/g);
                    return (
                      <p key={idx} className="mb-1 text-sm leading-relaxed">
                        {parts.map((part, i) => 
                          part.startsWith('**') && part.endsWith('**') ? (
                            <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
                          ) : (
                            <span key={i}>{part}</span>
                          )
                        )}
                      </p>
                    );
                  }
                  
                  // Bullet points with •
                  if (line.match(/^•\s/)) {
                    return (
                      <div key={idx} className="flex items-start gap-2 ml-2 mb-1">
                        <span className="text-gray-600 mt-0.5">•</span>
                        <span className="flex-1 text-sm">{line.replace(/^•\s/, '')}</span>
                      </div>
                    );
                  }
                  
                  // Checkmarks ✔
                  if (line.match(/^✔\s/)) {
                    return (
                      <div key={idx} className="flex items-start gap-2 ml-2 mb-1">
                        <span className="text-green-600 mt-0.5">✔</span>
                        <span className="flex-1 text-sm">{line.replace(/^✔\s/, '')}</span>
                      </div>
                    );
                  }
                  
                  // Table rows (| ... | ... |)
                  if (line.includes('|') && line.split('|').length > 2) {
                    const cells = line.split('|').filter(c => c.trim());
                    const isHeader = line.includes('---');
                    
                    if (isHeader) {
                      return <div key={idx} className="border-b border-gray-400 my-1"></div>;
                    }
                    
                    return (
                      <div key={idx} className="grid grid-cols-2 gap-3 py-1.5 px-2 text-sm bg-gray-50 rounded">
                        {cells.map((cell, i) => (
                          <div key={i} className={`${i === 0 ? 'font-medium text-gray-700' : 'text-gray-600'}`}>
                            {cell.trim()}
                          </div>
                        ))}
                      </div>
                    );
                  }
                  
                  // Empty lines
                  if (!line.trim()) {
                    return <div key={idx} className="h-1"></div>;
                  }
                  
                  // Regular text
                  return (
                    <p key={idx} className="mb-1 text-sm leading-relaxed">
                      {line}
                    </p>
                  );
                })}
              </div>
              
              {/* Show disease detection result */}
              {message.sender === 'bot' && message.diseaseDetection && (
                <div className="mt-3 pt-3 border-t border-gray-300 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-white p-2 rounded">
                      <div className="text-xs text-gray-500">Confidence</div>
                      <div className="font-semibold text-green-700">
                        {Math.round(message.diseaseDetection.confidence * 100)}%
                      </div>
                    </div>
                    <div className="bg-white p-2 rounded">
                      <div className="text-xs text-gray-500">Severity</div>
                      <div className={`font-semibold ${
                        message.diseaseDetection.severity === 'severe' ? 'text-red-600' :
                        message.diseaseDetection.severity === 'moderate' ? 'text-yellow-600' :
                        'text-green-600'
                      }`}>
                        {message.diseaseDetection.severity}
                      </div>
                    </div>
                  </div>
                  
                  {message.diseaseDetection.image_url && (
                    <div className="mt-2">
                      <img 
                        src={message.diseaseDetection.image_url} 
                        alt="Analyzed crop" 
                        className="max-w-full rounded-lg border-2 border-gray-300"
                      />
                    </div>
                  )}
                  
                  {/* Show raw detection data */}
                  {message.diseaseDetection.raw_labels.length > 0 && (
                    <details className="text-xs mt-2">
                      <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
                        {language === 'en' ? 'View detection details' : 'पहचान विवरण देखें'}
                      </summary>
                      <div className="mt-2 space-y-1 bg-white p-2 rounded">
                        <div className="font-semibold">Vision API Labels:</div>
                        {message.diseaseDetection.raw_labels.slice(0, 5).map((label, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span>{label.description}</span>
                            <span className="text-gray-500">{Math.round(label.score * 100)}%</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}
              
              {/* Show rich AI response data */}
              {message.sender === 'bot' && message.response && (
                <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                  {/* Alert Level */}
                  {message.response.alertLevel !== 'none' && (
                    <div className={`text-xs px-2 py-1 rounded inline-block ${
                      message.response.alertLevel === 'urgent' ? 'bg-red-100 text-red-700' :
                      message.response.alertLevel === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {message.response.alertLevel === 'urgent' 
                        ? (language === 'en' ? '🚨 Urgent Attention' : '🚨 तुरंत ध्यान दें')
                        : message.response.alertLevel === 'warning' 
                        ? (language === 'en' ? '⚠️ Caution' : '⚠️ सावधानी')
                        : (language === 'en' ? 'ℹ️ Information' : 'ℹ️ जानकारी')}
                    </div>
                  )}

                  {/* Suggested Actions */}
                  {message.response.suggestedActions.length > 0 && (
                    <div className="text-sm">
                      <p className="font-semibold text-green-700 mb-1">
                        {language === 'en' ? '✅ Action Items:' : '✅ करने योग्य कार्य:'}
                      </p>
                      <ul className="space-y-1">
                        {message.response.suggestedActions.map((action: any, idx: number) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                              action.priority === 'high' ? 'bg-red-100 text-red-600' :
                              action.priority === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {action.priority === 'high' 
                                ? (language === 'en' ? 'Urgent' : 'जरूरी')
                                : action.priority === 'medium' 
                                ? (language === 'en' ? 'Medium' : 'मध्यम')
                                : (language === 'en' ? 'Low' : 'कम')}
                            </span>
                            <span className="flex-1">{action.action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Quick Tips */}
                  {message.response.quickTips.length > 0 && (
                    <div className="text-sm">
                      <p className="font-semibold text-green-700 mb-1">
                        {language === 'en' ? '💡 Tips:' : '💡 टिप्स:'}
                      </p>
                      <ul className="list-disc list-inside space-y-0.5">
                        {message.response.quickTips.map((tip: string, idx: number) => (
                          <li key={idx}>{tip}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs opacity-70">
                  {message.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </p>
                
                {/* Read It button for bot messages */}
                {message.sender === 'bot' && (
                  <button
                    onClick={() => handleTextToSpeech(message.id, message.text)}
                    disabled={isLoading}
                    className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      speakingMessageId === message.id && isSpeaking
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    title={speakingMessageId === message.id && isSpeaking 
                      ? (language === 'en' ? 'Stop' : 'रोकें')
                      : (language === 'en' ? 'Read it' : 'पढ़ें')}
                  >
                    {speakingMessageId === message.id && isSpeaking ? (
                      <>
                        <VolumeX className="w-3 h-3" />
                        <span>{language === 'en' ? 'Stop' : 'रोकें'}</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3 h-3" />
                        <span>{language === 'en' ? 'Read it' : 'पढ़ें'}</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl px-4 py-3 rounded-bl-sm">
              <div className="flex gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white rounded-2xl border border-green-100 p-3">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden absolute opacity-0 w-0 h-0"
          style={{ display: 'none' }}
        />
        
        {/* Minimized Image Preview - WhatsApp/ChatGPT Style */}
        {imagePreview && (
          <div className="mb-3 flex items-center gap-3 p-2 bg-gray-50 rounded-xl">
            <img 
              src={imagePreview} 
              alt="Selected crop image" 
              className="w-16 h-16 object-cover rounded-lg border-2 border-green-200 shadow-sm"
            />
            <div className="flex-1">
              <p className="text-sm text-gray-700 font-medium">
                {language === 'en' ? 'Image attached' : 'छवि संलग्न'}
              </p>
              <p className="text-xs text-gray-500">
                {language === 'en' ? 'Ready to analyze' : 'विश्लेषण के लिए तैयार'}
              </p>
            </div>
            <button
              onClick={handleRemoveImage}
              className="w-8 h-8 bg-red-500 text-black rounded-full flex items-center justify-center hover:bg-red-600 transition-colors text-lg font-bold leading-none shadow-sm"
              title={language === 'en' ? 'Remove image' : 'छवि हटाएं'}
            >
              ×
            </button>
          </div>
        )}
        
        <div className="flex items-center gap-2">
          {/* Camera Button */}
          <button
            onClick={handleImageCapture}
            disabled={isLoading}
            className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center hover:bg-green-100 transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Capture image"
          >
            <Camera className="w-6 h-6 text-green-600" />
          </button>

          {/* Paperclip Button */}
          <button
            onClick={handleImageAttachment}
            disabled={isLoading}
            className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center hover:bg-green-100 transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Attach image"
          >
            <Paperclip className="w-6 h-6 text-green-600" />
          </button>

          {/* Voice Button */}
          <button
            onClick={handleVoiceInput}
            disabled={isLoading}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
              isListening
                ? 'bg-red-100 animate-pulse'
                : 'bg-green-50 hover:bg-green-100'
            }`}
            title="Voice input"
          >
            <Mic className={`w-6 h-6 ${isListening ? 'text-red-600' : 'text-green-600'}`} />
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSendMessage()}
            placeholder={isLoading ? 'AI is thinking...' : 'Type your question...'}
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-gray-50 rounded-full border-0 focus:outline-none focus:ring-2 focus:ring-green-200 disabled:opacity-50"
          />

          {/* Send Button */}
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim() || isLoading}
            className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            title="Send message"
          >
            <Send className="w-5 h-5 text-white" />
          </button>
        </div>
        
        {isListening && (
          <p className="text-center text-sm text-red-600 mt-2 animate-pulse">🎤 {language === 'en' ? 'Listening...' : 'सुन रहा हूँ...'}</p>
        )}
        {isLoading && (
          <p className="text-center text-sm text-green-600 mt-2">🤖 {language === 'en' ? 'AI is generating response...' : 'AI जवाब बना रहा है...'}</p>
        )}
        {isSpeaking && (
          <p className="text-center text-sm text-blue-600 mt-2 animate-pulse">🔊 {language === 'en' ? 'Reading message...' : 'संदेश पढ़ रहा हूँ...'}</p>
        )}
      </div>
    </div>
  );
}
