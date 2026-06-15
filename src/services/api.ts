const API_URL = import.meta.env.VITE_API_URL || '';
const DEFAULT_TIMEOUT = 8000; // 8 detik
const MAX_RETRIES = 2;

type ConnectionState = 'LIVE' | 'STANDBY' | 'ERROR';

class ApiService {
  private connectionState: ConnectionState = 'STANDBY';
  private listeners: ((state: ConnectionState) => void)[] = [];

  onConnectionChange(cb: (state: ConnectionState) => void) {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter(l => l!== cb);
    };
  }

  private setConnectionState(state: ConnectionState) {
    this.connectionState = state;
    this.listeners.forEach(cb => cb(state));
  }

  getConnectionState() {
    return this.connectionState;
  }

  private async fetchWithRetry(
    endpoint: string,
    options: RequestInit = {},
    retries = MAX_RETRIES
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
       ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
         ...options.headers,
        },
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok && retries > 0) {
        await new Promise(r => setTimeout(r, 1000)); // backoff 1s
        return this.fetchWithRetry(endpoint, options, retries - 1);
      }
      
      if (res.ok) this.setConnectionState('LIVE');
      else this.setConnectionState('ERROR');
      
      return res;
    } catch (err) {
      clearTimeout(timeoutId);
      if (retries > 0) {
        await new Promise(r => setTimeout(r, 1000));
        return this.fetchWithRetry(endpoint, options, retries - 1);
      }
      this.setConnectionState('ERROR');
      throw err;
    }
  }

  // Real-time endpoints: 3s
  async getStatus() {
    const res = await this.fetchWithRetry('/api/status');
    return res.json();
  }

  // Low-frequency endpoints: 60s
  async getDashboard() {
    const res = await this.fetchWithRetry('/api/dashboard');
    return res.json();
  }

  async getLiquidityZones() {
    const res = await this.fetchWithRetry('/api/liquidity');
    return res.json();
  }

  async getHistory() {
    const res = await this.fetchWithRetry('/api/history');
    return res.json();
  }
}

export const api = new ApiS
