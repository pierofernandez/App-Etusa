import { Platform } from 'react-native';

let started = false;

function toBytes(payload: ArrayLike<number>): Uint8Array {
  return payload instanceof Uint8Array ? payload : Uint8Array.from(payload);
}

export async function readValidatorNfc(): Promise<string> {
  if (Platform.OS === 'web') {
    throw new Error('La lectura NFC nativa está disponible desde la aplicación instalada en un teléfono compatible.');
  }
  const { default: NfcManager, Ndef, NfcTech } = await import('react-native-nfc-manager');
  if (!started) {
    await NfcManager.start();
    started = true;
  }
  const supported = await NfcManager.isSupported();
  if (!supported) throw new Error('Este dispositivo no es compatible con NFC.');
  const enabled = await NfcManager.isEnabled();
  if (!enabled) throw new Error('Activa NFC en los ajustes de tu teléfono.');
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);
    const tag = await NfcManager.getTag();
    const record = tag?.ndefMessage?.[0];
    if (!record?.payload) throw new Error('El validador no contiene una etiqueta NDEF válida.');
    return Ndef.text.decodePayload(toBytes(record.payload));
  } finally {
    await NfcManager.cancelTechnologyRequest().catch(() => undefined);
  }
}
