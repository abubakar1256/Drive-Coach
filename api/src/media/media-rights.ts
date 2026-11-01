import { BadRequestException } from "@nestjs/common";
export type MediaRights = { rightsType: "OWNED" | "LICENSED"; rightsHolder: string; licenseName: string; sourceUrl?: string; permissionConfirmed: boolean };
export function checkedMediaRights(value?: Partial<MediaRights>) {
  if (!value || !["OWNED", "LICENSED"].includes(value.rightsType ?? "") || value.permissionConfirmed !== true) throw new BadRequestException("Confirm ownership or a licence covering this image/video and its publication");
  for (const field of ["rightsHolder", "licenseName"] as const) if (typeof value[field] !== "string" || !value[field]!.trim() || value[field]!.length > 180) throw new BadRequestException("Rights holder and licence/use permission are required (maximum 180 characters)");
  let sourceUrl: string | null = null;
  if (value.sourceUrl) { try { const u = new URL(value.sourceUrl); if (u.protocol !== "https:" || u.username || u.password) throw Error(); sourceUrl = u.href; } catch { throw new BadRequestException("Use a public HTTPS licence/source reference without embedded credentials"); } }
  if (value.rightsType === "LICENSED" && !sourceUrl) throw new BadRequestException("A licence/source reference is required for third-party media");
  return { rightsType: value.rightsType, rightsHolder: value.rightsHolder!.trim(), licenseName: value.licenseName!.trim(), sourceUrl, permissionConfirmed: true, verification: "UPLOADER_DECLARED" };
}
