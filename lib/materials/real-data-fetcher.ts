import { SustainableMaterial } from './types';

const SOURCE_ENDPOINT = '/api/materials/external';
type SourceEnvelope = { source: string; data?: any; error?: string };

async function fetchSource(source: string): Promise<SourceEnvelope> {
  const response = await fetch(`${SOURCE_ENDPOINT}?source=${source}`);
  const envelope = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(envelope.error || `${source} is unavailable`);
  return envelope;
}

export async function fetchRealMaterialsData(): Promise<SustainableMaterial[]> {
  let localMaterials: unknown = [];
  try {
    const localResponse = await fetch('/api/materials');
    if (localResponse.ok) localMaterials = await localResponse.json().catch(() => []);
  } catch {
    // Local material records are optional when the database is unavailable.
  }

  const results = await Promise.allSettled(['epc', 'usgs', 'openfoodfacts'].map(fetchSource));
  const materials: SustainableMaterial[] = Array.isArray(localMaterials) ? localMaterials : [];
  const value = (index: number) => results[index].status === 'fulfilled' ? results[index].value.data : undefined;

  value(0)?.rows?.slice(0, 10).forEach((property: any) => materials.push({
    id: crypto.randomUUID(), availability: 'medium',
    name: `Building Material - ${property.property_type || 'Construction'}`,
    description: 'Construction information from the EPC external dataset', category: getPropertyCategory(property), cost: property.construction_age_band ? 100 : 150, unit: 'ton',
    ecoImpact: { carbonFootprint: Number(property.co2_emissions_current) || 150, waterUsage: 50, recyclability: 70, renewable: false, local: true },
    supplier: { id: 'epc-source', name: 'EPC external dataset', location: property.address || 'United Kingdom', rating: 4.2, certifications: [] }, technicalSpecs: {},
  }));

  value(1)?.products?.slice(0, 5).forEach((product: any) => {
    if (!product.name || !isConstructionMaterial(product.name)) return;
    materials.push({ id: crypto.randomUUID(), availability: 'high', name: `USGS ${product.name}`, description: 'Mineral commodity information from the USGS external dataset', category: mapUsgsToCategory(product.name), cost: 0, unit: 'ton', ecoImpact: { carbonFootprint: 0, waterUsage: 0, recyclability: 0, renewable: false, local: false }, supplier: { id: 'usgs-source', name: 'USGS external dataset', location: 'United States', rating: 4, certifications: [] }, technicalSpecs: {} });
  });

  value(2)?.products?.forEach((product: any) => {
    if (!product.product_name) return;
    materials.push({ id: crypto.randomUUID(), availability: 'low', name: product.product_name, description: 'Product information retrieved from Open Food Facts', category: 'other', cost: 0, unit: 'unit', ecoImpact: { carbonFootprint: 0, waterUsage: 0, recyclability: 0, renewable: false, local: false }, supplier: { id: 'openfoodfacts-source', name: 'Open Food Facts', location: 'Global', rating: 0, certifications: [] }, technicalSpecs: {} });
  });
  if (materials.length === 0) throw new Error('All Materials external sources are unavailable');
  return materials;
}

const getPropertyCategory = (property: any): SustainableMaterial['category'] => {
  const type = String(property.property_type || '').toLowerCase();
  if (type.includes('detached') || type.includes('semi')) return 'concrete';
  if (type.includes('flat') || type.includes('apartment')) return 'steel';
  if (type.includes('terraced')) return 'wood';
  return 'other';
};
const isConstructionMaterial = (name: string): boolean => ['cement', 'steel', 'copper', 'aluminum', 'clay', 'sand', 'gravel', 'stone'].some((item) => name.toLowerCase().includes(item));
const mapUsgsToCategory = (name: string): SustainableMaterial['category'] => {
  const value = name.toLowerCase();
  if (value.includes('cement')) return 'concrete';
  if (value.includes('steel')) return 'steel';
  if (value.includes('copper') || value.includes('aluminum')) return 'finishes';
  return 'other';
};