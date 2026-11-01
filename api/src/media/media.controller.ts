import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { AuthenticatedRequest, JwtAuthGuard } from "../auth/auth.guard";
import { AdminGuard } from "../admin/admin.guard";
import { UploadMediaDto, UploadMediaFileDto } from "./dto/media.dto";
import { MediaService } from "./media.service";

@Controller()
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post("admin/media/upload")
  upload(@Req() request: AuthenticatedRequest, @Body() dto: UploadMediaDto) {
    return this.mediaService.upload(request.user.sub, dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 15 * 1024 * 1024, files: 1 } }))
  @Post("admin/media/upload-file")
  uploadFile(@Req() request: AuthenticatedRequest, @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string; size: number }, @Body() dto: UploadMediaFileDto) {
    if (!file || !dto.routePointId) throw new BadRequestException("A file and routePointId are required");
    return this.mediaService.uploadFile(request.user.sub, dto.routePointId, file, dto);
  }

  @Get("media/:id/description") @UseGuards(JwtAuthGuard)
  async description(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Res() response: Response) {
    response.setHeader("Cache-Control", "private, no-store"); response.json(await this.mediaService.description(request.user.sub, id));
  }

  @Get("learning-media/:id/:kind") @UseGuards(JwtAuthGuard)
  async learningFile(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Param("kind") kind: string, @Query("routeId") routeId: string, @Res() response: Response) {
    const asset = await this.mediaService.learningFile(request.user.sub, routeId, id, kind);
    response.setHeader("Cache-Control", "private, no-store"); response.setHeader("X-Content-Type-Options", "nosniff"); response.type(asset.mimeType).send(asset.buffer);
  }

  @Get("media/:id") @UseGuards(JwtAuthGuard)
  async serve(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Res() response: Response) {
    const asset = await this.mediaService.file(request.user.sub, id);
    response.setHeader("Cache-Control", "private, no-store");
    if ("remoteUrl" in asset) { response.redirect(asset.remoteUrl); return; }
    response.setHeader("Content-Type", asset.mimeType);
    response.setHeader("Content-Disposition", `inline; filename="${asset.originalName.replace(/[\r\n"]/g, "")}"`);
    response.send(asset.buffer);
  }
}
