"use client";
import { motion, AnimatePresence } from "framer-motion";
import { SustainableMaterial, SortOption } from "@/lib/materials/types";

interface MaterialsGridProps {
  materials: SustainableMaterial[];
  sortBy: SortOption;
  onMaterialSelect: (
    material: SustainableMaterial & { potentialSavings?: number }
  ) => void;
  personalizedRecommendations: SustainableMaterial[];
  userMetrics: any;
}

export function MaterialsGrid({
  materials,
  sortBy,
  onMaterialSelect,
  personalizedRecommendations,
  userMetrics,
}: MaterialsGridProps) {
  const getSortLabel = (sortBy: SortOption) => {
    switch (sortBy) {
      case "carbon":
        return "Lowest Carbon";
      case "price":
        return "Lowest Price";
      case "rating":
        return "Highest Rating";
      case "recommended":
        return "Recommended";
      default:
        return "Recommended";
    }
  };

  const getCarbonRating = (carbonFootprint: number) => {
    if (carbonFootprint < 100)
      return { label: "Excellent", color: "text-green-600 bg-green-50" };
    if (carbonFootprint < 300)
      return { label: "Good", color: "text-blue-600 bg-blue-50" };
    if (carbonFootprint < 500)
      return { label: "Average", color: "text-yellow-600 bg-yellow-50" };
    return { label: "High", color: "text-red-600 bg-red-50" };
  };

  const getAvailabilityColor = (availability: string) => {
    switch (availability) {
      case "high":
        return "text-green-600 bg-green-50";
      case "medium":
        return "text-yellow-600 bg-yellow-50";
      case "low":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const isRecommended = (material: SustainableMaterial) => {
    return personalizedRecommendations.some((rec) => rec.id === material.id);
  };

  if (materials.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-12"
      >
        <div className="text-muted-foreground text-lg">
          No materials found matching your criteria
        </div>
        <div className="text-sm text-muted-foreground mt-2">
          Try adjusting your filters or search term
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Results Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            {materials.length} Materials Found
          </h2>
          <p className="text-muted-foreground text-sm">
            Sorted by {getSortLabel(sortBy)}
          </p>
        </div>

        {personalizedRecommendations.length > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-foreground font-medium">
              {personalizedRecommendations.length} personalized recommendations
            </span>
          </div>
        )}
      </div>

      {/* Materials Grid */}
      <AnimatePresence>
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {materials.map((material, index) => (
              <motion.div
                key={material.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className={`group relative bg-white border rounded-xl shadow-sm overflow-hidden transform transition-all duration-200 ${
                  isRecommended(material)
                    ? "border-green-300 ring-2 ring-green-100"
                    : "border-border hover:shadow-md"
                }`}
              >
                <button
                  type="button"
                  aria-label={`Select ${material.name}`}
                  onClick={() => onMaterialSelect(material)}
                  className="absolute inset-0 z-10 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-inset"
                />
                {/* Recommendation Badge */}
                {isRecommended(material) && (
                  <div className="bg-green-500 text-white text-xs font-medium px-3 py-1 text-center">
                    🌟 Recommended for your project
                  </div>
                )}

                <div className="pointer-events-none relative z-0 p-5">
                  {/* Header */}
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-semibold text-foreground text-lg leading-tight">
                      {material.name}
                    </h3>
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-primary/10 text-primary">
                      {material.category}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                    {material.description}
                  </p>

                  {/* Carbon Footprint */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-foreground">
                      Carbon Footprint
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">
                        {material.ecoImpact.carbonFootprint} kg CO₂
                      </span>
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                          getCarbonRating(material.ecoImpact.carbonFootprint)
                            .color
                        }`}
                      >
                        {
                          getCarbonRating(material.ecoImpact.carbonFootprint)
                            .label
                        }
                      </span>
                    </div>
                  </div>

                  {/* Additional Eco Metrics */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {material.ecoImpact.waterUsage && (
                      <div className="text-center p-2 bg-blue-50 rounded-lg">
                        <div className="text-xs text-blue-600">💧 Water</div>
                        <div className="text-sm font-semibold text-blue-800">
                          {material.ecoImpact.waterUsage}L
                        </div>
                      </div>
                    )}
                    {material.ecoImpact.recyclability && (
                      <div className="text-center p-2 bg-green-50 rounded-lg">
                        <div className="text-xs text-green-600">
                          ♻️ Recyclable
                        </div>
                        <div className="text-sm font-semibold text-green-800">
                          {material.ecoImpact.recyclability}%
                        </div>
                      </div>
                    )}
                    {material.ecoImpact.renewable && (
                      <div className="text-center p-2 bg-yellow-50 rounded-lg">
                        <div className="text-xs text-yellow-600">
                          🌱 Renewable
                        </div>
                        <div className="text-sm font-semibold text-yellow-800">
                          Yes
                        </div>
                      </div>
                    )}
                    {material.ecoImpact.local && (
                      <div className="text-center p-2 bg-purple-50 rounded-lg">
                        <div className="text-xs text-purple-600">📍 Local</div>
                        <div className="text-sm font-semibold text-purple-800">
                          Yes
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Supplier & Price */}
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        {material.supplier?.name || "Unknown Supplier"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {material.supplier?.location ||
                          "Location not specified"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-foreground">
                        ${material.cost}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        per {material.unit}
                      </div>
                    </div>
                  </div>

                  {/* Availability & Certifications */}
                  <div className="flex justify-between items-center pt-3 border-t border-border">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full ${getAvailabilityColor(
                        material.availability
                      )}`}
                    >
                      {material.availability} availability
                    </span>
                    <div className="flex gap-1">
                      {material.certifications
                        ?.slice(0, 2)
                        .map((cert: string, idx: number) => (
                          <span
                            key={idx}
                            className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                          >
                            {cert}
                          </span>
                        ))}
                      {material.certifications &&
                        material.certifications.length > 2 && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                            +{material.certifications.length - 2}
                          </span>
                        )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      </AnimatePresence>
    </div>
  );
}
