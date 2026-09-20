// components/ai-insights.tsx
"use client";

import { useState } from "react";
import { 
  Brain, 
  Zap, 
  TrendingUp, 
  AlertTriangle, 
  Lightbulb, 
  BarChart3, 
  Clock,
  ArrowRight,
  Sparkles,
  Shield,
  Leaf,
  Factory,
  Car
} from "lucide-react";

interface AIInsightsProps {
  insights: string[];
  isLoading: boolean;
  carbonData?: any;
}

interface InsightCard {
  type: 'optimization' | 'alert' | 'achievement' | 'prediction';
  priority: 'high' | 'medium' | 'low';
  category: 'energy' | 'transportation' | 'production' | 'lifestyle';
  impact: number; // 1-100 scale
  confidence: number; // 0-100
}

export function AIInsights({ insights, isLoading, carbonData }: AIInsightsProps) {
  const [expandedInsight, setExpandedInsight] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Enhanced insights with metadata
  const enhancedInsights = insights.map((insight, index) => {
    // Analyze insight content to determine type and priority
    const getInsightMetadata = (text: string): InsightCard => {
      const lower = text.toLowerCase();
      let type: InsightCard['type'] = 'optimization';
      let priority: InsightCard['priority'] = 'medium';
      let category: InsightCard['category'] = 'energy';
      let impact = 50;
      let confidence = 85;

      if (lower.includes('alert') || lower.includes('warning') || lower.includes('high')) {
        type = 'alert';
        priority = 'high';
        impact = 75;
      } else if (lower.includes('achievement') || lower.includes('saved') || lower.includes('reduced')) {
        type = 'achievement';
        priority = 'low';
        impact = 30;
      } else if (lower.includes('predict') || lower.includes('forecast') || lower.includes('trend')) {
        type = 'prediction';
        confidence = 92;
      }

      if (lower.includes('transport') || lower.includes('vehicle') || lower.includes('commute')) {
        category = 'transportation';
      } else if (lower.includes('production') || lower.includes('manufacturing')) {
        category = 'production';
      } else if (lower.includes('lifestyle') || lower.includes('habit')) {
        category = 'lifestyle';
      }

      return { type, priority, category, impact, confidence };
    };

    return {
      id: index,
      text: insight,
      timestamp: new Date(Date.now() - (insights.length - index) * 3600000),
      ...getInsightMetadata(insight)
    };
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'alert': return <AlertTriangle className="w-4 h-4" />;
      case 'achievement': return <TrendingUp className="w-4 h-4" />;
      case 'prediction': return <BarChart3 className="w-4 h-4" />;
      default: return <Lightbulb className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'alert': return 'text-red-600 bg-red-100 border-red-200';
      case 'achievement': return 'text-green-600 bg-green-100 border-green-200';
      case 'prediction': return 'text-purple-600 bg-purple-100 border-purple-200';
      default: return 'text-blue-600 bg-blue-100 border-blue-200';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'transportation': return <Car className="w-3 h-3" />;
      case 'production': return <Factory className="w-3 h-3" />;
      case 'lifestyle': return <Leaf className="w-3 h-3" />;
      default: return <Zap className="w-3 h-3" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    const styles = {
      high: 'bg-red-500 text-white',
      medium: 'bg-yellow-500 text-white',
      low: 'bg-green-500 text-white'
    };
    return styles[priority as keyof typeof styles] || styles.medium;
  };

  const filteredInsights = selectedCategory === 'all' 
    ? enhancedInsights 
    : enhancedInsights.filter(insight => insight.category === selectedCategory);

  const categories = [
    { id: 'all', name: 'All Insights', count: enhancedInsights.length },
    { id: 'energy', name: 'Energy', count: enhancedInsights.filter(i => i.category === 'energy').length },
    { id: 'transportation', name: 'Transport', count: enhancedInsights.filter(i => i.category === 'transportation').length },
    { id: 'production', name: 'Production', count: enhancedInsights.filter(i => i.category === 'production').length },
    { id: 'lifestyle', name: 'Lifestyle', count: enhancedInsights.filter(i => i.category === 'lifestyle').length },
  ];

  return (
    <div className="bg-gradient-to-br from-gray-50 to-blue-50/30 p-6 rounded-2xl border border-gray-200/60 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white">
              <div className="w-full h-full bg-green-400 rounded-full animate-pulse" />
            </div>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-800">Carbon insights</h3>
            <p className="text-sm text-gray-600 mt-1">Recommendations based on recorded project activity</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/80 rounded-full border border-gray-200 shadow-sm">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs font-semibold text-gray-700">Activity-based</span>
          <Sparkles className="w-3 h-3 text-yellow-500" />
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              selectedCategory === category.id
                ? 'bg-blue-500 text-white shadow-md'
                : 'bg-white/80 text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {category.id !== 'all' && getCategoryIcon(category.id)}
            <span>{category.name}</span>
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${
              selectedCategory === category.id 
                ? 'bg-white/20 text-white' 
                : 'bg-gray-100 text-gray-600'
            }`}>
              {category.count}
            </span>
          </button>
        ))}
      </div>

      {/* Insights Container */}
      <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
        {isLoading ? (
          // Loading Skeleton
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="animate-pulse bg-white/60 rounded-xl p-4 border border-gray-200/40">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))
        ) : filteredInsights.length > 0 ? (
          filteredInsights.map((insight) => (
            <div
              key={insight.id}
              className={`bg-white/80 backdrop-blur-sm rounded-xl border transition-all duration-300 hover:shadow-md cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
                expandedInsight === insight.id ? 'ring-2 ring-blue-200' : ''
              }`}
              onClick={() => setExpandedInsight(expandedInsight === insight.id ? null : insight.id)}
              role="button"
              tabIndex={0}
              aria-expanded={expandedInsight === insight.id}
              aria-label={`${expandedInsight === insight.id ? "Collapse" : "Expand"} insight: ${insight.text}`}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setExpandedInsight(expandedInsight === insight.id ? null : insight.id);
                }
              }}
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${getTypeColor(insight.type)}`}>
                    {getTypeIcon(insight.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getPriorityBadge(insight.priority)}`}>
                        {insight.priority.toUpperCase()}
                      </span>
                      <span className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full text-xs text-gray-600">
                        {getCategoryIcon(insight.category)}
                        {insight.category}
                      </span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {insight.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-sm text-gray-800 font-medium leading-relaxed">
                      {insight.text}
                    </p>

                    {/* Expanded Details */}
                    {expandedInsight === insight.id && (
                      <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-600">Impact Score</span>
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-green-500 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${insight.impact}%` }}
                            />
                          </div>
                          <span className="font-semibold text-gray-700">{insight.impact}/100</span>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-600">Signal strength</span>
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${insight.confidence}%` }}
                            />
                          </div>
                          <span className="font-semibold text-gray-700">{insight.confidence}%</span>
                        </div>

                        <button className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-semibold hover:bg-blue-100 transition-colors">
                          View Detailed Analysis
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Impact Indicator */}
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 relative">
                      <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
                        <path
                          d="M18 2.0845
                            a 15.9155 15.9155 0 0 1 0 31.831
                            a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#E5E7EB"
                          strokeWidth="3"
                        />
                        <path
                          d="M18 2.0845
                            a 15.9155 15.9155 0 0 1 0 31.831
                            a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke={insight.type === 'alert' ? '#EF4444' : insight.type === 'achievement' ? '#10B981' : '#3B82F6'}
                          strokeWidth="3"
                          strokeDasharray={`${insight.impact}, 100`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-bold text-gray-700">{insight.impact}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          // Empty State
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Brain className="w-8 h-8 text-gray-400" />
            </div>
            <h4 className="text-gray-600 font-medium mb-2">No Insights Available</h4>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              {selectedCategory !== 'all' 
                ? `No ${selectedCategory} insights found. Try selecting a different category.`
                : 'Add carbon activities to generate project recommendations.'
              }
            </p>
          </div>
        )}
      </div>

      {/* Footer Stats */}
      {enhancedInsights.length > 0 && !isLoading && (
        <div className="mt-6 pt-4 border-t border-gray-200/60">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-gray-800">{enhancedInsights.length}</div>
              <div className="text-xs text-gray-600">Total Insights</div>
            </div>
            <div>
              <div className="text-lg font-bold text-green-600">
                {enhancedInsights.filter(i => i.type === 'achievement').length}
              </div>
                <div className="text-xs text-gray-600">Positive signals</div>
            </div>
            <div>
              <div className="text-lg font-bold text-blue-600">
                {enhancedInsights.filter(i => i.priority === 'high').length}
              </div>
              <div className="text-xs text-gray-600">High priority</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
