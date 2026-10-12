import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService, JWT_ACCESS_SECRET } from "./auth.service";
import { JwtAuthGuard, OptionalJwtAuthGuard } from "./auth.guard";

@Module({
  imports: [JwtModule.register({ secret: JWT_ACCESS_SECRET, signOptions: { expiresIn: "15m" } })],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, OptionalJwtAuthGuard],
  exports: [AuthService, JwtAuthGuard, OptionalJwtAuthGuard, JwtModule],
})
export class AuthModule {}
