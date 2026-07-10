import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { QrcodeService } from './qrcode.service';
import { QrcodeController } from './qrcode.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    JwtModule,
  ],
  controllers: [QrcodeController],
  providers: [QrcodeService],
  exports: [QrcodeService],
})
export class QrcodeModule {}
