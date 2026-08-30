import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Site from "@/app/models/site";
import Project from "@/app/models/project";
import CarbonActivity from "@/app/models/CarbonActivity";
import EcoTask from "@/app/models/ecotask";
import {
  AuthorizationError,
  requireAuth,
} from "@/lib/authorization";
import {
  calculateEfficiencyScore,
  calculateActivityTotals,
} from "@/lib/carbonCalculation";
import { fetchEmissionFactors } from "@/lib/emissions";
import { buildCarbonInsights } from "@/lib/carbonInsights";

type ReportRequestBody = {
  siteId?: unknown;
  projectId?: unknown;
  generatedAt?: unknown;
};

type ReportActivity = {
  _id: unknown;
  type: string;
  value: number;
  description?: string;
  sustainableEF?: number;
  standardEF?: number;
  fuelType?: string;
  createdAt: Date;
};

const PAGE_WIDTH = 600;
const PAGE_HEIGHT = 800;
const MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const number = (value: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

const date = (value: Date | string | undefined) =>
  value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Not recorded";

const wrap = (text: string, font: any, size: number, maxWidth: number) => {
  const words = String(text || "").split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
};

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    await connectDB();
    const body = (await req.json()) as ReportRequestBody;

    if (typeof body.siteId !== "string" || !mongoose.isValidObjectId(body.siteId)) {
      return NextResponse.json({ error: "A valid siteId is required" }, { status: 400 });
    }

    const site = await Site.findById(body.siteId).select("_id userId name location projectType size startDate endDate status");
    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }
    if (site.userId !== user.email) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (body.projectId !== undefined) {
      if (typeof body.projectId !== "string" || !mongoose.isValidObjectId(body.projectId)) {
        return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
      }

      const project = await Project.findById(body.projectId).select("_id userId siteId");
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      if (project.userId !== user.email || project.siteId.toString() !== site._id.toString()) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const [projects, activities] = await Promise.all([
      Project.find({ userId: user.email, siteId: site._id }).select("_id name description location startDate endDate").lean(),
      CarbonActivity.find({ userId: user.email, siteId: body.siteId }).sort({ createdAt: 1 }).lean(),
    ]);
    const projectIds = projects.map((project) => project._id);
    const tasks = projectIds.length
      ? await EcoTask.find({ projectId: { $in: projectIds } }).sort({ deadline: 1 }).lean()
      : [];
    const reportActivities = activities as unknown as ReportActivity[];

    const calculationActivities = reportActivities.map((activity) => ({
      id: String(activity._id),
      timestamp: new Date(activity.createdAt).toISOString(),
      description: activity.description ?? "",
      type: activity.type,
      value: activity.value,
      sustainableEF: activity.sustainableEF,
      standardEF: activity.standardEF,
      fuelType: activity.fuelType,
    }));
    const factors = await fetchEmissionFactors();
    const carbonTotals = calculateActivityTotals(calculationActivities, factors);
    const activityTotals = calculationActivities.map((activity) =>
      calculateActivityTotals([activity], factors)
    );
    const trend = calculationActivities.map((activity, index) => ({
      time: activity.timestamp,
      emissions: activityTotals[index].emissions,
      savings: activityTotals[index].savings,
      net: activityTotals[index].emissions - activityTotals[index].savings,
    }));
    const insights = buildCarbonInsights(calculationActivities, factors);

    const carbonData = {
      activities: calculationActivities,
      totalEmissions: carbonTotals.emissions,
      totalSavings: carbonTotals.savings,
      netEmissions: carbonTotals.emissions - carbonTotals.savings,
      trend,
    };
    const efficiencyScore = calculateEfficiencyScore(carbonData);

    // Create a paginated PDF from the selected site's recorded data.
    const pdfDoc = await PDFDocument.create();
    const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let y = PAGE_HEIGHT - MARGIN;
    const addPage = () => { page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]); y = PAGE_HEIGHT - MARGIN; };
    const ensure = (height: number) => { if (y - height < MARGIN + 28) addPage(); };
    const text = (value: string, size = 10, font = regular, color = rgb(0.15, 0.2, 0.25)) => {
      for (const line of wrap(value, font, size, CONTENT_WIDTH)) { ensure(size + 4); page.drawText(line, { x: MARGIN, y, size, font, color }); y -= size + 4; }
    };
    const heading = (value: string) => { ensure(28); y -= 8; page.drawText(value, { x: MARGIN, y, size: 14, font: bold, color: rgb(0.02, 0.4, 0.3) }); y -= 22; };
    const row = (label: string, value: string) => { ensure(18); page.drawText(label, { x: MARGIN, y, size: 10, font: bold }); page.drawText(value, { x: MARGIN + 170, y, size: 10, font: regular }); y -= 17; };
    const footer = () => { page.drawText("JengaSafi | Recorded application data", { x: MARGIN, y: 18, size: 8, font: regular, color: rgb(0.4, 0.4, 0.4) }); };

    page.drawText("JengaSafi", { x: MARGIN, y, size: 12, font: bold, color: rgb(0.02, 0.4, 0.3) }); y -= 28;
    page.drawText("Sustainability Report", { x: MARGIN, y, size: 23, font: bold, color: rgb(0.02, 0.32, 0.25) }); y -= 32;
    text(`Site: ${site.name}`, 13, bold);
    text(`Reporting period: All recorded activity (no date range selected)`, 10);
    text(`Generated by: ${user.email}`, 10);
    text(`Generated at: ${new Date().toLocaleString("en-GB")}`, 10);
    y -= 8;

    heading("Executive Summary");
    row("Total Emissions", `${number(carbonTotals.emissions)} kg CO2`);
    row("Total Carbon Savings", `${number(carbonTotals.savings)} kg CO2`);
    row("Net Emissions", `${number(carbonTotals.emissions - carbonTotals.savings)} kg CO2`);
    row("Efficiency Score", efficiencyScore);
    if (!activities.length) { y -= 4; text("No carbon activity has been recorded for this site during the selected reporting period.", 10, bold); text("Carbon metrics cannot be calculated from absent activity records."); }

    heading("Site and Project Information");
    row("Location", site.location || "Not recorded");
    row("Project type", site.projectType || "Not recorded");
    row("Site status", site.status || "Not recorded");
    row("Site dates", `${date(site.startDate)} – ${date(site.endDate)}`);
    if (projects.length) projects.forEach((project) => { ensure(30); text(`Project: ${project.name}`, 10, bold); if (project.description) text(project.description); });

    heading("Carbon Activity Summary");
    if (activities.length) reportActivities.forEach((activity) => {
      const activityIndex = reportActivities.indexOf(activity);
      const emissions = activityTotals[activityIndex].emissions;
      const savings = activityTotals[activityIndex].savings;
      ensure(66);
      text(`${activity.type} | ${date(activity.createdAt)}`, 10, bold);
      text(`${activity.description || "No description recorded"} | Quantity: ${number(activity.value)} | Emissions: ${number(emissions)} kg CO2 | Savings: ${number(savings)} kg CO2`);
      text(`Data source: Recorded activity${activity.fuelType ? ` | Fuel: ${activity.fuelType}` : ""}`, 9, regular, rgb(0.35, 0.35, 0.35));
    });
    else text("No carbon activity records are available for this site.");

    heading("Emissions Breakdown");
    const breakdown = new Map<string, number>();
    reportActivities.forEach((activity, index) => breakdown.set(activity.type, (breakdown.get(activity.type) || 0) + activityTotals[index].emissions));
    if (breakdown.size) breakdown.forEach((value, category) => row(category, `${number(value)} kg CO2`)); else text("No emissions breakdown is available without recorded activities.");

    heading("Carbon Savings and Data Provenance");
    text(`Recorded activities contributed ${number(carbonTotals.savings)} kg CO2 of calculated carbon savings.`);
    text("Calculations use the application's existing carbon calculation utilities and emission factors. Activity records are identified as Recorded activity; no verification or certification claim is made.");

    heading("Carbon Insights");
    if (insights.length) insights.forEach((insight) => text(insight));
    else text("No carbon insights are available because no activity records were found.");

    heading("Sustainability Actions / EcoTasks");
    if (tasks.length) tasks.forEach((task) => text(`${task.title} | Status: ${task.status} | Deadline: ${date(task.deadline)}${task.actualCarbonSavings ? ` | Actual savings: ${number(task.actualCarbonSavings)} kg CO2` : ""}`));
    else text("No sustainability actions recorded for this reporting period.");

    heading("Report Notes");
    text("This report reflects data recorded in JengaSafi for the selected site. The report has no date-range filter because the current report form does not collect one; all records currently associated with the selected site are included. Missing fields are shown as not recorded rather than inferred.");
    footer();

    // Save PDF and convert to Buffer
    const pdfBytes = await pdfDoc.save();
    const pdfBuffer = Buffer.from(pdfBytes); // <-- convert Uint8Array to Buffer

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=report.pdf",
      },
    });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("Error generating report:", err);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
