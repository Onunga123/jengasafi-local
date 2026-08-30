// components/carbon-activity-log.tsx
"use client";

import { CarbonActivity, calculateEmissions, calculateSavings } from "@/lib/carbonCalculation";
import { useState, useMemo } from "react";
import { 
  Zap, 
  Car, 
  Leaf, 
  Factory, 
  Recycle, 
  Droplets, 
  TrendingUp, 
  TrendingDown,
  Clock,
  Filter,
  Search,
  Download,
  Shield,
  CheckCircle,
  AlertCircle
} from "lucide-react";

interface ActivityLogProps {
  activities: CarbonActivity[];
}

type ActivityType = 'all' | 'energy' | 'transport' | 'renewable' | 'material' | 'recycling' | 'waterReuse';

export function ActivityLog({ activities }: ActivityLogProps) {
  const [selectedType, setSelectedType] = useState<ActivityType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'latest' | 'oldest' | 'highest' | 'lowest'>('latest');

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'energy':
        return <Zap className="w-4 h-4" />;
      case 'transport':
        return <Car className="w-4 h-4" />;
      case 'renewable':
        return <Leaf className="w-4 h-4" />;
      case 'material':
        return <Factory className="w-4 h-4" />;
      case 'recycling':
        return <Recycle className="w-4 h-4" />;
      case 'waterReuse':
        return <Droplets className="w-4 h-4" />;
      default:
        return <Zap className="w-4 h-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'energy':
        return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'transport':
        return 'text-blue-600 bg-blue-100 border-blue-200';
      case 'renewable':
        return 'text-green-600 bg-green-100 border-green-200';
      case 'material':
        return 'text-orange-600 bg-orange-100 border-orange-200';
      case 'recycling':
        return 'text-emerald-600 bg-emerald-100 border-emerald-200';
      case 'waterReuse':
        return 'text-cyan-600 bg-cyan-100 border-cyan-200';
      default:
        return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const getVerificationBadge = (type: string) => {
    switch (type) {
      case 'energy':
        return {
          label: 'Kenya Power',
          color: 'bg-green-100 text-green-700 border-green-200',
          icon: <Shield className="w-3 h-3" />
        };
      case 'transport':
        return {
          label: 'UNFCCC Data',
          color: 'bg-blue-100 text-blue-700 border-blue-200',
          icon: <CheckCircle className="w-3 h-3" />
        };
      case 'renewable':
        return {
          label: 'Verified Green',
          color: 'bg-purple-100 text-purple-700 border-purple-200',
          icon: <Leaf className="w-3 h-3" />
        };
      default:
        return {
          label: 'Site Data',
          color: 'bg-gray-100 text-gray-700 border-gray-200',
          icon: <CheckCircle className="w-3 h-3" />
        };
    }
  };

  // Process and filter activities
  const processedActivities = useMemo(() => {
    let filtered = activities.map(activity => {
      const impact = ['renewable', 'material', 'recycling', 'waterReuse'].includes(activity.type)
        ? -calculateSavings(activity)
        : calculateEmissions(activity);
      
      // Safe date parsing
      let timestamp;
      try {
        timestamp = new Date(activity.timestamp);
        if (isNaN(timestamp.getTime())) {
          timestamp = new Date(); // Fallback to current time if invalid
        }
      } catch {
        timestamp = new Date(); // Fallback to current time if error
      }

      return {
        ...activity,
        impact,
        timestamp,
        isPositive: impact < 0
      };
    });

    // Apply type filter
    if (selectedType !== 'all') {
      filtered = filtered.filter(activity => activity.type === selectedType);
    }

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(activity => 
        activity.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        activity.type.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply sorting
    switch (sortBy) {
      case 'latest':
        filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        break;
      case 'oldest':
        filtered.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        break;
      case 'highest':
        filtered.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
        break;
      case 'lowest':
        filtered.sort((a, b) => Math.abs(a.impact) - Math.abs(b.impact));
        break;
    }

    return filtered;
  }, [activities, selectedType, searchQuery, sortBy]);

  // Calculate summary statistics
  const summary = useMemo(() => {
    const totalEmissions = processedActivities
      .filter(a => !a.isPositive)
      .reduce((sum, a) => sum + a.impact, 0);
    
    const totalSavings = processedActivities
      .filter(a => a.isPositive)
      .reduce((sum, a) => sum + Math.abs(a.impact), 0);

    const netImpact = totalSavings - totalEmissions;

    return {
      totalEmissions,
      totalSavings,
      netImpact,
      activityCount: processedActivities.length
    };
  }, [processedActivities]);

  const activityTypes: { value: ActivityType; label: string; count: number }[] = [
    { value: 'all', label: 'All Activities', count: activities.length },
    { value: 'energy', label: 'Energy', count: activities.filter(a => a.type === 'energy').length },
    { value: 'transport', label: 'Transport', count: activities.filter(a => a.type === 'transport').length },
    { value: 'renewable', label: 'Renewable', count: activities.filter(a => a.type === 'renewable').length },
    { value: 'material', label: 'Material', count: activities.filter(a => a.type === 'material').length },
    { value: 'recycling', label: 'Recycling', count: activities.filter(a => a.type === 'recycling').length },
    { value: 'waterReuse', label: 'Water', count: activities.filter(a => a.type === 'waterReuse').length },
  ];

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return timestamp.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="bg-gradient-to-br from-white to-gray-50/30 p-6 rounded-2xl border border-gray-200/60 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            Carbon Activity Log
            <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              {summary.activityCount} activities
            </span>
          </h3>
          <p className="text-sm text-gray-600 mt-1">Recorded emissions and carbon savings from construction activity</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4 text-sm">
            <div className="text-center">
              <div className="text-lg font-bold text-red-600">{summary.totalEmissions.toFixed(1)}</div>
              <div className="text-xs text-gray-500">Total Emissions</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-600">{summary.totalSavings.toFixed(1)}</div>
              <div className="text-xs text-gray-500">Total Savings</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search activities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="latest">Latest First</option>
            <option value="oldest">Oldest First</option>
            <option value="highest">Highest Impact</option>
            <option value="lowest">Lowest Impact</option>
          </select>
          
          <button className="px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Download className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Activity Type Filter */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {activityTypes.map((type) => (
          <button
            key={type.value}
            onClick={() => setSelectedType(type.value)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              selectedType === type.value
                ? 'bg-blue-500 text-white shadow-sm'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {type.value !== 'all' && getActivityIcon(type.value)}
            <span>{type.label}</span>
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${
              selectedType === type.value 
                ? 'bg-white/20 text-white' 
                : 'bg-gray-100 text-gray-600'
            }`}>
              {type.count}
            </span>
          </button>
        ))}
      </div>

      {/* Activities List */}
      <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
        {processedActivities.length > 0 ? (
          processedActivities.map((activity) => {
            const verification = getVerificationBadge(activity.type);
            
            return (
              <div
                key={activity.id || `${activity.timestamp.toISOString()}-${activity.type}-${activity.value}-${activity.description}`}
                className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200/60 p-4 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${getActivityColor(activity.type)}`}>
                      {getActivityIcon(activity.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-semibold text-gray-800 capitalize">
                          {activity.type}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${verification.color}`}>
                          {verification.icon}
                          {verification.label}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-2 leading-relaxed">
                        {activity.description}
                      </p>

                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimestamp(activity.timestamp)}
                        </span>
                        <span>Value: {activity.value} {activity.unit}</span>
                      </div>
                    </div>
                  </div>

                  {/* Impact */}
                  <div className="text-right ml-4">
                    <div className={`flex items-center gap-1 text-lg font-bold ${
                      activity.isPositive ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {activity.isPositive ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                      {Math.abs(activity.impact).toFixed(2)} kg
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      CO₂ {activity.isPositive ? 'Saved' : 'Emitted'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          // Empty State
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-gray-400" />
            </div>
            <h4 className="text-gray-600 font-medium mb-2">No Activities Found</h4>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              {selectedType !== 'all' 
                ? `No ${selectedType} activities found. Try selecting a different category.`
                : 'No carbon activities recorded yet. Start adding activities to track your emissions.'
              }
            </p>
          </div>
        )}
      </div>

      {/* Footer Summary */}
      {processedActivities.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200/60">
          <div className="flex items-center justify-between text-sm">
            <div className="text-gray-600">
              Showing {processedActivities.length} of {activities.length} activities
            </div>
            <div className={`font-semibold ${
              summary.netImpact < 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              Net Impact: {summary.netImpact.toFixed(2)} kg CO₂
            </div>
          </div>
        </div>
      )}
    </div>
  );
}