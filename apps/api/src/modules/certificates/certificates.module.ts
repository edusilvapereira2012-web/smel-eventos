import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { CertificatesController } from './certificates.controller';
import { CertificatesService } from './certificates.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'certificates',
    }),
    BullModule.registerQueue({
      name: 'email',
    }),
  ],
  controllers: [CertificatesController],
  providers: [CertificatesService],
  exports: [CertificatesService],
})
export class CertificatesModule {}
