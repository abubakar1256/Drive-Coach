import { BadRequestException, Body, Controller, Get, Param, Post, Req, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { AuthenticatedRequest, JwtAuthGuard } from "../auth/auth.guard";
import { AdminGuard } from "../admin/admin.guard";
import { UploadMediaDto } from "./dto/media.dto";
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
  @UseInterceptors(FileInterceptor("file"))
  @Post("admin/media/upload-file")
  uploadFile(@Req() request: AuthenticatedRequest, @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string; size: number }, @Body("routePointId") routePointId: string) {
    if (!file || !routePointId) throw new BadRequestException("A file and routePointId are required");
    return this.mediaService.uploadFile(request.user.sub, routePointId, file);
  }

  @Get("media/:id")
  async serve(@Param("id") id: string, @Res() response: Response) {
    const asset = await this.mediaService.file(id);
    if ("remoteUrl" in asset) { response.redirect(asset.remoteUrl); return; }
    response.setHeader("Content-Type", asset.mimeType);
    response.setHeader("Content-Disposition", `inline; filename="${asset.originalName.replace(/[\r\n"]/g, "")}"`);
    response.send(asset.buffer);
  }
}
