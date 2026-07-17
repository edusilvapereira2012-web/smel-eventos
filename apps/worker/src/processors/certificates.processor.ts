import { Process, Processor, InjectQueue } from '@nestjs/bull';
import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job, Queue } from 'bull';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as Minio from 'minio';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PinoLoggerService } from '../common/logger/pino.service';

@Processor('certificates')
export class CertificatesProcessor implements OnModuleInit {
  private minioClient!: Minio.Client;
  private bucketName!: string;

  constructor(
    private readonly logger: PinoLoggerService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @InjectQueue('email') private readonly emailQueue: Queue,
  ) {}

  async onModuleInit() {
    this.minioClient = new Minio.Client({
      endPoint: this.configService.get<string>('MINIO_ENDPOINT') || 'localhost',
      port: this.configService.get<number>('MINIO_PORT') || 9000,
      useSSL: false,
      accessKey: this.configService.get<string>('MINIO_ACCESS_KEY') || 'minio_admin',
      secretKey: this.configService.get<string>('MINIO_SECRET_KEY') || 'minio_secret_key_123',
    });
    this.bucketName = this.configService.get<string>('MINIO_BUCKET_CERTIFICATES') || 'certificates';

    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName, 'us-east-1');
        this.logger.log(`Bucket "${this.bucketName}" criado no MinIO.`, 'CertificatesProcessor');

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
        this.logger.log(`Política de leitura pública configurada para o bucket "${this.bucketName}".`, 'CertificatesProcessor');
      }
    } catch (error: any) {
      this.logger.error('Erro ao inicializar MinIO no Worker: ' + error.message, error.stack, 'CertificatesProcessor');
    }
  }

  @Process('generate-certificate')
  async handleGenerateCertificate(job: Job<{ registrationId: string; tenantId: string; eventId: string }>) {
    const { registrationId, tenantId, eventId } = job.data;
    this.logger.log(`[Job ${job.id}] Iniciando geração de certificado para inscrição ${registrationId}`, 'CertificatesProcessor');

    // 1. Buscar inscrição, evento e organização
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      include: { event: true },
    });

    if (!registration) {
      throw new Error(`Inscrição ${registrationId} não encontrada.`);
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new Error(`Organização ${tenantId} não encontrada.`);
    }

    // 2. Gerar código único e URL de validação
    const code = `CERT-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const appUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3000';
    const validationUrl = `${appUrl}/certificate/${code}`;

    // 3. Gerar imagem do QR Code
    const qrCodeBuffer = await QRCode.toBuffer(validationUrl, { margin: 1, width: 200 });

    // 4. Desenhar PDF com pdf-lib
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([841.89, 595.27]); // A4 Landscape
    const { width, height } = page.getSize();

    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Helper function to convert Hex to rgb
    const hexToRgb = (hex: string) => {
      const cleanHex = hex.replace('#', '');
      const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
      const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
      const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
      return rgb(isNaN(r) ? 0 : r, isNaN(g) ? 0 : g, isNaN(b) ? 0 : b);
    };

    // Helper function to draw centered text
    const drawCenteredText = (text: string, xPercent: number, yPercent: number, size: number, font: any, colorHex?: string) => {
      const txtWidth = font.widthOfTextAtSize(text, size);
      const pdfX = (xPercent / 100) * width - txtWidth / 2;
      const pdfY = (1 - (yPercent / 100)) * height - size / 2;
      page.drawText(text, {
        x: pdfX,
        y: pdfY,
        font: font,
        size: size,
        color: colorHex ? hexToRgb(colorHex) : rgb(0.09, 0.09, 0.11),
      });
    };

    // Quebra de texto manual
    const wrapText = (text: string, maxChars = 75): string[] => {
      const words = text.split(' ');
      const lines: string[] = [];
      let currentLine = '';
      for (const word of words) {
        if ((currentLine + ' ' + word).trim().length <= maxChars) {
          currentLine = (currentLine + ' ' + word).trim();
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }
      return lines;
    };

    // Helper function to draw centered multiline text
    const drawCenteredMultilineText = (text: string, xPercent: number, yPercent: number, size: number, font: any, maxChars = 75, colorHex?: string) => {
      const lines = wrapText(text, maxChars);
      let currentYPercent = yPercent;
      for (const line of lines) {
        drawCenteredText(line, xPercent, currentYPercent, size, font, colorHex);
        currentYPercent += (25 / height) * 100; // spacing down by ~25 points
      }
    };

    // Resolve variables
    const eventDateStr = new Date(registration.event.startDate).toLocaleDateString('pt-BR');
    const defaultBody = 'Certificamos que {NOME} participou com êxito do evento {TÍTULO}, realizado em {DATA}, com carga horária total de {X} horas.';
    
    const certTitle = registration.event.certificateTitle || tenant.certificateTitle || 'CERTIFICADO DE PARTICIPAÇÃO';
    const certBodyTemplate = registration.event.certificateBody || tenant.certificateBody || defaultBody;
    const certHours = registration.event.certificateHours || tenant.certificateHours || 8;
    const certSigner = registration.event.certificateSigner || tenant.certificateSigner || '';
    const certSignerUrl = registration.event.certificateSignerUrl || tenant.certificateSignerUrl || '';

    const bodyText = certBodyTemplate
      .replace('{NOME}', registration.name)
      .replace('{TÍTULO}', registration.event.title)
      .replace('{DATA}', eventDateStr)
      .replace('{X}', String(certHours));

    // Check if Event has custom layout configuration
    const isCustom = !!registration.event.certificateBackgroundUrl;

    if (isCustom) {
      // 4A. CUSTOM LAYOUT MODE
      // Load background image
      let bgImage;
      if (registration.event.certificateBackgroundUrl) {
        try {
          let bgUrl = registration.event.certificateBackgroundUrl;
          const minioEndpoint = this.configService.get<string>('MINIO_ENDPOINT');
          if (minioEndpoint === 'minio') {
            bgUrl = bgUrl.replace('localhost', 'minio');
          }
          const response = await fetch(bgUrl);
          if (response.ok) {
            const buffer = Buffer.from(await response.arrayBuffer());
            if (bgUrl.endsWith('.png')) {
              bgImage = await pdfDoc.embedPng(buffer);
            } else {
              bgImage = await pdfDoc.embedJpg(buffer);
            }
          }
        } catch (e: any) {
          this.logger.error(`Erro ao carregar imagem de plano de fundo do certificado: ${e.message}`, undefined, 'CertificatesProcessor');
        }
      }

      if (bgImage) {
        page.drawImage(bgImage, {
          x: 0,
          y: 0,
          width: width,
          height: height,
        });
      }

      // Parse layout JSON
      let layout: any = null;
      if (registration.event.certificateLayoutJson) {
        if (typeof registration.event.certificateLayoutJson === 'string') {
          try {
            layout = JSON.parse(registration.event.certificateLayoutJson);
          } catch (e) {}
        } else {
          layout = registration.event.certificateLayoutJson;
        }
      }

      // Fallback default coordinates if not set in layout
      const defaultLayout = {
        title: { x: 50, y: 25, fontSize: 28, color: '#09090b', enabled: true },
        name: { x: 50, y: 42, fontSize: 24, color: '#09090b', enabled: true },
        body: { x: 50, y: 55, fontSize: 14, color: '#27272a', enabled: true },
        signer: { x: 30, y: 78, fontSize: 12, color: '#09090b', enabled: true, showSignature: true },
        qrcode: { x: 75, y: 78, size: 80, enabled: true }
      };

      const titleConfig = layout?.title || defaultLayout.title;
      const nameConfig = layout?.name || defaultLayout.name;
      const bodyConfig = layout?.body || defaultLayout.body;
      const signerConfig = layout?.signer || defaultLayout.signer;
      const qrcodeConfig = layout?.qrcode || defaultLayout.qrcode;

      // 1. Draw Title
      if (titleConfig.enabled !== false) {
        drawCenteredText(certTitle, titleConfig.x, titleConfig.y, titleConfig.fontSize || 28, fontBold, titleConfig.color);
      }

      // 2. Draw Name
      if (nameConfig.enabled !== false) {
        drawCenteredText(registration.name, nameConfig.x, nameConfig.y, nameConfig.fontSize || 24, fontBold, nameConfig.color);
      }

      // 3. Draw Body
      if (bodyConfig.enabled !== false) {
        drawCenteredMultilineText(bodyText, bodyConfig.x, bodyConfig.y, bodyConfig.fontSize || 14, fontRegular, 75, bodyConfig.color);
      }

      // 4. Draw Signer & Signature
      if (signerConfig.enabled !== false && certSigner) {
        let signatureImage;
        if (certSignerUrl) {
          try {
            let sigUrl = certSignerUrl;
            const minioEndpoint = this.configService.get<string>('MINIO_ENDPOINT');
            if (minioEndpoint === 'minio') {
              sigUrl = sigUrl.replace('localhost', 'minio');
            }
            const response = await fetch(sigUrl);
            if (response.ok) {
              const buffer = Buffer.from(await response.arrayBuffer());
              if (sigUrl.endsWith('.png')) {
                signatureImage = await pdfDoc.embedPng(buffer);
              } else {
                signatureImage = await pdfDoc.embedJpg(buffer);
              }
            }
          } catch (e: any) {
            this.logger.error(`Erro ao carregar a assinatura do Signer: ${e.message}`, undefined, 'CertificatesProcessor');
          }
        }

        if (signatureImage && signerConfig.showSignature !== false) {
          const sigDims = signatureImage.scale(40 / signatureImage.height);
          const sigPdfX = (signerConfig.x / 100) * width - sigDims.width / 2;
          const sigPdfY = (1 - ((signerConfig.y - 7) / 100)) * height;
          page.drawImage(signatureImage, {
            x: sigPdfX,
            y: sigPdfY,
            width: sigDims.width,
            height: sigDims.height,
          });
        }

        // Underline
        const lineYPercent = signerConfig.y - 1.5;
        const linePdfY = (1 - (lineYPercent / 100)) * height;
        page.drawLine({
          start: { x: (signerConfig.x / 100) * width - 100, y: linePdfY },
          end: { x: (signerConfig.x / 100) * width + 100, y: linePdfY },
          thickness: 1,
          color: rgb(0.6, 0.6, 0.6),
        });

        // Signer Name
        drawCenteredText(certSigner, signerConfig.x, signerConfig.y, signerConfig.fontSize || 12, fontBold, signerConfig.color);

        // Signer Subtitle
        const subtitleLabel = 'Assinatura do Organizador';
        drawCenteredText(subtitleLabel, signerConfig.x, signerConfig.y + 2.5, (signerConfig.fontSize || 12) - 2, fontRegular, '#64748b');
      }

      // 5. Draw QR Code & Verification Label
      if (qrcodeConfig.enabled !== false) {
        const qrImage = await pdfDoc.embedPng(qrCodeBuffer);
        const qrSize = qrcodeConfig.size || 80;
        const qrPdfX = (qrcodeConfig.x / 100) * width - qrSize / 2;
        const qrPdfY = (1 - (qrcodeConfig.y / 100)) * height - qrSize / 2;

        page.drawImage(qrImage, {
          x: qrPdfX,
          y: qrPdfY,
          width: qrSize,
          height: qrSize,
        });

        const codeLabel = `Código: ${code}`;
        const codeWidth = fontRegular.widthOfTextAtSize(codeLabel, 8);
        page.drawText(codeLabel, {
          x: (qrcodeConfig.x / 100) * width - codeWidth / 2,
          y: (1 - ((qrcodeConfig.y + 10) / 100)) * height,
          size: 8,
          font: fontRegular,
          color: rgb(0.4, 0.4, 0.4),
        });

        const validateLabel = `Valide em: ${appUrl}/certificate/${code}`;
        const validateWidth = fontRegular.widthOfTextAtSize(validateLabel, 7.5);
        page.drawText(validateLabel, {
          x: (qrcodeConfig.x / 100) * width - validateWidth / 2,
          y: (1 - ((qrcodeConfig.y + 12.5) / 100)) * height,
          size: 7.5,
          font: fontRegular,
          color: rgb(0.4, 0.4, 0.4),
        });
      }

    } else {
      // 4B. LEGACY LAYOUT FALLBACK MODE
      // Borda primária
      page.drawRectangle({
        x: 20,
        y: 20,
        width: width - 40,
        height: height - 40,
        borderColor: rgb(0.38, 0.18, 0.89), // Violet
        borderWidth: 4,
      });

      // Borda secundária (inner border)
      page.drawRectangle({
        x: 28,
        y: 28,
        width: width - 56,
        height: height - 56,
        borderColor: rgb(0.09, 0.09, 0.11), // Slate-900
        borderWidth: 1.5,
      });

      // Detalhes geométricos nos cantos
      page.drawRectangle({
        x: 20,
        y: height - 60,
        width: 40,
        height: 40,
        color: rgb(0.38, 0.18, 0.89),
      });
      page.drawRectangle({
        x: width - 60,
        y: 20,
        width: 40,
        height: 40,
        color: rgb(0.38, 0.18, 0.89),
      });

      // Carregar e desenhar logo da Organização
      let logoImage;
      if (tenant.logoUrl) {
        try {
          let logoUrl = tenant.logoUrl;
          const minioEndpoint = this.configService.get<string>('MINIO_ENDPOINT');
          if (minioEndpoint === 'minio') {
            logoUrl = logoUrl.replace('localhost', 'minio');
          }
          const response = await fetch(logoUrl);
          if (response.ok) {
            const buffer = Buffer.from(await response.arrayBuffer());
            if (logoUrl.endsWith('.png')) {
              logoImage = await pdfDoc.embedPng(buffer);
            } else {
              logoImage = await pdfDoc.embedJpg(buffer);
            }
          }
        } catch (e: any) {
          this.logger.error(`Erro ao carregar o logo da Organização: ${e.message}`, undefined, 'CertificatesProcessor');
        }
      }

      if (logoImage) {
        const logoDims = logoImage.scale(60 / logoImage.height);
        page.drawImage(logoImage, {
          x: width / 2 - logoDims.width / 2,
          y: 475,
          width: logoDims.width,
          height: logoDims.height,
        });
      }

      // Título do Certificado
      const titleSize = 28;
      const titleWidth = fontBold.widthOfTextAtSize(certTitle, titleSize);
      page.drawText(certTitle, {
        x: width / 2 - titleWidth / 2,
        y: 430,
        size: titleSize,
        font: fontBold,
        color: rgb(0.09, 0.09, 0.11),
      });

      // Linha divisória
      page.drawLine({
        start: { x: width / 2 - 100, y: 410 },
        end: { x: width / 2 + 100, y: 410 },
        thickness: 2,
        color: rgb(0.38, 0.18, 0.89),
      });

      // Corpo do Certificado
      const bodyLines = wrapText(bodyText, 70);
      let currentY = 340;
      const bodySize = 15;
      for (const line of bodyLines) {
        const lineWidth = fontRegular.widthOfTextAtSize(line, bodySize);
        page.drawText(line, {
          x: width / 2 - lineWidth / 2,
          y: currentY,
          size: bodySize,
          font: fontRegular,
          color: rgb(0.2, 0.2, 0.2),
        });
        currentY -= 25;
      }

      // Assinante do Organizador
      if (certSigner) {
        let signatureImage;
        if (certSignerUrl) {
          try {
            let sigUrl = certSignerUrl;
            const minioEndpoint = this.configService.get<string>('MINIO_ENDPOINT');
            if (minioEndpoint === 'minio') {
              sigUrl = sigUrl.replace('localhost', 'minio');
            }
            const response = await fetch(sigUrl);
            if (response.ok) {
              const buffer = Buffer.from(await response.arrayBuffer());
              if (sigUrl.endsWith('.png')) {
                signatureImage = await pdfDoc.embedPng(buffer);
              } else {
                signatureImage = await pdfDoc.embedJpg(buffer);
              }
            }
          } catch (e: any) {
            this.logger.error(`Erro ao carregar a assinatura do Signer: ${e.message}`, undefined, 'CertificatesProcessor');
          }
        }

        if (signatureImage) {
          const sigDims = signatureImage.scale(40 / signatureImage.height);
          page.drawImage(signatureImage, {
            x: 240 - sigDims.width / 2,
            y: 135,
            width: sigDims.width,
            height: sigDims.height,
          });
        }

        page.drawLine({
          start: { x: 140, y: 125 },
          end: { x: 340, y: 125 },
          thickness: 1,
          color: rgb(0.6, 0.6, 0.6),
        });

        const nameWidth = fontBold.widthOfTextAtSize(certSigner, 12);
        page.drawText(certSigner, {
          x: 240 - nameWidth / 2,
          y: 105,
          size: 12,
          font: fontBold,
          color: rgb(0.09, 0.09, 0.11),
        });

        const subtitleLabel = 'Assinatura do Organizador';
        const subLabelWidth = fontRegular.widthOfTextAtSize(subtitleLabel, 10);
        page.drawText(subtitleLabel, {
          x: 240 - subLabelWidth / 2,
          y: 90,
          size: 10,
          font: fontRegular,
          color: rgb(0.4, 0.4, 0.4),
        });
      }

      // Desenhar QR Code e texto de validação
      const qrImage = await pdfDoc.embedPng(qrCodeBuffer);
      page.drawImage(qrImage, {
        x: 580,
        y: 90,
        width: 90,
        height: 90,
      });

      const codeLabel = `Código: ${code}`;
      page.drawText(codeLabel, {
        x: 510,
        y: 70,
        size: 8,
        font: fontRegular,
        color: rgb(0.4, 0.4, 0.4),
      });

      const validateLabel = `Valide em: ${appUrl}/certificate/${code}`;
      page.drawText(validateLabel, {
        x: 510,
        y: 55,
        size: 8,
        font: fontRegular,
        color: rgb(0.4, 0.4, 0.4),
      });
    }

    // 5. Salvar PDF em Buffer
    const pdfBytes = await pdfDoc.save();

    // 6. Fazer upload para o MinIO
    const filename = `certificates/${tenantId}/${eventId}/${code}.pdf`;
    await this.minioClient.putObject(
      this.bucketName,
      filename,
      Buffer.from(pdfBytes),
      pdfBytes.length,
      { 'Content-Type': 'application/pdf' }
    );

    const minioEndpoint = this.configService.get<string>('MINIO_ENDPOINT') || 'localhost';
    const minioPort = this.configService.get<number>('MINIO_PORT') || 9000;
    const publicHost = minioEndpoint === 'minio' ? 'localhost' : minioEndpoint;
    const fileUrl = `http://${publicHost}:${minioPort}/${this.bucketName}/${filename}`;

    // 7. Salvar registro no Banco de Dados
    await this.prisma.certificate.create({
      data: {
        registrationId,
        eventId,
        code,
        fileUrl,
      },
    });

    // 8. Enfileirar envio de e-mail com BullMQ centralizado
    const emailLog = await this.prisma.emailLog.create({
      data: {
        tenantId,
        to: registration.email,
        subject: 'Seu certificado está disponível! — SMEL-Plataforma de Eventos',
        template: 'certificate-issued',
        variables: {
          name: registration.name,
          eventTitle: registration.event.title,
          code,
        },
        status: 'PENDING',
      },
    });

    await this.emailQueue.add(
      'certificate-issued',
      { emailLogId: emailLog.id },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: false,
      },
    );

    this.logger.log(`[Job ${job.id}] Certificado ${code} gerado e armazenado com sucesso no MinIO.`, 'CertificatesProcessor');
  }
}
