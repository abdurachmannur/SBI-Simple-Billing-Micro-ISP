import net from 'net';
import tls from 'tls';
import crypto from 'crypto';
import https from 'https';

export interface MikrotikConnectionConfig {
  host: string;
  port: number;
  user: string;
  password?: string;
  protocol: 'api' | 'api-ssl' | 'rest-http' | 'rest-https';
  timeoutMs?: number;
}

// Encode word length per MikroTik RouterOS API specification
function encodeLength(len: number): Buffer {
  if (len < 0x80) {
    return Buffer.from([len]);
  }
  if (len < 0x4000) {
    const v = len | 0x8000;
    return Buffer.from([(v >> 8) & 0xff, v & 0xff]);
  }
  if (len < 0x200000) {
    const v = len | 0xc00000;
    return Buffer.from([(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff]);
  }
  if (len < 0x10000000) {
    const v = len | 0xe0000000;
    return Buffer.from([
      (v >>> 24) & 0xff,
      (v >> 16) & 0xff,
      (v >> 8) & 0xff,
      v & 0xff,
    ]);
  }
  return Buffer.from([
    0xf0,
    (len >>> 24) & 0xff,
    (len >> 16) & 0xff,
    (len >> 8) & 0xff,
    len & 0xff,
  ]);
}

function encodeSentence(words: string[]): Buffer {
  const parts: Buffer[] = [];
  for (const w of words) {
    const wordBuf = Buffer.from(w, 'utf8');
    parts.push(encodeLength(wordBuf.length));
    parts.push(wordBuf);
  }
  parts.push(Buffer.from([0])); // End of sentence
  return Buffer.concat(parts);
}

// Try reading a single length-prefixed word from buffer at offset
function readWordFromBuffer(
  buf: Buffer,
  offset: number
): { word: string; nextOffset: number } | null {
  if (offset >= buf.length) return null;
  const b0 = buf[offset];
  let len = 0;
  let headerBytes = 1;

  if ((b0 & 0x80) === 0x00) {
    len = b0;
    headerBytes = 1;
  } else if ((b0 & 0xc0) === 0x80) {
    if (offset + 2 > buf.length) return null;
    len = ((b0 & 0x3f) << 8) + buf[offset + 1];
    headerBytes = 2;
  } else if ((b0 & 0xe0) === 0xc0) {
    if (offset + 3 > buf.length) return null;
    len = ((b0 & 0x1f) << 16) + (buf[offset + 1] << 8) + buf[offset + 2];
    headerBytes = 3;
  } else if ((b0 & 0xf0) === 0xe0) {
    if (offset + 4 > buf.length) return null;
    len =
      ((b0 & 0x0f) << 24) +
      (buf[offset + 1] << 16) +
      (buf[offset + 2] << 8) +
      buf[offset + 3];
    headerBytes = 4;
  } else if (b0 === 0xf0) {
    if (offset + 5 > buf.length) return null;
    len =
      (buf[offset + 1] << 24) +
      (buf[offset + 2] << 16) +
      (buf[offset + 3] << 8) +
      buf[offset + 4];
    headerBytes = 5;
  }

  if (offset + headerBytes + len > buf.length) {
    return null;
  }

  const word = buf.toString('utf8', offset + headerBytes, offset + headerBytes + len);
  return {
    word,
    nextOffset: offset + headerBytes + len,
  };
}

function parseSentenceObject(words: string[]): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const w of words) {
    if (w.startsWith('=')) {
      const eqIdx = w.indexOf('=', 1);
      if (eqIdx !== -1) {
        const key = w.slice(1, eqIdx);
        const val = w.slice(eqIdx + 1);
        obj[key] = val;
      }
    }
  }
  return obj;
}

class RouterOSApiSocketSession {
  private socket: net.Socket | tls.TLSSocket | null = null;
  private rxBuffer: Buffer = Buffer.alloc(0);
  private currentSentence: string[] = [];
  private sentenceWaiters: {
    resolve: (sentences: string[][]) => void;
    reject: (err: Error) => void;
    collected: string[][];
  }[] = [];

  constructor(private config: MikrotikConnectionConfig) {}

  async connect(): Promise<void> {
    const timeout = this.config.timeoutMs || 8000;
    const host = this.config.host.trim();
    const port = Number(this.config.port) || (this.config.protocol === 'api-ssl' ? 8729 : 8728);

    await new Promise<void>((resolve, reject) => {
      const onError = (err: Error) => {
        cleanup();
        reject(new Error(`Gagal terhubung ke MikroTik (${host}:${port}): ${err.message}`));
      };

      const onTimeout = () => {
        cleanup();
        if (this.socket) this.socket.destroy();
        reject(
          new Error(
            `Waktu koneksi habis (timeout) saat menghubungi MikroTik ${host}:${port}. Pastikan IP Publik/VPN Tunnel dan Port API dapat diakses.`
          )
        );
      };

      const cleanup = () => {
        if (this.socket) {
          this.socket.removeListener('error', onError);
          this.socket.removeListener('timeout', onTimeout);
        }
      };

      if (this.config.protocol === 'api-ssl') {
        this.socket = tls.connect(
          {
            host,
            port,
            rejectUnauthorized: false,
          },
          () => {
            cleanup();
            resolve();
          }
        );
      } else {
        this.socket = net.createConnection({ host, port }, () => {
          cleanup();
          resolve();
        });
      }

      this.socket.setTimeout(timeout);
      this.socket.on('error', onError);
      this.socket.on('timeout', onTimeout);
    });

    if (!this.socket) throw new Error('Socket MikroTik tidak tersedia.');

    this.socket.on('data', (chunk: Buffer) => {
      this.rxBuffer = Buffer.concat([this.rxBuffer, chunk]);
      this.processRxBuffer();
    });

    this.socket.on('error', (err) => {
      while (this.sentenceWaiters.length > 0) {
        const w = this.sentenceWaiters.shift();
        w?.reject(err);
      }
    });

    this.socket.on('close', () => {
      while (this.sentenceWaiters.length > 0) {
        const w = this.sentenceWaiters.shift();
        w?.reject(new Error('Koneksi MikroTik tertutup sebelum perintah selesai.'));
      }
    });

    // Perform RouterOS API Login (supports RouterOS v6.43+ post-login & legacy challenge)
    const user = this.config.user.trim();
    const password = this.config.password || '';

    const loginRes = await this.sendRawCommand([
      '/login',
      `=name=${user}`,
      `=password=${password}`,
    ]);

    const doneSentence = loginRes.find((s) => s[0] === '!done') || [];
    const doneAttrs = parseSentenceObject(doneSentence);

    // Legacy RouterOS (< 6.43) returns =ret=<hex challenge>
    if (doneAttrs.ret) {
      const challenge = Buffer.from(doneAttrs.ret, 'hex');
      const md5 = crypto.createHash('md5');
      md5.update(Buffer.from([0]));
      md5.update(Buffer.from(password, 'utf8'));
      md5.update(challenge);
      const responseHex = '00' + md5.digest('hex');

      await this.sendRawCommand(['/login', `=name=${user}`, `=response=${responseHex}`]);
    }
  }

  private processRxBuffer() {
    let offset = 0;
    while (true) {
      const res = readWordFromBuffer(this.rxBuffer, offset);
      if (!res) break;
      offset = res.nextOffset;

      if (res.word === '') {
        // End of a sentence
        if (this.currentSentence.length > 0) {
          const completed = this.currentSentence;
          this.currentSentence = [];
          this.handleCompletedSentence(completed);
        }
      } else {
        this.currentSentence.push(res.word);
      }
    }
    if (offset > 0) {
      this.rxBuffer = this.rxBuffer.subarray(offset);
    }
  }

  private handleCompletedSentence(sentence: string[]) {
    const activeWaiter = this.sentenceWaiters[0];
    if (!activeWaiter) return;

    const tag = sentence[0];
    activeWaiter.collected.push(sentence);

    if (tag === '!done' || tag === '!fatal') {
      this.sentenceWaiters.shift();
      const trap = activeWaiter.collected.find((s) => s[0] === '!trap');
      if (trap) {
        const trapObj = parseSentenceObject(trap);
        activeWaiter.reject(
          new Error(trapObj.message || 'Perintah ditolak oleh MikroTik (!trap).')
        );
      } else if (tag === '!fatal') {
        activeWaiter.reject(new Error('Koneksi dihentikan oleh MikroTik (!fatal).'));
      } else {
        activeWaiter.resolve(activeWaiter.collected);
      }
    }
  }

  private sendRawCommand(words: string[]): Promise<string[][]> {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.destroyed) {
        reject(new Error('Koneksi socket MikroTik sudah tertutup.'));
        return;
      }
      this.sentenceWaiters.push({ resolve, reject, collected: [] });
      const encoded = encodeSentence(words);
      this.socket.write(encoded);
    });
  }

  async execute(command: string, params: Record<string, string> = {}): Promise<Record<string, string>[]> {
    const words = [command];
    for (const [k, v] of Object.entries(params)) {
      if (k.startsWith('?')) {
        words.push(`${k}=${v}`);
      } else {
        words.push(`=${k}=${v}`);
      }
    }
    const sentences = await this.sendRawCommand(words);
    return sentences
      .filter((s) => s[0] === '!re' || s[0] === '!done')
      .map((s) => parseSentenceObject(s))
      .filter((obj) => Object.keys(obj).length > 0);
  }

  close() {
    if (this.socket && !this.socket.destroyed) {
      this.socket.destroy();
    }
  }
}

// Helper for RouterOS v7 REST API (HTTP / HTTPS)
async function executeRestApi(
  config: MikrotikConnectionConfig,
  restPath: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?: Record<string, any>
): Promise<any> {
  const scheme = config.protocol === 'rest-https' ? 'https' : 'http';
  let cleanHost = config.host.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  const port = Number(config.port);
  const hostWithPort =
    port && !cleanHost.includes(':') && port !== 80 && port !== 443
      ? `${cleanHost}:${port}`
      : cleanHost;

  const url = `${scheme}://${hostWithPort}/rest/${restPath.replace(/^\/+/, '')}`;
  const authHeader =
    'Basic ' +
    Buffer.from(`${config.user.trim()}:${config.password || ''}`, 'utf8').toString('base64');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs || 8000);

  try {
    const fetchOptions: RequestInit = {
      method,
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    };
    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body);
    }

    // For Node.js fetch with self-signed HTTPS on RouterOS
    if (scheme === 'https') {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }

    const res = await fetch(url, fetchOptions);
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const errJson = await res.json();
        if (errJson?.detail || errJson?.message) {
          detail = errJson.detail || errJson.message;
        }
      } catch {
        // ignore
      }
      throw new Error(`MikroTik REST API gagal (${detail}).`);
    }
    if (res.status === 204) return {};
    return await res.json();
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`Waktu koneksi REST API habis saat menghubungi ${url}`);
    }
    throw new Error(err?.message || `Gagal menghubungi MikroTik REST API di ${url}`);
  } finally {
    clearTimeout(timer);
  }
}

export function parseRouterOsUptimeToSeconds(uptimeStr: string): number {
  if (!uptimeStr) return 0;
  let total = 0;
  const weeks = uptimeStr.match(/(\d+)w/);
  const days = uptimeStr.match(/(\d+)d/);
  const hours = uptimeStr.match(/(\d+)h/);
  const mins = uptimeStr.match(/(\d+)m/);
  const secs = uptimeStr.match(/(\d+)s/);
  if (weeks) total += Number(weeks[1]) * 7 * 86400;
  if (days) total += Number(days[1]) * 86400;
  if (hours) total += Number(hours[1]) * 3600;
  if (mins) total += Number(mins[1]) * 60;
  if (secs) total += Number(secs[1]);
  return total;
}

export async function testMikrotikConnection(config: MikrotikConnectionConfig) {
  if (!config.host || !config.user) {
    throw new Error('Host/IP MikroTik dan Username wajib diisi.');
  }

  if (config.protocol === 'rest-http' || config.protocol === 'rest-https') {
    const [resource, identityObj] = await Promise.all([
      executeRestApi(config, 'system/resource'),
      executeRestApi(config, 'system/identity').catch(() => ({ name: 'MikroTik' })),
    ]);
    return {
      identity: identityObj?.name || 'MikroTik Router',
      boardName: resource?.['board-name'] || resource?.platform || 'RouterOS',
      version: resource?.version || '-',
      uptime: resource?.uptime || '-',
      cpuLoad: Number(resource?.['cpu-load'] || 0),
    };
  }

  const session = new RouterOSApiSocketSession(config);
  try {
    await session.connect();
    const resList = await session.execute('/system/resource/print');
    const idList = await session.execute('/system/identity/print').catch(() => []);
    const resource = resList[0] || {};
    const identity = idList[0]?.name || 'MikroTik Router';

    return {
      identity,
      boardName: resource['board-name'] || resource.platform || 'RouterOS',
      version: resource.version || '-',
      uptime: resource.uptime || '-',
      cpuLoad: Number(resource['cpu-load'] || 0),
    };
  } finally {
    session.close();
  }
}

export interface RawMikrotikSnapshot {
  identity: string;
  resource: Record<string, any>;
  pppSecrets: Record<string, any>[];
  pppActive: Record<string, any>[];
  simpleQueues: Record<string, any>[];
  netwatch: Record<string, any>[];
  arpList: Record<string, any>[];
}

export async function fetchMikrotikSnapshot(
  config: MikrotikConnectionConfig
): Promise<RawMikrotikSnapshot> {
  if (!config.host || !config.user) {
    throw new Error(
      'Konfigurasi MikroTik belum diatur. Silakan atur Host/IP Publik, Port, dan Username MikroTik di Pengaturan.'
    );
  }

  if (config.protocol === 'rest-http' || config.protocol === 'rest-https') {
    const [resource, identityObj, pppSecrets, pppActive, simpleQueues, netwatch, arpList] =
      await Promise.all([
        executeRestApi(config, 'system/resource'),
        executeRestApi(config, 'system/identity').catch(() => ({ name: 'MikroTik' })),
        executeRestApi(config, 'ppp/secret').catch(() => []),
        executeRestApi(config, 'ppp/active').catch(() => []),
        executeRestApi(config, 'queue/simple').catch(() => []),
        executeRestApi(config, 'tool/netwatch').catch(() => []),
        executeRestApi(config, 'ip/arp').catch(() => []),
      ]);

    return {
      identity: identityObj?.name || 'MikroTik Router',
      resource: resource || {},
      pppSecrets: Array.isArray(pppSecrets) ? pppSecrets : [],
      pppActive: Array.isArray(pppActive) ? pppActive : [],
      simpleQueues: Array.isArray(simpleQueues) ? simpleQueues : [],
      netwatch: Array.isArray(netwatch) ? netwatch : [],
      arpList: Array.isArray(arpList) ? arpList : [],
    };
  }

  const session = new RouterOSApiSocketSession(config);
  try {
    await session.connect();
    const resList = await session.execute('/system/resource/print');
    const idList = await session.execute('/system/identity/print').catch(() => []);
    const pppSecrets = await session.execute('/ppp/secret/print').catch(() => []);
    const pppActive = await session.execute('/ppp/active/print').catch(() => []);
    const simpleQueues = await session.execute('/queue/simple/print').catch(() => []);
    const netwatch = await session.execute('/tool/netwatch/print').catch(() => []);
    const arpList = await session.execute('/ip/arp/print').catch(() => []);

    return {
      identity: idList[0]?.name || 'MikroTik Router',
      resource: resList[0] || {},
      pppSecrets,
      pppActive,
      simpleQueues,
      netwatch,
      arpList,
    };
  } finally {
    session.close();
  }
}

export async function executeMikrotikControlAction(
  config: MikrotikConnectionConfig,
  action: 'isolate' | 'unisolate' | 'kick',
  params: {
    secretId?: string;
    activeSessionId?: string;
    queueId?: string;
    targetAccount?: string;
  }
): Promise<{ message: string }> {
  if (config.protocol === 'rest-http' || config.protocol === 'rest-https') {
    if (action === 'kick') {
      if (!params.activeSessionId) {
        throw new Error('ID sesi aktif PPPoE tidak ditemukan untuk di-reset.');
      }
      await executeRestApi(
        config,
        `ppp/active/${encodeURIComponent(params.activeSessionId)}`,
        'DELETE'
      );
      return { message: `Sesi aktif "${params.targetAccount || ''}" berhasil di-reset.` };
    }

    const disableFlag = action === 'isolate' ? 'true' : 'false';
    if (params.secretId) {
      await executeRestApi(
        config,
        `ppp/secret/${encodeURIComponent(params.secretId)}`,
        'PATCH',
        { disabled: disableFlag }
      );
      // If isolating and currently active, also kick active session so isolation takes effect immediately
      if (action === 'isolate' && params.activeSessionId) {
        await executeRestApi(
          config,
          `ppp/active/${encodeURIComponent(params.activeSessionId)}`,
          'DELETE'
        ).catch(() => {});
      }
      return {
        message:
          action === 'isolate'
            ? `Akun PPPoE "${params.targetAccount}" berhasil diisolir (disabled).`
            : `Isolir akun PPPoE "${params.targetAccount}" berhasil dibuka (enabled).`,
      };
    }

    if (params.queueId) {
      await executeRestApi(
        config,
        `queue/simple/${encodeURIComponent(params.queueId)}`,
        'PATCH',
        { disabled: disableFlag }
      );
      return {
        message:
          action === 'isolate'
            ? `Simple Queue "${params.targetAccount}" berhasil dinonaktifkan.`
            : `Simple Queue "${params.targetAccount}" berhasil diaktifkan kembali.`,
      };
    }

    throw new Error('ID PPPoE Secret atau Simple Queue pelanggan tidak ditemukan di MikroTik.');
  }

  // RouterOS Socket API
  const session = new RouterOSApiSocketSession(config);
  try {
    await session.connect();
    if (action === 'kick') {
      if (!params.activeSessionId) {
        throw new Error('ID sesi aktif PPPoE tidak ditemukan untuk di-reset.');
      }
      await session.execute('/ppp/active/remove', { '.id': params.activeSessionId });
      return { message: `Sesi aktif "${params.targetAccount || ''}" berhasil di-reset.` };
    }

    const disabledVal = action === 'isolate' ? 'yes' : 'no';
    if (params.secretId) {
      await session.execute('/ppp/secret/set', {
        '.id': params.secretId,
        disabled: disabledVal,
      });
      if (action === 'isolate' && params.activeSessionId) {
        await session
          .execute('/ppp/active/remove', { '.id': params.activeSessionId })
          .catch(() => {});
      }
      return {
        message:
          action === 'isolate'
            ? `Akun PPPoE "${params.targetAccount}" berhasil diisolir (disabled).`
            : `Isolir akun PPPoE "${params.targetAccount}" berhasil dibuka (enabled).`,
      };
    }

    if (params.queueId) {
      await session.execute('/queue/simple/set', {
        '.id': params.queueId,
        disabled: disabledVal,
      });
      return {
        message:
          action === 'isolate'
            ? `Simple Queue "${params.targetAccount}" berhasil dinonaktifkan.`
            : `Simple Queue "${params.targetAccount}" berhasil diaktifkan kembali.`,
      };
    }

    throw new Error('ID PPPoE Secret atau Simple Queue pelanggan tidak ditemukan di MikroTik.');
  } finally {
    session.close();
  }
}
