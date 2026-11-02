import type { ServerFrame } from '@/@types/frames';

type RawFrame = Record<string, unknown>;
type FrameParser = (raw: RawFrame) => ServerFrame | null;

const isRecord = (value: unknown): value is RawFrame =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

const isDeliveryStatus = (value: unknown): value is 'delivered' | 'failed' =>
  value === 'delivered' || value === 'failed';

const parseIdentity: FrameParser = ({ address }) =>
  isString(address) ? { type: 'identity', address } : null;

const parseMessage: FrameParser = ({ id, from, content, ts }) => {
  if (!isString(id) || !isString(from)) return null;
  if (typeof content !== 'string' || typeof ts !== 'number') return null;
  return { type: 'message_received', id, from, content, ts };
};

const parseNeighborDiscovered: FrameParser = ({ id, transport, rssi }) => {
  if (!isString(id) || !isString(transport)) return null;
  return { type: 'neighbor_discovered', id, transport, ...(typeof rssi === 'number' ? { rssi } : {}) };
};

const parseNeighborLost: FrameParser = ({ id }) => (isString(id) ? { type: 'neighbor_lost', id } : null);

const parseDeliveryStatus: FrameParser = ({ id, status }) =>
  isString(id) && isDeliveryStatus(status) ? { type: 'delivery_status', id, status } : null;

const parseError: FrameParser = ({ code, message }) =>
  isString(code) && typeof message === 'string' ? { type: 'error', code, message } : null;

const PARSERS: Record<string, FrameParser> = {
  identity: parseIdentity,
  message_received: parseMessage,
  neighbor_discovered: parseNeighborDiscovered,
  neighbor_lost: parseNeighborLost,
  delivery_status: parseDeliveryStatus,
  error: parseError,
};

const decode = (data: unknown): unknown => {
  if (typeof data !== 'string') return data;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
};

/** Validates an untrusted WebSocket payload; returns null for anything malformed. */
export function parseFrame(data: unknown): ServerFrame | null {
  const raw = decode(data);
  if (!isRecord(raw) || typeof raw.type !== 'string') return null;
  const parse = Object.hasOwn(PARSERS, raw.type) ? PARSERS[raw.type] : undefined;
  return parse ? parse(raw) : null;
}
