import { SustainableMaterial } from './types';

export async function fetchRealMaterialsData(): Promise<SustainableMaterial[]> {
  let localMaterials: unknown = [];
  try {
    const localResponse = await fetch('/api/materials');
    if (localResponse.ok) localMaterials = await localResponse.json().catch(() => []);
  } catch {
    // Local material records are optional when the database is unavailable.
  }

  const materials: SustainableMaterial[] = Array.isArray(localMaterials) ? localMaterials : [];
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