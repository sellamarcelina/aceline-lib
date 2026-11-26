import { useEffect, useRef, useState } from 'react';

export class ApiError extends Error {
  public status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    token?: string | null;
    body?: unknown;
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const res = await fetch(path, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    let message = 'Terjadi kesalahan pada server.';
    try {
      const errData = (await res.json()) as { error?: string };
      if (errData.error) message = errData.error;
    } catch {
      // fallback
    }
    throw new ApiError(message, res.status);
  }

  return (await res.json()) as T;
}

export async function downloadReportCsv(
  reportId: string,
  reportCode: string,
  token: string
): Promise<void> {
  const res = await fetch(`/api/reports/${encodeURIComponent(reportId)}/csv`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    throw new Error('Gagal mengunduh berkas CSV laporan.');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${reportCode}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export type RealtimeStatus = 'connected' | 'connecting' | 'disconnected';

export interface RealtimeMessage {
  event: string;
  payload: unknown;
  timestamp: string;
}

export function useLibraryRealtime(
  token: string | null,
  onEvent: (msg: RealtimeMessage) => void
): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>('connecting');
  const onEventRef = useRef(onEvent);
  const wsRef = useRef<WebSocket | null>(null);
  const tokenRef = useRef(token);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    tokenRef.current = token;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'auth', token: token || '' }));
    }
  }, [token]);

  useEffect(() => {
    let disposed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = 1200;

    function connect() {
      if (disposed) return;
      setStatus('connecting');
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (disposed) return;
        retryDelay = 1200;
        setStatus('connected');
        if (tokenRef.current) {
          ws.send(JSON.stringify({ type: 'auth', token: tokenRef.current }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(String(event.data)) as RealtimeMessage;
          if (parsed && parsed.event) {
            onEventRef.current(parsed);
          }
        } catch {
          // ignore malformed event
        }
      };

      ws.onclose = () => {
        if (disposed) return;
        setStatus('disconnected');
        reconnectTimer = setTimeout(() => {
          retryDelay = Math.min(retryDelay * 1.5, 10000);
          connect();
        }, retryDelay);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return status;
}
