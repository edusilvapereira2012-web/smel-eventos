import { Injectable, OnModuleInit, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import * as Minio from 'minio';
import * as QRCode from 'qrcode';

@Injectable()
export class QrcodeService implements OnModuleInit {
  private readonly logger = new Logger(QrcodeService.name);
  private minioClient!: Minio.Client;
  private bucketName!: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    this.minioClient = new Minio.Client({
      endPoint: this.configService.get<string>('MINIO_ENDPOINT') || 'localhost',
      port: this.configService.get<number>('MINIO_PORT') || 9000,
      useSSL: false,
      accessKey: this.configService.get<string>('MINIO_ACCESS_KEY') || 'minio_admin',
      secretKey: this.configService.get<string>('MINIO_SECRET_KEY') || 'minio_secret_key_123',
    });
    this.bucketName = this.configService.get<string>('MINIO_BUCKET_EVENTS') || 'events';
  }

  async getOrCreateQRCode(registrationId: string): Promise<string> {
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
    });

    if (!registration) {
      throw new NotFoundException('Inscrição não encontrada');
    }

    const objectName = `qrcodes/${registrationId}.png`;
    
    const externalUrl = this.configService.get<string>('MINIO_EXTERNAL_URL');
    const publicUrl = externalUrl
      ? `${externalUrl}/${this.bucketName}/${objectName}`
      : (() => {
          const endPoint = this.configService.get<string>('MINIO_ENDPOINT') || 'localhost';
          const port = this.configService.get<number>('MINIO_PORT') || 9000;
          const publicHost = endPoint === 'minio' ? 'localhost' : endPoint;
          return `http://${publicHost}:${port}/${this.bucketName}/${objectName}`;
        })();

    try {
      await this.minioClient.statObject(this.bucketName, objectName);
      return publicUrl;
    } catch (err) {
      this.logger.log(`Gerando novo QR Code para inscrição ${registrationId}`);
      
      const qrSecret = this.configService.get<string>('QR_SECRET') || 'super_secret_qr_signature_key_32_bytes_long_12345';
      const payload = {
        sub: registration.id,
        code: registration.code,
        eventId: registration.eventId,
      };

      const token = this.jwtService.sign(payload, {
        secret: qrSecret,
        expiresIn: '1y',
      });

      const buffer = await QRCode.toBuffer(token, {
        type: 'png',
        width: 300,
        margin: 2,
      });

      await this.minioClient.putObject(
        this.bucketName,
        objectName,
        buffer,
        buffer.length,
        { 'Content-Type': 'image/png' },
      );

      return publicUrl;
    }
  }
}
