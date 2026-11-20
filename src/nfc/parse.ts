import { ValidatorPayload } from '../types';

export function parseValidatorPayload(raw: string): ValidatorPayload {
  const clean = raw.trim();
  if (!clean) return {};
  if (clean.startsWith('{')) {
    const parsed = JSON.parse(clean);
    return {
      routeCode: String(parsed.route ?? parsed.ruta ?? ''),
      stop: String(parsed.stop ?? parsed.paradero ?? ''),
    };
  }
  const parts = clean.split('|').map((part) => part.trim());
  if (parts[0]?.toUpperCase() === 'ETUSA') {
    return { routeCode: parts[1] || undefined, stop: parts[2] || undefined };
  }
  return {};
}
