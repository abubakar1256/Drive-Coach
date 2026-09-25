import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

const fallbackCentres = [
  { slug: "brussels-south", name: "Brussels South", city: "Brussels", area: "Anderlecht", region: "Brussels", routes: 12 },
  { slug: "antwerp-north", name: "Antwerp North", city: "Antwerp", area: "Deurne", region: "Antwerp", routes: 9 },
  { slug: "ghent-east", name: "Ghent East", city: "Ghent", area: "Sint-Denijs-Westrem", region: "East Flanders", routes: 8 },
];

@Injectable()
export class ExamCentresService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    try {
      return await this.prisma.examCentre.findMany({ where: { isPublished: true }, include: { _count: { select: { routes: true } } }, orderBy: { name: "asc" } });
    } catch {
      return fallbackCentres;
    }
  }

  async getBySlug(slug: string) {
    try {
      const centre = await this.prisma.examCentre.findFirst({ where: { slug, isPublished: true }, include: { routes: { where: { status: "PUBLISHED" }, include: { points: { orderBy: { sequence: "asc" }, take: 3 } } } } });
      return centre ? { ...centre, routes: centre.routes.map((route) => ({ ...route, points: route.points.map((point) => ({ ...point, imageUrl: null, videoUrl: null })) })) } : null;
    } catch {
      return fallbackCentres.find((centre) => centre.slug === slug) ?? null;
    }
  }
}
