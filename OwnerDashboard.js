import React, { useState, useEffect } from "react";
import { 
  View, Text, TouchableOpacity, ScrollView, Modal, Vibration, Alert, SafeAreaView, Button 
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { 
  collection, onSnapshot, query, orderBy, where, addDoc, updateDoc, doc, increment, serverTimestamp, getDocs 
} from "firebase/firestore";
import { db } from "./firebaseConfig";
import styles from "./styles"; 

// IMPORT NOTIFICATION HELPERS
import { registerForPushNotificationsAsync, sendPushNotification } from "./notifications";

export default function OwnerDashboard({ user, onLogout }) {
  const [viewMode, setViewMode] = useState("dashboard"); 
  const [items, setItems] = useState([]);
  
  const [rawReports, setRawReports] = useState([]);
  const [rawRequests, setRawRequests] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]); 
  const [mergedHistory, setMergedHistory] = useState([]);

  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [scanLock, setScanLock] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [scannedItem, setScannedItem] = useState(null);
  const [adjustQty, setAdjustQty] = useState(1);

  useEffect(() => {
    if (!permission) requestPermission();

    // 1. REGISTER NOTIFICATIONS (For Owner)
    registerForPushNotificationsAsync().then(async (token) => {
        if (token) {
            const q = query(collection(db, "accounts"), where("username", "==", user.username));
            const snapshot = await getDocs(q);
            snapshot.forEach(async (d) => {
                await updateDoc(doc(db, "accounts", d.id), { pushToken: token });
            });
        }
    });

    // 2. Inventory
    const unsubInv = onSnapshot(query(collection(db, "inventory"), orderBy("name")), (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 3. Reports
    const unsubRep = onSnapshot(query(collection(db, "reports"), orderBy("timestamp", "desc")), (snap) => {
      setRawReports(snap.docs.map(d => ({ ...d.data(), id: d.id })));
    });

    // 4. History (Approved/Returned)
    const qHist = query(collection(db, "requests"), where("status", "in", ["APPROVED", "RETURNED"]), orderBy("timestamp", "desc"));
    const unsubHist = onSnapshot(qHist, (snap) => {
      setRawRequests(snap.docs.map(d => ({ ...d.data(), id: d.id })));
    });

    // 5. PENDING REQUESTS
    const qPend = query(collection(db, "requests"), where("status", "==", "PENDING"));
    const unsubPend = onSnapshot(qPend, (snap) => {
      const data = snap.docs.map(d => ({ 
        ...d.data(), 
        id: d.id,
        rawTime: d.data().timestamp ? d.data().timestamp.seconds : 0,
        displayDate: d.data().timestamp ? new Date(d.data().timestamp.seconds * 1000).toLocaleString() : 'Just now'
      }));
      data.sort((a, b) => b.rawTime - a.rawTime);
      setPendingRequests(data);
    });

    return () => { unsubInv(); unsubRep(); unsubHist(); unsubPend(); };
  }, []);

  // --- HELPER: NOTIFY EMPLOYEE ---
  const notifyEmployee = async (username, title, body) => {
      const q = query(collection(db, "accounts"), where("username", "==", username));
      const snaps = await getDocs(q);
      snaps.forEach(doc => {
          const data = doc.data();
          if (data.pushToken) {
              sendPushNotification(data.pushToken, title, body);
          }
      });
  };

  // --- APPROVAL LOGIC ---
  const handleApprove = async (req) => {
    const item = items.find(i => i.id === req.itemId);
    
    if (!item) { Alert.alert("Error", "Item not found."); return; }
    if (item.quantity < req.quantity) { Alert.alert("Error", `Not enough stock.`); return; }

    try {
        await updateDoc(doc(db, "inventory", req.itemId), { quantity: increment(-req.quantity) });
        await updateDoc(doc(db, "requests", req.id), { status: "APPROVED" });
        
        notifyEmployee(req.requestorUsername, "Request Approved ✅", `Your request for ${req.itemName} has been approved.`);

        Alert.alert("Success", "Request Approved");
    } catch (e) { Alert.alert("Error", e.message); }
  };

  const handleDecline = async (req) => {
    try {
        await updateDoc(doc(db, "requests", req.id), { status: "DECLINED" });
        
        notifyEmployee(req.requestorUsername, "Request Declined ❌", `Your request for ${req.itemName} was declined.`);

        Alert.alert("Declined", "Request has been declined.");
    } catch (e) { Alert.alert("Error", e.message); }
  };

  // --- MERGE LOGIC ---
  useEffect(() => {
    const reportLogs = rawReports.map(r => ({
        id: r.id, uniqueKey: `rep_${r.id}`, itemName: r.name, qty: r.quantity,
        unit: items.find(i => i.name === r.name)?.unit || 'units',
        actionType: r.type.includes('RESTOCK') || r.type.includes('RETURN') ? 'IN' : 'OUT',
        label: r.type, user: null,
        dateObj: r.timestamp ? r.timestamp.seconds : 0,
        displayDate: r.timestamp ? new Date(r.timestamp.seconds * 1000).toLocaleString() : ''
    }));

    const borrowLogs = rawRequests.map(r => ({
        id: r.id, uniqueKey: `req_${r.id}`, itemName: r.itemName, qty: r.quantity,
        unit: r.unit, actionType: r.status === 'RETURNED' ? 'IN' : 'OUT',
        label: r.status === 'RETURNED' ? 'Returned' : 'Borrowed',
        user: r.requestorName,
        dateObj: r.timestamp ? r.timestamp.seconds : 0,
        displayDate: r.timestamp ? new Date(r.timestamp.seconds * 1000).toLocaleString() : ''
    }));

    const combined = [...reportLogs, ...borrowLogs].sort((a, b) => b.dateObj - a.dateObj);
    setMergedHistory(combined);
  }, [rawReports, rawRequests, items]);

  const openCheckModal = (item) => { setScannedItem(item); setAdjustQty(1); setShowAdjustModal(true); };
  
  const handleBarCodeScanned = ({ data }) => {
    if (scanLock) return; setScanLock(true); Vibration.vibrate(200); setScanning(false);
    let searchName = data; try { const parsed = JSON.parse(data); if(parsed.name) searchName = parsed.name; } catch(e) {} 
    const foundItem = items.find(i => i.name.toLowerCase() === searchName.toLowerCase());
    if (foundItem) openCheckModal(foundItem); else Alert.alert("Not Found", `Item "${searchName}" not in inventory.`);
    setTimeout(() => setScanLock(false), 2000);
  };

  const confirmAdjust = async (type) => {
    if (!scannedItem) return;
    try {
        let newQty = scannedItem.quantity;
        if (type === "RESTOCK") newQty += adjustQty;
        else {
            if (adjustQty > newQty) { Alert.alert("Error", "Not enough stock."); return; }
            newQty -= adjustQty;
        }
        await updateDoc(doc(db, "inventory", scannedItem.id), { quantity: newQty });
        await addDoc(collection(db, "reports"), {
            name: scannedItem.name, type: type === "RESTOCK" ? "RESTOCK" : "SOLD (MANUAL)", 
            quantity: adjustQty, date: new Date().toISOString().split('T')[0], timestamp: serverTimestamp()
        });
        Alert.alert("Success", "Inventory Updated"); setShowAdjustModal(false);
    } catch (e) { Alert.alert("Error", e.message); }
  };

  const totalStockCount = items.reduce((acc, i) => acc + i.quantity, 0);
  const lowStock = items.filter(i => (i.unit === 'box' ? i.quantity <= 5 : i.quantity <= 10));

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: '#0F172A' }}>OWNER PANEL</Text>
        <TouchableOpacity onPress={onLogout}><Text style={{ color: '#EF4444', fontWeight: 'bold' }}>Logout</Text></TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#E2E8F0' }}>
          {['dashboard', 'approvals', 'inventory', 'reports'].map(tab => (
              <TouchableOpacity key={tab} onPress={() => setViewMode(tab)} style={{ flex: 1, paddingVertical: 15, alignItems: 'center', borderBottomWidth: 3, borderColor: viewMode === tab ? '#0F172A' : 'transparent' }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 10, color: viewMode === tab ? '#0F172A' : '#94A3B8' }}>{tab.toUpperCase()}</Text>
              </TouchableOpacity>
          ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        
        {viewMode === 'dashboard' && (
            <View>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                    <View style={[styles.card, { flex: 1, padding: 15 }]}>
                        <Text style={styles.cardLabel}>Total Stock</Text>
                        <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#10B981' }}>{totalStockCount.toLocaleString()}</Text>
                    </View>
                    <View style={[styles.card, { flex: 1, padding: 15 }]}>
                        <Text style={styles.cardLabel}>Pending</Text>
                        <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#F59E0B' }}>{pendingRequests.length}</Text>
                    </View>
                </View>

                {pendingRequests.length > 0 && (
                    <View style={{ marginBottom: 20 }}>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#F59E0B' }}>Action Required ({pendingRequests.length})</Text>
                        {pendingRequests.slice(0, 3).map(r => (
                            <View key={r.id} style={[styles.card, { padding: 15, marginBottom: 10, borderLeftWidth: 5, borderLeftColor: '#F59E0B' }]}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <View>
                                        <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{r.itemName}</Text>
                                        <Text style={{ color: '#666' }}>Requested by: {r.requestorName}</Text>
                                    </View>
                                    <View>
                                        <Text style={{ fontWeight: 'bold' }}>{r.quantity} {r.unit}</Text>
                                        <TouchableOpacity onPress={() => setViewMode('approvals')} style={{ marginTop: 5 }}>
                                            <Text style={{ color: '#0F172A', fontSize: 12, textDecorationLine: 'underline' }}>Review</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {lowStock.length > 0 ? (
                    <View style={[styles.card, { borderLeftWidth: 5, borderLeftColor: '#EF4444' }]}>
                        <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 10, color: '#B91C1C' }}>⚠️ Low Stock Alerts</Text>
                        {lowStock.map(i => ( <View key={i.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}><Text style={{ color: '#475569' }}>{i.name}</Text><Text style={{ fontWeight: 'bold', color: '#EF4444' }}>{i.quantity} {i.unit}</Text></View> ))}
                    </View>
                ) : <View style={[styles.card, { backgroundColor: '#ECFDF5', alignItems: 'center' }]}><Text style={{ color: '#059669', fontWeight: 'bold' }}>All Stocks Healthy ✅</Text></View>}
            </View>
        )}

        {viewMode === 'approvals' && (
            <View>
                <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: '#334155' }}>Pending Approvals</Text>
                {pendingRequests.length === 0 && <Text style={{ textAlign: 'center', marginTop: 20, color: '#94A3B8' }}>No pending requests.</Text>}
                
                {pendingRequests.map(r => (
                    <View key={r.id} style={[styles.card, { padding: 15, marginBottom: 12 }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                             <View>
                                <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#0F172A' }}>{r.itemName}</Text>
                                <Text style={{ color: '#64748B' }}>Requested by: <Text style={{ fontWeight: 'bold' }}>{r.requestorName}</Text></Text>
                                <Text style={{ fontSize: 11, color: '#999' }}>{r.displayDate}</Text>
                             </View>
                             <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{r.quantity} {r.unit}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity onPress={() => handleDecline(r)} style={{ flex: 1, backgroundColor: '#FEE2E2', padding: 10, borderRadius: 6, alignItems: 'center' }}>
                                <Text style={{ color: '#991B1B', fontWeight: 'bold' }}>Decline</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleApprove(r)} style={{ flex: 1, backgroundColor: '#DCFCE7', padding: 10, borderRadius: 6, alignItems: 'center' }}>
                                <Text style={{ color: '#166534', fontWeight: 'bold' }}>Approve</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ))}
            </View>
        )}

        {viewMode === 'inventory' && (
            <View>
                {/* --- UPDATE: Instruction text changed --- */}
                <Text style={{ textAlign: 'center', color: '#64748B', marginBottom: 15 }}>
                    Scan QR code to Check/Adjust Stock
                </Text>

                {/* --- UPDATE: List is now Read-Only (View instead of TouchableOpacity) --- */}
                {items.map(item => ( 
                    <View key={item.id} style={styles.row}>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#0F172A' }}>{item.name}</Text>
                            <Text style={{ color: '#64748B' }}>
                                In Stock: <Text style={{ fontWeight: 'bold', color: '#0F172A' }}>{item.quantity} {item.unit}</Text>
                            </Text>
                        </View>
                        {/* --- UPDATE: Removed the "Check" button --- */}
                    </View> 
                ))}
            </View>
        )}

        {viewMode === 'reports' && (
            <View>
                <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: '#334155' }}>Activity Logs</Text>
                {mergedHistory.length === 0 && <Text style={{ textAlign: 'center', marginTop: 20, color: '#94A3B8' }}>No activity found.</Text>}
                {mergedHistory.map((r) => (
                    <View key={r.uniqueKey} style={[styles.card, { padding: 12, marginBottom: 12 }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0F172A' }}>{r.itemName}</Text>
                                <View style={{ marginTop: 2 }}>
                                    {r.user ? <Text style={{ color: '#475569', fontSize: 12 }}>{r.label}: <Text style={{ fontWeight: 'bold', color: '#0F172A' }}>{r.user}</Text></Text> : <Text style={{ color: r.actionType === 'IN' ? '#166534' : '#991B1B', fontSize: 12, fontWeight: 'bold' }}>{r.label.toUpperCase()}</Text>}
                                    <Text style={{ fontSize: 11, color: '#94A3B8' }}>{r.displayDate}</Text>
                                </View>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}><View style={{ backgroundColor: r.actionType === 'IN' ? '#DCFCE7' : '#FEE2E2', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}><Text style={{ color: r.actionType === 'IN' ? '#166534' : '#991B1B', fontWeight: 'bold', fontSize: 14 }}>{r.actionType === 'IN' ? '+' : '-'}{r.qty} {r.unit}</Text></View></View>
                        </View>
                    </View>
                ))}
            </View>
        )}
      </ScrollView>

      {/* --- UPDATE: Camera Button is the only floating action --- */}
      <TouchableOpacity style={{ position: 'absolute', bottom: 30, right: 20, backgroundColor: '#0F172A', width: 65, height: 65, borderRadius: 35, justifyContent: 'center', alignItems: 'center', elevation: 10 }} onPress={() => setScanning(true)}>
          <Text style={{ fontSize: 30 }}>📷</Text>
      </TouchableOpacity>
      
      <Modal visible={showAdjustModal} transparent animationType="fade">
          <View style={styles.backdrop}>
              <View style={[styles.card, { width: '85%', padding: 25 }]}>
                  <Text style={[styles.menuTitle, { marginBottom: 5 }]}>Inventory Check</Text>
                  <Text style={{ textAlign: 'center', color: '#64748B', marginBottom: 20 }}>Adjusting: <Text style={{ fontWeight: 'bold', color: '#0F172A' }}>{scannedItem?.name}</Text></Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 30 }}>
                      <TouchableOpacity style={[styles.sellBtn, { width: 50, height: 50, borderRadius: 25, backgroundColor: '#64748B' }]} onPress={() => setAdjustQty(Math.max(1, adjustQty - 1))}>
                          <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold' }}>−</Text>
                      </TouchableOpacity>
                      <Text style={{ fontSize: 32, fontWeight: 'bold', marginHorizontal: 30 }}>{adjustQty}</Text>
                      <TouchableOpacity style={[styles.sellBtn, { width: 50, height: 50, borderRadius: 25, backgroundColor: '#10B981' }]} onPress={() => setAdjustQty(adjustQty + 1)}>
                          <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold' }}>+</Text>
                      </TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 15, marginBottom: 15 }}>
                      <TouchableOpacity style={[styles.scanBtn, { flex: 1, backgroundColor: '#EF4444', marginBottom: 0 }]} onPress={() => confirmAdjust("SOLD")}>
                          <Text style={{ color: 'white', fontWeight: 'bold' }}>REMOVE (Sold)</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.scanBtn, { flex: 1, backgroundColor: '#0369A1', marginBottom: 0 }]} onPress={() => confirmAdjust("RESTOCK")}>
                          <Text style={{ color: 'white', fontWeight: 'bold' }}>ADD (Restock)</Text>
                      </TouchableOpacity>
                  </View>
                  <Button title="Close" color="#64748B" onPress={() => setShowAdjustModal(false)} />
              </View>
          </View>
      </Modal>

      <Modal visible={scanning} animationType="slide">
          <View style={{ flex: 1, backgroundColor: 'black' }}>
              <CameraView 
                style={{ flex: 1 }} 
                onBarcodeScanned={scanLock ? undefined : handleBarCodeScanned} 
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }} 
              />
              <SafeAreaView style={styles.cameraOverlay}>
                  <Button title="Close Scanner" color="white" onPress={() => setScanning(false)} />
              </SafeAreaView>
          </View>
      </Modal>
    </SafeAreaView>
  );
}