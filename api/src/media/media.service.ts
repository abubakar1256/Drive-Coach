import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PrismaService } from "../prisma.service";
import { UploadMediaDto } from "./dto/media.dto";
import { validMediaSignature } from "./media-signature";
import { RouteAccessService } from "../routes/route-access.service";

const MIME_EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4", "video/webm": "webm" };
const MAX_BYTES = 15 * 1024 * 1024;

@Injectable()
export class MediaService {
  constructor(private readonly prisma: PrismaService, private readonly routeAccess: RouteAccessService) {}

  upload(userId: string, dto: UploadMediaDto) {
    const encoded = dto.dataBase64.replace(/^data:[^;]+;base64,/, "");
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new BadRequestException("Invalid base64 media data");
    const buffer = Buffer.from(encoded, "base64");
    return this.persist(userId, dto.routePointId, buffer, dto.originalName, dto.mimeType);
  }

  uploadFile(userId: string, routePointId: string, file: { buffer: Buffer; originalname: string; mimetype: string; size: number }) {
    return this.persist(userId, routePointId, file.buffer, file.originalname, file.mimetype);
  }

  private async persist(userId: string, routePointId: string, buffer: Buffer, originalName: string, mimeType: string) {
    const point = await this.prisma.routePoint.findUnique({ where: { id: routePointId }, select: { id: true } });
    if (!point) throw new NotFoundException("Route point not found");
    const extension = MIME_EXTENSIONS[mimeType];
    if (!extension) throw new BadRequestException("Unsupported media type");
    if (!buffer.length || buffer.length > MAX_BYTES) throw new BadRequestException("Media must be between 1 byte and 15 MB");
    if (!validMediaSignature(buffer, mimeType)) throw new BadRequestException("File content does not match the allowed media type");
    const id = randomUUID();
    const cloudinaryRequested = process.env.MEDIA_PROVIDER === "cloudinary";
    const cloudinaryConfigured = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_UPLOAD_PRESET);
    let storageKey: string; let publicUrl: string;
    if (cloudinaryRequested && !cloudinaryConfigured) throw new ServiceUnavailableException("Cloudinary storage is selected but CLOUDINARY_CLOUD_NAME or CLOUDINARY_UPLOAD_PRESET is missing");
    const databaseStorage = process.env.MEDIA_PROVIDER === "database" || (!process.env.MEDIA_PROVIDER && process.env.NODE_ENV === "production");
    if (databaseStorage) {
      storageKey = `database:${id}`; publicUrl = `/api/v1/media/${id}`;
    } else if (cloudinaryRequested) {
      const remote = await this.uploadToCloudinary(buffer, originalName, mimeType);
      storageKey = `cloudinary:${remote.publicId}`; publicUrl = remote.publicUrl;
    } else {
      storageKey = `${id}.${extension}`; const directory = join(process.cwd(), "uploads", "media");
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, storageKey), buffer, { flag: "wx" });
      publicUrl = `/api/v1/media/${id}`;
    }
    const provider = databaseStorage ? "database" : cloudinaryRequested ? "cloudinary" : "local";
    await this.prisma.$transaction(async tx => {
      await tx.mediaAsset.create({ data: { id, routePointId, storageKey, publicUrl, originalName, mimeType, byteSize: buffer.length, ...(databaseStorage ? { dataBytes: buffer } : {}) } });
      await tx.auditLog.create({ data: { userId, action: "MEDIA_UPLOADED", entity: "RoutePoint", entityId: routePointId, metadata: { mimeType, byteSize: buffer.length, provider } } });
    });
    return { id, routePointId, storageKey, publicUrl, originalName, mimeType, byteSize: buffer.length, provider };
  }

  private async uploadToCloudinary(buffer: Buffer, originalName: string, mimeType: string) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME as string;
    const preset = process.env.CLOUDINARY_UPLOAD_PRESET as string;
    const resourceType = mimeType.startsWith("video/") ? "video" : "image";
    const form = new FormData();
    form.append("file", new Blob([buffer], { type: mimeType }), originalName);
    form.append("upload_preset", preset);
    if (process.env.CLOUDINARY_FOLDER) form.append("folder", process.env.CLOUDINARY_FOLDER);
    const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/${resourceType}/upload`, { method: "POST", body: form });
    const payload = await response.json().catch(() => null) as { public_id?: string; secure_url?: string; error?: { message?: string } } | null;
    if (!response.ok || !payload?.public_id || !payload.secure_url) throw new ServiceUnavailableException(payload?.error?.message ?? "Cloudinary upload failed");
    return { publicId: payload.public_id, publicUrl: payload.secure_url };
  }

  async file(userId: string, id: string) {
    const [asset, user] = await Promise.all([
      this.prisma.mediaAsset.findUnique({ where: { id }, select: { routePoint: { select: { routeId: true } } } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
    ]);
    if (!asset) throw new NotFoundException("Media asset not found");
    if (!user) throw new ForbiddenException("Account required");
    // Content editors may preview drafts they manage. Learners must have paid
    // access for this exact route; a free trial does not include route media.
    if (!["ADMIN", "SUPER_ADMIN", "CONTENT_MANAGER"].includes(user.role)) {
      const access = await this.routeAccess.requireAccess(userId, asset.routePoint.routeId);
      if (!access.premium) throw new ForbiddenException("Paid route access required for media");
    }
    const rows = await this.prisma.$queryRawUnsafe<Array<{ storageKey: string; publicUrl: string; mimeType: string; originalName: string }>>('SELECT "storageKey", "publicUrl", "mimeType", "originalName" FROM "MediaAsset" WHERE "id" = $1', id);
    if (!rows[0]) throw new NotFoundException("Media asset not found");
    if (rows[0].storageKey.startsWith("database:")) {
      const asset = await this.prisma.mediaAsset.findUnique({ where: { id }, select: { dataBytes: true } });
      if (!asset?.dataBytes) throw new NotFoundException("Stored media is unavailable");
      return { ...rows[0], buffer: Buffer.from(asset.dataBytes) };
    }
    if (rows[0].publicUrl.startsWith("http")) return { ...rows[0], remoteUrl: rows[0].publicUrl };
    const buffer = await readFile(join(process.cwd(), "uploads", "media", rows[0].storageKey)).catch(() => null);
    if (!buffer) throw new NotFoundException("Media file is unavailable");
    return { ...rows[0], buffer };
  }
}
