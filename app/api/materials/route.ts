// app/api/materials/route.ts
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import SustainableMaterial from "@/app/models/sustainableMaterial";
import { AuthorizationError, requireRole } from "@/lib/authorization";

export async function GET() {
  try {
    await connectDB();
    const materials = await SustainableMaterial.find().populate('supplier');
    return NextResponse.json(materials);
  } catch (error) {
    console.error("Error fetching materials:", error);
    return NextResponse.json({ error: "Failed to fetch materials" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireRole("admin");
    await connectDB();
    const body = (await req.json()) as Record<string, unknown>;

    const allowedMaterial = {
      name: body.name,
      description: body.description,
      category: body.category,
      price: body.price,
      unit: body.unit,
      availability: body.availability,
      ecoImpact: body.ecoImpact,
      supplier: body.supplier,
    };
    
    const material = await SustainableMaterial.create(allowedMaterial);
    return NextResponse.json(material, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Error creating material:", error);
    return NextResponse.json({ error: "Failed to create material" }, { status: 500 });
  }
}