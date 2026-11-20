import { RouteInfo } from './types';

export const FARES = { general: 150, medio: 75 } as const;
export const RECHARGE_AMOUNTS = [500, 1000, 2000, 5000];
export const INITIAL_WALLET = {
  balance: 2000,
  fareType: 'general' as const,
  routeCode: '3511',
  express: false,
  trips: [],
};

export const ROUTES: RouteInfo[] = [
  { code: '3511', short: 'Ruta 3511', description: 'San Juan de Lurigancho – Magdalena', stops: ['Abancay', 'Centro de Lima', 'Brasil', 'Magdalena'] },
  { code: '7501', short: 'Ruta 7501', description: 'Servicio urbano ETUSA', stops: ['Miraflores', 'Angamos', 'Javier Prado'] },
  { code: '1051', short: 'Ruta 1051', description: 'Servicio urbano ETUSA', stops: ['Plaza Norte', 'Centro', 'San Isidro'] },
];

export const routeByCode = (code: string) => ROUTES.find((r) => r.code === code) ?? ROUTES[0];
export const money = (cents: number) => `S/ ${(cents / 100).toFixed(2)}`;
export const createId = () => `ET${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
