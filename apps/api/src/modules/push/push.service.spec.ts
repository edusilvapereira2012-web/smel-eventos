import { Test, TestingModule } from '@nestjs/testing';
import { PushService } from './push.service';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../common/redis/redis.service';
import * as webpush from 'web-push';

jest.mock('web-push');

describe('PushService', () => {
  let service: PushService;
  let redisService: RedisService;

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'VAPID_PUBLIC_KEY') return 'mock-pub';
      if (key === 'VAPID_PRIVATE_KEY') return 'mock-priv';
      return null;
    }),
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<PushService>(PushService);
    redisService = module.get<RedisService>(RedisService);
    service.onModuleInit();
  });

  it('should initialize with vapid details', () => {
    expect(webpush.setVapidDetails).toHaveBeenCalled();
  });

  it('should return public key', () => {
    const result = service.getPublicKey();
    expect(result.publicKey).toBe('mock-pub');
  });

  it('should subscribe successfully', async () => {
    mockRedisService.get.mockResolvedValue(null);
    const sub = { endpoint: 'test-endpoint' };
    const result = await service.subscribe('user-1', sub);
    expect(result.success).toBe(true);
    expect(mockRedisService.set).toHaveBeenCalledWith(
      'push:user:user-1',
      JSON.stringify([sub]),
    );
  });

  it('should send notification to subscribed users', async () => {
    const sub = { endpoint: 'test-endpoint' };
    mockRedisService.get.mockResolvedValue(JSON.stringify([sub]));
    (webpush.sendNotification as jest.Mock).mockResolvedValue({});

    const result = await service.sendNotification('user-1', 'Title', 'Body');
    expect(result.success).toBe(true);
    expect(webpush.sendNotification).toHaveBeenCalled();
  });
});
