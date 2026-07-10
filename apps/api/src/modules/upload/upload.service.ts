import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import * as crypto from 'crypto';

@Injectable()
export class UploadService implements OnModuleInit {
  private readonly logger = new Logger(UploadService.name);
  private minioClient: Minio.Client;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    this.minioClient = new Minio.Client({
      endPoint: this.configService.get<string>('MINIO_ENDPOINT') || 'localhost',
      port: this.configService.get<number>('MINIO_PORT') || 9000,
      useSSL: false,
      accessKey: this.configService.get<string>('MINIO_ACCESS_KEY') || 'minio_admin',
      secretKey: this.configService.get<string>('MINIO_SECRET_KEY') || 'minio_secret_key_123',
    });
    this.bucketName = this.configService.get<string>('MINIO_BUCKET_EVENTS') || 'events';
  }

  async onModuleInit() {
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName, 'us-east-1');
        this.logger.log(`Bucket "${this.bucketName}" criado no MinIO.`);

        // Configurar política de leitura pública para o bucket
        const policy = {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${this.bucketName}/*`],
            },
          ],
        };
        await this.minioClient.setBucketPolicy(this.bucketName, JSON.stringify(policy));
        this.logger.log(`Política de leitura pública configurada para o bucket "${this.bucketName}".`);
      }
    } catch (error) {
      this.logger.error('Erro ao inicializar MinIO:', error);
    }
  }

  async uploadFile(file: Express.Multer.File): Promise<string> {
    const fileExt = file.originalname.split('.').pop();
    const randomName = crypto.randomBytes(16).toString('hex');
    const filename = `${randomName}.${fileExt}`;

    await this.minioClient.putObject(
      this.bucketName,
      filename,
      file.buffer,
      file.size,
      { 'Content-Type': file.mimetype }
    );

    const endPoint = this.configService.get<string>('MINIO_ENDPOINT') || 'localhost';
    const port = this.configService.get<number>('MINIO_PORT') || 9000;
    
    // Se estiver rodando dentro do Docker (endpoint = minio), o navegador precisa acessar via localhost
    const publicHost = endPoint === 'minio' ? 'localhost' : endPoint;
    return `http://${publicHost}:${port}/${this.bucketName}/${filename}`;
  }
}
