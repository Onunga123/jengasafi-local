"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { 
  User, 
  Mail, 
  Building, 
  Target, 
  Leaf, 
  Zap, 
  Recycle,
  Edit3,
  Award,
  BarChart3
} from "lucide-react";

interface ProfileDisplayProps {
  clientData: any;
  session: any;
  onEdit: () => void;
}

export function ProfileDisplay({ clientData, session, onEdit }: ProfileDisplayProps) {
  const focusAreas = [
    { id: "energy", label: "Energy Efficiency", icon: Zap, color: "text-yellow-600" },
    { id: "materials", label: "Sustainable Materials", icon: Leaf, color: "text-green-600" },
    { id: "waste", label: "Waste Management", icon: Recycle, color: "text-blue-600" },
    { id: "water", label: "Water Conservation", icon: "💧", color: "text-cyan-600" },
    { id: "transport", label: "Transport & Logistics", icon: "🚚", color: "text-orange-600" },
    { id: "biodiversity", label: "Biodiversity", icon: "🌿", color: "text-emerald-600" }
  ];

  const getFocusAreaIcon = (areaId: string) => {
    const area = focusAreas.find(a => a.id === areaId);
    if (!area) return null;
    
    if (typeof area.icon === "string") {
      return <span className="text-lg">{area.icon}</span>;
    }
    return <area.icon className="w-4 h-4" />;
  };

  return (
    <motion.div
      className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 max-w-6xl mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h2 className="text-3xl font-bold text-emerald-700 mb-2">
            Welcome back, {clientData.name}! 🌱
          </h2>
          <p className="text-gray-600 text-lg">
            Your sustainability journey at a glance
          </p>
        </div>
        <button
          onClick={onEdit}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl transition-all duration-200 hover:shadow-lg"
        >
          <Edit3 className="w-4 h-4" />
          Edit Profile
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Personal Information */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-6 border border-emerald-100">
            <h3 className="text-xl font-semibold text-emerald-800 mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Personal Information
            </h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                <Mail className="w-4 h-4 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-medium text-gray-900">{clientData.email}</p>
                </div>
              </div>
              
              {clientData.company && (
                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                  <Building className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-600">Company</p>
                    <p className="font-medium text-gray-900">{clientData.company}</p>
                  </div>
                </div>
              )}
              
              {clientData.role && (
                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                  <Award className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-600">Role</p>
                    <p className="font-medium text-gray-900">{clientData.role}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sustainability Goals */}
          {clientData.sustainabilityGoals && (
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-100">
              <h3 className="text-xl font-semibold text-blue-800 mb-4 flex items-center gap-2">
                <Target className="w-5 h-5" />
                Sustainability Goals
              </h3>
              <p className="text-gray-700 leading-relaxed bg-white p-4 rounded-lg border border-blue-200">
                {clientData.sustainabilityGoals}
              </p>
            </div>
          )}
        </div>

        {/* Targets & Focus Areas */}
        <div className="space-y-6">
          {/* Carbon Reduction Target */}
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-6 border border-orange-100">
            <h3 className="text-xl font-semibold text-orange-800 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Carbon Reduction Target
            </h3>
            <div className="text-center">
              <div className="text-5xl font-bold text-orange-600 mb-2">
                {clientData.reductionTarget}%
              </div>
              <p className="text-gray-600">Target emissions reduction</p>
            </div>
            <div className="mt-4 w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-orange-500 h-3 rounded-full transition-all duration-1000"
                style={{ width: `${(clientData.reductionTarget / 50) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>10%</span>
              <span>50%</span>
            </div>
          </div>

          {/* Focus Areas */}
          {clientData.focusAreas && clientData.focusAreas.length > 0 && (
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-100">
              <h3 className="text-xl font-semibold text-purple-800 mb-4 flex items-center gap-2">
                <Leaf className="w-5 h-5" />
                Focus Areas
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {clientData.focusAreas.map((areaId: string) => {
                  const area = focusAreas.find(a => a.id === areaId);
                  if (!area) return null;
                  
                  return (
                    <div
                      key={areaId}
                      className="flex items-center gap-2 p-3 bg-white rounded-lg border border-purple-200"
                    >
                      <div className={`${area.color}`}>
                        {getFocusAreaIcon(areaId)}
                      </div>
                      <span className="text-sm font-medium text-gray-700">
                        {area.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

    </motion.div>
  );
}