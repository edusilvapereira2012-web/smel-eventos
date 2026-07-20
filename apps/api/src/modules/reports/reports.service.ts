import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { RegistrationStatus, TenantRole } from '@prisma/client';
import { decrypt, maskCpf, cleanCpf } from '../../common/utils/encryption.helper';
import * as ExcelJS from 'exceljs';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

@Injectable()
export class ReportsService {
  private readonly encryptionKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.encryptionKey = this.configService.get<string>('ENCRYPTION_KEY') || 'default_secret_encryption_key_32_bytes_long';
  }

  /**
   * Helper to normalize strings for standard PDF fonts (prevents encoding crashes)
   */
  private cleanStringForPdf(str: string): string {
    if (!str) return '';
    // Normalize and remove accents to ensure compatibility with standard WinAnsiEncoding Helvetica font
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E]/g, '');
  }

  /**
   * Fetch registrations for export with permissions checking, audit logging, and decrypting/masking of CPFs.
   */
  async getExportData(
    eventId: string,
    sensitive: boolean,
    tenantId: string,
    userId: string,
    ip?: string,
    userAgent?: string,
  ) {
    // 1. Verify event belongs to tenant
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, tenantId },
    });

    if (!event) {
      throw new NotFoundException('Evento não encontrado.');
    }

    // 2. Fetch user's membership in the tenant to resolve their role
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    const isSuperAdmin = user?.email === 'valterpcjr@gmail.com';
    let userRole: TenantRole;

    if (isSuperAdmin) {
      userRole = TenantRole.OWNER;
    } else {
      const membership = await this.prisma.tenantMembership.findUnique({
        where: {
          tenantId_userId: {
            tenantId,
            userId,
          },
        },
      });

      if (!membership) {
        throw new ForbiddenException('Acesso negado ao tenant especificado.');
      }

      userRole = membership.role;
    }

    // 3. Sensitive data export authorization
    if (sensitive) {
      if (userRole !== TenantRole.OWNER && userRole !== TenantRole.ADMIN) {
        throw new ForbiddenException('Apenas Administradores e Proprietários podem exportar CPFs em claro.');
      }

      // Log to AuditLog
      try {
        await this.prisma.auditLog.create({
          data: {
            userId,
            action: 'EXPORT_SENSITIVE_DATA',
            resource: 'registrations',
            resourceId: eventId,
            metadata: {
              eventId,
              eventTitle: event.title,
              ip,
              userAgent,
            },
            ip,
            userAgent,
          },
        });
      } catch (err) {
        // Prevent audit logging failure from blocking the export
      }
    }

    // 4. Fetch registrations
    const registrations = await this.prisma.registration.findMany({
      where: { eventId },
      orderBy: { name: 'asc' },
    });

    // 5. Decrypt and format CPFs
    return {
      event,
      data: registrations.map((reg) => {
        let cpfVal = '***.***.***-**';
        try {
          const decryptedCpf = decrypt(reg.cpf || '', this.encryptionKey);
          cpfVal = sensitive ? decryptedCpf : maskCpf(decryptedCpf);
        } catch (err) {
          // Fallback if decryption fails
        }

        return {
          code: reg.code,
          name: reg.name,
          email: reg.email,
          cpf: cpfVal,
          phone: reg.phone || '',
          status: reg.status,
          createdAt: reg.createdAt,
        };
      }),
    };
  }

  /**
   * Export registrations to CSV
   */
  async exportCsv(
    eventId: string,
    sensitive: boolean,
    tenantId: string,
    userId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<{ csvContent: string; eventSlug: string }> {
    const { event, data } = await this.getExportData(eventId, sensitive, tenantId, userId, ip, userAgent);

    // Build CSV Content
    let csv = '\uFEFF'; // Add BOM for Excel UTF-8 compatibility
    csv += 'Código,Nome,E-mail,CPF,Telefone,Status,Data de Inscrição\n';

    data.forEach((row) => {
      // Escape commas and quotes
      const name = `"${row.name.replace(/"/g, '""')}"`;
      const email = `"${row.email.replace(/"/g, '""')}"`;
      const phone = `"${row.phone.replace(/"/g, '""')}"`;
      const dateStr = row.createdAt.toISOString();

      csv += `${row.code},${name},${email},${row.cpf},${phone},${row.status},${dateStr}\n`;
    });

    return {
      csvContent: csv,
      eventSlug: event.slug,
    };
  }

  /**
   * Export registrations to Excel (styled)
   */
  async exportExcel(
    eventId: string,
    sensitive: boolean,
    tenantId: string,
    userId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<{ buffer: Buffer; eventSlug: string }> {
    const { event, data } = await this.getExportData(eventId, sensitive, tenantId, userId, ip, userAgent);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Inscrições');

    // Define columns
    worksheet.columns = [
      { header: 'Código', key: 'code', width: 22 },
      { header: 'Nome', key: 'name', width: 35 },
      { header: 'E-mail', key: 'email', width: 35 },
      { header: 'CPF', key: 'cpf', width: 20 },
      { header: 'Telefone', key: 'phone', width: 20 },
      { header: 'Status', key: 'status', width: 18 },
      { header: 'Data de Inscrição', key: 'createdAt', width: 28 },
    ];

    // Header styling
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A8A' }, // Slate Navy Blue
      };
      cell.font = {
        color: { argb: 'FFFFFFFF' },
        bold: true,
        name: 'Segoe UI',
        size: 11,
      };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
      cell.border = {
        bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      };
    });
    headerRow.height = 28;

    // Add data rows
    data.forEach((row) => {
      const addedRow = worksheet.addRow({
        code: row.code,
        name: row.name,
        email: row.email,
        cpf: row.cpf,
        phone: row.phone,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
      });

      // Styling data row cells
      addedRow.eachCell((cell) => {
        cell.font = {
          name: 'Segoe UI',
          size: 10,
        };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, // Slate-200 border
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
        cell.alignment = { vertical: 'middle' };
      });
      addedRow.height = 22;
    });

    const buffer = (await workbook.xlsx.writeBuffer()) as any as Buffer;

    return {
      buffer,
      eventSlug: event.slug,
    };
  }

  /**
   * Generates a presence list PDF with signature lines for confirmed participants.
   */
  async generatePresenceListPdf(eventId: string, tenantId: string): Promise<{ buffer: Buffer; eventSlug: string }> {
    // 1. Verify event
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, tenantId },
    });

    if (!event) {
      throw new NotFoundException('Evento não encontrado.');
    }

    // 2. Fetch confirmed registrations sorted alphabetically by name
    const registrations = await this.prisma.registration.findMany({
      where: {
        eventId,
        status: RegistrationStatus.CONFIRMED,
      },
      orderBy: { name: 'asc' },
    });

    // 3. Create PDF Doc
    const pdfDoc = await PDFDocument.create();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 595.27; // A4 Portrait width
    const pageHeight = 841.89; // A4 Portrait height

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let pageNum = 1;

    const drawHeader = (currentPage: any, isContinuation: boolean) => {
      // Header Banner Background
      currentPage.drawRectangle({
        x: 40,
        y: pageHeight - 90,
        width: pageWidth - 80,
        height: 60,
        color: rgb(0.96, 0.97, 0.99), // Very light gray-blue
      });

      // Text inside banner
      currentPage.drawText(
        this.cleanStringForPdf(event.title.toUpperCase()),
        {
          x: 50,
          y: pageHeight - 55,
          size: 13,
          font: fontBold,
          color: rgb(0.06, 0.09, 0.16),
        }
      );

      const titleSub = isContinuation
        ? 'LISTA DE PRESENCA (CONTINUACAO) - PAGINA ' + pageNum
        : 'LISTA DE PRESENCA - TOTAL DE CONFIRMADOS: ' + registrations.length;

      currentPage.drawText(titleSub, {
        x: 50,
        y: pageHeight - 75,
        size: 9,
        font: fontRegular,
        color: rgb(0.38, 0.43, 0.53),
      });

      // Draw table columns header
      currentPage.drawText('CODIGO', { x: 45, y: pageHeight - 115, size: 9, font: fontBold, color: rgb(0.12, 0.16, 0.23) });
      currentPage.drawText('PARTICIPANTE / E-MAIL', { x: 135, y: pageHeight - 115, size: 9, font: fontBold, color: rgb(0.12, 0.16, 0.23) });
      currentPage.drawText('PRESENCA', { x: 355, y: pageHeight - 115, size: 9, font: fontBold, color: rgb(0.12, 0.16, 0.23) });
      currentPage.drawText('ASSINATURA', { x: 425, y: pageHeight - 115, size: 9, font: fontBold, color: rgb(0.12, 0.16, 0.23) });

      // Table Header Line separator
      currentPage.drawLine({
        start: { x: 40, y: pageHeight - 122 },
        end: { x: pageWidth - 40, y: pageHeight - 122 },
        thickness: 1,
        color: rgb(0.12, 0.16, 0.23),
      });
    };

    // Draw first page header
    drawHeader(page, false);

    let yPosition = pageHeight - 145;
    const rowHeight = 36;

    for (const reg of registrations) {
      // If we go beyond page limits, create new page
      if (yPosition < 60) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        pageNum++;
        drawHeader(page, true);
        yPosition = pageHeight - 145;
      }

      // Draw Code
      page.drawText(reg.code, {
        x: 45,
        y: yPosition + 10,
        size: 9,
        font: fontRegular,
        color: rgb(0.09, 0.09, 0.11),
      });

      // Draw Name (truncated if too long to prevent overlapping checkbox)
      const cleanedName = this.cleanStringForPdf(reg.name);
      const displayName = cleanedName.length > 38 ? cleanedName.substring(0, 36) + '...' : cleanedName;
      page.drawText(displayName, {
        x: 135,
        y: yPosition + 14,
        size: 9,
        font: fontBold,
        color: rgb(0.09, 0.09, 0.11),
      });

      // Draw Email
      const displayNameEmail = reg.email.length > 42 ? reg.email.substring(0, 39) + '...' : reg.email;
      page.drawText(displayNameEmail, {
        x: 135,
        y: yPosition + 2,
        size: 8,
        font: fontRegular,
        color: rgb(0.38, 0.43, 0.53),
      });

      // Draw Checkbox for presence
      page.drawRectangle({
        x: 355,
        y: yPosition + 8,
        width: 10,
        height: 10,
        color: rgb(1, 1, 1),
        borderColor: rgb(0.38, 0.43, 0.53),
        borderWidth: 1,
      });

      // Draw Signature Line
      page.drawText('_________________________', {
        x: 425,
        y: yPosition + 10,
        size: 9,
        font: fontRegular,
        color: rgb(0.65, 0.71, 0.8),
      });

      // Draw thin row separator
      page.drawLine({
        start: { x: 40, y: yPosition - 6 },
        end: { x: pageWidth - 40, y: yPosition - 6 },
        thickness: 0.5,
        color: rgb(0.89, 0.91, 0.94),
      });

      yPosition -= rowHeight;
    }

    const pdfBytes = await pdfDoc.save();
    return {
      buffer: Buffer.from(pdfBytes),
      eventSlug: event.slug,
    };
  }
}
