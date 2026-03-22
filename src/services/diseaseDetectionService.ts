/**
 * Disease Detection Service - Google Cloud Vision Integration
 * Analyzes crop images to detect diseases, pests, and health issues
 */

import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth-helpers';

const VISION_API_KEY = (import.meta as any).env.VITE_GOOGLE_CLOUD_VISION_API_KEY;
const VISION_API_URL = `https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY}`;

export interface DiseaseDetectionResult {
  disease_name: string;
  confidence: number;
  severity: 'mild' | 'moderate' | 'severe' | 'unknown';
  remedy_suggested: string;
  affected_part: string;
  raw_labels: Array<{ description: string; score: number }>;
  raw_web_entities: Array<{ description: string; score: number }>;
  image_url: string;
}

// Disease knowledge base with remedies
const DISEASE_REMEDIES: Record<string, { remedy: string; severity: string; affected_part: string }> = {
  // Fungal Diseases
  'leaf blight': {
    remedy: 'Apply Mancozeb 2.5g per liter of water. Spray in the evening. Repeat after 10 days. Remove infected leaves.',
    severity: 'moderate',
    affected_part: 'leaves'
  },
  'powdery mildew': {
    remedy: 'Spray sulfur-based fungicide (3g/liter). Ensure good air circulation. Apply neem oil as preventive measure.',
    severity: 'mild',
    affected_part: 'leaves'
  },
  'rust': {
    remedy: 'Use copper-based fungicide (2g/liter). Practice crop rotation. Remove infected plant debris.',
    severity: 'moderate',
    affected_part: 'leaves and stems'
  },
  'anthracnose': {
    remedy: 'Apply Carbendazim 1g/liter. Improve drainage. Avoid overhead irrigation.',
    severity: 'moderate',
    affected_part: 'fruits and leaves'
  },
  'downy mildew': {
    remedy: 'Spray Metalaxyl + Mancozeb (2g/liter). Reduce humidity. Increase plant spacing.',
    severity: 'moderate',
    affected_part: 'leaves'
  },
  'fusarium wilt': {
    remedy: 'No chemical cure. Remove infected plants. Use resistant varieties. Improve soil drainage.',
    severity: 'severe',
    affected_part: 'roots and stems'
  },
  
  // Bacterial Diseases
  'bacterial spot': {
    remedy: 'Apply copper hydroxide (2g/liter). Remove infected leaves. Avoid water splash on leaves.',
    severity: 'moderate',
    affected_part: 'leaves and fruits'
  },
  'bacterial blight': {
    remedy: 'Spray Streptocycline (1g/10 liters). Remove infected parts. Use disease-free seeds.',
    severity: 'severe',
    affected_part: 'leaves and stems'
  },
  
  // Viral Diseases
  'mosaic virus': {
    remedy: 'No cure available. Remove infected plants immediately. Control aphid vectors. Use virus-free seeds.',
    severity: 'severe',
    affected_part: 'leaves'
  },
  'leaf curl': {
    remedy: 'Control whitefly vectors with Imidacloprid (0.5ml/liter). Remove infected leaves. Use resistant varieties.',
    severity: 'severe',
    affected_part: 'leaves'
  },
  
  // Pests
  'aphid': {
    remedy: 'Spray Imidacloprid (0.5ml/liter) or neem oil (5ml/liter). Introduce ladybugs as natural predators.',
    severity: 'mild',
    affected_part: 'leaves and stems'
  },
  'whitefly': {
    remedy: 'Use yellow sticky traps. Spray Thiamethoxam (0.5g/liter). Apply neem oil (5ml/liter).',
    severity: 'moderate',
    affected_part: 'leaves'
  },
  'caterpillar': {
    remedy: 'Apply Bacillus thuringiensis (1g/liter). Hand-pick larvae. Use pheromone traps.',
    severity: 'moderate',
    affected_part: 'leaves and fruits'
  },
  'thrips': {
    remedy: 'Spray Fipronil (1ml/liter). Use blue sticky traps. Maintain field hygiene.',
    severity: 'mild',
    affected_part: 'leaves and flowers'
  },
  'mite': {
    remedy: 'Apply Propargite (2ml/liter). Increase humidity. Use predatory mites.',
    severity: 'mild',
    affected_part: 'leaves'
  },
  
  // Nutrient Deficiencies
  'nitrogen deficiency': {
    remedy: 'Apply urea (10kg/acre) or organic compost. Foliar spray of urea solution (2%).',
    severity: 'mild',
    affected_part: 'leaves'
  },
  'iron deficiency': {
    remedy: 'Apply ferrous sulfate (5g/liter) as foliar spray. Reduce soil pH if alkaline.',
    severity: 'mild',
    affected_part: 'young leaves'
  },
  'magnesium deficiency': {
    remedy: 'Apply Epsom salt (10g/liter) as foliar spray. Add dolomite lime to soil.',
    severity: 'mild',
    affected_part: 'older leaves'
  }
};

/**
 * Upload image to Supabase Storage
 */
export async function uploadImageToSupabase(imageBase64: string): Promise<string | null> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('User not authenticated');
      return null;
    }

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
    const filename = `disease-images/${user.id}/${timestamp}.jpg`;

    console.log('📤 Uploading disease image to Supabase Storage...');

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

    console.log('✅ Disease image uploaded successfully:', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error) {
    console.error('Error in uploadImageToSupabase:', error);
    return null;
  }
}

/**
 * Analyze image using Google Cloud Vision API
 */
export async function analyzeImageWithVision(imageBase64: string): Promise<DiseaseDetectionResult | null> {
  try {
    if (!VISION_API_KEY || VISION_API_KEY === 'your_vision_api_key_here') {
      console.error('❌ Google Cloud Vision API key not configured');
      return null;
    }

    console.log('🔍 Analyzing image with Google Cloud Vision...');

    // Prepare Vision API request
    const requestBody = {
      requests: [
        {
          image: {
            content: imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64
          },
          features: [
            { type: 'LABEL_DETECTION', maxResults: 20 },
            { type: 'WEB_DETECTION', maxResults: 20 },
            { type: 'IMAGE_PROPERTIES' }
          ]
        }
      ]
    };

    // Call Vision API
    const response = await fetch(VISION_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Vision API error:', errorText);
      throw new Error(`Vision API failed: ${response.status}`);
    }

    const data = await response.json();
    const result = data.responses[0];

    if (result.error) {
      console.error('Vision API returned error:', result.error);
      throw new Error(result.error.message);
    }

    // Extract labels and web entities
    const labels = result.labelAnnotations || [];
    const webEntities = result.webDetection?.webEntities || [];

    console.log('📊 Vision API labels:', labels.slice(0, 5).map((l: any) => l.description));
    console.log('🌐 Vision API web entities:', webEntities.slice(0, 5).map((e: any) => e.description));

    // Analyze results to detect disease
    const detection = detectDiseaseFromLabels(labels, webEntities);

    return detection;
  } catch (error) {
    console.error('Error analyzing image with Vision:', error);
    return null;
  }
}

/**
 * Detect disease from Vision API labels and web entities
 */
function detectDiseaseFromLabels(
  labels: Array<{ description: string; score: number }>,
  webEntities: Array<{ description: string; score: number }>
): DiseaseDetectionResult {
  const allTerms = [
    ...labels.map(l => ({ text: l.description.toLowerCase(), score: l.score })),
    ...webEntities.map(e => ({ text: (e.description || '').toLowerCase(), score: e.score || 0 }))
  ];

  console.log('🔍 Analyzing terms for disease detection...');

  // Disease detection keywords
  const diseaseKeywords = [
    'blight', 'mildew', 'rust', 'spot', 'rot', 'wilt', 'disease', 'infection',
    'fungus', 'mold', 'anthracnose', 'mosaic', 'curl', 'bacterial', 'viral',
    'aphid', 'whitefly', 'caterpillar', 'pest', 'insect', 'thrips', 'mite',
    'deficiency', 'chlorosis', 'necrosis', 'lesion', 'canker'
  ];

  // Plant/crop keywords
  const plantKeywords = [
    'leaf', 'leaves', 'plant', 'crop', 'tomato', 'potato', 'wheat', 'rice',
    'corn', 'maize', 'cotton', 'soybean', 'vegetable', 'fruit'
  ];

  // Check for disease indicators
  let detectedDisease: string | null = null;
  let maxScore = 0;
  let affectedPart = 'leaves';

  for (const term of allTerms) {
    // Check if term contains disease keywords
    for (const keyword of diseaseKeywords) {
      if (term.text.includes(keyword)) {
        if (term.score > maxScore) {
          maxScore = term.score;
          detectedDisease = term.text;
        }
      }
    }

    // Detect affected part
    if (term.text.includes('leaf') || term.text.includes('leaves')) {
      affectedPart = 'leaves';
    } else if (term.text.includes('fruit')) {
      affectedPart = 'fruits';
    } else if (term.text.includes('stem')) {
      affectedPart = 'stems';
    } else if (term.text.includes('root')) {
      affectedPart = 'roots';
    }
  }

  // If no specific disease detected, check for general health issues
  if (!detectedDisease) {
    const healthIssues = allTerms.filter(t => 
      t.text.includes('yellow') || t.text.includes('brown') || 
      t.text.includes('dry') || t.text.includes('wilting') ||
      t.text.includes('damage')
    );

    if (healthIssues.length > 0) {
      detectedDisease = 'possible nutrient deficiency or stress';
      maxScore = healthIssues[0].score;
    }
  }

  // Find matching remedy
  let remedy = 'Unable to identify specific disease. Please consult a local agricultural expert or upload a clearer image showing the affected area.';
  let severity: 'mild' | 'moderate' | 'severe' | 'unknown' = 'unknown';

  if (detectedDisease) {
    // Try to match with known diseases
    for (const [diseaseKey, diseaseInfo] of Object.entries(DISEASE_REMEDIES)) {
      if (detectedDisease.includes(diseaseKey)) {
        remedy = diseaseInfo.remedy;
        severity = diseaseInfo.severity as any;
        affectedPart = diseaseInfo.affected_part;
        detectedDisease = diseaseKey;
        break;
      }
    }
  }

  // If still no match, provide general advice
  if (severity === 'unknown' && detectedDisease) {
    remedy = `Possible issue detected: ${detectedDisease}. Recommended actions: 1) Remove affected parts, 2) Improve air circulation, 3) Avoid overhead watering, 4) Apply broad-spectrum fungicide if fungal, 5) Consult local agricultural extension officer.`;
    severity = 'moderate';
  }

  const result: DiseaseDetectionResult = {
    disease_name: detectedDisease || 'Unknown',
    confidence: maxScore,
    severity,
    remedy_suggested: remedy,
    affected_part: affectedPart,
    raw_labels: labels.slice(0, 10).map(l => ({ description: l.description, score: l.score })),
    raw_web_entities: webEntities.slice(0, 10).map(e => ({ description: e.description || '', score: e.score || 0 })),
    image_url: ''
  };

  console.log('✅ Disease detection result:', {
    disease: result.disease_name,
    confidence: Math.round(result.confidence * 100) + '%',
    severity: result.severity
  });

  return result;
}

/**
 * Save disease detection result to database
 */
export async function saveDiseaseLog(
  detection: DiseaseDetectionResult,
  cropCycleId?: number
): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('User not authenticated');
      return false;
    }

    console.log('💾 Saving disease log to database...');

    const { error } = await supabase
      .from('disease_logs')
      .insert({
        user_id: user.id,
        crop_cycle_id: cropCycleId || null,
        detection_date: new Date().toISOString(),
        disease_name: detection.disease_name,
        severity: detection.severity,
        image_s3_url: detection.image_url,
        confidence_score: detection.confidence,
        remedy_suggested: detection.remedy_suggested,
        notes: `Detected via Google Cloud Vision API. Affected: ${detection.affected_part}. Raw labels: ${detection.raw_labels.slice(0, 3).map(l => l.description).join(', ')}`
      });

    if (error) {
      console.error('Error saving disease log:', error);
      return false;
    }

    console.log('✅ Disease log saved successfully');
    return true;
  } catch (error) {
    console.error('Error in saveDiseaseLog:', error);
    return false;
  }
}

/**
 * Complete disease detection workflow
 * 1. Upload image to Supabase
 * 2. Analyze with Vision API
 * 3. Save to database
 */
export async function detectDiseaseFromImage(
  imageBase64: string,
  cropCycleId?: number
): Promise<DiseaseDetectionResult | null> {
  try {
    console.log('🌱 Starting disease detection workflow...');

    // Step 1: Upload image to Supabase
    const imageUrl = await uploadImageToSupabase(imageBase64);
    if (!imageUrl) {
      console.error('Failed to upload image');
      return null;
    }

    // Step 2: Analyze with Vision API
    const detection = await analyzeImageWithVision(imageBase64);
    if (!detection) {
      console.error('Failed to analyze image');
      return null;
    }

    // Add image URL to result
    detection.image_url = imageUrl;

    // Step 3: Save to database
    await saveDiseaseLog(detection, cropCycleId);

    console.log('✅ Disease detection workflow completed');
    return detection;
  } catch (error) {
    console.error('Error in disease detection workflow:', error);
    return null;
  }
}
