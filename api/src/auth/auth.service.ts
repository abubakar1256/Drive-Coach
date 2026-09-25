import { BadRequestException, ConflictException, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Prisma, PrismaClient, User, UserRole } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { createHash, randomBytes } from "node:crypto";
import { ChangePasswordDto, ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto, VerifyEmailDto } from "./dto/auth.dto";
import { PrismaService } from "../prisma.service";

export const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "development-only-change-this-secret";
const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const BCRYPT_ROUNDS = 12;

export type AuthPayload = { sub: string; email: string; role: UserRole };

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwtService: JwtService) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    try {
      const existing = await this.prisma.user.findUnique({ where: { email } });
      if (existing) throw new ConflictException("An account with this email already exists");
      const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
      const user = await this.prisma.user.create({ data: { email, passwordHash, displayName: dto.displayName?.trim() || null } });
      await this.prisma.$executeRawUnsafe('INSERT INTO "Notification" ("id", "userId", "type", "title", "body") VALUES ($1,$2,$3,$4,$5)', randomBytes(16).toString("hex"), user.id, "WELCOME", "Welcome to RoutePilot", "Save your first approved route and start a calm practice session when you are ready.");
      const verificationToken = await this.createVerificationToken(user.id);
      const deliveryConfigured = await this.sendEmail(user.email, "Verify your RoutePilot email", this.verificationUrl(verificationToken, "verify-email"));
      const tokens = await this.issueTokens(user);
      return { ...tokens, emailVerification: process.env.NODE_ENV === "production" ? { required: true, deliveryConfigured } : { required: true, developmentToken: verificationToken, deliveryConfigured } };
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("An account with this email already exists");
      throw new ServiceUnavailableException("Authentication database is unavailable");
    }
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    try {
      const user = await this.prisma.user.findUnique({ where: { email } });
      if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) throw new UnauthorizedException("Invalid email or password");
      return this.issueTokens(user);
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new ServiceUnavailableException("Authentication database is unavailable");
    }
  }

  async refresh(refreshToken: string) {
    const parsed = this.parseRefreshToken(refreshToken);
    if (!parsed) throw new UnauthorizedException("Invalid refresh token");
    try {
      const session = await this.prisma.refreshSession.findUnique({ where: { id: parsed.sessionId }, include: { user: true } });
      if (!session || session.revokedAt || session.expiresAt <= new Date() || !(await bcrypt.compare(parsed.secret, session.tokenHash))) throw new UnauthorizedException("Invalid or expired refresh token");
      await this.prisma.refreshSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      return this.issueTokens(session.user);
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new ServiceUnavailableException("Authentication database is unavailable");
    }
  }

  async logout(refreshToken: string) {
    const parsed = this.parseRefreshToken(refreshToken);
    if (!parsed) return { success: true };
    try {
      const session = await this.prisma.refreshSession.findUnique({ where: { id: parsed.sessionId } });
      if (session && !session.revokedAt && await bcrypt.compare(parsed.secret, session.tokenHash)) await this.prisma.refreshSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      return { success: true };
    } catch {
      throw new ServiceUnavailableException("Authentication database is unavailable");
    }
  }

  async me(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" } } } });
      if (!user) throw new UnauthorizedException("User no longer exists");
      const subscription = user.subscriptions.find((item) => item.status === "ACTIVE") ?? user.subscriptions[0];
      const verification = await this.prisma.$queryRawUnsafe<Array<{ emailVerifiedAt: Date | null }>>('SELECT "emailVerifiedAt" FROM "User" WHERE "id" = $1', userId);
      return { ...this.safeUser(user), emailVerified: Boolean(verification[0]?.emailVerifiedAt), subscription: subscription ? { status: subscription.status, planName: subscription.plan.name, expiresAt: subscription.expiresAt } : { status: "FREE", planName: "Free", expiresAt: null } };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new ServiceUnavailableException("Authentication database is unavailable");
    }
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user || !(await bcrypt.compare(dto.currentPassword, user.passwordHash))) throw new UnauthorizedException("Current password is incorrect");
      if (dto.currentPassword === dto.newPassword) throw new BadRequestException("New password must be different");
      await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS) } });
      await this.prisma.refreshSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      return { success: true, message: "Password changed. Please log in again on your devices." };
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) throw error;
      throw new ServiceUnavailableException("Unable to change password");
    }
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>('SELECT "id" FROM "User" WHERE "email" = $1', email);
    const message = "If an account exists for this email, a password reset link will be sent.";
    if (!rows[0]) return { success: true, message };
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await this.prisma.$executeRawUnsafe('INSERT INTO "PasswordResetToken" ("id", "userId", "tokenHash", "expiresAt") VALUES ($1,$2,$3,NOW() + INTERVAL \'1 hour\')', randomBytes(16).toString("hex"), rows[0].id, tokenHash);
    const deliveryConfigured = await this.sendEmail(email, "Reset your RoutePilot password", this.verificationUrl(token, "reset-password"));
    return process.env.NODE_ENV === "production" ? { success: true, message, deliveryConfigured } : { success: true, message, developmentToken: token, deliveryConfigured };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = createHash("sha256").update(dto.token).digest("hex");
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string; userId: string }>>('SELECT "id", "userId" FROM "PasswordResetToken" WHERE "tokenHash" = $1 AND "usedAt" IS NULL AND "expiresAt" > NOW() LIMIT 1', tokenHash);
    if (!rows[0]) throw new UnauthorizedException("Invalid or expired password reset token");
    await this.prisma.$executeRawUnsafe('UPDATE "User" SET "passwordHash" = $1, "updatedAt" = NOW() WHERE "id" = $2', await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS), rows[0].userId);
    await this.prisma.$executeRawUnsafe('UPDATE "RefreshSession" SET "revokedAt" = NOW() WHERE "userId" = $1 AND "revokedAt" IS NULL', rows[0].userId);
    await this.prisma.$executeRawUnsafe('UPDATE "PasswordResetToken" SET "usedAt" = NOW() WHERE "id" = $1', rows[0].id);
    return { success: true, message: "Password reset. You can now log in with your new password." };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const tokenHash = createHash("sha256").update(dto.token).digest("hex");
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string; userId: string }>>('SELECT "id", "userId" FROM "EmailVerificationToken" WHERE "tokenHash" = $1 AND "usedAt" IS NULL AND "expiresAt" > NOW() LIMIT 1', tokenHash);
    if (!rows[0]) throw new UnauthorizedException("Invalid or expired email verification token");
    await this.prisma.$executeRawUnsafe('UPDATE "User" SET "emailVerifiedAt" = NOW(), "updatedAt" = NOW() WHERE "id" = $1', rows[0].userId);
    await this.prisma.$executeRawUnsafe('UPDATE "EmailVerificationToken" SET "usedAt" = NOW() WHERE "id" = $1', rows[0].id);
    return { success: true, message: "Email verified successfully." };
  }

  async resendVerification(userId: string) {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ emailVerifiedAt: Date | null }>>('SELECT "emailVerifiedAt" FROM "User" WHERE "id" = $1', userId);
    if (rows[0]?.emailVerifiedAt) return { success: true, message: "Email is already verified." };
    const token = await this.createVerificationToken(userId);
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    const deliveryConfigured = user ? await this.sendEmail(user.email, "Verify your RoutePilot email", this.verificationUrl(token, "verify-email")) : false;
    return process.env.NODE_ENV === "production" ? { success: true, message: "If email delivery is configured, a verification link will be sent.", deliveryConfigured } : { success: true, message: "Verification token created for local development.", developmentToken: token, deliveryConfigured };
  }

  private async createVerificationToken(userId: string) {
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await this.prisma.$executeRawUnsafe('INSERT INTO "EmailVerificationToken" ("id", "userId", "tokenHash", "expiresAt") VALUES ($1,$2,$3,NOW() + INTERVAL \'24 hours\')', randomBytes(16).toString("hex"), userId, tokenHash);
    return token;
  }

  private verificationUrl(token: string, page: "verify-email" | "reset-password") {
    return `${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/auth/${page}?token=${encodeURIComponent(token)}`;
  }

  private async sendEmail(to: string, subject: string, link: string) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !from) return false;
    try {
      const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [to], subject, html: `<div style="font-family:Arial,sans-serif;max-width:560px"><h2 style="color:#106c55">RoutePilot</h2><p>Continue securely using the button below.</p><p><a href="${link}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#ff8a22;color:#fff;text-decoration:none">Continue</a></p><p style="color:#71817a;font-size:12px">This link expires automatically. If you did not request it, you can ignore this email.</p></div>` }) });
      return response.ok;
    } catch { return false; }
  }

  private async issueTokens(user: User) {
    const payload: AuthPayload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwtService.signAsync(payload, { secret: JWT_ACCESS_SECRET, expiresIn: "15m" });
    const secret = randomBytes(48).toString("base64url");
    const session = await this.prisma.refreshSession.create({ data: { userId: user.id, tokenHash: await bcrypt.hash(secret, BCRYPT_ROUNDS), expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS) } });
    return { user: this.safeUser(user), accessToken, refreshToken: `${session.id}.${secret}`, expiresIn: ACCESS_TOKEN_TTL_MS / 1000 };
  }

  private safeUser(user: User) {
    return { id: user.id, email: user.email, displayName: user.displayName, role: user.role, createdAt: user.createdAt };
  }

  private parseRefreshToken(token: string) {
    const separator = token.indexOf(".");
    if (separator < 1 || separator === token.length - 1) return null;
    return { sessionId: token.slice(0, separator), secret: token.slice(separator + 1) };
  }
}
