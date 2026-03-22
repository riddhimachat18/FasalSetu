# FasalSetu - Complete Project Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Features](#features)
3. [Setup & Installation](#setup--installation)
4. [Architecture](#architecture)
5. [Technology Stack](#technology-stack)
6. [Database Schema](#database-schema)
7. [API Integration](#api-integration)
8. [Voice Features](#voice-features)
9. [Disease Detection](#disease-detection)
10. [Troubleshooting](#troubleshooting)

---

## Project Overview

### What is FasalSetu?
FasalSetu is an AI-powered farming assistant designed for Indian farmers. It provides intelligent farming advice, disease detection, weather alerts, and crop management tools in multiple regional languages.

### Target Users
- Small and medium-scale farmers in India
- Agricultural extension workers
- Farming communities

### Key Objectives
- Democratize access to farming knowledge
- Reduce crop losses through early disease detection
- Provide personalized farming advice
- Support regional languages for better accessibility

---

## Features

### 1. AI Chatbot
**Description**: Conversational AI assistant powered by Google Gemini

**Capabilities**:
- Text, voice, and image input
- Context-aware responses (weather, soil, crop history, location)
- Multi-language support (6+ languages)
- Chat history persistence
- Real-time farming advice

**How It Works**:
1. User asks question (text/voice/image)
2. System builds context from user profile, location, weather, soil data
3. Gemini AI processes query with full context
4. Response generated in user's language
5. Option for voice output

### 2. Voice Features

**Voice Input (Speech-to-Text)**:
- Web Speech API integration
- Supports 6 regional languages
- Real-time transcription
- Browser-based (no server processing)

**Voice Output (Text-to-Speech)**:
- Chirp 3 HD voices
- 8 voice profiles (male/female for each language)
- Customizable speed (0.5x - 2.0x)
- Customizable volume (0% - 100%)
- Customizable pitch (0.5 - 2.0)

**Available Voices**:
- Hindi: Dr. Priya (F), Arjun (M)
- English: Sarah (F), Raj (M)
- Marathi: Rohan (M), Priya (F)
- Tamil: Kavya (F)
- Telugu: Vikram (M)
- Kannada: Deepa (F)

**Voice Settings**:
- Enable/disable toggle
- Voice profile selection
- Speed, volume, pitch controls
- Test voice button
- Save settings button

### 3. Disease Detection

**Technology**: Gemini Vision AI

**Process**:
1. Farmer captures/uploads crop image
2. Selects crop type
3. AI analyzes image for diseases
4. Provides detailed diagnosis:
   - Disease name
   - Severity level (mild/moderate/severe)
   - Symptoms description
   - Treatment recommendations
   - Prevention tips
   - Organic and chemical control options

**Features**:
- Image storage in Supabase
- Disease history tracking
- Automatic crop status update
- Multi-language results
- Confidence scoring

### 4. Crop Management

**Crop Log**:
- Add new crop cycles
- Track sowing date
- Monitor crop phases (sowing, germination, vegetative, flowering, fruiting, harvesting)
- Update crop health status
- View active and past crops
- Days since sowing counter

**Crop Status**:
- Healthy
- Diseased
- Harvested
- Failed

**Integration**:
- Links with disease detection
- Used in AI context building
- Historical data for recommendations

### 5. Weather Alerts

**Data Source**: OpenWeather API

**Features**:
- Real-time weather data
- 7-day forecast
- Temperature and humidity
- Rainfall predictions
- Farming-specific alerts
- GPS-based location

**Display**:
- Current conditions
- Daily forecast
- Weather warnings
- Irrigation recommendations

### 6. Crop Suggestions

**AI-Powered Recommendations**:
- Best crops for region
- Seasonal suggestions
- Soil-based recommendations
- Market demand analysis
- Expected yield predictions

**Factors Considered**:
- Location and climate
- Soil properties (pH, NPK, texture)
- Current season
- Historical data
- User preferences
- Weather patterns

### 7. Soil Data Integration

**Data Source**: SoilGrids API

**Soil Properties**:
- Soil type
- pH level
- NPK values (Nitrogen, Phosphorus, Potassium)
- Organic carbon content
- Cation Exchange Capacity (CEC)
- Soil texture
- Bulk density

**Usage**:
- Automatic fetching based on GPS
- Stored in database
- Used for AI recommendations
- Crop suitability analysis

### 8. Geolocation Services

**Features**:
- Browser GPS integration
- Location-based weather
- Soil data retrieval
- Regional recommendations

**Privacy**:
- User consent required
- Stored locally and in database
- Can be updated anytime

### 9. Multi-language Support

**Supported Languages**:
1. English (Indian)
2. Hindi (हिंदी)
3. Marathi (मराठी)
4. Tamil (தமிழ்)
5. Telugu (తెలుగు)
6. Kannada (ಕನ್ನಡ)
7. Hinglish (Mixed Hindi-English)

**Language Features**:
- UI translation
- AI responses in selected language
- Voice input/output
- Settings persistence
- Seamless switching

### 10. Settings

**Available Settings**:
- Language selection
- Voice configuration
- Location update
- Soil data fetch
- Account management (logout)

**Persistence**:
- localStorage for client settings
- Database for user preferences
- Synced across sessions

---

## Setup & Installation

### Prerequisites
```
- Node.js 18+
- npm or yarn
- Supabase account
- Google Gemini API key
- Modern browser (Chrome/Edge recommended)
```

### Installation Steps

**1. Clone Repository**
```bash
git clone <repository-url>
cd FasalSetu_New
```

**2. Install Dependencies**
```bash
npm install
```

**3. Environment Variables**
Create `.env` file:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GEMINI_API_KEY=your_gemini_api_key
```

**4. Database Setup**
Run SQL scripts in Supabase SQL Editor (in order):
```sql
1. supabase-setup.sql
2. CREATE_CROP_SUGGESTIONS_TABLE.sql
3. ADD_MISSING_COLUMNS.sql
4. add-location-columns.sql
5. fix-rls-policies.sql
6. FIX_DISEASE_LOGS_TABLE.sql
```

**5. Supabase Storage**
Create storage bucket:
- Name: `disease-images`
- Public access: Enabled
- File size limit: 5MB

**6. Run Development Server**
```bash
npm run dev
```

Visit: `http://localhost:5173`

**7. Build for Production**
```bash
npm run build
npm run preview
```

---

## Architecture

### System Architecture

**Frontend Layer**:
- React 18 + TypeScript
- Vite build tool
- TailwindCSS for styling
- Lucide icons

**Components**:
- HomePage.tsx - Main dashboard
- Chatbot.tsx - AI chat interface
- CropLog.tsx - Crop management
- DiseaseDetectionTest.tsx - Disease detection
- CropSuggestions.tsx - AI recommendations
- Settings.tsx - App settings
- CalendarAlerts.tsx - Weather alerts

**Service Layer**:
- cropAdvisoryAI.ts - Gemini AI integration
- voiceService.ts - Voice I/O
- diseaseDetectionService.ts - Disease detection
- weatherService.ts - Weather API
- soilService.ts - Soil data
- geolocationService.ts - GPS services

**Library Functions**:
- supabase.ts - Supabase client
- auth-helpers.ts - Authentication
- crop-db.ts - Crop database operations
- soil-db.ts - Soil database operations
- user-location.ts - Location management

**Backend (Supabase)**:
- PostgreSQL database
- Authentication (email/password)
- Storage (images)
- Row Level Security (RLS)

**AI/ML Layer**:
- Google Gemini AI (text + vision)
- Web Speech API (STT)
- Chirp 3 TTS

**External APIs**:
- OpenWeather API
- SoilGrids API
- Browser Geolocation API

### Data Flow

**User Input → AI Response**:
```
User Input (Text/Voice/Image)
  ↓
Context Building:
  - User Profile
  - Location (GPS)
  - Weather Data
  - Soil Properties
  - Crop History
  - Current Crop Status
  ↓
Gemini AI Processing
  ↓
Response Generation (in user's language)
  ↓
Output (Text/Voice)
  ↓
Save to Database
```

**Disease Detection Flow**:
```
Image Upload
  ↓
Crop Type Selection
  ↓
Upload to Supabase Storage
  ↓
Gemini Vision AI Analysis
  ↓
Disease Identification:
  - Name
  - Severity
  - Symptoms
  - Treatment
  - Prevention
  ↓
Save to disease_logs table
  ↓
Update Crop Status
  ↓
Notify User
```

---

## Technology Stack

### Frontend
- **Framework**: React 18
- **Language**: TypeScript
- **Build Tool**: Vite
- **Styling**: TailwindCSS
- **Icons**: Lucide React
- **UI Components**: Custom + shadcn/ui

### Backend
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage
- **Real-time**: Supabase Realtime (optional)

### AI/ML
- **Text AI**: Google Gemini 1.5 Pro
- **Vision AI**: Google Gemini Vision
- **Voice Input**: Web Speech API
- **Voice Output**: Chirp 3 TTS

### External Services
- **Weather**: OpenWeather API
- **Soil Data**: SoilGrids REST API
- **Geolocation**: Browser Geolocation API

### Development Tools
- **Package Manager**: npm
- **Version Control**: Git
- **Code Editor**: VS Code (recommended)
- **Browser DevTools**: Chrome DevTools

---

## Database Schema

### Tables

**1. users**
```sql
- id (uuid, primary key)
- email (text)
- created_at (timestamp)
- location_latitude (numeric)
- location_longitude (numeric)
- location_city (text)
- location_state (text)
- location_country (text)
```

**2. crop_cycles**
```sql
- crop_id (serial, primary key)
- user_id (uuid, foreign key)
- crop_name (text)
- sowing_date (date)
- current_phase (text)
- is_active (boolean)
- health_status (text)
- notes (text)
- created_at (timestamp)
```

**3. disease_logs**
```sql
- log_id (serial, primary key)
- user_id (uuid, foreign key)
- crop_cycle_id (integer, foreign key)
- detection_date (timestamp)
- disease_name (text)
- severity (text)
- image_s3_url (text)
- confidence_score (numeric)
- remedy_suggested (text)
- notes (text)
```

**4. soil_data**
```sql
- soil_id (serial, primary key)
- user_id (uuid, foreign key)
- latitude (numeric)
- longitude (numeric)
- soil_type (text)
- ph (numeric)
- nitrogen (numeric)
- phosphorus (numeric)
- potassium (numeric)
- organic_carbon (numeric)
- cec (numeric)
- texture (text)
- bulk_density (numeric)
- fetched_at (timestamp)
```

**5. crop_suggestions**
```sql
- suggestion_id (serial, primary key)
- user_id (uuid, foreign key)
- suggested_crop (text)
- season (text)
- reason (text)
- expected_yield (text)
- market_demand (text)
- created_at (timestamp)
```

### Row Level Security (RLS)

All tables have RLS policies:
```sql
-- Users can only access their own data
CREATE POLICY "Users can view own data"
ON table_name FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own data"
ON table_name FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own data"
ON table_name FOR UPDATE
USING (auth.uid() = user_id);
```

---

## API Integration

### Google Gemini AI

**Configuration**:
```typescript
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ 
  model: "gemini-1.5-pro" 
});
```

**Text Generation**:
```typescript
const result = await model.generateContent(prompt);
const response = result.response.text();
```

**Vision Analysis**:
```typescript
const result = await model.generateContent([
  prompt,
  { inlineData: { data: base64Image, mimeType: "image/jpeg" } }
]);
```

### OpenWeather API

**Endpoint**: `https://api.openweathermap.org/data/2.5/weather`

**Request**:
```typescript
const response = await fetch(
  `${API_URL}?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`
);
```

### SoilGrids API

**Endpoint**: `https://rest.isric.org/soilgrids/v2.0/properties/query`

**Request**:
```typescript
const response = await fetch(
  `${API_URL}?lon=${lon}&lat=${lat}&property=phh2o&property=nitrogen&depth=0-5cm`
);
```

### Supabase

**Client Setup**:
```typescript
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
```

**Database Query**:
```typescript
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('user_id', userId);
```

**Storage Upload**:
```typescript
const { data, error } = await supabase.storage
  .from('disease-images')
  .upload(filePath, file);
```

---

## Voice Features

### Voice Service Implementation

**Speech Recognition (Voice Input)**:
```typescript
const recognition = new webkitSpeechRecognition();
recognition.lang = 'hi-IN'; // or other language
recognition.continuous = false;
recognition.interimResults = false;

recognition.onresult = (event) => {
  const transcript = event.results[0][0].transcript;
  // Use transcript
};

recognition.start();
```

**Speech Synthesis (Voice Output)**:
```typescript
const utterance = new SpeechSynthesisUtterance(text);
utterance.lang = 'hi-IN';
utterance.rate = 1.0;
utterance.volume = 0.8;
utterance.pitch = 1.0;

// Select voice
const voices = speechSynthesis.getVoices();
const selectedVoice = voices.find(v => v.lang === 'hi-IN');
utterance.voice = selectedVoice;

speechSynthesis.speak(utterance);
```

### Voice Settings Storage

**localStorage Keys**:
```typescript
- voice_enabled: "true" | "false"
- selected_voice_id: "priya-professional" | "raj-friendly" | etc.
- voice_speed: "0.5" to "2.0"
- voice_volume: "0.0" to "1.0"
- voice_pitch: "0.5" to "2.0"
```

---

## Disease Detection

### Implementation

**Image Processing**:
```typescript
// Convert image to base64
const reader = new FileReader();
reader.onloadend = () => {
  const base64 = reader.result.split(',')[1];
  // Send to Gemini Vision AI
};
reader.readAsDataURL(file);
```

**AI Analysis**:
```typescript
const prompt = `Analyze this ${cropName} image for diseases. 
Provide: disease name, severity, symptoms, treatment, prevention.`;

const result = await model.generateContent([
  prompt,
  { inlineData: { data: base64Image, mimeType: "image/jpeg" } }
]);
```

**Database Storage**:
```typescript
const { data, error } = await supabase
  .from('disease_logs')
  .insert({
    user_id: userId,
    crop_cycle_id: cropId,
    disease_name: diseaseName,
    severity: severity,
    image_s3_url: imageUrl,
    confidence_score: 0.85,
    remedy_suggested: remedy
  });
```

---

## Troubleshooting

### Common Issues

**1. Voice Not Working**
- Use Chrome or Edge browser
- Check microphone permissions
- Install language packs (Windows Settings)
- Verify device volume

**2. Database Errors**
- Check Supabase URL and keys
- Verify RLS policies
- Ensure user is authenticated
- Check table structure

**3. API Errors**
- Verify API keys in .env
- Check API quotas
- Ensure internet connection
- Check API endpoint URLs

**4. Image Upload Fails**
- Check file size (< 5MB)
- Verify storage bucket exists
- Check file format (JPEG/PNG)
- Ensure storage permissions

**5. Location Not Working**
- Enable location permissions
- Use HTTPS (required)
- Check GPS is enabled
- Try manual location update

### Debug Commands

**Check Voice Availability**:
```javascript
speechSynthesis.getVoices().forEach(v => 
  console.log(v.name, v.lang)
);
```

**Test Database Connection**:
```javascript
const { data, error } = await supabase
  .from('users')
  .select('*')
  .limit(1);
console.log(data, error);
```

**Clear All Settings**:
```javascript
localStorage.clear();
location.reload();
```

---

## Browser Compatibility

### Recommended
- ✅ Chrome 90+ (Desktop & Mobile)
- ✅ Edge 90+ (Desktop & Mobile)
- ✅ Safari 14.5+ (iOS)

### Limited Support
- ⚠️ Firefox (no speech recognition)
- ⚠️ Safari Desktop (limited voice features)

### Not Supported
- ❌ Internet Explorer
- ❌ Browsers older than 2020

---

## Deployment

### Production Build
```bash
npm run build
```

### Hosting Options
- **Vercel** (recommended)
- **Netlify**
- **GitHub Pages**
- **Firebase Hosting**

### Environment Variables
Set in hosting platform:
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_GEMINI_API_KEY
```

### Domain Configuration
- HTTPS required (for geolocation)
- CORS configured in Supabase
- API keys secured

---

## Security

### Authentication
- Supabase Auth (JWT tokens)
- Email/password authentication
- Session management
- Secure token storage

### Data Protection
- Row Level Security (RLS)
- User data isolation
- Encrypted connections (HTTPS)
- API key protection

### Privacy
- Location: User consent required
- Voice: Not stored, processed locally
- Images: Stored with permission
- Data: User-owned, can be deleted

---

## Future Enhancements

### Planned Features
- [ ] Offline mode
- [ ] Push notifications
- [ ] Market price integration
- [ ] Community forum
- [ ] Video tutorials
- [ ] Expert consultation
- [ ] Crop insurance integration
- [ ] Government scheme alerts

### Technical Improvements
- [ ] Progressive Web App (PWA)
- [ ] Service workers
- [ ] Caching strategies
- [ ] Performance optimization
- [ ] Accessibility improvements
- [ ] Unit tests
- [ ] E2E tests

---

**Last Updated**: November 23, 2025  
**Version**: 1.0  
**Project**: FasalSetu - AI-Powered Farming Assistant
