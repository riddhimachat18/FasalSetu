// Smart Crop Advisory AI - Gemini Integration for FasalSetu
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth-helpers';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface FarmerContext {
  farmerId: string;
  sessionId: string;
  
  // Farmer Profile
  farmerProfile: {
    name?: string;
    location?: string; // Village/District/State
    farmSize?: number; // in acres
    preferredLanguage?: 'hi' | 'mr' | 'te' | 'ta' | 'en' | 'mixed'; // Hindi, Marathi, Telugu, Tamil, English
    experienceLevel?: 'beginner' | 'intermediate' | 'expert';
  };
  
  // Current Farm Data
  farmData: {
    farmSize?: number; // in acres (duplicate for convenience)
    soilType?: string; // e.g., "sandy loam", "clay", "black soil"
    soilPH?: number;
    soilNPK?: { nitrogen: number; phosphorus: number; potassium: number };
    currentCrop?: string;
    cropStage?: 'planning' | 'sowing' | 'growing' | 'flowering' | 'harvest';
    irrigationType?: 'rainfed' | 'drip' | 'sprinkler' | 'flood';
    // Detailed soil properties from farm_soil_data table
    soilOrganicCarbon?: number; // in g/kg
    soilCEC?: number; // Cation Exchange Capacity in cmol(+)/kg
    soilTexture?: {
      clay: number; // percentage
      sand: number; // percentage
      silt: number; // percentage
    };
    soilBulkDensity?: number; // in cg/cm³
  };
  
  // Weather Context
  weatherData?: {
    temperature?: number;
    humidity?: number;
    rainfall?: number;
    forecast?: string; // e.g., "rain expected tomorrow"
  };
  
  // Conversation History
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp?: Date;
  }>;
}

export interface CropAdvisoryResponse {
  message: string; // Main response in farmer's language
  detectedLanguage: string;
  category: 'crop_planning' | 'soil_advice' | 'fertilizer' | 'irrigation' | 
            'disease_pest' | 'weather' | 'harvest' | 'market' | 'general';
  
  // Actionable Suggestions
  suggestedActions: Array<{
    action: string;
    priority: 'high' | 'medium' | 'low';
    timing: 'immediate' | 'this_week' | 'this_month';
  }>;
  
  // Quick Tips
  quickTips: string[];
  
  // Follow-up Questions
  followUpQuestions: string[];
  
  // Visual Aids (optional)
  visualAids?: {
    showImage?: boolean;
    imageDescription?: string;
    showVideo?: boolean;
    videoTopic?: string;
  };
  
  // Alert Level
  alertLevel: 'none' | 'info' | 'warning' | 'urgent';
  
  confidence: number;
}

// ============================================
// MAIN AI SERVICE CLASS
// ============================================

export class CropAdvisoryAI {
  private model: any;
  private isInitialized = false;
  private apiKey: string;

  constructor() {
    this.apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || '';
    this.initializeService();
  }

  private async initializeService() {
    if (this.isInitialized) return;

    try {
      if (!this.apiKey || this.apiKey === '') {
        console.warn('⚠️ Gemini API key not configured. Using fallback mode.');
        this.isInitialized = true;
        return;
      }

      const genAI = new GoogleGenerativeAI(this.apiKey);
      
      this.model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-exp',
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.4, // Lower for more consistent farming advice
          topP: 0.8,
          topK: 20,
        },
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
        ],
      });

      this.isInitialized = true;
      console.log('✅ Crop Advisory AI initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Crop Advisory AI:', error);
      this.isInitialized = true; // Allow fallback mode
    }
  }

  // ============================================
  // IMAGE UPLOAD TO SUPABASE STORAGE
  // ============================================
  
  async uploadImageToSupabase(imageBase64: string, userId: string): Promise<string | null> {
    try {
      // Convert base64 to blob
      const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/jpeg' });

      // Generate unique filename
      const timestamp = Date.now();
      const filename = `crop-images/${userId}/${timestamp}.jpg`;

      console.log('📤 Uploading image to Supabase Storage...');

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('crop-images')
        .upload(filename, blob, {
          contentType: 'image/jpeg',
          upsert: false
        });

      if (error) {
        console.error('Error uploading image:', error);
        return null;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('crop-images')
        .getPublicUrl(filename);

      console.log('✅ Image uploaded successfully:', urlData.publicUrl);
      return urlData.publicUrl;
    } catch (error) {
      console.error('Error in uploadImageToSupabase:', error);
      return null;
    }
  }

  // ============================================
  // FETCH FARM CONTEXT FROM DATABASE
  // ============================================
  
  async fetchFarmContext(): Promise<Partial<FarmerContext>> {
    try {
      const user = await getCurrentUser();
      if (!user) {
        console.warn('⚠️ No authenticated user, using default context');
        return {};
      }

      console.log('📊 Fetching farm context from database...');

      // Fetch user profile data
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('latitude, longitude, city, state, country, preferred_language')
        .eq('id', user.id)
        .single();

      if (userError) {
        console.error('Error fetching user data:', userError);
      }

      // Fetch soil data
      const { data: soilData, error: soilError } = await supabase
        .from('farm_soil_data')
        .select('*')
        .eq('user_id', user.id)
        .order('recorded_at', { ascending: false })
        .limit(1);

      if (soilError) {
        console.error('Error fetching soil data:', soilError);
      }

      const latestSoil = soilData && soilData.length > 0 ? soilData[0] : null;

      // Fetch active crop cycles
      const { data: cropData, error: cropError } = await supabase
        .from('crop_cycles')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('sowing_date', { ascending: false })
        .limit(1);

      if (cropError) {
        console.error('Error fetching crop data:', cropError);
      }

      const activeCrop = cropData && cropData.length > 0 ? cropData[0] : null;

      // Build location string from available data
      let location = 'Unknown';
      if (userData) {
        const locationParts: string[] = [];
        if (userData.city) locationParts.push(userData.city);
        if (userData.state) locationParts.push(userData.state);
        if (userData.country) locationParts.push(userData.country);
        
        if (locationParts.length > 0) {
          location = locationParts.join(', ');
        } else if (userData.latitude && userData.longitude) {
          // Fallback to coordinates if no city/state/country
          location = `${userData.latitude.toFixed(4)}, ${userData.longitude.toFixed(4)}`;
        }
      }

      console.log('📍 Farmer location:', location);

      // Build enriched context
      const enrichedContext: Partial<FarmerContext> = {
        farmerId: user.id,
        farmerProfile: {
          name: 'Farmer', // Name not stored in users table
          location: location,
          farmSize: undefined, // farm_size column doesn't exist in users table
          preferredLanguage: (userData?.preferred_language as any) || 'mixed',
          experienceLevel: 'intermediate'
        },
        farmData: {
          farmSize: undefined, // farm_size column doesn't exist in users table
          soilType: latestSoil?.soil_type_name || 'Unknown',
          soilPH: latestSoil?.ph_level || undefined,
          soilNPK: {
            nitrogen: latestSoil?.total_nitrogen || 0,
            phosphorus: 45, // Not available from SoilGrids
            potassium: 180  // Not available from SoilGrids
          },
          currentCrop: activeCrop?.crop_name || undefined,
          cropStage: activeCrop?.current_stage as any || 'planning',
          irrigationType: 'drip', // Default, could be added to database
          // Detailed soil properties
          soilOrganicCarbon: latestSoil?.organic_carbon || undefined,
          soilCEC: latestSoil?.cec || undefined,
          soilTexture: latestSoil ? {
            clay: latestSoil.clay_pct || 0,
            sand: latestSoil.sand_pct || 0,
            silt: latestSoil.silt_pct || 0
          } : undefined,
          soilBulkDensity: latestSoil?.bulk_density || undefined
        }
      };

      console.log('✅ Farm context loaded from database');
      return enrichedContext;
    } catch (error) {
      console.error('❌ Error fetching farm context:', error);
      return {};
    }
  }

  // ============================================
  // MAIN METHOD: Generate Farming Advice
  // ============================================
  
  async generateAdvice(
    userQuestion: string,
    context: FarmerContext,
    tableSchema?: string,
    imageBase64?: string
  ): Promise<CropAdvisoryResponse> {
    if (!this.isInitialized) {
      await this.initializeService();
    }

    // Fetch latest farm context from database
    const dbContext = await this.fetchFarmContext();
    
    console.log('🗄️ Database context soil data:', {
      soilType: dbContext.farmData?.soilType,
      soilPH: dbContext.farmData?.soilPH,
      soilTexture: dbContext.farmData?.soilTexture
    });
    console.log('🖥️ UI context soil data:', {
      soilType: context.farmData?.soilType,
      soilPH: context.farmData?.soilPH,
      soilTexture: context.farmData?.soilTexture
    });
    
    // Merge database context with provided context
    // IMPORTANT: UI selections (language, currentCrop) take precedence over database values
    const enrichedContext: FarmerContext = {
      ...context,
      ...dbContext,
      farmerProfile: {
        ...dbContext.farmerProfile,
        ...context.farmerProfile,
        // UI language selection takes precedence
        preferredLanguage: context.farmerProfile?.preferredLanguage || dbContext.farmerProfile?.preferredLanguage || 'mixed'
      },
      farmData: {
        // Start with database data as base
        ...dbContext.farmData,
        // Merge UI data, but only non-undefined values
        ...(Object.fromEntries(
          Object.entries(context.farmData || {}).filter(([_, value]) => value !== undefined)
        )),
        // UI selected crop always takes precedence (even if empty string)
        currentCrop: context.farmData?.currentCrop !== undefined 
          ? context.farmData.currentCrop 
          : dbContext.farmData?.currentCrop
      }
    };

    console.log('🌾 Final enriched context - currentCrop:', enrichedContext.farmData?.currentCrop);
    console.log('🌱 Final enriched context - soil data:', {
      soilType: enrichedContext.farmData?.soilType,
      soilPH: enrichedContext.farmData?.soilPH,
      soilTexture: enrichedContext.farmData?.soilTexture,
      soilOrganicCarbon: enrichedContext.farmData?.soilOrganicCarbon,
      soilCEC: enrichedContext.farmData?.soilCEC,
      soilNPK: enrichedContext.farmData?.soilNPK
    });

    // Upload image to Supabase Storage if provided
    let imageUrl: string | null = null;
    if (imageBase64) {
      const user = await getCurrentUser();
      if (user) {
        imageUrl = await this.uploadImageToSupabase(imageBase64, user.id);
        if (imageUrl) {
          console.log('📸 Image stored at:', imageUrl);
        }
      }
    }

    // Fallback mode
    if (!this.model || !this.apiKey) {
      console.log('🔄 Using fallback response');
      return this.getFallbackResponse(enrichedContext);
    }

    try {
      console.log('🌾 Using enriched context with database data');
      
      // Map language code to locale for Gemini API
      const language = enrichedContext.farmerProfile?.preferredLanguage || 'mixed';
      const languageLocaleMap: Record<string, string> = {
        en: 'en-US',
        hi: 'hi-IN',
        mr: 'mr-IN',
        te: 'te-IN',
        ta: 'ta-IN',
        mixed: 'hi-IN' // Default to Hindi for Hinglish
      };
      
      const languageCode = languageLocaleMap[language] || 'en-US';
      console.log('🌐 Using language code:', languageCode, 'for language:', language);
      
      // Build the content for the model
      let content;
      if (imageBase64) {
        console.log('📸 Processing image for disease detection...');
        console.log('🌾 Selected crop for analysis:', enrichedContext.farmData?.currentCrop);
        console.log('🌾 Farmer context:', JSON.stringify({
          currentCrop: enrichedContext.farmData?.currentCrop,
          location: enrichedContext.farmerProfile?.location,
          language: enrichedContext.farmerProfile?.preferredLanguage
        }));
        
        // Multimodal input: text + image
        const imagePrompt = this.buildImageAnalysisPrompt(userQuestion, enrichedContext);
        console.log('📝 Image prompt preview (first 500 chars):', imagePrompt.substring(0, 500));
        
        content = [
          { text: imagePrompt },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: imageBase64
            }
          }
        ];
      } else {
        // Text-only input - wrap in array for consistency
        const textPrompt = this.buildFarmingPrompt(userQuestion, enrichedContext, tableSchema);
        console.log('📝 Prompt being sent to AI (first 1000 chars):', textPrompt.substring(0, 1000));
        content = textPrompt; // String is acceptable for text-only
      }
      
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Response timeout')), 25000)
      );
      
      // Generate content with language-specific configuration
      const generationPromise = this.model.generateContent({
        contents: typeof content === 'string' 
          ? [{ role: 'user', parts: [{ text: content }] }]
          : [{ role: 'user', parts: content }],
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.4,
          topP: 0.8,
          topK: 20,
          candidateCount: 1,
          responseMimeType: 'text/plain'
        }
      });
      
      const result = await Promise.race([generationPromise, timeoutPromise]) as any;

      if (!result?.response) {
        throw new Error('No response from model');
      }

      const response = await result.response;
      const generatedText = response.text();

      if (!generatedText || generatedText.trim() === '') {
        throw new Error('Empty response from model');
      }

      console.log('🤖 AI Response received, language:', enrichedContext.farmerProfile?.preferredLanguage);
      console.log('📝 Response preview:', generatedText.substring(0, 100));

      return this.parseResponse(generatedText, enrichedContext);
    } catch (error: any) {
      console.error('❌ Error generating advice:', error);
      return this.getFallbackResponse(enrichedContext);
    }
  }

  // ============================================
  // IMAGE ANALYSIS PROMPT BUILDER
  // ============================================
  
  private buildImageAnalysisPrompt(userQuestion: string, context: FarmerContext): string {
    const language = context.farmerProfile?.preferredLanguage || 'mixed';
    
    const languageMap = {
      hi: 'Hindi (हिंदी)',
      mr: 'Marathi (मराठी)',
      te: 'Telugu (తెలుగు)',
      ta: 'Tamil (தமிழ்)',
      en: 'English',
      mixed: 'Hinglish (mix of Hindi and English)'
    };

    // Concise structured response format (not JSON, but formatted text)
    const cropName = context.farmData?.currentCrop || 'crop';
    console.log('🌾 Building image prompt for crop:', cropName);
    console.log('🌾 Full context.farmData:', JSON.stringify(context.farmData));
    const detailedResponseFormat = language === 'en' ? `
**RESPONSE FORMAT (Concise & Actionable):**

This ${cropName} plant shows symptoms of **[Disease Name in ${cropName}]** ([scientific name]).

🔍 **Why it looks like [Disease Name]**
• [Key symptom 1 in ${cropName}]
• [Key symptom 2 in ${cropName}]
• [Key symptom 3 in ${cropName}]

🌱 **What this disease does to ${cropName}**
[1-2 sentences: parts affected + yield impact in ${cropName}]

🧪 **Immediate Action for ${cropName}**

**Organic Control:**
• [Remedy 1 with dosage for ${cropName}]
• [Remedy 2 with dosage for ${cropName}]

**Chemical Control for ${cropName}** (choose ONE):
| Product | Dosage |
| [Product 1] | [dosage/liter] |
| [Product 2] | [dosage/liter] |

Spray in morning/evening. Repeat after [X] days.

🚫 **Prevention for ${cropName}**
✔ [Tip 1 for ${cropName}]
✔ [Tip 2 for ${cropName}]
✔ [Tip 3 for ${cropName}]
` : `
**उत्तर प्रारूप (संक्षिप्त और कार्रवाई योग्य):**

यह ${cropName} का पौधा **[${cropName} में रोग का नाम]** ([वैज्ञानिक नाम]) के लक्षण दिखाता है।

🔍 **यह [रोग का नाम] क्यों लगता है**
• [${cropName} में मुख्य लक्षण 1]
• [${cropName} में मुख्य लक्षण 2]
• [${cropName} में मुख्य लक्षण 3]

🌱 **यह रोग ${cropName} को क्या करता है**
[1-2 वाक्य: प्रभावित भाग + ${cropName} में उपज पर प्रभाव]

🧪 **${cropName} के लिए तत्काल कार्रवाई**

**जैविक नियंत्रण:**
• [${cropName} के लिए खुराक के साथ उपाय 1]
• [${cropName} के लिए खुराक के साथ उपाय 2]

**${cropName} के लिए रासायनिक नियंत्रण** (कोई एक चुनें):
| उत्पाद | खुराक |
| [उत्पाद 1] | [खुराक/लीटर] |
| [उत्पाद 2] | [खुराक/लीटर] |

सुबह/शाम स्प्रे करें। [X] दिन बाद दोहराएं।

🚫 **${cropName} के लिए रोकथाम**
✔ [${cropName} के लिए टिप 1]
✔ [${cropName} के लिए टिप 2]
✔ [${cropName} के लिए टिप 3]
`;

    // Language-specific JSON schemas for image analysis (kept for backward compatibility)
    const imageJsonSchemas: Record<string, string> = {
      en: `{
  "message": "Disease diagnosis and treatment in English (3-4 lines)",
  "detectedLanguage": "English",
  "category": "disease_pest",
  "suggestedActions": [
    {"action": "Treatment step with exact quantities", "priority": "high", "timing": "immediate"}
  ],
  "quickTips": ["Prevention tip 1", "Prevention tip 2"],
  "followUpQuestions": ["When did this problem start?", "Is it affecting the whole field?"],
  "visualAids": {"showImage": true, "imageDescription": "Disease appearance", "showVideo": true, "videoTopic": "Treatment method"},
  "alertLevel": "warning|urgent",
  "confidence": 0.85
}`,
      hi: `{
  "message": "रोग निदान और उपचार हिंदी में (3-4 पंक्तियाँ)",
  "detectedLanguage": "Hindi (हिंदी)",
  "category": "disease_pest",
  "suggestedActions": [
    {"action": "सटीक मात्रा के साथ उपचार कदम", "priority": "high", "timing": "immediate"}
  ],
  "quickTips": ["रोकथाम सुझाव 1", "रोकथाम सुझाव 2"],
  "followUpQuestions": ["यह समस्या कब से है?", "क्या पूरे खेत में है?"],
  "visualAids": {"showImage": true, "imageDescription": "रोग की दिखावट", "showVideo": true, "videoTopic": "उपचार विधि"},
  "alertLevel": "warning|urgent",
  "confidence": 0.85
}`,
      mr: `{
  "message": "रोग निदान आणि उपचार मराठीत (3-4 ओळी)",
  "detectedLanguage": "Marathi (मराठी)",
  "category": "disease_pest",
  "suggestedActions": [
    {"action": "अचूक प्रमाणासह उपचार पायरी", "priority": "high", "timing": "immediate"}
  ],
  "quickTips": ["प्रतिबंध टीप 1", "प्रतिबंध टीप 2"],
  "followUpQuestions": ["ही समस्या कधीपासून आहे?", "संपूर्ण शेतात आहे का?"],
  "visualAids": {"showImage": true, "imageDescription": "रोगाचे स्वरूप", "showVideo": true, "videoTopic": "उपचार पद्धत"},
  "alertLevel": "warning|urgent",
  "confidence": 0.85
}`,
      te: `{
  "message": "వ్యాధి నిర్ధారణ మరియు చికిత్స తెలుగులో (3-4 పంక్తులు)",
  "detectedLanguage": "Telugu (తెలుగు)",
  "category": "disease_pest",
  "suggestedActions": [
    {"action": "ఖచ్చితమైన పరిమాణాలతో చికిత్స దశ", "priority": "high", "timing": "immediate"}
  ],
  "quickTips": ["నివారణ చిట్కా 1", "నివారణ చిట్కా 2"],
  "followUpQuestions": ["ఈ సమస్య ఎప్పటి నుండి ఉంది?", "మొత్తం పొలంలో ఉందా?"],
  "visualAids": {"showImage": true, "imageDescription": "వ్యాధి రూపం", "showVideo": true, "videoTopic": "చికిత్స పద్ధతి"},
  "alertLevel": "warning|urgent",
  "confidence": 0.85
}`,
      ta: `{
  "message": "நோய் கண்டறிதல் மற்றும் சிகிச்சை தமிழில் (3-4 வரிகள்)",
  "detectedLanguage": "Tamil (தமிழ்)",
  "category": "disease_pest",
  "suggestedActions": [
    {"action": "துல்லியமான அளவுகளுடன் சிகிச்சை படி", "priority": "high", "timing": "immediate"}
  ],
  "quickTips": ["தடுப்பு குறிப்பு 1", "தடுப்பு குறிப்பு 2"],
  "followUpQuestions": ["இந்த பிரச்சனை எப்போது தொடங்கியது?", "முழு வயலிலும் உள்ளதா?"],
  "visualAids": {"showImage": true, "imageDescription": "நோய் தோற்றம்", "showVideo": true, "videoTopic": "சிகிச்சை முறை"},
  "alertLevel": "warning|urgent",
  "confidence": 0.85
}`,
      mixed: `{
  "message": "Disease diagnosis और treatment Hinglish में (3-4 lines)",
  "detectedLanguage": "Hinglish",
  "category": "disease_pest",
  "suggestedActions": [
    {"action": "Exact quantities के साथ treatment step", "priority": "high", "timing": "immediate"}
  ],
  "quickTips": ["Prevention tip 1", "Prevention tip 2"],
  "followUpQuestions": ["यह problem कब से है?", "पूरे field में है?"],
  "visualAids": {"showImage": true, "imageDescription": "Disease की appearance", "showVideo": true, "videoTopic": "Treatment method"},
  "alertLevel": "warning|urgent",
  "confidence": 0.85
}`
    };

    // Get the specific language instruction
    const languageInstruction = language === 'en' 
      ? 'RESPOND ONLY IN ENGLISH. DO NOT use Hindi, Marathi, Telugu, Tamil, or any other language. Use ENGLISH ONLY.'
      : language === 'hi'
      ? 'केवल हिंदी में जवाब दें। अंग्रेजी या अन्य भाषा का उपयोग न करें।'
      : language === 'mr'
      ? 'फक्त मराठीत उत्तर द्या। इंग्रजी किंवा इतर भाषा वापरू नका।'
      : language === 'te'
      ? 'తెలుగులో మాత్రమే సమాధానం ఇవ్వండి। ఇంగ్లీష్ లేదా ఇతర భాషలను ఉపయోగించవద్దు।'
      : language === 'ta'
      ? 'தமிழில் மட்டும் பதிலளிக்கவும். ஆங்கிலம் அல்லது பிற மொழிகளைப் பயன்படுத்த வேண்டாம்.'
      : 'Respond in Hinglish (mix of Hindi and English). You can use both languages naturally.';

    return `You are "FasalSetu AI", an expert agricultural pathologist and crop disease specialist.

🚨🚨🚨 CRITICAL: THIS IS A ${context.farmData?.currentCrop?.toUpperCase() || 'CROP'} PLANT 🚨🚨🚨
The farmer has explicitly selected ${context.farmData?.currentCrop || 'this crop'} from their crop list.
You MUST analyze this image as a ${context.farmData?.currentCrop || 'crop'} plant ONLY.
DO NOT mention or analyze for any other crop type (especially NOT rice, wheat, or other crops).
If the image doesn't look like ${context.farmData?.currentCrop || 'the selected crop'}, still analyze it as ${context.farmData?.currentCrop || 'that crop'} and provide relevant disease information.

🚨 LANGUAGE REQUIREMENT 🚨
RESPOND IN: ${languageMap[language as keyof typeof languageMap]}
${language === 'en' ? 'Use ONLY English - clear, professional agricultural terminology.' : ''}
${language === 'hi' ? 'केवल हिंदी में - स्पष्ट, पेशेवर कृषि शब्दावली।' : ''}
${language === 'mixed' ? 'Use Hinglish - mix Hindi and English naturally for farmers.' : ''}

📸 ${context.farmData?.currentCrop?.toUpperCase() || 'CROP'} DISEASE ANALYSIS TASK:
The farmer has sent you a ${context.farmData?.currentCrop || 'crop'} image. Provide a COMPREHENSIVE, STRUCTURED analysis for ${context.farmData?.currentCrop || 'this crop'} following this EXACT format:

${detailedResponseFormat}

📋 FARMER CONTEXT:
Location: ${context.farmerProfile?.location || 'Unknown'}
🌾 **SELECTED CROP: ${context.farmData?.currentCrop || 'Unknown'}** 🌾
Crop Stage: ${context.farmData?.cropStage || 'Unknown'}
Soil Type: ${context.farmData?.soilType || 'Unknown'}
Soil pH: ${context.farmData?.soilPH || 'Unknown'}

❓ FARMER'S QUESTION: "${userQuestion || 'What is wrong with my crop?'}"

🚨 IMPORTANT: This image is of **${context.farmData?.currentCrop || 'the crop'}** plant. Analyze diseases specific to **${context.farmData?.currentCrop || 'this crop'}** ONLY. Do NOT analyze for other crops.

🎯 ANALYSIS REQUIREMENTS:
1. **Identify disease** in **${context.farmData?.currentCrop || 'this crop'}** with scientific name (1 line)
2. **List 3 KEY symptoms** only (not 5+)
3. **Impact**: 1-2 sentences max
4. **Treatment** for **${context.farmData?.currentCrop || 'this crop'}**: 
   - 2 organic options with dosages
   - 2 chemical options in table (not 3)
5. **Prevention**: 3 tips only (not 4+)

🔬 BE SPECIFIC BUT CONCISE:
- Product names: "Tricyclazole 75 WP"
- Dosages: "6 g / 10 L" or "0.6 g / L"
- Timing: "morning/evening, repeat after 10 days"
- Keep it SHORT - farmers want quick answers

📊 FORMAT RULES:
- Use tables ONLY for chemical products
- Use bullet points • for organic remedies
- Use checkmarks ✔ for prevention
- NO long paragraphs - keep sentences short
- MAXIMUM 15 lines total response

⚠️ CRITICAL:
- If you cannot identify the disease clearly, say so and suggest consulting a local expert
- Always provide at least 3 fungicide/pesticide options with exact dosages
- Mention safety precautions if using chemicals
- Adapt recommendations to the farmer's location and crop type

🔴 FINAL INSTRUCTIONS:
- Respond in PLAIN TEXT (not JSON) following the structured format above
- Use markdown formatting (**, |, •, ✔)
- Be comprehensive but concise
- Focus on actionable advice
- Use ${languageMap[language as keyof typeof languageMap]} throughout

Now analyze the image and provide your detailed disease analysis.`;
  }

  // ============================================
  // PROMPT BUILDER WITH LANGUAGE-SPECIFIC JSON SCHEMAS
  // ============================================
  
  private buildFarmingPrompt(userQuestion: string, context: FarmerContext, tableSchema?: string): string {
    const language = context.farmerProfile?.preferredLanguage || 'mixed';
    
    console.log('🌐 Building prompt for language:', language);
    
    const languageMap = {
      hi: 'Hindi (हिंदी)',
      mr: 'Marathi (मराठी)',
      te: 'Telugu (తెలుగు)',
      ta: 'Tamil (தமிழ்)',
      en: 'English',
      mixed: 'Hinglish (mix of Hindi and English)'
    };

    const schemaContext = tableSchema ? `\n\n📊 DATABASE SCHEMA:\n${tableSchema}\n` : '';

    // Language-specific JSON schemas with translated field descriptions
    const jsonSchemas: Record<string, string> = {
      en: `{
  "message": "Your farming advice in English (2-3 lines)",
  "detectedLanguage": "English",
  "category": "crop_planning|soil_advice|fertilizer|irrigation|disease_pest|weather|harvest|market|general",
  "suggestedActions": [
    {
      "action": "Specific farming step to take",
      "priority": "high|medium|low",
      "timing": "immediate|this_week|this_month"
    }
  ],
  "quickTips": ["Farming tip 1", "Farming tip 2"],
  "followUpQuestions": ["Follow-up question 1?", "Follow-up question 2?"],
  "visualAids": {
    "showImage": true,
    "imageDescription": "Description of helpful image",
    "showVideo": false,
    "videoTopic": "Video topic"
  },
  "alertLevel": "none|info|warning|urgent",
  "confidence": 0.85
}`,
      hi: `{
  "message": "आपकी खेती की सलाह हिंदी में (2-3 पंक्तियाँ)",
  "detectedLanguage": "Hindi (हिंदी)",
  "category": "crop_planning|soil_advice|fertilizer|irrigation|disease_pest|weather|harvest|market|general",
  "suggestedActions": [
    {
      "action": "करने के लिए विशिष्ट कदम",
      "priority": "high|medium|low",
      "timing": "immediate|this_week|this_month"
    }
  ],
  "quickTips": ["सुझाव 1", "सुझाव 2"],
  "followUpQuestions": ["प्रश्न 1?", "प्रश्न 2?"],
  "visualAids": {
    "showImage": true,
    "imageDescription": "सहायक छवि का विवरण",
    "showVideo": false,
    "videoTopic": "वीडियो विषय"
  },
  "alertLevel": "none|info|warning|urgent",
  "confidence": 0.85
}`,
      mr: `{
  "message": "तुमच्या शेतीचा सल्ला मराठीत (2-3 ओळी)",
  "detectedLanguage": "Marathi (मराठी)",
  "category": "crop_planning|soil_advice|fertilizer|irrigation|disease_pest|weather|harvest|market|general",
  "suggestedActions": [
    {
      "action": "करण्यासाठी विशिष्ट पायरी",
      "priority": "high|medium|low",
      "timing": "immediate|this_week|this_month"
    }
  ],
  "quickTips": ["टीप 1", "टीप 2"],
  "followUpQuestions": ["प्रश्न 1?", "प्रश्न 2?"],
  "visualAids": {
    "showImage": true,
    "imageDescription": "उपयुक्त प्रतिमेचे वर्णन",
    "showVideo": false,
    "videoTopic": "व्हिडिओ विषय"
  },
  "alertLevel": "none|info|warning|urgent",
  "confidence": 0.85
}`,
      te: `{
  "message": "మీ వ్యవసాయ సలహా తెలుగులో (2-3 పంక్తులు)",
  "detectedLanguage": "Telugu (తెలుగు)",
  "category": "crop_planning|soil_advice|fertilizer|irrigation|disease_pest|weather|harvest|market|general",
  "suggestedActions": [
    {
      "action": "చేయవలసిన నిర్దిష్ట చర్య",
      "priority": "high|medium|low",
      "timing": "immediate|this_week|this_month"
    }
  ],
  "quickTips": ["చిట్కా 1", "చిట్కా 2"],
  "followUpQuestions": ["ప్రశ్న 1?", "ప్రశ్న 2?"],
  "visualAids": {
    "showImage": true,
    "imageDescription": "సహాయక చిత్రం వివరణ",
    "showVideo": false,
    "videoTopic": "వీడియో అంశం"
  },
  "alertLevel": "none|info|warning|urgent",
  "confidence": 0.85
}`,
      ta: `{
  "message": "உங்கள் விவசாய ஆலோசனை தமிழில் (2-3 வரிகள்)",
  "detectedLanguage": "Tamil (தமிழ்)",
  "category": "crop_planning|soil_advice|fertilizer|irrigation|disease_pest|weather|harvest|market|general",
  "suggestedActions": [
    {
      "action": "எடுக்க வேண்டிய குறிப்பிட்ட நடவடிக்கை",
      "priority": "high|medium|low",
      "timing": "immediate|this_week|this_month"
    }
  ],
  "quickTips": ["குறிப்பு 1", "குறிப்பு 2"],
  "followUpQuestions": ["கேள்வி 1?", "கேள்வி 2?"],
  "visualAids": {
    "showImage": true,
    "imageDescription": "உதவிகரமான படத்தின் விளக்கம்",
    "showVideo": false,
    "videoTopic": "வீடியோ தலைப்பு"
  },
  "alertLevel": "none|info|warning|urgent",
  "confidence": 0.85
}`,
      mixed: `{
  "message": "आपकी farming की advice Hinglish में (2-3 lines)",
  "detectedLanguage": "Hinglish",
  "category": "crop_planning|soil_advice|fertilizer|irrigation|disease_pest|weather|harvest|market|general",
  "suggestedActions": [
    {
      "action": "करने के लिए specific step",
      "priority": "high|medium|low",
      "timing": "immediate|this_week|this_month"
    }
  ],
  "quickTips": ["Tip 1", "Tip 2"],
  "followUpQuestions": ["Question 1?", "Question 2?"],
  "visualAids": {
    "showImage": true,
    "imageDescription": "Helpful image का description",
    "showVideo": false,
    "videoTopic": "Video topic"
  },
  "alertLevel": "none|info|warning|urgent",
  "confidence": 0.85
}`
    };

    // Language-specific examples
    const examples: Record<string, string> = {
      en: `EXAMPLE RESPONSE IN ENGLISH:
{
  "message": "For tomato cultivation in your black soil with pH 7.2, apply 50kg DAP per acre during land preparation. Your soil has good water retention, so irrigate every 5-7 days.",
  "detectedLanguage": "English",
  "category": "crop_planning",
  "suggestedActions": [
    {"action": "Apply 50kg DAP fertilizer per acre", "priority": "high", "timing": "immediate"},
    {"action": "Set up drip irrigation system", "priority": "medium", "timing": "this_week"}
  ],
  "quickTips": ["Check soil moisture before watering", "Mulch around plants to retain moisture"],
  "followUpQuestions": ["Which tomato variety do you prefer?", "Do you have drip irrigation?"],
  "alertLevel": "info",
  "confidence": 0.9
}`,
      hi: `हिंदी में उदाहरण उत्तर:
{
  "message": "आपकी काली मिट्टी में टमाटर की खेती के लिए, जमीन तैयार करते समय प्रति एकड़ 50 किलो डीएपी डालें। आपकी मिट्टी में पानी अच्छा रुकता है, इसलिए हर 5-7 दिन में सिंचाई करें।",
  "detectedLanguage": "Hindi (हिंदी)",
  "category": "crop_planning",
  "suggestedActions": [
    {"action": "प्रति एकड़ 50 किलो डीएपी खाद डालें", "priority": "high", "timing": "immediate"},
    {"action": "ड्रिप सिंचाई प्रणाली लगाएं", "priority": "medium", "timing": "this_week"}
  ],
  "quickTips": ["पानी देने से पहले मिट्टी की नमी जांचें", "पौधों के चारों ओर मल्चिंग करें"],
  "followUpQuestions": ["आप कौन सी टमाटर की किस्म पसंद करते हैं?", "क्या आपके पास ड्रिप सिंचाई है?"],
  "alertLevel": "info",
  "confidence": 0.9
}`,
      mr: `मराठीत उदाहरण उत्तर:
{
  "message": "तुमच्या काळ्या मातीत टोमॅटो लागवडीसाठी, जमीन तयार करताना प्रति एकर 50 किलो डीएपी टाका। तुमच्या मातीत पाणी चांगले राहते, म्हणून दर 5-7 दिवसांनी पाणी द्या।",
  "detectedLanguage": "Marathi (मराठी)",
  "category": "crop_planning",
  "suggestedActions": [
    {"action": "प्रति एकर 50 किलो डीएपी खत टाका", "priority": "high", "timing": "immediate"},
    {"action": "ठिबक सिंचन प्रणाली लावा", "priority": "medium", "timing": "this_week"}
  ],
  "quickTips": ["पाणी देण्यापूर्वी मातीची ओलावा तपासा", "रोपांभोवती मल्चिंग करा"],
  "followUpQuestions": ["तुम्हाला कोणती टोमॅटो जात आवडते?", "तुमच्याकडे ठिबक सिंचन आहे का?"],
  "alertLevel": "info",
  "confidence": 0.9
}`,
      te: `తెలుగులో ఉదాహరణ సమాధానం:
{
  "message": "మీ నల్ల నేలలో టమాటా సాగుకు, భూమి తయారీ సమయంలో ఎకరాకు 50 కిలోల డీఏపీ వేయండి। మీ నేలలో నీరు బాగా నిలుస్తుంది, కాబట్టి ప్రతి 5-7 రోజులకు నీరు పెట్టండి।",
  "detectedLanguage": "Telugu (తెలుగు)",
  "category": "crop_planning",
  "suggestedActions": [
    {"action": "ఎకరాకు 50 కిలోల డీఏపీ ఎరువు వేయండి", "priority": "high", "timing": "immediate"},
    {"action": "డ్రిప్ నీటిపారుదల వ్యవస్థ ఏర్పాటు చేయండి", "priority": "medium", "timing": "this_week"}
  ],
  "quickTips": ["నీరు పెట్టే ముందు నేల తేమను తనిఖీ చేయండి", "మొక్కల చుట్టూ మల్చింగ్ చేయండి"],
  "followUpQuestions": ["మీకు ఏ టమాటా రకం ఇష్టం?", "మీ వద్ద డ్రిప్ నీటిపారుదల ఉందా?"],
  "alertLevel": "info",
  "confidence": 0.9
}`,
      ta: `தமிழில் உதாரண பதில்:
{
  "message": "உங்கள் கருப்பு மண்ணில் தக்காளி சாகுபடிக்கு, நிலம் தயாரிக்கும் போது ஏக்கருக்கு 50 கிலோ டிஏபி இடவும். உங்கள் மண்ணில் நீர் நன்றாக தங்கும், எனவே ஒவ்வொரு 5-7 நாட்களுக்கும் நீர் பாய்ச்சவும்.",
  "detectedLanguage": "Tamil (தமிழ்)",
  "category": "crop_planning",
  "suggestedActions": [
    {"action": "ஏக்கருக்கு 50 கிலோ டிஏபி உரம் இடவும்", "priority": "high", "timing": "immediate"},
    {"action": "சொட்டு நீர் பாசன அமைப்பை நிறுவவும்", "priority": "medium", "timing": "this_week"}
  ],
  "quickTips": ["நீர் பாய்ச்சும் முன் மண் ஈரத்தை சரிபார்க்கவும்", "செடிகளைச் சுற்றி மல்ச்சிங் செய்யவும்"],
  "followUpQuestions": ["நீங்கள் எந்த தக்காளி வகையை விரும்புகிறீர்கள்?", "உங்களிடம் சொட்டு நீர் பாசனம் உள்ளதா?"],
  "alertLevel": "info",
  "confidence": 0.9
}`,
      mixed: `Hinglish में example response:
{
  "message": "आपकी black soil में tomato की cultivation के लिए, land preparation के time प्रति acre 50 kg DAP डालें। आपकी soil में water अच्छा retain होता है, तो हर 5-7 days में irrigation करें।",
  "detectedLanguage": "Hinglish",
  "category": "crop_planning",
  "suggestedActions": [
    {"action": "प्रति acre 50 kg DAP fertilizer apply करें", "priority": "high", "timing": "immediate"},
    {"action": "Drip irrigation system setup करें", "priority": "medium", "timing": "this_week"}
  ],
  "quickTips": ["Watering से पहले soil moisture check करें", "Plants के around mulching करें"],
  "followUpQuestions": ["आप कौन सी tomato variety prefer करते हैं?", "क्या आपके पास drip irrigation है?"],
  "alertLevel": "info",
  "confidence": 0.9
}`
    };

    // Get the specific language instruction
    const languageInstruction = language === 'en' 
      ? 'RESPOND ONLY IN ENGLISH. DO NOT use Hindi, Marathi, Telugu, Tamil, or any other language. Use ENGLISH ONLY.'
      : language === 'hi'
      ? 'केवल हिंदी में जवाब दें। अंग्रेजी या अन्य भाषा का उपयोग न करें।'
      : language === 'mr'
      ? 'फक्त मराठीत उत्तर द्या। इंग्रजी किंवा इतर भाषा वापरू नका।'
      : language === 'te'
      ? 'తెలుగులో మాత్రమే సమాధానం ఇవ్వండి। ఇంగ్లీష్ లేదా ఇతర భాషలను ఉపయోగించవద్దు।'
      : language === 'ta'
      ? 'தமிழில் மட்டும் பதிலளிக்கவும். ஆங்கிலம் அல்லது பிற மொழிகளைப் பயன்படுத்த வேண்டாம்.'
      : 'Respond in Hinglish (mix of Hindi and English). You can use both languages naturally.';

    return `🚨🚨🚨 ABSOLUTE LANGUAGE REQUIREMENT 🚨🚨🚨
${languageInstruction}
SELECTED LANGUAGE: ${languageMap[language as keyof typeof languageMap]}
${language === 'en' ? 'EVERY SINGLE WORD must be ENGLISH. NO Hindi/Marathi/Telugu/Tamil allowed.' : ''}
${language === 'mr' ? 'प्रत्येक शब्द मराठीत असावा. हिंदी/इंग्रजी नको.' : ''}
${language === 'te' ? 'ప్రతి పదం తెలుగులో ఉండాలి. హిందీ/ఇంగ్లీష్ వద్దు.' : ''}
${language === 'ta' ? 'ஒவ்வொரு வார்த்தையும் தமிழில் இருக்க வேண்டும். இந்தி/ஆங்கிலம் வேண்டாம்.' : ''}

You are "FasalSetu AI", a smart farming assistant for Indian farmers.
${schemaContext}

🌾 YOUR ROLE:
- Help farmers with crop planning, soil health, fertilizers, pest control, weather, and harvest advice
- Give SIMPLE and PRACTICAL answers with actionable details based on the soil profile
- Be friendly, patient, conversational, and warm — like a helpful agriculture officer who is also a friend
- Welcome ALL questions, even off-topic ones, and respond kindly before redirecting to farming
- Use the detailed soil properties (pH, CEC, texture, etc.) to provide specific recommendations
- For irrigation advice, consider sand/silt content (high sand = fast drainage, needs frequent watering)
- For fertilizer advice, consider CEC (low CEC = fertilizer washes away quickly, apply in smaller doses)
- For soil health, consider organic carbon (low = add compost/manure)
- Avoid technical jargon — use simple farming terms

📋 FARMER CONTEXT:
Location: ${context.farmerProfile?.location || 'Unknown'}
Farm Size: ${context.farmData?.farmSize || 'Unknown'} acres

🌱 SOIL INFORMATION:
Soil Type: ${context.farmData?.soilType || 'Unknown'}
Soil pH: ${context.farmData?.soilPH || 'Unknown'}
${context.farmData?.soilTexture ? `Soil Texture: ${context.farmData.soilTexture.clay}% clay, ${context.farmData.soilTexture.sand}% sand, ${context.farmData.soilTexture.silt}% silt` : ''}
${context.farmData?.soilOrganicCarbon ? `Organic Carbon: ${context.farmData.soilOrganicCarbon} g/kg` : ''}
${context.farmData?.soilCEC ? `CEC: ${context.farmData.soilCEC} cmol(+)/kg` : ''}
${context.farmData?.soilNPK ? `NPK: N=${context.farmData.soilNPK.nitrogen}, P=${context.farmData.soilNPK.phosphorus}, K=${context.farmData.soilNPK.potassium}` : ''}
${context.farmData?.soilBulkDensity ? `Bulk Density: ${context.farmData.soilBulkDensity} cg/cm³` : ''}

🌾 CROP INFORMATION:
Current Crop: ${context.farmData?.currentCrop || 'None'}
Crop Stage: ${context.farmData?.cropStage || 'planning'}
Irrigation: ${context.farmData?.irrigationType || 'Unknown'}

🌤️ WEATHER:
Temperature: ${context.weatherData?.temperature || 'Unknown'}°C
Humidity: ${context.weatherData?.humidity || 'Unknown'}%
Forecast: ${context.weatherData?.forecast || 'No data'}

💬 RECENT CONVERSATION:
${context.conversationHistory?.slice(-3).map(msg => `${msg.role}: ${msg.content}`).join('\n') || 'First interaction'}

❓ FARMER'S QUESTION: "${userQuestion}"

⚠️ IMPORTANT: Use the soil information provided above (texture, pH, organic carbon, CEC, NPK) to give accurate recommendations. If the farmer asks about soil or crop suitability, reference these specific soil properties in your answer.

🎯 RESPONSE CATEGORIES:
1. crop_planning - "Which crop to grow?", "Best crop for my soil?"
2. soil_advice - "What is my soil type?", "How to improve pH?"
3. fertilizer - "How much urea?", "When to apply DAP?"
4. irrigation - "When to water?", "How much water needed?"
5. disease_pest - "Yellow leaves", "Pest attack", "White spots"
6. weather - "Will it rain?", "Should I irrigate today?"
7. harvest - "When to harvest?", "How to store grains?"
8. market - "Current price?", "Where to sell?"
9. general - Other farming questions

📝 REQUIRED JSON FORMAT WITH ${languageMap[language as keyof typeof languageMap].toUpperCase()} CONTENT:
${jsonSchemas[language] || jsonSchemas.mixed}

${examples[language] || examples.mixed}

🚨 CRITICAL RULES FOR ${languageMap[language as keyof typeof languageMap].toUpperCase()}:
${language === 'en' ? `
- Write ONLY in English
- NO Hindi words allowed (not even "किसान", "खेत", "फसल")
- NO Marathi/Telugu/Tamil words
- Use English farming terms: "farmer" not "किसान", "field" not "खेत", "crop" not "फसल"
- Check EVERY word before responding
` : language === 'hi' ? `
- केवल हिंदी में लिखें
- अंग्रेजी शब्द बिल्कुल नहीं (जैसे "crop", "soil", "fertilizer" नहीं)
- हिंदी खेती शब्द उपयोग करें: "फसल", "मिट्टी", "खाद"
- हर शब्द जांचें
` : language === 'mr' ? `
- फक्त मराठीत लिहा
- हिंदी/इंग्रजी शब्द नको (जसे "फसल", "crop", "soil" नको)
- मराठी शेती शब्द वापरा: "पीक", "माती", "खत"
- प्रत्येक शब्द तपासा
` : language === 'te' ? `
- తెలుగులో మాత్రమే రాయండి
- హిందీ/ఇంగ్లీష్ పదాలు వద్దు (ఉదా: "फसल", "crop", "soil" వద్దు)
- తెలుగు వ్యవసాయ పదాలు ఉపయోగించండి: "పంట", "నేల", "ఎరువు"
- ప్రతి పదాన్ని తనిఖీ చేయండి
` : language === 'ta' ? `
- தமிழில் மட்டும் எழுதவும்
- இந்தி/ஆங்கில வார்த்தைகள் வேண்டாம் (எ.கா: "फसल", "crop", "soil" வேண்டாம்)
- தமிழ் விவசாய வார்த்தைகளைப் பயன்படுத்தவும்: "பயிர்", "மண்", "உரம்"
- ஒவ்வொரு வார்த்தையையும் சரிபார்க்கவும்
` : `
- Hinglish में लिखें (Hindi + English mix)
- दोनों languages naturally use करें
- Example: "आपकी soil में nitrogen कम है"
`}

- Keep answers SHORT (2-3 lines)
- Use SIMPLE words, not technical terms
- Give ACTIONABLE steps with quantities
- Match the farmer's language exactly
- If urgent (disease/pest/weather alert), set alertLevel to "warning" or "urgent"

💬 BE CONVERSATIONAL & FLEXIBLE:
- If the farmer asks a non-farming or off-topic question, DO NOT reject it
- Provide a friendly, brief response in ${languageMap[language as keyof typeof languageMap]}
- Then gently redirect them back to farming needs
- Always be warm, friendly, and helpful - never rigid or dismissive
- The goal is to build trust and rapport with the farmer

🔴 FINAL LANGUAGE VERIFICATION:
Before responding, verify EVERY WORD is in ${languageMap[language as keyof typeof languageMap]}.
${language === 'en' ? 'If you see ANY Hindi/Hinglish/Marathi/Telugu/Tamil word, REWRITE in PURE ENGLISH.' : ''}
${language === 'hi' ? 'यदि कोई अंग्रेजी शब्द दिखे, तो शुद्ध हिंदी में फिर से लिखें।' : ''}
${language === 'mr' ? 'जर कोणताही इंग्रजी/हिंदी शब्द दिसला, तर शुद्ध मराठीत पुन्हा लिहा।' : ''}
${language === 'te' ? 'ఏదైనా ఇంగ్లీష్/హిందీ పదం కనిపిస్తే, స్వచ్ఛమైన తెలుగులో మళ్లీ రాయండి।' : ''}
${language === 'ta' ? 'ஏதேனும் ஆங்கிலம்/இந்தி வார்த்தை தெரிந்தால், தூய தமிழில் மீண்டும் எழுதவும்.' : ''}

Now respond to the farmer's question in JSON format using ${languageMap[language as keyof typeof languageMap]} ONLY.`;
  }

  // ============================================
  // RESPONSE PARSER
  // ============================================
  
  private parseResponse(
    generatedText: string,
    context: FarmerContext
  ): CropAdvisoryResponse {
    try {
      // Try to parse as JSON first (for backward compatibility)
      const cleanedText = generatedText.replace(/```json\n?|\n?```/g, '').trim();
      
      // Check if it looks like JSON
      if (cleanedText.startsWith('{') && cleanedText.endsWith('}')) {
        try {
          const parsed = JSON.parse(cleanedText);
          return {
            message: parsed.message || 'मैं आपकी मदद करने के लिए यहाँ हूँ।',
            detectedLanguage: parsed.detectedLanguage || 'Hindi',
            category: parsed.category || 'general',
            suggestedActions: parsed.suggestedActions || [],
            quickTips: parsed.quickTips || [],
            followUpQuestions: parsed.followUpQuestions || [],
            visualAids: parsed.visualAids,
            alertLevel: parsed.alertLevel || 'none',
            confidence: parsed.confidence || 0.7
          };
        } catch (jsonError) {
          // JSON parsing failed, treat as plain text
          console.log('📝 Response is not JSON, treating as plain text');
        }
      }

      // Handle as plain text (detailed disease analysis format)
      console.log('✅ Parsing as structured text response');
      
      // Extract suggested actions from the text
      const suggestedActions: Array<{
        action: string;
        priority: 'high' | 'medium' | 'low';
        timing: 'immediate' | 'this_week' | 'this_month';
      }> = [];
      const actionMatches = generatedText.match(/\*\*1️⃣.*?\*\*[\s\S]*?(?=\*\*2️⃣|\*\*🚫|$)/);
      if (actionMatches) {
        suggestedActions.push({
          action: 'Follow cultural practices mentioned above',
          priority: 'high',
          timing: 'immediate'
        });
      }
      
      // Extract quick tips from prevention section
      const quickTips: string[] = [];
      const preventionMatches = generatedText.match(/🚫.*?Prevention.*?\n([\s\S]*?)$/i);
      if (preventionMatches) {
        const tips = preventionMatches[1].match(/✔\s*(.+)/g);
        if (tips) {
          quickTips.push(...tips.slice(0, 3).map(t => t.replace(/✔\s*/, '').trim()));
        }
      }

      // Determine alert level based on keywords
      let alertLevel: 'none' | 'info' | 'warning' | 'urgent' = 'info';
      if (generatedText.toLowerCase().includes('severe') || 
          generatedText.toLowerCase().includes('urgent') ||
          generatedText.toLowerCase().includes('100%')) {
        alertLevel = 'urgent';
      } else if (generatedText.toLowerCase().includes('moderate') ||
                 generatedText.toLowerCase().includes('significant')) {
        alertLevel = 'warning';
      }

      return {
        message: generatedText,
        detectedLanguage: context.farmerProfile?.preferredLanguage || 'mixed',
        category: 'disease_pest',
        suggestedActions,
        quickTips,
        followUpQuestions: [],
        alertLevel,
        confidence: 0.85
      };
    } catch (error) {
      console.error('❌ Error parsing response:', error);
      console.error('Problematic text:', generatedText.substring(0, 200));
      return this.getFallbackResponse(context);
    }
  }

  // ============================================
  // FALLBACK RESPONSE
  // ============================================
  
  private getFallbackResponse(context: FarmerContext): CropAdvisoryResponse {
    const language = context.farmerProfile?.preferredLanguage || 'mixed';
    
    const fallbackMessages = {
      hi: 'नमस्ते! मैं आपकी खेती में मदद करने के लिए यहाँ हूँ। कृपया अपना सवाल फिर से पूछें।',
      mr: 'नमस्कार! मी तुमच्या शेतीसाठी मदत करण्यासाठी येथे आहे। कृपया तुमचा प्रश्न पुन्हा विचारा।',
      te: 'నమస్కారం! నేను మీ వ్యవసాయంలో సహాయం చేయడానికి ఇక్కడ ఉన్నాను। దయచేసి మీ ప్రశ్నను మళ్లీ అడగండి।',
      ta: 'வணக்கம்! உங்கள் விவசாயத்தில் உதவ நான் இங்கே இருக்கிறேன். தயவுசெய்து உங்கள் கேள்வியை மீண்டும் கேளுங்கள்.',
      en: 'Hello! I am here to help with your farming. Please ask your question again.',
      mixed: 'नमस्ते! मैं आपकी farming में help करने के लिए यहाँ हूँ। Please ask your question again।'
    };

    return {
      message: fallbackMessages[language] || fallbackMessages.mixed,
      detectedLanguage: language,
      category: 'general',
      suggestedActions: [
        {
          action: 'मिट्टी की जांच करें / Check soil health',
          priority: 'medium',
          timing: 'this_week'
        }
      ],
      quickTips: [
        'नियमित रूप से खेत का निरीक्षण करें',
        'मौसम की जानकारी रखें'
      ],
      followUpQuestions: [
        'आप कौन सी फसल उगाना चाहते हैं?',
        'आपकी मिट्टी का प्रकार क्या है?'
      ],
      alertLevel: 'info',
      confidence: 0.6
    };
  }

  // ============================================
  // GENERATE CROP SUGGESTIONS
  // ============================================
  
  async generateCropSuggestions(context: FarmerContext): Promise<Array<{
    title: string;
    description: string;
    category: 'seasonal' | 'soil' | 'market' | 'disease' | 'fertilizer' | 'irrigation' | 'general';
    confidence: number;
  }>> {
    if (!this.isInitialized) {
      await this.initializeService();
    }

    // Fetch latest farm context from database
    const dbContext = await this.fetchFarmContext();
    const enrichedContext: FarmerContext = {
      ...context,
      ...dbContext,
      farmerProfile: {
        ...context.farmerProfile,
        ...dbContext.farmerProfile,
      },
      farmData: {
        ...context.farmData,
        ...dbContext.farmData
      }
    };

    if (!this.model || !this.apiKey) {
      console.log('🔄 Using fallback suggestions');
      return this.getFallbackSuggestions();
    }

    try {
      const language = enrichedContext.farmerProfile?.preferredLanguage || 'mixed';
      const prompt = this.buildSuggestionsPrompt(enrichedContext, language);

      console.log('🌾 Generating crop suggestions...');

      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 1500,
          temperature: 0.6,
          topP: 0.9,
          topK: 30,
        }
      });

      const response = await result.response;
      const generatedText = response.text();

      console.log('✅ Suggestions generated');
      return this.parseSuggestions(generatedText);
    } catch (error) {
      console.error('❌ Error generating suggestions:', error);
      return this.getFallbackSuggestions();
    }
  }

  private buildSuggestionsPrompt(context: FarmerContext, language: string): string {
    const languageMap = {
      hi: 'Hindi (हिंदी)',
      mr: 'Marathi (मराठी)',
      te: 'Telugu (తెలుగు)',
      ta: 'Tamil (தமிழ்)',
      en: 'English',
      mixed: 'Hinglish (mix of Hindi and English)'
    };

    return `You are "FasalSetu AI", an expert agricultural advisor for Indian farmers.

🎯 TASK: Generate 4 personalized crop suggestions for this farmer.

📋 FARMER CONTEXT:
Location: ${context.farmerProfile?.location || 'Unknown'}
Farm Size: ${context.farmData?.farmSize || 'Unknown'} acres

🌱 SOIL INFORMATION (Use this for crop recommendations):
Soil Type: ${context.farmData?.soilType || 'Unknown'}
Soil pH: ${context.farmData?.soilPH || 'Unknown'}
${context.farmData?.soilTexture ? `Soil Texture: ${context.farmData.soilTexture.clay}% clay, ${context.farmData.soilTexture.sand}% sand, ${context.farmData.soilTexture.silt}% silt` : 'Soil Texture: Not available'}
${context.farmData?.soilOrganicCarbon ? `Organic Carbon: ${context.farmData.soilOrganicCarbon} g/kg` : 'Organic Carbon: Not available'}
${context.farmData?.soilCEC ? `CEC: ${context.farmData.soilCEC} cmol(+)/kg` : 'CEC: Not available'}
${context.farmData?.soilNPK ? `NPK: N=${context.farmData.soilNPK.nitrogen}, P=${context.farmData.soilNPK.phosphorus}, K=${context.farmData.soilNPK.potassium}` : 'NPK: Not available'}

🌾 CROP & CLIMATE:
Current Crop: ${context.farmData?.currentCrop || 'None'}
Crop Stage: ${context.farmData?.cropStage || 'planning'}
Temperature: ${context.weatherData?.temperature || 'Unknown'}°C
Season: ${this.getCurrentSeason()}

🌐 LANGUAGE: ${languageMap[language as keyof typeof languageMap]}
${language === 'en' ? 'Respond ONLY in English.' : ''}
${language === 'hi' ? 'केवल हिंदी में जवाब दें।' : ''}
${language === 'mixed' ? 'Respond in Hinglish (mix Hindi and English).' : ''}

📝 RESPONSE FORMAT (JSON):
{
  "suggestions": [
    {
      "title": "Short catchy title (5-7 words)",
      "description": "Detailed actionable advice (2-3 sentences, 40-60 words)",
      "category": "seasonal|soil|market|disease|fertilizer|irrigation",
      "confidence": 0.85
    }
  ]
}

🎯 SUGGESTION CATEGORIES:
1. **seasonal** - Best crops for current season/weather
2. **soil** - Crops matching soil type and pH
3. **market** - High-demand crops with good prices
4. **disease** - Disease-resistant varieties
5. **fertilizer** - Nutrient management tips
6. **irrigation** - Water-efficient crops

📊 REQUIREMENTS:
- Generate exactly 4 suggestions
- Mix different categories (don't repeat)
- Be specific to farmer's location and soil
- Include crop varieties (e.g., "DBW-187 wheat")
- Mention expected yield or profit if relevant
- Keep descriptions actionable and practical
- Use ${languageMap[language as keyof typeof languageMap]} throughout

🌾 EXAMPLES:

${language === 'en' ? `{
  "suggestions": [
    {
      "title": "Winter Wheat - DBW-187 Variety",
      "description": "Perfect for your black soil with pH 7.2. This rust-resistant variety yields 45-50 quintals per acre. Plant before November 20 for best results.",
      "category": "seasonal",
      "confidence": 0.92
    },
    {
      "title": "Chickpea Prices Rising 20%",
      "description": "Market demand for chickpea is high this season. Expected price: ₹6,500/quintal. Your soil is ideal for Kabuli variety.",
      "category": "market",
      "confidence": 0.88
    }
  ]
}` : `{
  "suggestions": [
    {
      "title": "सर्दियों की गेहूं - DBW-187 किस्म",
      "description": "आपकी काली मिट्टी और pH 7.2 के लिए बिल्कुल सही। यह रस्ट-प्रतिरोधी किस्म 45-50 क्विंटल प्रति एकड़ देती है। 20 नवंबर से पहले बुवाई करें।",
      "category": "seasonal",
      "confidence": 0.92
    },
    {
      "title": "चने की कीमत 20% बढ़ रही है",
      "description": "इस सीजन में चने की मांग ज्यादा है। अपेक्षित कीमत: ₹6,500/क्विंटल। आपकी मिट्टी काबुली किस्म के लिए आदर्श है।",
      "category": "market",
      "confidence": 0.88
    }
  ]
}`}

Now generate 4 personalized suggestions for this farmer in JSON format.`;
  }

  private getCurrentSeason(): string {
    const month = new Date().getMonth() + 1;
    if (month >= 11 || month <= 2) return 'Winter (Rabi)';
    if (month >= 3 && month <= 6) return 'Summer (Zaid)';
    return 'Monsoon (Kharif)';
  }

  private parseSuggestions(generatedText: string): Array<{
    title: string;
    description: string;
    category: 'seasonal' | 'soil' | 'market' | 'disease' | 'fertilizer' | 'irrigation' | 'general';
    confidence: number;
  }> {
    try {
      const cleanedText = generatedText.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleanedText);
      
      if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
        return parsed.suggestions.map((s: any) => ({
          title: s.title || 'Crop Suggestion',
          description: s.description || 'No description available',
          category: s.category || 'general',
          confidence: s.confidence || 0.7
        }));
      }
      
      return this.getFallbackSuggestions();
    } catch (error) {
      console.error('Error parsing suggestions:', error);
      return this.getFallbackSuggestions();
    }
  }

  private getFallbackSuggestions(): Array<{
    title: string;
    description: string;
    category: 'seasonal' | 'soil' | 'market' | 'disease' | 'fertilizer' | 'irrigation' | 'general';
    confidence: number;
  }> {
    return [
      {
        title: 'Seasonal Crop Planning',
        description: 'Plan your next crop based on current season and weather conditions. Consult with local agricultural officer for best varieties.',
        category: 'seasonal',
        confidence: 0.6
      },
      {
        title: 'Soil Health Check',
        description: 'Get your soil tested to know nutrient levels. This helps choose the right crop and fertilizer for better yield.',
        category: 'soil',
        confidence: 0.6
      },
      {
        title: 'Market Price Monitoring',
        description: 'Check current market prices before planting. High-demand crops can give better returns this season.',
        category: 'market',
        confidence: 0.6
      },
      {
        title: 'Disease Prevention',
        description: 'Choose disease-resistant crop varieties. Regular monitoring and early treatment can save your crop.',
        category: 'disease',
        confidence: 0.6
      }
    ];
  }
}

// ============================================
// EXPORT SINGLETON
// ============================================

export const cropAdvisoryAI = new CropAdvisoryAI();
