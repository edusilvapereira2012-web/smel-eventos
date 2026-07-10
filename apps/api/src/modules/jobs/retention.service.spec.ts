import { Test, TestingModule } from '@nestjs/testing';
import { RetentionService } from './retention.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('RetentionService', () => {
  let service: RetentionService;
  let prisma: PrismaService;

  const mockPrisma = {
    emailLog: {
      deleteMany: jest.fn().mockResolvedValue({ count: 5 }),
    },
    auditLog: {
      deleteMany: jest.fn().mockResolvedValue({ count: 10 }),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetentionService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<RetentionService>(RetentionService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should purge old logs successfully', async () => {
    await service.purgeOldLogs();
    expect(mockPrisma.emailLog.deleteMany).toHaveBeenCalled();
    expect(mockPrisma.auditLog.deleteMany).toHaveBeenCalled();
  });
});
