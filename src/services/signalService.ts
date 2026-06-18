const API_URL = import.meta.env.VITE_API_URL;
const WS_URL = import.meta.env.VITE_WS_URL;

export type SignalData = {
  status: 'STANDBY' | 'BUY' | 'SELL';
  entry: number | null;
  sl: number | null;
  tp1: number | null;
  tp2: number | null;
  timestamp: string;
}

export const connectSignalWS = (onMessage: (data: SignalData) => void) => {
  const ws = new WebSocket(WS_URL);
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onMessage(data);
  };
  return () => ws.close();
}
