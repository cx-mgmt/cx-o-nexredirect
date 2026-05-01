import path from "path";
import fs from "fs";

const MMDB_PATH = process.env.NEXREDIRECT_GEOIP_PATH || path.join(process.cwd(), "data", "GeoLite2-Country.mmdb");

type CountryResponse = { country?: { iso_code?: string } };
type Reader = { get: (ip: string) => CountryResponse | null };

let _reader: Reader | null = null;
let _loadAttempted = false;

async function getReader(): Promise<Reader | null> {
  if (_reader) return _reader;
  if (_loadAttempted) return null;
  _loadAttempted = true;
  if (!fs.existsSync(MMDB_PATH)) return null;
  try {
    const maxmind = await import("maxmind");
    _reader = (await maxmind.open(MMDB_PATH)) as unknown as Reader;
    return _reader;
  } catch {
    return null;
  }
}

export function resetGeoReader() {
  _reader = null;
  _loadAttempted = false;
}

export function geoStatus(): { available: boolean; path: string } {
  return { available: fs.existsSync(MMDB_PATH), path: MMDB_PATH };
}

export async function lookupCountry(ip: string): Promise<string | null> {
  const r = await getReader();
  if (!r) return null;
  try {
    const result = r.get(ip);
    return result?.country?.iso_code ?? null;
  } catch {
    return null;
  }
}
