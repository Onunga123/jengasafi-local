// components/activity-form.tsx
"use client";

import React, { useState, useMemo, useEffect } from "react";
import { authoritativeEmissionFactors } from "@/lib/emissionFactors";
import { getCarbonReductionUnit } from "@/lib/taskCarbonReduction";
import { CarbonActivityType } from "@/types/CarbonActivity";
import { 
  Calculator, 
  Info, 
  Zap, 
  Car, 
  Leaf, 
  Factory, 
  Recycle, 
  Droplets,
  Fuel,
  TrendingUp,
  TrendingDown,
  Sparkles,
  CheckCircle,
  AlertCircle
} from "lucide-react";

interface ActivityFormProps {
  siteId: string;
  taskId?: string;
  measurementPhase?: "baseline" | "post-action";
  measurementActivityType?: CarbonActivityType;
  isInventoryMeasurement?: boolean;
  onActivityAdded: () => void;
  onActivityError: (message?: string) => void;
}

interface NewActivityState {
  type: string;
  value: string;
  description: string;
  fuelType: string;
  sustainableEF: string;
  standardEF: string;
}

export function ActivityForm({
  siteId,
  taskId,
  measurementPhase,
  measurementActivityType,
  isInventoryMeasurement = false,
  onActivityAdded,
  onActivityError,
}: ActivityFormProps) {
  const [newActivity, setNewActivity] = useState<NewActivityState>({
    type: measurementActivityType || "energy",
    value: "",
    description: "",
    fuelType: "grid",
    sustainableEF: "",
    standardEF: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCalculation, setShowCalculation] = useState(false);

  const isTaskMeasurement = Boolean(taskId && measurementPhase && measurementActivityType);
  const isOrdinaryEntry = !isTaskMeasurement && !isInventoryMeasurement;
  const [activityCategory, setActivityCategory] = useState<"emission" | "saving">("emission");

  const emissionActivityTypes = ["energy", "transport", "machinery", "waste", "water"] as const;
  const savingActivityTypes = ["renewable", "material", "recycling", "waterReuse"] as const;

  const activityLabels: Record<string, string> = {
    energy: "Energy use",
    transport: "Transport",
    machinery: "Machinery fuel",
    waste: "Waste to landfill",
    water: "Water consumption",
    renewable: "Renewable energy",
    material: "Sustainable material",
    recycling: "Waste recycled",
    waterReuse: "Water reused",
  };

  useEffect(() => {
    if (!measurementActivityType) return;
    setNewActivity((prev) => ({ ...prev, type: measurementActivityType }));
  }, [measurementActivityType]);

  const selectActivityCategory = (category: "emission" | "saving") => {
    setActivityCategory(category);
    setNewActivity((prev) => ({
      ...prev,
      type: category === "emission" ? emissionActivityTypes[0] : savingActivityTypes[0],
      value: "",
      sustainableEF: "",
      standardEF: "",
    }));
    setShowCalculation(false);
  };

  // Helper functions defined before useMemo
  const getValueLabel = (): string => {
    const unit = getCarbonReductionUnit(newActivity.type as CarbonActivityType) || "unit";
    switch (newActivity.type) {
      case "energy":
      case "renewable":
        return `Energy (${unit})`;
      case "transport":
        return `Distance (${unit})`;
      case "machinery":
        return `Fuel (${unit})`;
      case "waste":
      case "recycling":
        return `Weight (${unit})`;
      case "water":
      case "waterReuse":
        return `Volume (${unit})`;
      case "material":
        return `Quantity (${unit})`;
      default:
        return "Value";
    }
  };

  const getUnit = (): string => {
    return getCarbonReductionUnit(newActivity.type as CarbonActivityType) || "unit";
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "energy":
        return <Zap className="w-4 h-4" />;
      case "transport":
        return <Car className="w-4 h-4" />;
      case "machinery":
        return <Fuel className="w-4 h-4" />;
      case "renewable":
        return <Leaf className="w-4 h-4" />;
      case "material":
        return <Factory className="w-4 h-4" />;
      case "recycling":
        return <Recycle className="w-4 h-4" />;
      case "water":
      case "waterReuse":
        return <Droplets className="w-4 h-4" />;
      default:
        return <Zap className="w-4 h-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    const isEmission = ['energy', 'transport', 'machinery', 'waste', 'water'].includes(type);
    return isEmission ? 'text-red-600' : 'text-green-600';
  };

  // Calculate real-time emissions/savings
  const calculation = useMemo(() => {
    if (!newActivity.value || isNaN(Number(newActivity.value))) {
      return null;
    }

    const value = Number(newActivity.value);
    let emissions = 0;
    let savings = 0;
    let calculationText = "";
    let formula = "";
    const unit = getUnit();

    switch (newActivity.type) {
      case "energy":
        const energyEF = newActivity.fuelType === "diesel"
          ? authoritativeEmissionFactors.energyDiesel
          : authoritativeEmissionFactors.energyGrid;
        emissions = value * energyEF;
        calculationText = `Energy consumption × Emission factor`;
        formula = `${value} ${unit} × ${energyEF} kg CO₂/${unit} = ${emissions.toFixed(2)} kg CO₂`;
        break;

      case "transport":
        const transportEF = authoritativeEmissionFactors.transport;
        emissions = value * transportEF;
        calculationText = `Distance traveled × Transport emission factor`;
        formula = `${value} ${unit} × ${transportEF} kg CO₂/${unit} = ${emissions.toFixed(2)} kg CO₂`;
        break;

      case "machinery":
        const machineryEF = authoritativeEmissionFactors.fuelDiesel;
        emissions = value * machineryEF;
        calculationText = `Fuel consumed × Diesel emission factor`;
        formula = `${value} ${unit} × ${machineryEF} kg CO₂/${unit} = ${emissions.toFixed(2)} kg CO₂`;
        break;

      case "renewable":
        const gridEF = authoritativeEmissionFactors.energyGrid;
        savings = value * gridEF;
        calculationText = `Renewable energy × Grid emission factor avoided`;
        formula = `${value} ${unit} × ${gridEF} kg CO₂/${unit} = ${savings.toFixed(2)} kg CO₂ saved`;
        break;

      case "material":
        if (newActivity.standardEF && newActivity.sustainableEF) {
          const standardEF = Number(newActivity.standardEF);
          const sustainableEF = Number(newActivity.sustainableEF);
          savings = value * (standardEF - sustainableEF);
          calculationText = `Material quantity × (Standard EF - Sustainable EF)`;
          formula = `${value} ${unit} × (${standardEF} - ${sustainableEF}) kg CO₂/${unit} = ${savings.toFixed(2)} kg CO₂ saved`;
        }
        break;

      case "recycling":
        savings = value * authoritativeEmissionFactors.wasteLandfill;
        calculationText = `Waste recycled × Landfill emissions avoided`;
        formula = `${value} ${unit} × ${authoritativeEmissionFactors.wasteLandfill} kg CO₂/${unit} = ${savings.toFixed(2)} kg CO₂ saved`;
        break;

      case "waterReuse":
        savings = value * authoritativeEmissionFactors.water;
        calculationText = `Water reused × Water treatment emissions avoided`;
        formula = `${value} ${unit} × ${authoritativeEmissionFactors.water} kg CO₂/${unit} = ${savings.toFixed(2)} kg CO₂ saved`;
        break;

      case "waste":
        emissions = value * authoritativeEmissionFactors.wasteLandfill;
        calculationText = `Waste to landfill × Landfill emission factor`;
        formula = `${value} ${unit} × ${authoritativeEmissionFactors.wasteLandfill} kg CO₂/${unit} = ${emissions.toFixed(2)} kg CO₂`;
        break;

      case "water":
        emissions = value * authoritativeEmissionFactors.water;
        calculationText = `Water consumed × Water treatment emission factor`;
        formula = `${value} ${unit} × ${authoritativeEmissionFactors.water} kg CO₂/${unit} = ${emissions.toFixed(2)} kg CO₂`;
        break;
    }

    return {
      emissions,
      savings,
      calculationText,
      formula,
      isSaving: savings > 0
    };
  }, [newActivity]);

  const handleInputChange = (field: keyof NewActivityState, value: string) => {
    setNewActivity((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const baseActivity = {
      siteId,
      timestamp: new Date().toISOString(),
      description: newActivity.description || `Carbon ${['renewable', 'material', 'recycling', 'waterReuse'].includes(newActivity.type) ? 'Saving' : 'Emission'}`,
      value: Number(newActivity.value),
    };

    const activityToAdd: any = { ...baseActivity, type: newActivity.type };

    if (isTaskMeasurement) {
      activityToAdd.taskId = taskId;
      activityToAdd.measurementPhase = measurementPhase;
    }

    if (newActivity.type === "energy" || newActivity.type === "machinery") {
      activityToAdd.fuelType = newActivity.fuelType;
    } else if (newActivity.type === "material") {
      activityToAdd.sustainableEF = Number(newActivity.sustainableEF);
      activityToAdd.standardEF = Number(newActivity.standardEF);
    }

    try {
      const response = await fetch('/api/carbon-trends/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activityToAdd),
      });

      if (response.ok) {
        onActivityAdded();
        
        // Reset form
         setNewActivity({
           type: measurementActivityType || "energy",
          value: "",
          description: "",
          fuelType: "grid",
          sustainableEF: "",
          standardEF: "",
        });
        
         setShowCalculation(false);
      } else {
        const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
        onActivityError(typeof payload?.error === "string" ? payload.error : undefined);
      }
    } catch (error) {
      console.error('Failed to add activity:', error);
      onActivityError();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-white to-blue-50/30 p-6 rounded-2xl border border-blue-200/60 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            {isTaskMeasurement
              ? measurementPhase === "baseline"
                ? "Record baseline measurement"
                : "Record post-action measurement"
              : "Log Carbon Activity"}
            <Sparkles className="w-5 h-5 text-blue-500" />
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {isTaskMeasurement
              ? `Enter the actual ${getUnit()} measurement. Carbon impact is calculated by the server.`
              : "Track emissions and savings with real-time calculations"}
          </p>
        </div>
        
        {!isTaskMeasurement && (
          <button
            type="button"
            onClick={() => setShowCalculation(!showCalculation)}
            aria-expanded={showCalculation}
            className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
          >
            <Calculator className="w-4 h-4" />
            {showCalculation ? "Hide calculation details" : "How was this calculated?"}
          </button>
        )}
      </div>

      <form onSubmit={handleAddActivity} className="space-y-6">
        {/* Activity Type */}
        <div className="bg-white/60 rounded-xl p-4 border border-gray-200/40">
          {isOrdinaryEntry ? (
            <>
              <fieldset>
                <legend className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  What are you recording?
                  <Info className="w-3 h-3 text-gray-400" aria-hidden="true" />
                </legend>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => selectActivityCategory("emission")}
                    aria-pressed={activityCategory === "emission"}
                    className={`rounded-lg border p-4 text-left transition-colors ${activityCategory === "emission" ? "border-red-300 bg-red-50 text-red-900 ring-2 ring-red-200" : "border-gray-200 bg-white hover:border-red-200 hover:bg-red-50/50"}`}
                  >
                    <span className="block font-semibold">Emission-producing activity</span>
                    <span className="mt-1 block text-sm text-gray-600">Energy, transport, fuel, waste, or water use.</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => selectActivityCategory("saving")}
                    aria-pressed={activityCategory === "saving"}
                    className={`rounded-lg border p-4 text-left transition-colors ${activityCategory === "saving" ? "border-green-300 bg-green-50 text-green-900 ring-2 ring-green-200" : "border-gray-200 bg-white hover:border-green-200 hover:bg-green-50/50"}`}
                  >
                    <span className="block font-semibold">Carbon-saving activity</span>
                    <span className="mt-1 block text-sm text-gray-600">Renewable energy, materials, recycling, or reuse.</span>
                  </button>
                </div>
              </fieldset>

              <div className="mt-5">
                <label htmlFor="ordinary-activity-type" className="mb-2 block text-sm font-semibold text-gray-800">
                  What activity are you recording?
                </label>
                <select
                  id="ordinary-activity-type"
                  value={newActivity.type}
                  onChange={(e) => handleInputChange("type", e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {(activityCategory === "emission" ? emissionActivityTypes : savingActivityTypes).map((type) => (
                    <option key={type} value={type}>{activityLabels[type]}</option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-gray-500">
                  {activityCategory === "emission"
                    ? "This record contributes to reported project emissions."
                    : "This record represents an activity-derived carbon-saving estimate."
                  }
                </p>
              </div>
            </>
          ) : (
            <>
              <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
                <Zap className="w-4 h-4" />
                Activity Type
                <Info className="w-3 h-3 text-gray-400" aria-hidden="true" />
              </label>
              <select
                value={newActivity.type}
                onChange={(e) => handleInputChange("type", e.target.value)}
                disabled={isSubmitting || isTaskMeasurement}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                required
              >
                <optgroup label="Emissions activities">
                  {emissionActivityTypes.map((type) => <option key={type} value={type}>{activityLabels[type]}</option>)}
                </optgroup>
                <optgroup label="Carbon-saving activities">
                  {savingActivityTypes.map((type) => <option key={type} value={type}>{activityLabels[type]}</option>)}
                </optgroup>
              </select>
              <p className="mt-2 text-xs text-gray-500">
                {isTaskMeasurement
                  ? `This measurement is fixed to the EcoTask activity: ${activityLabels[newActivity.type] || newActivity.type}.`
                  : "Choose the activity that best matches the inventory record."
                }
              </p>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Value Input */}
          <div className="bg-white/60 rounded-xl p-4 border border-gray-200/40">
            <label className="block text-sm font-semibold text-gray-800 mb-3">
              {getValueLabel()}
            </label>
            <input
              type="number"
              step="any"
              value={newActivity.value}
              onChange={(e) => handleInputChange("value", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              min={isTaskMeasurement ? 0 : undefined}
              disabled={isSubmitting}
              placeholder="Enter amount..."
            />
            <p className="text-xs text-gray-500 mt-2">
              {isTaskMeasurement
                ? `Enter the actual measured ${getUnit()} for this ${measurementPhase === "baseline" ? "baseline" : "post-action"} period`
                : "Enter the quantity for this activity"}
            </p>
          </div>

          {/* Conditional Fields */}
          {(newActivity.type === "energy" || newActivity.type === "machinery") && (
            <div className="bg-white/60 rounded-xl p-4 border border-gray-200/40">
              <label className="block text-sm font-semibold text-gray-800 mb-3">
                Fuel / Energy Source
              </label>
              <select
                value={newActivity.fuelType}
                onChange={(e) => handleInputChange("fuelType", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                disabled={isSubmitting}
              >
                <option value="grid">⚡ Grid Electricity</option>
                <option value="diesel">⛽ Diesel Fuel</option>
              </select>
              <p className="text-xs text-gray-500 mt-2">
                Different sources have different emission factors
              </p>
            </div>
          )}

         {newActivity.type === "material" && (
            <>
              <div className="bg-white/60 rounded-xl p-4 border border-gray-200/40">
                <label className="block text-sm font-semibold text-gray-800 mb-3">
                  Standard Material EF (kg CO₂/ton)
                </label>
                <input
                  type="number"
                  step="any"
                  value={newActivity.standardEF}
                  onChange={(e) => handleInputChange("standardEF", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  disabled={isSubmitting}
                  placeholder="e.g., 300 for concrete"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Emission factor for conventional material
                </p>
              </div>
              <div className="bg-white/60 rounded-xl p-4 border border-gray-200/40">
                <label className="block text-sm font-semibold text-gray-800 mb-3">
                  Sustainable Material EF (kg CO₂/ton)
                </label>
                <input
                  type="number"
                  step="any"
                  value={newActivity.sustainableEF}
                  onChange={(e) => handleInputChange("sustainableEF", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  disabled={isSubmitting}
                  placeholder="e.g., 150 for sustainable concrete"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Emission factor for sustainable alternative
                </p>
              </div>
            </>
          )}
        </div>

        {/* Description */}
        <div className="bg-white/60 rounded-xl p-4 border border-gray-200/40">
          <label className="block text-sm font-semibold text-gray-800 mb-3">
            Description (Optional)
          </label>
          <input
            type="text"
            value={newActivity.description}
            onChange={(e) => handleInputChange("description", e.target.value)}
            placeholder="e.g., Concrete delivery, Solar panel output, Equipment fuel consumption..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isSubmitting}
          />
          <p className="text-xs text-gray-500 mt-2">
            Add context to help identify this activity later
          </p>
        </div>

        {/* Real-time Calculation Display */}
        {!isTaskMeasurement && calculation && newActivity.value && (
          <div className={`bg-gradient-to-r ${
            calculation.isSaving 
              ? 'from-green-50 to-emerald-50 border-green-200' 
              : 'from-blue-50 to-cyan-50 border-blue-200'
          } rounded-xl p-4 border`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-gray-600" />
                <h3 className="font-semibold text-gray-800">Real-time Calculation</h3>
              </div>
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                calculation.isSaving 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {calculation.isSaving ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                <span className="font-semibold">
                  {calculation.isSaving 
                    ? `Saving ${calculation.savings.toFixed(2)} kg CO₂`
                    : `Emitting ${calculation.emissions.toFixed(2)} kg CO₂`
                  }
                </span>
              </div>
            </div>

            {showCalculation && (
              <div className="space-y-2 text-sm">
                <p className="text-gray-600">{calculation.calculationText}</p>
                <div className="bg-white rounded-lg p-3 border font-mono">
                  {calculation.formula}
                </div>
                <p className="text-xs text-gray-500">
                  This is an activity-derived estimate using the application&apos;s configured emission factors, not a verified EcoTask actual reduction.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Submit Button */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <CheckCircle className="w-4 h-4 text-green-500" />
            Uses the application&apos;s configured emission factors; saving values are estimates, not verified EcoTask reductions.
          </div>
          
          <button
            type="submit"
            disabled={isSubmitting || !newActivity.value}
            className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Adding Activity...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Add Carbon Activity
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}