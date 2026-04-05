import { Global, Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { SharedLoginBootstrapService } from './shared-login-bootstrap.service';

@Global()
@Module({
  imports: [],
  controllers: [AuthController],
  providers: [
    AuthService,
    PrismaService,
    JwtAuthGuard,
    SharedLoginBootstrapService
  ],
  exports: [AuthService, JwtAuthGuard]
})
export class AuthModule {}
