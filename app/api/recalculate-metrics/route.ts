// app/api/recalculate-metrics/route.ts
import { NextResponse } from 'next/server';
import { AuthorizationError, requireRole } from '@/lib/authorization';

export async function POST() {
  try {
    await requireRole('admin');
    console.log('♻️ Recalculating metrics...');
    // Add logic to actually recalculate metrics if needed
    return NextResponse.json({ message: 'Recalculation complete' });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error recalculating metrics:', error);
    return NextResponse.json({ error: 'Failed to recalculate metrics' }, { status: 500 });
  }
}
