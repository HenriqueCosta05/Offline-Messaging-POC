import { parseFrame } from './frames';

const json = (frame: object) => JSON.stringify(frame);

describe('parseFrame', () => {
  it('parses a valid message frame', () => {
    const raw = json({ type: 'message_received', id: '1', from: 'bob', content: 'yo', ts: 5 });
    expect(parseFrame(raw)).toEqual({ type: 'message_received', id: '1', from: 'bob', content: 'yo', ts: 5 });
  });

  it.each([
    ['identity', { type: 'identity', address: 'me' }],
    ['neighbor with rssi', { type: 'neighbor_discovered', id: 'bob', transport: 'ble', rssi: -50 }],
    ['neighbor without rssi', { type: 'neighbor_discovered', id: 'bob', transport: 'ble' }],
    ['neighbor lost', { type: 'neighbor_lost', id: 'bob' }],
    ['delivered', { type: 'delivery_status', id: '1', status: 'delivered' }],
    ['failed', { type: 'delivery_status', id: '1', status: 'failed' }],
    ['error', { type: 'error', code: 'bad_frame', message: 'nope' }],
  ])('parses %s', (_label, frame) => {
    expect(parseFrame(json(frame))).toEqual(frame);
  });

  it('accepts an already decoded object', () => {
    expect(parseFrame({ type: 'neighbor_lost', id: 'bob' })).toEqual({ type: 'neighbor_lost', id: 'bob' });
  });

  it('drops a non-numeric rssi', () => {
    const frame = { type: 'neighbor_discovered', id: 'bob', transport: 'ble', rssi: 'x' };
    expect(parseFrame(json(frame))).toEqual({ type: 'neighbor_discovered', id: 'bob', transport: 'ble' });
  });

  it.each([
    ['not json', 'nope'],
    ['unknown type', json({ type: 'wat' })],
    ['inherited key as type', json({ type: 'toString' })],
    ['non-string type', json({ type: 1 })],
    ['missing fields', json({ type: 'message_received', id: '1' })],
    ['message without content', json({ type: 'message_received', id: '1', from: 'bob', ts: 1 })],
    ['identity without address', json({ type: 'identity' })],
    ['neighbor without transport', json({ type: 'neighbor_discovered', id: 'bob' })],
    ['neighbor lost without id', json({ type: 'neighbor_lost' })],
    ['bad status', json({ type: 'delivery_status', id: '1', status: 'maybe' })],
    ['error without message', json({ type: 'error', code: 'x' })],
    ['array', '[]'],
    ['binary', new ArrayBuffer(2)],
  ])('rejects %s', (_label, input) => {
    expect(parseFrame(input)).toBeNull();
  });
});
