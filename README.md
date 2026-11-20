# ETUSA Pay — aplicación móvil sin Machine Learning

Aplicación móvil multiplataforma basada en el Anexo 9 del documento de tesis. Se conserva el flujo de cobro, billetera, recargas, historial y comprobante; se excluye por completo el módulo de Machine Learning.

## Funcionalidades
- Billetera digital con saldo inicial de demostración de S/ 20,00.
- Pago NFC leyendo etiquetas NDEF con formato `ETUSA|ruta|paradero` o JSON (`{"ruta":"7501","paradero":"Miraflores"}`).
- Tarifas: general S/ 1,50 y medio pasaje S/ 0,75.
- Rechazo por saldo insuficiente y acceso a recargas de S/ 5, 10, 20 o 50.
- Historial de viajes y comprobante individual.
- Rutas de referencia 3511, 7501 y 1051.
- Transporte exprés configurable.
- Persistencia local con AsyncStorage y recuperación ante datos dañados.
- Control de repetición de lectura NFC en una misma sesión.
- Modo de demostración para probar el flujo sin un validador físico.

## Requisitos
- Node.js compatible con la versión de Expo instalada.
- Android Studio para compilar Android.
- Xcode en macOS para compilar iOS.
- Un teléfono Android con NFC y una etiqueta NDEF para probar el pago real.

## Instalación
```bash
npm install
npx expo prebuild
```

Android:
```bash
npx expo run:android
```

iOS (macOS):
```bash
npx expo run:ios
```

Para iniciar el servidor de desarrollo:
```bash
npx expo start
```

> `react-native-nfc-manager` necesita código nativo. Expo Go no incluye este módulo; utiliza un development build generado con `expo run:android` o `expo run:ios`.

## Etiqueta NFC de prueba
Graba un registro NDEF de texto con uno de estos valores:

```text
ETUSA|3511|Abancay
```

O JSON:

```json
{"ruta":"7501","paradero":"Miraflores"}
```

## Alcance y límites
- Las recargas y los pagos son operaciones locales de demostración. No se conecta a bancos ni a una pasarela de pago.
- El modo NFC lee el identificador de ruta/paradero del validador; no certifica por sí solo que exista una transacción financiera externa.
- El saldo y el historial se guardan en el dispositivo. Para una operación real de empresa se requeriría un backend transaccional y conciliación centralizada.
- No incluye Machine Learning, predicciones, Random Forest ni clasificación de jornadas.
