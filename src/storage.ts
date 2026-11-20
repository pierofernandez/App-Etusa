import AsyncStorage from '@react-native-async-storage/async-storage';
import { INITIAL_WALLET } from './data';
import { WalletData } from './types';

const KEY = 'etusa-pay-v1';
export async function loadWallet(): Promise<WalletData> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return INITIAL_WALLET;
    const parsed = JSON.parse(raw);
    if (typeof parsed.balance !== 'number' || !Array.isArray(parsed.trips)) throw new Error('Datos inválidos');
    return { ...INITIAL_WALLET, ...parsed } as WalletData;
  } catch {
    await AsyncStorage.removeItem(KEY).catch(() => undefined);
    return INITIAL_WALLET;
  }
}
export async function saveWallet(data: WalletData) {
  await AsyncStorage.setItem(KEY, JSON.stringify(data));
}
