import { SustainableMaterial, Supplier } from './types';

export const DATA_SOURCES = {
  GOV_UK: "https://api.epc.opendatacommunities.org/api/v1/domestic/search",
  OSM_OVERPASS: "https://overpass-api.de/api/interpreter",
  USGS: "https://api.usgs.gov/v1/products",
  OPEN_DATA: "https://world.openfoodfacts.org/api/v2/search",
  OPENLCA: "https://nexus.openlca.org/api/v1/processes",
};

export const INDUSTRY_AVERAGES: Record<string, number> = {
  concrete: 900,
  steel: 1800,  
  wood: 50,
  insulation: 150,
  finishes: 120,
  other: 200
};

export const getIndustryAverageCarbon = async (category: string): Promise<number> => {
  try {
    const response = await fetch(
      `/api/materials/external?source=openlca&category=${encodeURIComponent(category)}`
    );
    
    if (response.ok) {
      const envelope = await response.json();
      const data = envelope.data;
      if (data?.data?.length > 0) {
        const process = data.data[0];
        const gwp = process.exchanges?.find((e: any) => e.flow?.flowType === "PRODUCT")?.amount;
        if (gwp) return gwp * 1000;
      }
    }
  } catch (error) {
    console.log(`Using default carbon data for ${category}`);
  }

  return INDUSTRY_AVERAGES[category] || 200;
};