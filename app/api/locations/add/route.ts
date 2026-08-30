import { NextResponse } from 'next/server';
import { LocationCollection } from '@/lib/auth/dbc/locations';
import { AuthorizationError, requireRole } from '@/lib/authorization';

export async function POST(request: Request) {
  try {
    await requireRole('admin');
    const body = await request.json();
    const {
      name,
      type,
      address,
      coordinates, // [lng, lat]
      sustainabilityMetrics,
      activeProjects
    } = body;

    // Validate required fields
    if (
      !name || !type || !address ||
      !coordinates || coordinates.length !== 2 ||
      !sustainabilityMetrics || typeof activeProjects !== 'number'
    ) {
      return NextResponse.json(
        { error: 'Missing or invalid fields' },
        { status: 400 }
      );
    }

    const newLocation = await LocationCollection.addLocation({
      name,
      type,
      address,
      coordinates: {
        type: 'Point',
        coordinates
      },
      sustainabilityMetrics,
      activeProjects
    });

    return NextResponse.json({ message: 'Location added', location: newLocation });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Add Location Error:', error);
    return NextResponse.json(
      { error: 'Failed to add location' },
      { status: 500 }
    );
  }
}
