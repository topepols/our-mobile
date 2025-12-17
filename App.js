import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, Button, Alert, 
  Vibration, Dimensions, ScrollView, Modal, SafeAreaView, 
  TouchableWithoutFeedback,
  Image // Added for Logo
} from "react-native";

// --- EXTERNAL ASSETS ---
import styles, { chartConfig } from "./styles"; 

// --- FIREBASE & CAMERA ---
import { db } from "./firebaseConfig";
import { collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp, limit } from "firebase/firestore";
import { CameraView, useCameraPermissions } from "expo-camera";
import { BarChart, LineChart } from "react-native-chart-kit";

export default function App() {
  const [page, setPage] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [items, setItems] = useState([]);
  const [reports, setReports] = useState([]);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [scanLock, setScanLock] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [scannedItem, setScannedItem] = useState(null); 
  const [adjustQty, setAdjustQty] = useState(1);       
  const [showAdjustModal, setShowAdjustModal] = useState(false);

  useEffect(() => {
    if (!permission) requestPermission();
    const unsubInv = onSnapshot(query(collection(db, "inventory"), orderBy("name")), (snapshot) => {
      setItems(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubRep = onSnapshot(query(collection(db, "reports"), orderBy("timestamp", "desc")), (snapshot) => {
      setReports(snapshot.docs.map(d => {
        const data = d.data();
        return { ...data, id: d.id, displayDate: data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleString() : "Just now" };
      }));
    });
    return () => { unsubInv(); unsubRep(); };
  }, [permission]);

  const getInventoryData = () => {
    const sortedItems = [...items].sort((a, b) => b.quantity - a.quantity);
    return {
      labels: sortedItems.map(i => i.name.length > 5 ? i.name.substring(0, 5) + ".." : i.name),
      datasets: [{ data: sortedItems.map(i => i.quantity) }]
    };
  };

  const getSalesTrendData = () => {
    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();
    const salesCounts = last7Days.map(date => {
      return reports.filter(r => r.type === "SOLD" && r.date === date).reduce((sum, r) => sum + r.quantity, 0);
    });
    return { labels: last7Days.map(d => d.split('-')[2]), datasets: [{ data: salesCounts }] };
  };

  const getTodayRevenue = () => {
    const today = new Date().toISOString().split('T')[0];
    return reports.filter(r => (r.type === "SOLD" || r.type === "DEDUCT") && r.date === today).reduce((acc, curr) => acc + (curr.quantity * (curr.unitPrice || 0)), 0);
  };

  const onScan = async ({ data }) => {
    if (scanLock) return;
    setScanLock(true);
    Vibration.vibrate(200);
    let parsed;
    try { parsed = JSON.parse(data); } 
    catch { parsed = { name: data, unit: "pcs", prices: { pcs: 0, box: 0, tub: 0 } }; }
    const scanName = parsed.name || parsed.productName || data;
    const existingItem = items.find(i => i.name.toLowerCase() === scanName.toLowerCase());
    if (existingItem) { setScannedItem(existingItem); } 
    else { setScannedItem({ name: scanName, unit: parsed.unit || "pcs", prices: parsed.prices || { pcs: 0, box: 0, tub: 0 }, quantity: 0, isNew: true }); }
    setAdjustQty(1); setScanning(false); setShowAdjustModal(true);
    setTimeout(() => setScanLock(false), 2000);
  };

  const confirmAdjustment = async (actionType) => {
    try {
      if (scannedItem.isNew) {
        const newItem = { name: scannedItem.name, quantity: adjustQty, unit: scannedItem.unit, date: new Date().toISOString().slice(0, 10), prices: scannedItem.prices };
        await addDoc(collection(db, "inventory"), newItem);
        await addReport(newItem.name, "NEW ITEM", adjustQty, newItem.prices, newItem.unit);
      } else {
        const newTotal = actionType === "ADD" ? scannedItem.quantity + adjustQty : Math.max(0, scannedItem.quantity - adjustQty);
        await updateDoc(doc(db, "inventory", scannedItem.id), { quantity: newTotal });
        await addReport(scannedItem.name, actionType === "ADD" ? "RESTOCK" : "SOLD", adjustQty, scannedItem.prices, scannedItem.unit);
      }
      setShowAdjustModal(false); setScannedItem(null);
      Alert.alert("Success", "Inventory Updated");
    } catch (e) { Alert.alert("Error", e.message); }
  };

  const addReport = async (name, type, qty, prices, unit) => {
    await addDoc(collection(db, "reports"), { name, type, quantity: qty, unitPrice: prices?.[unit] || 0, date: new Date().toISOString().split('T')[0], timestamp: serverTimestamp() });
  };

  const login = () => {
    const acc = { admin: "admin123", manager: "manager123" };
    if (acc[username] === password) { setPage("dashboard"); setUsername(""); setPassword(""); }
    else { Alert.alert("Denied", "Invalid credentials"); }
  };

  // --- UPDATED MENU WITH CIRCULAR LOGO ---
  const Menu = () => (
    <View style={[styles.menu, { left: menuOpen ? 0 : -280 }]}>
      <View style={{ alignItems: 'center', marginBottom: 40, marginTop: 20 }}>
        {/* LOGO CONTAINER */}
        <View style={styles.logoCircle}>
           <Image 
            source={{ uri: 'https://scontent.fmnl8-2.fna.fbcdn.net/v/t39.30808-6/469034145_122097488396661705_3581626582363008440_n.jpg?_nc_cat=111&ccb=1-7&_nc_sid=6ee11a&_nc_eui2=AeGr4ll7-wiqcCq1J6vUQ0dqdOVUNpWdzz905VQ2lZ3PPx8z4YYUWJVD2HdC8cCGNlpTN_wZdK7i6ISt8wggNwiD&_nc_ohc=0HqAsUs0QycQ7kNvwHxqYys&_nc_oc=Admx8Fx26yflBbiwcSbdD9aZE7rZJeqq6Kslr-buTeGbxQUobTgkYspXFq-gpVNKQj0&_nc_zt=23&_nc_ht=scontent.fmnl8-2.fna&_nc_gid=Nf7fWLnxxiT1ub3gKgnGmA&oh=00_AflCXEnUYtlPXlOZBPPDvRttVodgOwHi_mf6TEySmc8y4A&oe=69489CF9' }} 
            style={styles.logoImage} 
           />
        </View>
        <Text style={styles.menuTitle}>Double JDG</Text>
        <Text style={styles.menuSubtitle}>Mobile Management</Text>
      </View>

      <View style={{ flex: 1 }}>
        {["dashboard", "inventory", "reports"].map((p) => (
          <TouchableOpacity 
            key={p} 
            style={[styles.menuItem, page === p && styles.menuItemActive]} 
            onPress={() => { setPage(p); setMenuOpen(false); }}
          >
            <Text style={[styles.menuText, page === p && styles.menuTextActive]}>
              {p.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Logout button at the very bottom */}
      <TouchableOpacity style={styles.logoutButton} onPress={() => setPage("login")}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );

  if (page === "login") return (
    <View style={styles.containerCentered}>
      <Text style={styles.title}>Welcome Back</Text>
      <TextInput placeholder="Username" style={styles.input} onChangeText={setUsername} autoCapitalize="none" />
      <TextInput placeholder="Password" secureTextEntry style={styles.input} onChangeText={setPassword} />
      <Button title="Sign In" color="#0F172A" onPress={login} />
    </View>
  );

  const totalValue = items.reduce((acc, curr) => acc + (curr.quantity * (curr.prices?.[curr.unit] || 0)), 0);
  const lowStockItems = items.filter(i => i.quantity < 5);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Menu />
      {menuOpen && <TouchableWithoutFeedback onPress={() => setMenuOpen(false)}><View style={styles.backdrop} /></TouchableWithoutFeedback>}

      <View style={styles.header}>
        <TouchableOpacity onPress={() => setMenuOpen(!menuOpen)}><Text style={{ fontSize: 28 }}>☰</Text></TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A' }}>{page.toUpperCase()}</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {page === "dashboard" && (
            <View>
              <View style={[styles.card, { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD', borderWidth: 1 }]}>
                <Text style={[styles.cardLabel, { color: '#0369A1' }]}>Today's Sales Revenue</Text>
                <Text style={[styles.cardVal, { fontSize: 28, color: '#0369A1' }]}>₱{getTodayRevenue().toLocaleString()}</Text>
              </View>

              <View style={styles.card}>
                <Text style={[styles.cardLabel, { marginBottom: 12 }]}>Recent Activity</Text>
                {reports.slice(0, 5).map((rep) => (
                  <View key={rep.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', fontSize: 13, color: '#1E293B' }} numberOfLines={1}>{rep.name}</Text>
                      <Text style={{ fontSize: 11, color: '#94A3B8' }}>{rep.displayDate.split(',')[1] || rep.displayDate}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: (rep.type === 'RESTOCK' || rep.type === 'NEW ITEM') ? '#10B981' : '#EF4444' }}>
                        {rep.type === 'RESTOCK' ? '+' : '-'}{rep.quantity}
                      </Text>
                      <Text style={{ fontSize: 10, color: '#64748B' }}>{rep.type}</Text>
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.card}>
                <Text style={styles.cardLabel}>Stock Levels</Text>
                <ScrollView horizontal={true} showsHorizontalScrollIndicator={false}>
                  <BarChart
                    data={getInventoryData()}
                    width={Math.max(Dimensions.get("window").width - 64, items.length * 80)}
                    height={240}
                    chartConfig={{ ...chartConfig, fillShadowGradient: "#7DB8F1", fillShadowGradientOpacity: 1 }}
                    style={{ borderRadius: 16, marginTop: 10 }}
                    fromZero showValuesOnTopOfBars withInnerLines={false} verticalLabelRotation={30}
                  />
                </ScrollView>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardLabel}>Sales Trend (Last 7 Days)</Text>
                <LineChart
                  data={getSalesTrendData()}
                  width={Dimensions.get("window").width - 64}
                  height={220}
                  chartConfig={{ ...chartConfig, color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})` }}
                  bezier style={{ borderRadius: 16, marginTop: 10 }}
                />
              </View>
            </View>
          )}

          {page === "inventory" && (
            <View>
              {lowStockItems.length > 0 && (
                <View style={[styles.card, { borderColor: '#EF4444', borderWidth: 1, backgroundColor: '#FEF2F2' }]}>
                  <Text style={{ color: '#B91C1C', fontWeight: '800', marginBottom: 5 }}>⚠️ CRITICAL STOCK ({lowStockItems.length})</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {lowStockItems.map(item => (
                      <View key={item.id} style={{ backgroundColor: 'white', padding: 8, borderRadius: 8, marginRight: 8, borderWidth: 1, borderColor: '#FCA5A5' }}>
                        <Text style={{ fontWeight: '700', fontSize: 12 }}>{item.name}</Text>
                        <Text style={{ color: '#EF4444', fontSize: 11 }}>Qty: {item.quantity}</Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}
              <Text style={[styles.cardLabel, { marginBottom: 10, marginTop: 5 }]}>All Inventory Items</Text>
              {items.map((item) => (
                <View key={item.id} style={styles.row}>
                  <View style={{flex:1}}><Text style={{fontWeight:'700', fontSize:16, color: '#0F172A'}}>{item.name}</Text><Text style={{color:'#64748B'}}>{item.unit} • Stock: {item.quantity}</Text></View>
                  <View style={{alignItems: 'flex-end'}}><Text style={[styles.cardVal, {fontSize: 14}]}>₱{(item.prices?.[item.unit] || 0).toLocaleString()}</Text></View>
                </View>
              ))}
            </View>
          )}

          {page === "reports" && reports.map((rep) => (
            <View key={rep.id} style={styles.row}>
              <View><Text style={{fontWeight:'700', color: '#0F172A'}}>{rep.name}</Text><Text style={{fontSize:12, color:'#94A3B8'}}>{rep.displayDate}</Text></View>
              <View style={{alignItems:'flex-end'}}><Text style={{ fontWeight:'700', color: (rep.type === 'RESTOCK' || rep.type === 'NEW ITEM') ? '#10B981' : (rep.type === 'SOLD' || rep.type === 'DEDUCT') ? '#EF4444' : '#3B82F6' }}>{rep.type}</Text><Text style={{fontSize:13, fontWeight: '600'}}>Qty: {rep.quantity}</Text></View>
            </View>
          ))}
        </ScrollView>

        {page !== "login" && (
          <TouchableOpacity 
            style={{ position: 'absolute', bottom: 30, right: 20, backgroundColor: '#0F172A', width: 65, height: 65, borderRadius: 32.5, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOpacity: 0.3 }} 
            onPress={() => setScanning(true)}
          >
            <Text style={{ fontSize: 28 }}>📷</Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={showAdjustModal} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={[styles.card, { marginHorizontal: 30, padding: 25, alignSelf: 'center', width: '85%' }]}>
            <Text style={[styles.menuTitle, { marginBottom: 5 }]}>{scannedItem?.name}</Text>
            <Text style={[styles.cardLabel, { marginBottom: 20 }]}>Current Stock: {scannedItem?.quantity || 0}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 30 }}>
              <TouchableOpacity style={[styles.sellBtn, { width: 50, height: 50, borderRadius: 25, backgroundColor: '#64748B' }]} onPress={() => setAdjustQty(Math.max(1, adjustQty - 1))}><Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold' }}>−</Text></TouchableOpacity>
              <Text style={{ fontSize: 36, fontWeight: 'bold', marginHorizontal: 35 }}>{adjustQty}</Text>
              <TouchableOpacity style={[styles.sellBtn, { width: 50, height: 50, borderRadius: 25, backgroundColor: '#10B981' }]} onPress={() => setAdjustQty(adjustQty + 1)}><Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold' }}>+</Text></TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
              <TouchableOpacity style={[styles.scanBtn, { flex: 1, marginRight: 8, backgroundColor: '#EF4444', marginBottom: 0 }]} onPress={() => confirmAdjustment("DEDUCT")}><Text style={{ color: 'white', fontWeight: 'bold' }}>SOLD</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.scanBtn, { flex: 1, marginLeft: 8, backgroundColor: '#0369A1', marginBottom: 0 }]} onPress={() => confirmAdjustment("ADD")}><Text style={{ color: 'white', fontWeight: 'bold' }}>RESTOCK</Text></TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setShowAdjustModal(false)}><Text style={{ textAlign: 'center', color: '#64748B', fontWeight: '600', marginTop: 15 }}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={scanning} animationType="slide">
        <View style={{flex:1, backgroundColor:'black'}}><CameraView style={{ flex: 1 }} onBarcodeScanned={scanLock ? undefined : onScan} barcodeScannerSettings={{ barcodeTypes: ["qr"] }} /><SafeAreaView style={styles.cameraOverlay}><Button title="Close Scanner" color="white" onPress={() => setScanning(false)} /></SafeAreaView></View>
      </Modal>
    </SafeAreaView>
  );
}