import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAccessToken, getActiveTenantId } from '@/lib/api';

export interface LiveCheckIn {
  eventId: string;
  name: string;
  checkedInAt: string;
  total: number;
}

export function useEventStats(eventId?: string, onUpdate?: () => void) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [liveCheckins, setLiveCheckins] = useState<LiveCheckIn[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const tenantId = getActiveTenantId();
    const token = getAccessToken();

    if (!tenantId || !token) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    const wsUrl = apiUrl.replace('/api', '');

    const newSocket = io(`${wsUrl}/tenant-${tenantId}`, {
      query: { token },
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('checkin:new', (data: LiveCheckIn) => {
      if (!eventId || data.eventId === eventId) {
        setLiveCheckins((prev) => [data, ...prev.slice(0, 19)]); // Keep last 20
        if (onUpdate) onUpdate();
      }
    });

    newSocket.on('registration:new', (data: { eventId: string }) => {
      if (!eventId || data.eventId === eventId) {
        if (onUpdate) onUpdate();
      }
    });

    newSocket.on('registration:cancelled', (data: { eventId: string }) => {
      if (!eventId || data.eventId === eventId) {
        if (onUpdate) onUpdate();
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [eventId, onUpdate]);

  return { isConnected, liveCheckins };
}
