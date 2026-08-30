"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { SustainableMaterial, Supplier } from "@/types";
import { fetchRealMaterialsData } from "@/lib/materials/real-data-fetcher";

interface MaterialsHubProps {
  onMaterialSelect?: (material: SustainableMaterial) => void;
  siteId: string;
}

interface UserCarbonMetrics {
  totalEmissions: number;
  totalSavings: number;
  netEmissions: number;
  reductionTarget: number;
  highImpactCategories: string[];
}

// Industry estimates are used when the optional external LCA source is not configured.
const getIndustryAverageCarbon = async (category: string): Promise<number> => {
  // Base industry averages (kg CO2 per unit)
  const industryAverages: Record<string, number> = {
    concrete: 900,    // kg CO2 per ton
    steel: 1800,      // kg CO2 per ton  
    wood: 50,         // kg CO2 per ton
    insulation: 150,  // kg CO2 per m3
    finishes: 120,    // kg CO2 per m2
    other: 200
  };

  return industryAverages[category] || 200;
};

// Helper functions for data processing
const getMaterialCategoryFromProperty = (property: any): SustainableMaterial['category'] => {
  const type = property.property_type?.toLowerCase() || '';
  if (type.includes('detached') || type.includes('semi')) return 'concrete';
  if (type.includes('flat') || type.includes('apartment')) return 'steel';
  if (type.includes('terraced')) return 'brick';
  return 'other';
};

const calculateMaterialPrice = (property: any): number => {
  const base = property.construction_age_band ? 100 : 150;
  return base + (Math.random() * 200);
};

const isConstructionMaterial = (name: string): boolean => {
  const materials = ['cement', 'steel', 'copper', 'aluminum', 'clay', 'sand', 'gravel', 'stone'];
  return materials.some(material => name.toLowerCase().includes(material));
};

const mapUsgsToCategory = (name: string): SustainableMaterial['category'] => {
  if (name.toLowerCase().includes('cement')) return 'concrete';
  if (name.toLowerCase().includes('steel')) return 'steel';
  if (name.toLowerCase().includes('copper') || name.toLowerCase().includes('aluminum')) return 'finishes';
  return 'other';
};

const getOpenLCADemoData = (): any[] => {
  return [
    {
      name: "Low-Carbon Concrete Mix",
      description: "Concrete with reduced clinker content using industrial by-products",
      category: "concrete",
      price: 120,
      unit: "ton",
      ecoImpact: {
        carbonFootprint: 650,
        waterUsage: 140,
        recyclability: 85,
        renewable: false,
        local: true,
      },
      supplier: {
        name: "GreenBuild Materials Ltd",
        location: "Nairobi, Kenya",
        rating: 4.5,
        certification: ["ISO 14001", "LEED"]
      }
    },
    {
      name: "Recycled Steel Beams",
      description: "Structural steel from 95% recycled content with EAF production",
      category: "steel",
      price: 850,
      unit: "ton",
      ecoImpact: {
        carbonFootprint: 950,
        waterUsage: 25,
        recyclability: 98,
        renewable: false,
        local: false,
      },
      supplier: {
        name: "EcoSteel International",
        location: "Mombasa, Kenya",
        rating: 4.3,
        certification: ["ISO 14001", "EPD"]
      }
    },
    {
      name: "Bamboo Structural Timber",
      description: "Fast-growing bamboo for structural applications, sustainably harvested",
      category: "wood",
      price: 75,
      unit: "ton",
      ecoImpact: {
        carbonFootprint: 25,
        waterUsage: 15,
        recyclability: 90,
        renewable: true,
        local: true,
      },
      supplier: {
        name: "Bamboo Solutions Africa",
        location: "Kisumu, Kenya",
        rating: 4.7,
        certification: ["FSC", "PEFC"]
      }
    },
    {
      name: "Cellulose Fiber Insulation",
      description: "Recycled newspaper insulation with borate fire treatment",
      category: "insulation",
      price: 45,
      unit: "m3",
      ecoImpact: {
        carbonFootprint: 35,
        waterUsage: 8,
        recyclability: 95,
        renewable: true,
        local: true,
      },
      supplier: {
        name: "EcoInsulate Kenya",
        location: "Nakuru, Kenya",
        rating: 4.4,
        certification: ["Cradle to Cradle"]
      }
    },
    {
      name: "Low-VOC Natural Paints",
      description: "Plant-based paints with zero volatile organic compounds",
      category: "finishes",
      price: 28,
      unit: "liter",
      ecoImpact: {
        carbonFootprint: 45,
        waterUsage: 12,
        recyclability: 85,
        renewable: true,
        local: false,
      },
      supplier: {
        name: "Natural Coatings Co.",
        location: "Eldoret, Kenya",
        rating: 4.6,
        certification: ["EU Ecolabel", "Green Seal"]
      }
    }
  ];
};

// Safe data access with defaults
const getMaterialCarbonFootprint = (material: any): number => {
  return material?.ecoImpact?.carbonFootprint ?? 
         material?.carbonFootprint ?? 
         material?.gwpA1A3 ?? 
         200;
};

const getMaterialCategory = (material: any): SustainableMaterial['category'] => {
  const category = material?.category?.toLowerCase() || 'other';
  const allowedCategories: SustainableMaterial['category'][] = ['concrete', 'steel', 'wood', 'insulation', 'finishes', 'other'];
  return allowedCategories.includes(category as any) ? category as SustainableMaterial['category'] : 'other';
};

const getMaterialSupplier = (material: any): Supplier | undefined => {
  if (!material.supplier) return undefined;
  
  return {
    _id: material.supplier._id || material.supplier.id || 'unknown',
    name: material.supplier.name || 'Unknown Supplier',
    location: material.supplier.location || 'Unknown',
    contact: material.supplier.contact || '',
    email: material.supplier.email || '',
    phone: material.supplier.phone || '',
    rating: material.supplier.rating || 3.0,
    certification: material.supplier.certification || material.supplier.certifications || []
  };
};

export default function MaterialsHub({ onMaterialSelect, siteId }: MaterialsHubProps) {
  const [materials, setMaterials] = useState<SustainableMaterial[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [userMetrics, setUserMetrics] = useState<UserCarbonMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"carbon" | "price" | "rating" | "recommended">("recommended");
  const [estimatedQuantity, setEstimatedQuantity] = useState<number>(1000);
  const [industryAverages, setIndustryAverages] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchUserMetrics();
    fetchRealMaterials(); // Now using real data sources
    loadIndustryAverages();
  }, [siteId]);

  const loadIndustryAverages = async () => {
    const categories = ['concrete', 'steel', 'wood', 'insulation', 'finishes', 'other'];
    const averages: Record<string, number> = {};
    
    const values = await Promise.all(
      categories.map((category) => getIndustryAverageCarbon(category))
    );
    categories.forEach((category, index) => {
      averages[category] = values[index];
    });
    
    setIndustryAverages(averages);
  };

  const fetchUserMetrics = async () => {
    try {
      const response = await fetch(`/api/carbon-trends?siteId=${siteId}`);
      const carbonData = await response.json();
      
      setUserMetrics({
        totalEmissions: carbonData.totalEmissions || 0,
        totalSavings: carbonData.totalSavings || 0,
        netEmissions: carbonData.netEmissions || 0,
        reductionTarget: 25,
        highImpactCategories: await analyzeHighImpactCategories(siteId)
      });
    } catch (error) {
      console.error("Error fetching user metrics:", error);
      setUserMetrics({
        totalEmissions: 0,
        totalSavings: 0,
        netEmissions: 0,
        reductionTarget: 25,
        highImpactCategories: ["concrete", "steel", "insulation"]
      });
    }
  };

  const analyzeHighImpactCategories = async (siteId: string): Promise<string[]> => {
    try {
      const response = await fetch(`/api/activities?siteId=${siteId}`);
      const activities = await response.json();
      
      const categoryEmissions: Record<string, number> = {};
      activities.forEach((activity: any) => {
        if (activity.category) {
          categoryEmissions[activity.category] = (categoryEmissions[activity.category] || 0) + (activity.emissions || 0);
        }
      });
      
      return Object.entries(categoryEmissions)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([category]) => category);
    } catch (error) {
      return ["concrete", "steel", "insulation"];
    }
  };

  const fetchRealMaterials = async () => {
    try {
      setLoading(true);
      const realMaterials = await fetchRealMaterialsData();
      
      // Validate and transform the data
      const validatedMaterials = Array.isArray(realMaterials) ? realMaterials.map(validateMaterial) : [];
      setMaterials(validatedMaterials.length > 0 ? validatedMaterials : getOpenLCADemoData().map(validateMaterial));
      
    } catch {
      // External providers are optional and can be unavailable independently of
      // the application. Keep the materials workflow usable with the local demo
      // catalog rather than displaying an empty page.
      setError("Live material data sources are temporarily unavailable. Showing the built-in reference catalog.");
      setMaterials(getOpenLCADemoData().map(validateMaterial));
    } finally {
      setLoading(false);
    }
  };

  // Data validation function with proper typing
  const validateMaterial = (material: any): SustainableMaterial => {
    const supplier = getMaterialSupplier(material);
  
    const validatedMaterial: SustainableMaterial = {
      _id: material._id || material.id || `material-${Math.random().toString(36).substr(2, 9)}`,
      name: material.name || 'Unnamed Material',
      description: material.description || 'No description available',
      category: getMaterialCategory(material),
      price: Number(material.price) || 0,
      unit: material.unit || 'unit',
      availability: material.availability || 'medium',
      ecoImpact: {
        carbonFootprint: getMaterialCarbonFootprint(material),
        waterUsage: material?.ecoImpact?.waterUsage || material?.waterUsage || 0,
        recyclability: material?.ecoImpact?.recyclability || material?.recyclability || 50,
        renewable: material?.ecoImpact?.renewable || false,
        local: material?.ecoImpact?.local || false,
      },
      supplier,
      supplierId: supplier?._id || "unknown",
      certification: material.certification || [],
    };
  
    return validatedMaterial;
  };

  const calculateRecommendationScore = (material: SustainableMaterial): number => {
    if (!userMetrics) return 50;

    let score = 0;
    
    try {
      // Carbon savings potential (40% weight)
      const industryAvg = industryAverages[material.category] || getIndustryAverageCarbon(material.category);
      const carbonFootprint = material.ecoImpact.carbonFootprint;
      const carbonSavings = Number(industryAvg) - Number(carbonFootprint);
      const carbonScore = Math.max(0, (carbonSavings / Number(industryAvg)) * 40);
      score += carbonScore;
      
      // Match with user's high-impact categories (30% weight)
      if (userMetrics.highImpactCategories.includes(material.category)) {
        score += 30;
      }
      
      // Supplier reliability (20% weight)
      score += (material.supplier?.rating || 3) * 4;
      
      // Local sourcing bonus (10% weight)
      if (material.ecoImpact.local) {
        score += 10;
      }
    } catch (error) {
      console.error("Error calculating recommendation score:", error);
      score = 50;
    }
    
    return Math.min(100, Math.max(0, score));
  };

  // Safe filtered materials with validation
  const filteredMaterials = (materials || [])
    .filter((material) => {
      if (!material) return false;
      
      const matchesCategory = selectedCategory === "all" || material.category === selectedCategory;
      const matchesSearch = searchTerm === "" || 
        material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        material.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        material.supplier?.name?.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesCategory && matchesSearch;
    })
    .map(material => {
      const carbonFootprint = material.ecoImpact.carbonFootprint;
      const industryAvg = industryAverages[material.category] || getIndustryAverageCarbon(material.category);
      
      return {
        ...material,
        recommendationScore: calculateRecommendationScore(material),
        potentialSavings: (Number(industryAvg) - carbonFootprint) * estimatedQuantity,
        industryAverage: industryAvg
      };
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "recommended":
          return (b.recommendationScore || 0) - (a.recommendationScore || 0);
        case "carbon":
          return a.ecoImpact.carbonFootprint - b.ecoImpact.carbonFootprint;
        case "price":
          return a.price - b.price;
        case "rating":
          return (b.supplier?.rating || 0) - (a.supplier?.rating || 0);
        default:
          return 0;
      }
    });

  const handleMaterialSelect = async (material: SustainableMaterial & { potentialSavings?: number }) => {
    try {
      const category = material.category;
      const carbonFootprint = material.ecoImpact.carbonFootprint;
      const industryAvg = industryAverages[category] || await getIndustryAverageCarbon(category);
      const carbonSaved = material.potentialSavings || (industryAvg - carbonFootprint) * estimatedQuantity;

      await fetch('/api/carbon-trends/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: "material_savings",
          value: estimatedQuantity,
          sustainableEF: carbonFootprint,
          standardEF: industryAvg,
          description: `Used sustainable ${material.name} from ${material.supplier?.name || 'unknown supplier'}`,
          siteId: siteId,
          category: category,
          savings: carbonSaved
        })
      });

      if (userMetrics) {
        setUserMetrics({
          ...userMetrics,
          totalSavings: userMetrics.totalSavings + carbonSaved,
          netEmissions: Math.max(0, userMetrics.netEmissions - carbonSaved)
        });
      }

      alert(`✅ Saved ${carbonSaved.toFixed(0)} kg CO₂ by choosing ${material.name}!`);
      
      if (onMaterialSelect) {
        onMaterialSelect(material);
      }
    } catch (error) {
      console.error("Error saving carbon data:", error);
      alert("Material selected, but error saving carbon data");
    }
  };

  const getPriorityCategories = (): string[] => {
    return userMetrics?.highImpactCategories || ["concrete", "steel", "insulation"];
  };

  const getPersonalizedRecommendations = () => {
    return filteredMaterials
      .filter(material => getPriorityCategories().includes(material.category))
      .slice(0, 3);
  };

  const categories = ["all", "concrete", "steel", "wood", "insulation", "finishes", "other"];

  const getEcoImpactColor = (carbonFootprint: number) => {
    if (carbonFootprint < 50) return "bg-emerald-100 text-emerald-800";
    if (carbonFootprint < 150) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const getRecommendationBadge = (score: number) => {
    if (score >= 80) return { text: "Highly Recommended", color: "bg-emerald-500 text-white" };
    if (score >= 60) return { text: "Recommended", color: "bg-blue-500 text-white" };
    return { text: "Good Option", color: "bg-gray-500 text-white" };
  };

  if (loading) {
    return (
      <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-4">Loading sustainable materials from open data sources...</p>
          <p className="text-sm text-muted-foreground mt-2">Fetching from Ecoinvent, UNEP, and Open Government datasets</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
        <div className="text-center py-12 text-destructive">
          <p>Error: {error}</p>
          <button
            onClick={fetchRealMaterials}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md mt-4"
          >
            Retry materials search
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
      {/* Header with Data Source Info */}
      <div className="mb-8">
        <div className="flex justify-between items-start mb-2">
          <h2 className="text-2xl font-bold text-foreground">
            Sustainable Materials Hub
          </h2>
          <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
            External and estimated sources
          </div>
        </div>
        <p className="text-muted-foreground">
          Sourcing eco-friendly materials from Ecoinvent, UNEP LCA, and Open Government datasets
        </p>
        
        {userMetrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            <div className="bg-muted/30 p-3 rounded-lg">
              <div className="text-sm text-muted-foreground">Net Emissions</div>
              <div className="text-lg font-semibold">{userMetrics.netEmissions.toFixed(0)} kg CO₂</div>
            </div>
            <div className="bg-muted/30 p-3 rounded-lg">
              <div className="text-sm text-muted-foreground">Reduction Target</div>
              <div className="text-lg font-semibold text-emerald-600">{userMetrics.reductionTarget}%</div>
            </div>
            <div className="bg-muted/30 p-3 rounded-lg">
              <div className="text-sm text-muted-foreground">Focus Areas</div>
              <div className="text-lg font-semibold">
                {getPriorityCategories().slice(0, 2).join(", ")}
              </div>
            </div>
            <div className="bg-muted/30 p-3 rounded-lg">
              <div className="text-sm text-muted-foreground">Available Materials</div>
              <div className="text-lg font-semibold">{materials.length}</div>
            </div>
          </div>
        )}
      </div>

      {/* Rest of your existing JSX remains the same */}
      {/* Filters */}
      <div className="bg-muted/30 p-4 rounded-lg border border-border mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Category</label>
            <select
              className="w-full px-3 py-2 border border-border rounded-md bg-background"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Sort By</label>
            <select
              className="w-full px-3 py-2 border border-border rounded-md bg-background"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="recommended">Recommended</option>
              <option value="carbon">Lowest Carbon</option>
              <option value="price">Lowest Price</option>
              <option value="rating">Supplier Rating</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-foreground mb-1">Search</label>
            <input
              type="text"
              placeholder="Search materials, suppliers, or descriptions..."
              className="w-full px-3 py-2 border border-border rounded-md bg-background"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Quantity</label>
            <input
              type="number"
              value={estimatedQuantity}
              onChange={(e) => setEstimatedQuantity(Number(e.target.value))}
              className="w-full px-3 py-2 border border-border rounded-md bg-background"
              min="1"
            />
          </div>
        </div>
      </div>

      {/* Data Source Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-blue-900 mb-2 flex items-center">
          🌍 Carbon information and provenance
        </h3>
        <p className="text-blue-800 text-sm">
          Material carbon information may come from external datasets or industry estimates. Review the source details for each material before using it as project evidence.
        </p>
      </div>

      {/* Personalized Recommendations Banner */}
      {userMetrics && getPersonalizedRecommendations().length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2 flex items-center">
            💡 Personalized Recommendations
          </h3>
          <p className="text-blue-800 text-sm">
            Based on your project data, we recommend focusing on <strong>{getPriorityCategories().join(", ")}</strong> materials. 
            These categories represent your highest impact areas where sustainable choices will make the biggest difference.
          </p>
        </div>
      )}

      {/* Materials Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredMaterials.map((material) => {
          const recommendation = getRecommendationBadge(material.recommendationScore);
          const carbonFootprint = material.ecoImpact.carbonFootprint;
          
          return (
            <motion.div
              key={material._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-background border border-border rounded-lg p-4 hover:shadow-md transition-shadow relative"
            >
              {/* Recommendation Badge */}
              {sortBy === "recommended" && (
                <div className={`absolute -top-2 -right-2 px-2 py-1 rounded-full text-xs ${recommendation.color}`}>
                  {recommendation.text}
                </div>
              )}

              <div className="flex justify-between items-start mb-3">
                <h3 className="font-semibold text-foreground text-lg">{material.name}</h3>
                <span className="px-2 py-1 rounded-full text-xs bg-gray-100 capitalize">
                  {material.category}
                </span>
              </div>

              <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                {material.description}
              </p>

              {/* Potential Savings Highlight */}
              <div className="bg-emerald-50 border border-emerald-200 rounded p-2 mb-3">
                <div className="text-xs text-emerald-800 font-medium">Potential Carbon Savings</div>
                <div className="text-sm font-bold text-emerald-900">
                  {material.potentialSavings.toFixed(0)} kg CO₂
                </div>
                <div className="text-xs text-emerald-700">
                  vs industry average: {material.industryAverage} kg CO₂
                </div>
              </div>

              {/* Eco Impact Metrics */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Carbon Footprint:</span>
                  <span className={`px-2 py-1 rounded text-xs ${getEcoImpactColor(carbonFootprint)}`}>
                    {carbonFootprint} kg CO₂/{material.unit}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Water Usage:</span>
                  <span className="text-sm font-medium">
                    {material.ecoImpact.waterUsage} L/{material.unit}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Recyclability:</span>
                  <span className="text-sm font-medium">
                    {material.ecoImpact.recyclability}%
                  </span>
                </div>
              </div>

              {/* Supplier Info */}
              {material.supplier && (
                <div className="border-t border-border pt-3 mb-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-foreground">
                      {material.supplier.name}
                    </span>
                    <div className="flex items-center">
                      <span className="text-yellow-500 text-sm">★</span>
                      <span className="text-sm text-muted-foreground ml-1">
                        {material.supplier.rating?.toFixed(1) || 'N/A'}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{material.supplier.location}</p>
                  {(material.supplier.email || material.supplier.phone) && (
                    <p className="text-xs text-muted-foreground">
                      {material.supplier.phone || material.supplier.email}
                    </p>
                  )}
                </div>
              )}

              {/* Price and Action */}
              <div className="flex justify-between items-center pt-3 border-t border-border">
                <div>
                  <span className="text-2xl font-bold text-foreground">
                    KES {material.price.toLocaleString()}
                  </span>
                  <span className="text-sm text-muted-foreground ml-1">/{material.unit}</span>
                </div>
                
                <button
                  onClick={() => handleMaterialSelect(material)}
                  className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm hover:bg-primary/90 transition-colors"
                >
                  Select
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredMaterials.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="text-muted-foreground mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No materials found</h3>
          <p className="text-muted-foreground">
            {searchTerm || selectedCategory !== "all" 
              ? "Try adjusting your search or filters."
              : "No sustainable materials available yet."
            }
          </p>
        </div>
      )}

      {/* Stats Summary */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-muted/30 p-4 rounded-lg border border-border">
          <div className="text-2xl font-bold text-foreground">{materials.length}</div>
          <div className="text-sm text-muted-foreground">Sustainable Materials</div>
        </div>
        <div className="bg-muted/30 p-4 rounded-lg border border-border">
          <div className="text-2xl font-bold text-foreground">
            {Math.min(...materials.map(m => m.ecoImpact.carbonFootprint))}
          </div>
          <div className="text-sm text-muted-foreground">Lowest Carbon Footprint</div>
        </div>
        <div className="bg-muted/30 p-4 rounded-lg border border-border">
          <div className="text-2xl font-bold text-emerald-600">
            {userMetrics?.reductionTarget || 25}%
          </div>
          <div className="text-sm text-muted-foreground">Your Reduction Target</div>
        </div>
        <div className="bg-muted/30 p-4 rounded-lg border border-border">
          <div className="text-2xl font-bold text-blue-600">
            {getPersonalizedRecommendations().length}
          </div>
          <div className="text-sm text-muted-foreground">Personalized Picks</div>
        </div>
      </div>
    </div>
  );
} 