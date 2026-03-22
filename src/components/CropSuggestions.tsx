import { useState, useEffect } from 'react';
import { Lightbulb, ThumbsUp, Sprout, Wheat, Leaf, Loader2, Droplets, TrendingUp, Shield } from 'lucide-react';
import { cropAdvisoryAI, FarmerContext } from '../services/cropAdvisoryAI';
import { getActiveSuggestions, createSuggestion, markSuggestionHelpful, type CropSuggestion } from '../lib/crop-suggestions-db';
import { getCurrentUser } from '../lib/auth-helpers';

interface Suggestion {
  id: number;
  title: string;
  description: string;
  category: 'seasonal' | 'soil' | 'market' | 'disease' | 'fertilizer' | 'irrigation' | 'general';
  icon: any;
  isHelpful?: boolean | null;
}

export default function CropSuggestions() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    setIsLoading(true);
    try {
      // Try to load existing suggestions from database
      const existingSuggestions = await getActiveSuggestions();
      
      if (existingSuggestions.length > 0) {
        console.log('📊 Loaded existing suggestions from database');
        setSuggestions(existingSuggestions.map(s => ({
          id: s.suggestion_id,
          title: s.title,
          description: s.description,
          category: s.category,
          icon: getCategoryIcon(s.category),
          isHelpful: s.is_helpful
        })));
      } else {
        // Generate new suggestions if none exist
        await generateNewSuggestions();
      }
    } catch (error) {
      console.error('Error loading suggestions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateNewSuggestions = async () => {
    setIsGenerating(true);
    try {
      console.log('🤖 Generating new AI suggestions...');
      
      // Build farmer context - always use English for suggestions
      const user = await getCurrentUser();
      const farmerContext: FarmerContext = {
        farmerId: user?.id || 'unknown',
        sessionId: `session_${Date.now()}`,
        farmerProfile: {
          preferredLanguage: 'en' // Always use English for crop suggestions
        },
        farmData: {}
      };

      // Generate suggestions using AI
      const aiSuggestions = await cropAdvisoryAI.generateCropSuggestions(farmerContext);
      
      // Save to database
      const savedSuggestions: Suggestion[] = [];
      for (const aiSugg of aiSuggestions) {
        const saved = await createSuggestion({
          title: aiSugg.title,
          description: aiSugg.description,
          category: aiSugg.category,
          confidence_score: aiSugg.confidence,
          crop_context: farmerContext
        });
        
        if (saved) {
          savedSuggestions.push({
            id: saved.suggestion_id,
            title: saved.title,
            description: saved.description,
            category: saved.category,
            icon: getCategoryIcon(saved.category),
            isHelpful: saved.is_helpful
          });
        }
      }
      
      setSuggestions(savedSuggestions);
      console.log('✅ Generated and saved new suggestions');
    } catch (error) {
      console.error('Error generating suggestions:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleHelpful = async (suggestionId: number) => {
    try {
      const success = await markSuggestionHelpful(suggestionId, true);
      if (success) {
        setSuggestions(prev => prev.map(s => 
          s.id === suggestionId ? { ...s, isHelpful: true } : s
        ));
        console.log('✅ Marked as helpful');
      }
    } catch (error) {
      console.error('Error marking as helpful:', error);
    }
  };

  const getCategoryIcon = (category: Suggestion['category']) => {
    switch (category) {
      case 'seasonal':
        return Leaf;
      case 'soil':
        return Wheat;
      case 'market':
        return TrendingUp;
      case 'disease':
        return Shield;
      case 'fertilizer':
        return Sprout;
      case 'irrigation':
        return Droplets;
      default:
        return Lightbulb;
    }
  };

  const getCategoryColor = (category: Suggestion['category']) => {
    switch (category) {
      case 'seasonal':
        return 'bg-blue-100 text-blue-700';
      case 'soil':
        return 'bg-amber-100 text-amber-700';
      case 'market':
        return 'bg-purple-100 text-purple-700';
      case 'disease':
        return 'bg-red-100 text-red-700';
      case 'fertilizer':
        return 'bg-green-100 text-green-700';
      case 'irrigation':
        return 'bg-cyan-100 text-cyan-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getCategoryLabel = (category: Suggestion['category']) => {
    const labels: Record<string, string> = {
      seasonal: 'Seasonal',
      soil: 'Soil Match',
      market: 'Market Trend',
      disease: 'Disease Resistant',
      fertilizer: 'Fertilizer',
      irrigation: 'Water Management',
      general: 'General'
    };
    
    return labels[category] || 'General';
  };

  const getText = (key: string) => {
    const texts: Record<string, string> = {
      title: 'Crop Suggestions',
      subtitle: 'Personalized recommendations for your farm',
      refresh: 'Refresh',
      generating: 'Generating...',
      helpful: 'Helpful',
      markedHelpful: 'Marked Helpful',
      noSuggestions: 'No suggestions yet',
      generatePrompt: 'Generate personalized crop suggestions based on your farm data',
      generateButton: 'Generate Suggestions',
      knowledgeBase: 'Knowledge Base',
      sowingGuide: 'Sowing Guide',
      sowingGuideDesc: 'Step-by-step instructions',
      pestControl: 'Pest Control',
      pestControlDesc: 'Natural remedies'
    };
    
    return texts[key] || key;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-gray-800">{getText('title')}</h2>
          <p className="text-gray-500 text-sm mt-1">
            {getText('subtitle')}
          </p>
        </div>
        {!isLoading && suggestions.length > 0 && (
          <button
            onClick={generateNewSuggestions}
            disabled={isGenerating}
            className="px-4 py-2 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{getText('generating')}</span>
              </>
            ) : (
              <span>{getText('refresh')}</span>
            )}
          </button>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
        </div>
      )}

      {/* Suggestions Grid */}
      {!isLoading && (
        <div className="space-y-4">
          {suggestions.map((suggestion) => {
            const Icon = suggestion.icon;
            return (
              <div
                key={suggestion.id}
                className="bg-white rounded-2xl p-5 border border-green-100 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <Icon className="w-7 h-7 text-green-600" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-gray-800">{suggestion.title}</h3>
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs flex-shrink-0 ${getCategoryColor(
                          suggestion.category
                        )}`}
                      >
                        {getCategoryLabel(suggestion.category)}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed mb-4">
                      {suggestion.description}
                    </p>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleHelpful(suggestion.id)}
                        disabled={suggestion.isHelpful === true}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-full transition-colors text-sm ${
                          suggestion.isHelpful === true
                            ? 'bg-green-100 text-green-700 cursor-default'
                            : 'bg-green-50 text-green-700 hover:bg-green-100'
                        }`}
                      >
                        <ThumbsUp className={`w-4 h-4 ${suggestion.isHelpful === true ? 'fill-current' : ''}`} />
                        <span>{suggestion.isHelpful === true ? getText('markedHelpful') : getText('helpful')}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && suggestions.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center border border-green-100">
          <Lightbulb className="w-12 h-12 text-green-600 mx-auto mb-4" />
          <h3 className="text-gray-700 mb-2">{getText('noSuggestions')}</h3>
          <p className="text-gray-500 text-sm mb-6">
            {getText('generatePrompt')}
          </p>
          <button
            onClick={generateNewSuggestions}
            disabled={isGenerating}
            className="px-6 py-3 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {isGenerating ? getText('generating') : getText('generateButton')}
          </button>
        </div>
      )}

      {/* Knowledge Base Cards */}
      <div className="pt-4">
        <h3 className="text-gray-700 mb-3">{getText('knowledgeBase')}</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-4 border border-green-200">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center mb-3">
              <Sprout className="w-5 h-5 text-green-600" />
            </div>
            <h4 className="text-gray-800 text-sm mb-1">{getText('sowingGuide')}</h4>
            <p className="text-gray-600 text-xs">{getText('sowingGuideDesc')}</p>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-4 border border-blue-200">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center mb-3">
              <Leaf className="w-5 h-5 text-blue-600" />
            </div>
            <h4 className="text-gray-800 text-sm mb-1">{getText('pestControl')}</h4>
            <p className="text-gray-600 text-xs">{getText('pestControlDesc')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
