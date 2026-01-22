export function parseSizeToBytes(input: unknown): number | null {
  if (input === null || input === undefined) return null;

  const raw = String(input).trim();
  if (!raw) return null;

  const normalized = raw.replace(/_/g, "").trim();

  // Plain number => bytes
  if (/^\d+(?:\.\d+)?$/.test(normalized)) {
    const value = Number(normalized);
    if (!Number.isFinite(value) || value <= 0) return null;
    return Math.floor(value);
  }

  const match = /^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)$/.exec(normalized);
  if (!match) return null;

  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;

  const unit = match[2].toLowerCase();

  const multipliers: Record<string, number> = {
    b: 1,
    byte: 1,
    bytes: 1,

    k: 1024,
    kb: 1024,
    kib: 1024,

    m: 1024 * 1024,
    mb: 1024 * 1024,
    mib: 1024 * 1024,

    g: 1024 * 1024 * 1024,
    gb: 1024 * 1024 * 1024,
    gib: 1024 * 1024 * 1024,
  };

  const multiplier = multipliers[unit];
  if (!multiplier) return null;

  return Math.floor(value * multiplier);
}

export function formatMiB(bytes: number) {
  const mib = bytes / (1024 * 1024);
  if (!Number.isFinite(mib)) return `${bytes}B`;
  return `${mib.toFixed(mib >= 10 ? 0 : 1)}MB`;
}

