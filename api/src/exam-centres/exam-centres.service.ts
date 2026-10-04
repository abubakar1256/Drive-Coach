import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { officialCentres } from "./official-centres";

const fallbackCentres = officialCentres.map((centre) => ({ ...centre, routes: 0 }));

@Injectable()
export class ExamCentresService {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await Promise.all(officialCentres.map((centre) => this.prisma.examCentre.upsert({
        where: { slug: centre.slug },
        update: { ...centre, isPublished: true },
        create: { ...centre, isPublished: true },
      })));
    } catch {
      // The API can still serve its static centre directory while the database is unavailable.
    }
  }

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
