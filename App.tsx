import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { FARES, INITIAL_WALLET, RECHARGE_AMOUNTS, ROUTES, createId, money, routeByCode } from './src/data';
import { loadWallet, saveWallet } from './src/storage';
import { readValidatorNfc } from './src/nfc/native';
import { parseValidatorPayload } from './src/nfc/parse';
import { FareType, PaymentSource, Trip, WalletData } from './src/types';

const C = { navy: '#102A43', blue: '#1769E0', blue2: '#EAF2FF', ink: '#142536', muted: '#718096', line: '#E7EDF3', bg: '#F4F7FB', white: '#FFFFFF', green: '#15966A', greenBg: '#E8F7F0', red: '#C74747', amber: '#A66A13' };
type Tab = 'inicio' | 'actividad' | 'pase';

function Icon({ name, size = 20, color = C.ink }: { name: string; size?: number; color?: string }) {
  const glyphs: Record<string, string> = { home: '⌂', list: '▤', card: '▣', nfc: ')))', arrow: '↗', plus: '+', bus: '▰', clock: '◷', check: '✓', wallet: '▣', chevron: '›', bolt: 'ϟ' };
  return <Text style={{ color, fontSize: size, fontWeight: '700' }}>{glyphs[name] ?? '•'}</Text>;
}
function moneyText(amount: number) { return money(amount); }
function dateLabel(timestamp: number) { return new Date(timestamp).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }

export default function App() {
  const [wallet, setWallet] = useState<WalletData>(INITIAL_WALLET);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>('inicio');
  const [busy, setBusy] = useState(false);
  const [lastTrip, setLastTrip] = useState<Trip | null>(null);
  const [showRecharge, setShowRecharge] = useState(false);
  const [selectedRecharge, setSelectedRecharge] = useState(1000);
  const [showPay, setShowPay] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [routePicker, setRoutePicker] = useState(false);
  const [farePicker, setFarePicker] = useState(false);
  const lastReadRef = useRef<{ key: string; at: number } | null>(null);

  useEffect(() => { loadWallet().then(setWallet).finally(() => setLoaded(true)); }, []);
  useEffect(() => { if (loaded) saveWallet(wallet).catch(() => Alert.alert('Guardado', 'No se pudo guardar el estado local.')); }, [wallet, loaded]);

  const currentRoute = routeByCode(wallet.routeCode);
  const fare = FARES[wallet.fareType];
  const groupedTrips = useMemo(() => {
    const groups: { title: string; trips: Trip[] }[] = [];
    wallet.trips.forEach((trip) => {
      const title = new Date(trip.paidAt).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
      const existing = groups.find((g) => g.title === title);
      if (existing) existing.trips.push(trip); else groups.push({ title, trips: [trip] });
    });
    return groups;
  }, [wallet.trips]);

  const finishPayment = useCallback(async (payloadText: string, source: PaymentSource, readId: string) => {
    const now = Date.now();
    if (lastReadRef.current?.key === readId && now - lastReadRef.current.at < 4000) return;
    lastReadRef.current = { key: readId, at: now };
    let payload = {};
    try { payload = parseValidatorPayload(payloadText); } catch { Alert.alert('Validador no reconocido', 'La información de la etiqueta NFC no tiene un formato válido.'); return; }
    const p = payload as { routeCode?: string; stop?: string };
    const route = routeByCode(p.routeCode || wallet.routeCode);
    if (wallet.balance < fare) {
      setShowPay(false); setShowRecharge(true);
      Alert.alert('Saldo insuficiente', 'No tienes saldo suficiente para realizar este viaje. Recarga tu billetera para continuar.');
      return;
    }
    const trip: Trip = {
      id: createId(), routeCode: route.code, routeName: route.short,
      stop: p.stop || route.stops[0], amount: fare, fareType: wallet.fareType,
      paidAt: now, source,
    };
    const next: WalletData = { ...wallet, balance: wallet.balance - fare, trips: [trip, ...wallet.trips].slice(0, 50), routeCode: route.code };
    setWallet(next); setLastTrip(trip); setShowPay(false);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, [fare, wallet]);

  const payWithNfc = async () => {
    setBusy(true);
    try {
      const payload = await readValidatorNfc();
      await finishPayment(payload, 'nfc', `nfc-${Date.now()}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo leer el validador.';
      Alert.alert('No se pudo leer NFC', message);
    } finally { setBusy(false); }
  };

  const handlePayPress = () => {
    if (wallet.express) { payWithNfc(); } else { setShowPay(true); }
  };

  const demoPayment = async () => {
    const route = routeByCode(wallet.routeCode);
    await finishPayment(`ETUSA|${route.code}|${route.stops[0]}`, 'demo', `demo-${Date.now()}`);
  };

  const recharge = async () => {
    const next = { ...wallet, balance: wallet.balance + selectedRecharge };
    setWallet(next); setShowRecharge(false);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    Alert.alert('Recarga registrada', `Se agregaron ${moneyText(selectedRecharge)} a tu saldo de prueba.`);
  };

  const setFare = (value: FareType) => { setWallet((w) => ({ ...w, fareType: value })); setFarePicker(false); };
  const setRoute = (code: string) => { setWallet((w) => ({ ...w, routeCode: code })); setRoutePicker(false); };

  if (!loaded) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={s.loading}><ActivityIndicator size="large" color={C.blue} /><Text style={s.muted}>Preparando tu billetera…</Text></SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View style={s.topbar}>
        <View style={s.brandMark}><Text style={s.brandArrow}>↑</Text></View>
        <View style={{ flex: 1 }}><Text style={s.brand}>ETUSA <Text style={{ color: C.blue }}>Pay</Text></Text><Text style={s.brandSub}>TU VIAJE, MÁS SIMPLE</Text></View>
        <View style={s.onlinePill}><View style={s.onlineDot}/><Text style={s.onlineText}>Billetera local</Text></View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {tab === 'inicio' && <>
          <View style={s.greeting}><Text style={s.eyebrow}>TU BILLETERA DIGITAL</Text><Text style={s.heading}>Hola, pasajero</Text><Text style={s.muted}>Todo listo para tu próximo viaje.</Text></View>
          <View style={s.balanceCard}>
            <View style={s.balanceTop}><Text style={s.balanceLabel}>SALDO DISPONIBLE</Text><View style={s.balanceIcon}><Icon name="wallet" color="#FFFFFF" size={18}/></View></View>
            <Text style={s.balance}>{moneyText(wallet.balance)}</Text>
            <View style={s.balanceBottom}><Text style={s.balanceHint}>Saldo guardado en este dispositivo</Text><Pressable style={s.addBalance} onPress={() => setShowRecharge(true)}><Icon name="plus" color={C.navy} size={15}/><Text style={s.addBalanceText}>Recargar</Text></Pressable></View>
          </View>
          <View style={s.sectionHeader}><Text style={s.sectionTitle}>Paga tu pasaje</Text><Text style={s.sectionHint}>Rápido y sin efectivo</Text></View>
          <View style={s.payCard}>
            <View style={s.nfcCircle}><Text style={s.nfcGlyph}>)))</Text></View>
            <Text style={s.payTitle}>Acerca tu celular al validador</Text>
            <Text style={s.payDescription}>Lee la etiqueta NFC del bus y confirma tu pago automáticamente.</Text>
            <View style={s.payMeta}><View><Text style={s.metaLabel}>TARIFA ACTUAL</Text><Text style={s.metaValue}>{moneyText(fare)}</Text></View><View style={s.metaDivider}/><View><Text style={s.metaLabel}>RUTA</Text><Text style={s.metaValue}>{currentRoute.code}</Text></View></View>
            <Pressable style={({ pressed }) => [s.primaryButton, pressed && s.pressed, busy && s.disabled]} onPress={handlePayPress} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff"/> : <><Icon name="nfc" color="#fff" size={20}/><Text style={s.primaryButtonText}>Pagar pasaje</Text></>}
            </Pressable>
            <Text style={s.secureNote}>Pago de prueba · No se realiza ningún cargo bancario</Text>
          </View>
          <View style={s.sectionHeader}><Text style={s.sectionTitle}>Configura tu viaje</Text></View>
          <View style={s.settingCard}>
            <Pressable style={s.settingRow} onPress={() => setRoutePicker(true)}><View style={s.settingIcon}><Icon name="bus" color={C.blue}/></View><View style={{ flex: 1 }}><Text style={s.settingTitle}>Ruta seleccionada</Text><Text style={s.settingSub}>{currentRoute.code} · {currentRoute.description}</Text></View><Icon name="chevron" color={C.muted} size={25}/></Pressable>
            <View style={s.separator}/>
            <Pressable style={s.settingRow} onPress={() => setFarePicker(true)}><View style={s.settingIcon}><Icon name="card" color={C.blue}/></View><View style={{ flex: 1 }}><Text style={s.settingTitle}>Tipo de tarifa</Text><Text style={s.settingSub}>{wallet.fareType === 'general' ? 'General · S/ 1,50' : 'Medio pasaje · S/ 0,75'}</Text></View><Icon name="chevron" color={C.muted} size={25}/></Pressable>
            <View style={s.separator}/>
            <View style={s.settingRow}><View style={s.settingIcon}><Icon name="bolt" color={C.blue}/></View><View style={{ flex: 1 }}><Text style={s.settingTitle}>Transporte exprés</Text><Text style={s.settingSub}>Pagar sin confirmación previa</Text></View><Switch value={wallet.express} onValueChange={(value) => setWallet((w) => ({ ...w, express: value }))} trackColor={{ false: '#D7E0EA', true: C.blue }} thumbColor="#fff"/></View>
          </View>
          <View style={s.sectionHeader}><Text style={s.sectionTitle}>Últimos movimientos</Text><Pressable onPress={() => setTab('actividad')}><Text style={s.link}>Ver todos</Text></Pressable></View>
          {wallet.trips.length === 0 ? <EmptyState title="Aún no tienes viajes" subtitle="Cuando realices tu primer pago, aparecerá aquí."/> : wallet.trips.slice(0, 2).map((trip) => <TripRow key={trip.id} trip={trip} onPress={() => setSelectedTrip(trip)}/>)}
        </>}

        {tab === 'actividad' && <>
          <Text style={s.eyebrow}>TU HISTORIAL</Text><Text style={s.heading}>Actividad de viajes</Text><Text style={s.muted}>Consulta tus pagos y comprobantes.</Text>
          <View style={s.statsRow}><View style={s.statCard}><Text style={s.statNumber}>{wallet.trips.length}</Text><Text style={s.statLabel}>Viajes registrados</Text></View><View style={s.statCard}><Text style={s.statNumber}>{moneyText(wallet.trips.reduce((a, t) => a + t.amount, 0))}</Text><Text style={s.statLabel}>Total pagado</Text></View></View>
          {groupedTrips.length === 0 ? <EmptyState title="Tu actividad está vacía" subtitle="Tus viajes se guardarán aquí automáticamente después de cada pago."/> : groupedTrips.map((group) => <View key={group.title} style={s.group}><Text style={s.groupTitle}>{group.title}</Text>{group.trips.map((trip) => <TripRow key={trip.id} trip={trip} onPress={() => setSelectedTrip(trip)}/>)}</View>)}
        </>}

        {tab === 'pase' && <>
          <Text style={s.eyebrow}>ETUSA PAY</Text><Text style={s.heading}>Mi pase</Text><Text style={s.muted}>Tu información de viaje en un solo lugar.</Text>
          <View style={s.passCard}><View style={s.passHeader}><Text style={s.passBrand}>ETUSA <Text style={{ color: '#9FC5FF' }}>Pay</Text></Text><Text style={s.passChip}>PASE DIGITAL</Text></View><Text style={s.passLabel}>SALDO DISPONIBLE</Text><Text style={s.passBalance}>{moneyText(wallet.balance)}</Text><View style={s.passLine}/><View style={s.passInfoRow}><View><Text style={s.passSmall}>RUTA FAVORITA</Text><Text style={s.passInfo}>{currentRoute.code}</Text></View><View><Text style={s.passSmall}>TARIFA</Text><Text style={s.passInfo}>{wallet.fareType === 'general' ? 'General' : 'Medio pasaje'}</Text></View></View></View>
          <View style={s.settingCard}><Text style={s.sectionTitle}>Preferencias</Text><View style={s.settingRow}><View style={s.settingIcon}><Icon name="bolt" color={C.blue}/></View><View style={{ flex: 1 }}><Text style={s.settingTitle}>Transporte exprés</Text><Text style={s.settingSub}>{wallet.express ? 'Activado' : 'Desactivado'}</Text></View><Switch value={wallet.express} onValueChange={(value) => setWallet((w) => ({ ...w, express: value }))} trackColor={{ false: '#D7E0EA', true: C.blue }} thumbColor="#fff"/></View></View>
          <View style={s.privacyNote}><Text style={s.privacyTitle}>Tu información, protegida</Text><Text style={s.privacyText}>ETUSA Pay guarda el saldo y los viajes localmente en tu dispositivo. No solicita nombre, documento ni datos de tarjetas.</Text></View>
          <Pressable style={s.outlineButton} onPress={() => { Alert.alert('Restablecer billetera', '¿Deseas volver al saldo inicial de prueba y borrar el historial de este dispositivo?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Restablecer', style: 'destructive', onPress: () => { setWallet(INITIAL_WALLET); setLastTrip(null); } }]); }}><Text style={s.outlineButtonText}>Restablecer datos de prueba</Text></Pressable>
        </>}
      </ScrollView>

      <View style={s.tabbar}>
        <TabButton label="Inicio" icon="home" active={tab === 'inicio'} onPress={() => setTab('inicio')}/>
        <TabButton label="Actividad" icon="list" active={tab === 'actividad'} onPress={() => setTab('actividad')}/>
        <TabButton label="Mi pase" icon="card" active={tab === 'pase'} onPress={() => setTab('pase')}/>
      </View>

      {showPay && <Modal title="Pagar pasaje" onClose={() => setShowPay(false)}>
        <View style={s.modalNfc}><Text style={s.modalNfcGlyph}>)))</Text></View>
        <Text style={s.modalTitle}>Listo para acercar</Text><Text style={s.modalText}>{wallet.express ? 'Aproxima la parte superior de tu celular al validador NFC del bus.' : 'Confirma que deseas pagar con esta billetera y aproxima tu celular al validador NFC del bus.'}</Text>
        <View style={s.modalSummary}><Text style={s.modalSummaryLabel}>Importe del pasaje</Text><Text style={s.modalSummaryAmount}>{moneyText(fare)}</Text><Text style={s.modalSummaryDetail}>{currentRoute.code} · {wallet.fareType === 'general' ? 'Tarifa general' : 'Medio pasaje'}</Text></View>
        <Pressable style={s.primaryButton} onPress={payWithNfc} disabled={busy}>{busy ? <ActivityIndicator color="#fff"/> : <><Icon name="nfc" color="#fff"/><Text style={s.primaryButtonText}>Leer validador NFC</Text></>}</Pressable>
        <Pressable style={s.demoButton} onPress={demoPayment}><Text style={s.demoButtonText}>Probar pago de demostración</Text></Pressable>
        <Text style={s.secureNote}>La demostración registra un viaje ficticio y descuenta el saldo local.</Text>
      </Modal>}

      {showRecharge && <Modal title="Recargar billetera" onClose={() => setShowRecharge(false)}>
        <Text style={s.modalText}>Selecciona un monto para agregar a tu saldo de prueba.</Text>
        <View style={s.amountGrid}>{RECHARGE_AMOUNTS.map((amount) => <Pressable key={amount} onPress={() => setSelectedRecharge(amount)} style={[s.amountOption, selectedRecharge === amount && s.amountSelected]}><Text style={[s.amountText, selectedRecharge === amount && s.amountTextSelected]}>{moneyText(amount)}</Text></Pressable>)}</View>
        <View style={s.modalSummary}><Text style={s.modalSummaryLabel}>Nuevo saldo</Text><Text style={s.modalSummaryAmount}>{moneyText(wallet.balance + selectedRecharge)}</Text><Text style={s.modalSummaryDetail}>Saldo actual: {moneyText(wallet.balance)}</Text></View>
        <Pressable style={s.primaryButton} onPress={recharge}><Icon name="plus" color="#fff"/><Text style={s.primaryButtonText}>Confirmar recarga de prueba</Text></Pressable>
        <Text style={s.secureNote}>La recarga es simulada. No se conecta a una pasarela bancaria.</Text>
      </Modal>}

      {routePicker && <Modal title="Seleccionar ruta" onClose={() => setRoutePicker(false)}>{ROUTES.map((route) => <Pressable key={route.code} style={[s.choiceRow, wallet.routeCode === route.code && s.choiceActive]} onPress={() => setRoute(route.code)}><View style={s.settingIcon}><Icon name="bus" color={C.blue}/></View><View style={{ flex: 1 }}><Text style={s.settingTitle}>{route.code}</Text><Text style={s.settingSub}>{route.description}</Text></View>{wallet.routeCode === route.code && <Text style={s.choiceCheck}>✓</Text>}</Pressable>)}</Modal>}
      {farePicker && <Modal title="Tipo de tarifa" onClose={() => setFarePicker(false)}>{(['general', 'medio'] as FareType[]).map((value) => <Pressable key={value} style={[s.choiceRow, wallet.fareType === value && s.choiceActive]} onPress={() => setFare(value)}><View style={{ flex: 1 }}><Text style={s.settingTitle}>{value === 'general' ? 'Tarifa general' : 'Medio pasaje'}</Text><Text style={s.settingSub}>{moneyText(FARES[value])} por viaje</Text></View>{wallet.fareType === value && <Text style={s.choiceCheck}>✓</Text>}</Pressable>)}</Modal>}
      {selectedTrip && <Modal title="Comprobante de viaje" onClose={() => setSelectedTrip(null)}><View style={s.receiptIcon}><Icon name="check" color={C.green} size={28}/></View><Text style={s.modalTitle}>Pago registrado</Text><Text style={s.modalText}>Tu viaje quedó guardado en este dispositivo.</Text><View style={s.receiptBox}><ReceiptLine label="Código" value={selectedTrip.id}/><ReceiptLine label="Ruta" value={selectedTrip.routeCode}/><ReceiptLine label="Paradero" value={selectedTrip.stop}/><ReceiptLine label="Fecha" value={dateLabel(selectedTrip.paidAt)}/><ReceiptLine label="Tarifa" value={selectedTrip.fareType === 'general' ? 'General' : 'Medio pasaje'}/><ReceiptLine label="Medio" value={selectedTrip.source === 'nfc' ? 'NFC' : 'Demostración'}/><View style={s.separator}/><ReceiptLine label="Total pagado" value={moneyText(selectedTrip.amount)} strong/></View><Pressable style={s.primaryButton} onPress={() => setSelectedTrip(null)}><Text style={s.primaryButtonText}>Listo</Text></Pressable></Modal>}
      {lastTrip && <View pointerEvents="none" style={s.toast}><View style={s.toastCheck}><Icon name="check" color="#fff" size={15}/></View><View style={{ flex: 1 }}><Text style={s.toastTitle}>¡Pago exitoso!</Text><Text style={s.toastSub}>{moneyText(lastTrip.amount)} · Ruta {lastTrip.routeCode}</Text></View><Pressable pointerEvents="auto" onPress={() => { setSelectedTrip(lastTrip); setLastTrip(null); }}><Text style={s.link}>Ver</Text></Pressable><Pressable pointerEvents="auto" onPress={() => setLastTrip(null)}><Text style={s.toastClose}>×</Text></Pressable></View>}
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

function TabButton({ label, icon, active, onPress }: { label: string; icon: string; active: boolean; onPress: () => void }) {
  return <Pressable style={s.tabButton} onPress={onPress}><Icon name={icon} size={21} color={active ? C.blue : C.muted}/><Text style={[s.tabLabel, active && s.tabLabelActive]}>{label}</Text></Pressable>;
}
function TripRow({ trip, onPress }: { trip: Trip; onPress: () => void }) {
  return <Pressable style={s.tripRow} onPress={onPress}><View style={s.tripIcon}><Icon name="bus" color={C.blue}/></View><View style={{ flex: 1 }}><Text style={s.tripTitle}>{trip.routeName} · {trip.stop}</Text><Text style={s.tripSub}>{dateLabel(trip.paidAt)} · {trip.source === 'nfc' ? 'NFC' : 'Demo'}</Text></View><View style={{ alignItems: 'flex-end' }}><Text style={s.tripAmount}>− {moneyText(trip.amount)}</Text><Text style={s.tripDetail}>Comprobante ›</Text></View></Pressable>;
}
function EmptyState({ title, subtitle }: { title: string; subtitle: string }) { return <View style={s.empty}><View style={s.emptyIcon}><Icon name="list" color={C.muted} size={25}/></View><Text style={s.emptyTitle}>{title}</Text><Text style={s.emptyText}>{subtitle}</Text></View>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <View style={s.overlay}><Pressable style={s.backdrop} onPress={onClose}/><View style={s.sheet}><View style={s.sheetHandle}/><View style={s.sheetHeader}><Text style={s.sheetTitle}>{title}</Text><Pressable onPress={onClose} style={s.closeButton}><Text style={s.closeText}>×</Text></Pressable></View><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>{children}</ScrollView></View></View>; }
function ReceiptLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) { return <View style={s.receiptLine}><Text style={s.receiptLabel}>{label}</Text><Text style={[s.receiptValue, strong && { color: C.blue, fontSize: 18, fontWeight: '800' }]}>{value}</Text></View>; }

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: C.bg }, topbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingTop: 8, paddingBottom: 12, gap: 11 }, brandMark: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center' }, brandArrow: { color: '#fff', fontSize: 28, fontWeight: '900', lineHeight: 32 }, brand: { color: C.navy, fontSize: 19, fontWeight: '900', letterSpacing: -0.5 }, brandSub: { color: C.muted, fontSize: 8, fontWeight: '800', letterSpacing: 1.5, marginTop: 1 }, onlinePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E9F7F0', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7 }, onlineDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: C.green }, onlineText: { color: C.green, fontSize: 10, fontWeight: '700' }, scroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 34 }, greeting: { marginBottom: 18 }, eyebrow: { color: C.blue, fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 6 }, heading: { color: C.ink, fontSize: 27, lineHeight: 33, fontWeight: '900', letterSpacing: -0.8, marginBottom: 4 }, muted: { color: C.muted, fontSize: 13, lineHeight: 19 }, balanceCard: { backgroundColor: C.navy, borderRadius: 23, padding: 21, marginBottom: 26, overflow: 'hidden' }, balanceTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, balanceLabel: { color: '#B7C8D9', fontSize: 10, fontWeight: '800', letterSpacing: 1.3 }, balanceIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#294B6B', alignItems: 'center', justifyContent: 'center' }, balance: { color: '#fff', fontSize: 36, fontWeight: '900', letterSpacing: -1.2, marginTop: 11, marginBottom: 15 }, balanceBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#34516D', paddingTop: 14 }, balanceHint: { color: '#B7C8D9', fontSize: 10 }, addBalance: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 13 }, addBalanceText: { color: C.navy, fontSize: 11, fontWeight: '800' }, sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, marginTop: 2 }, sectionTitle: { color: C.ink, fontSize: 16, fontWeight: '800' }, sectionHint: { color: C.muted, fontSize: 11 }, payCard: { backgroundColor: C.white, borderRadius: 22, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: C.line, marginBottom: 25 }, nfcCircle: { width: 66, height: 66, borderRadius: 22, backgroundColor: C.blue2, alignItems: 'center', justifyContent: 'center', marginBottom: 13 }, nfcGlyph: { color: C.blue, fontSize: 27, fontWeight: '900', letterSpacing: -5, marginRight: 5 }, payTitle: { color: C.ink, fontSize: 17, fontWeight: '900', textAlign: 'center' }, payDescription: { color: C.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6, maxWidth: 270 }, payMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28, width: '100%', paddingVertical: 15, marginTop: 8, marginBottom: 4 }, metaLabel: { color: C.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1 }, metaValue: { color: C.ink, fontSize: 15, fontWeight: '900', marginTop: 4 }, metaDivider: { width: 1, height: 31, backgroundColor: C.line }, primaryButton: { width: '100%', minHeight: 51, borderRadius: 15, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, paddingHorizontal: 14 }, primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' }, pressed: { opacity: 0.86, transform: [{ scale: 0.99 }] }, disabled: { opacity: 0.6 }, secureNote: { color: '#93A1B1', fontSize: 9, textAlign: 'center', marginTop: 11 }, settingCard: { backgroundColor: C.white, borderRadius: 19, paddingHorizontal: 14, borderWidth: 1, borderColor: C.line, marginBottom: 24 }, settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15 }, settingIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.blue2, alignItems: 'center', justifyContent: 'center' }, settingTitle: { color: C.ink, fontSize: 12, fontWeight: '800' }, settingSub: { color: C.muted, fontSize: 10, marginTop: 4, lineHeight: 14 }, separator: { height: 1, backgroundColor: C.line }, link: { color: C.blue, fontSize: 11, fontWeight: '800' }, tripRow: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 15, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }, tripIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.blue2, alignItems: 'center', justifyContent: 'center' }, tripTitle: { color: C.ink, fontSize: 11, fontWeight: '800' }, tripSub: { color: C.muted, fontSize: 9, marginTop: 4 }, tripAmount: { color: C.ink, fontSize: 11, fontWeight: '900' }, tripDetail: { color: C.blue, fontSize: 9, marginTop: 4 }, tabbar: { flexDirection: 'row', backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 9, paddingBottom: Platform.OS === 'ios' ? 3 : 8 }, tabButton: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 3 }, tabLabel: { color: C.muted, fontSize: 9, fontWeight: '700' }, tabLabelActive: { color: C.blue, fontWeight: '900' }, statsRow: { flexDirection: 'row', gap: 10, marginVertical: 19 }, statCard: { flex: 1, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 15 }, statNumber: { color: C.navy, fontSize: 20, fontWeight: '900' }, statLabel: { color: C.muted, fontSize: 10, marginTop: 5 }, group: { marginTop: 17 }, groupTitle: { color: C.muted, fontSize: 11, fontWeight: '800', textTransform: 'capitalize', marginBottom: 9 }, empty: { backgroundColor: C.white, borderRadius: 18, padding: 25, alignItems: 'center', marginTop: 14, borderWidth: 1, borderColor: C.line }, emptyIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }, emptyTitle: { color: C.ink, fontSize: 14, fontWeight: '900' }, emptyText: { color: C.muted, fontSize: 11, textAlign: 'center', lineHeight: 17, marginTop: 5, maxWidth: 240 }, passCard: { backgroundColor: C.navy, borderRadius: 22, padding: 22, marginTop: 21, marginBottom: 20 }, passHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 31 }, passBrand: { color: '#fff', fontSize: 18, fontWeight: '900' }, passChip: { color: '#C7D8E8', fontSize: 8, fontWeight: '900', letterSpacing: 1.2, backgroundColor: '#294B6B', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 }, passLabel: { color: '#B7C8D9', fontSize: 9, fontWeight: '800', letterSpacing: 1.3 }, passBalance: { color: '#fff', fontSize: 34, fontWeight: '900', marginTop: 7, marginBottom: 22 }, passLine: { height: 1, backgroundColor: '#34516D', marginBottom: 17 }, passInfoRow: { flexDirection: 'row', gap: 60 }, passSmall: { color: '#B7C8D9', fontSize: 8, letterSpacing: 1, fontWeight: '800' }, passInfo: { color: '#fff', fontSize: 13, fontWeight: '800', marginTop: 5 }, privacyNote: { backgroundColor: '#EAF2FF', borderRadius: 16, padding: 15, marginBottom: 17 }, privacyTitle: { color: C.navy, fontSize: 12, fontWeight: '900', marginBottom: 5 }, privacyText: { color: '#536B83', fontSize: 10, lineHeight: 16 }, outlineButton: { borderWidth: 1, borderColor: '#D6E0EA', borderRadius: 13, padding: 14, alignItems: 'center' }, outlineButtonText: { color: C.red, fontSize: 11, fontWeight: '800' }, overlay: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end', zIndex: 20 }, backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(10,25,41,0.48)' }, sheet: { backgroundColor: C.white, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 22, paddingTop: 10, paddingBottom: 26, maxHeight: '88%' }, sheetHandle: { width: 38, height: 4, borderRadius: 3, backgroundColor: '#D7E0EA', alignSelf: 'center', marginBottom: 17 }, sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 17 }, sheetTitle: { color: C.ink, fontSize: 18, fontWeight: '900' }, closeButton: { width: 30, height: 30, borderRadius: 10, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }, closeText: { color: C.muted, fontSize: 22, lineHeight: 24 }, modalNfc: { width: 76, height: 76, borderRadius: 25, backgroundColor: C.blue2, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: 5, marginBottom: 13 }, modalNfcGlyph: { color: C.blue, fontSize: 34, fontWeight: '900', letterSpacing: -7, marginRight: 7 }, modalTitle: { color: C.ink, fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: 6 }, modalText: { color: C.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginBottom: 17 }, modalSummary: { backgroundColor: C.bg, borderRadius: 16, padding: 15, alignItems: 'center', marginBottom: 16 }, modalSummaryLabel: { color: C.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1 }, modalSummaryAmount: { color: C.navy, fontSize: 26, fontWeight: '900', marginTop: 5 }, modalSummaryDetail: { color: C.muted, fontSize: 10, marginTop: 4 }, demoButton: { alignItems: 'center', padding: 14, marginTop: 4 }, demoButtonText: { color: C.blue, fontSize: 12, fontWeight: '800' }, amountGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 18 }, amountOption: { width: '48%', borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 16, alignItems: 'center' }, amountSelected: { borderColor: C.blue, backgroundColor: C.blue2 }, amountText: { color: C.ink, fontSize: 15, fontWeight: '800' }, amountTextSelected: { color: C.blue }, choiceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12, marginBottom: 9 }, choiceActive: { borderColor: C.blue, backgroundColor: '#F4F8FF' }, choiceCheck: { color: C.blue, fontSize: 19, fontWeight: '900' }, receiptIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: C.greenBg, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 12 }, receiptBox: { backgroundColor: C.bg, borderRadius: 16, padding: 15, marginBottom: 16 }, receiptLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, gap: 12 }, receiptLabel: { color: C.muted, fontSize: 10 }, receiptValue: { color: C.ink, fontSize: 10, fontWeight: '800', textAlign: 'right', flexShrink: 1 }, toast: { position: 'absolute', bottom: 78, left: 16, right: 16, backgroundColor: C.navy, borderRadius: 16, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10, elevation: 8 }, toastCheck: { width: 27, height: 27, borderRadius: 9, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' }, toastTitle: { color: '#fff', fontSize: 12, fontWeight: '900' }, toastSub: { color: '#C5D4E2', fontSize: 10, marginTop: 3 }, toastClose: { color: '#D8E3ED', fontSize: 22, paddingHorizontal: 4 }
});
