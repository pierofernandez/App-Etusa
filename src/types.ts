export type FareType = 'general' | 'medio';
export type PaymentSource = 'nfc' | 'demo';

export type Trip = {
  id: string;
  routeCode: string;
  routeName: string;
  stop: string;
  amount: number; // céntimos
  fareType: FareType;
  paidAt: number;
  source: PaymentSource;
};

export type RouteInfo = { code: string; short: string; description: string; stops: string[] };
export type WalletData = {
  balance: number; // céntimos
  fareType: FareType;
  routeCode: string;
  express: boolean;
  trips: Trip[];
};

export type ValidatorPayload = { routeCode?: string; stop?: string };
