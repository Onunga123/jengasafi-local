import { NextResponse } from 'next/server';
import { LocationCollection } from '@/lib/auth/dbc/locations';
import { AuthorizationError, requireRole } from '@/lib/authorization';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  try {
    const type = searchParams.get('type');
    const lat = parseFloat(searchParams.get('lat')!);
    const lng = parseFloat(searchParams.get('lng')!);
    const radius = parseInt(searchParams.get('radius') || '5000');

    let data;
    if (!isNaN(lat) && !isNaN(lng)) {
      data = await LocationCollection.getLocationsWithinRadius([lng, lat], radius);
    } else if (type) {
      data = await LocationCollection.getLocationsByType(type);
    } else {
      data = await LocationCollection.getHighImpactLocations();
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('[GET /api/locations] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireRole('admin');
    const body = await req.json();

    const newLocation = await LocationCollection.addLocation({
      name: body.name,
      type: body.type,
      address: body.address,
      coordinates: body.coordinates,
      sustainabilityMetrics: {
        carbonImpact: body.sustainabilityMetrics.carbonImpact,
        energyUsage: body.sustainabilityMetrics.energyUsage,
      },
      activeProjects: body.activeProjects,
    });

    return NextResponse.json({ success: true, location: newLocation });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[POST /api/locations] Error:', error);
    return NextResponse.json({ error: 'Failed to create location' }, { status: 500 });
  }
}
