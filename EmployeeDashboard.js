import React, { useState, useEffect } from "react";
import { 
  View, Text, TouchableOpacity, ScrollView, Modal, SafeAreaView, Image, Alert, Button 
} from "react-native";
import { 
  collection, onSnapshot, query, orderBy, where, addDoc, serverTimestamp, updateDoc, doc, increment, getDocs 
} from "firebase/firestore";
import { db } from "./firebaseConfig";
import styles from "./styles";

// Safe import for notifications
let registerForPushNotificationsAsync, sendPushNotification;
try {
  const notif = require("./notifications");
  registerForPushNotificationsAsync = notif.registerForPushNotificationsAsync;
  sendPushNotification = notif.sendPushNotification;
} catch (e) { console.log("Notification module missing"); }

export default function EmployeeDashboard({ user, onLogout }) {
  const [items, setItems] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [cart, setCart] = useState({});
  
  const [showCart, setShowCart] = useState(false);
  const [returnModalVisible, setReturnModalVisible] = useState(false);
  const [selectedReturnItem, setSelectedReturnItem] = useState(null);

  const [viewMode, setViewMode] = useState("dashboard");
  const [sortMode, setSortMode] = useState("newest");

  useEffect(() => {
    // 1. Notification Registration
    if (registerForPushNotificationsAsync) {
        registerForPushNotificationsAsync().then(async (token) => {
            if (token) {
                const q = query(collection(db, "accounts"), where("username", "==", user.username));
                const snaps = await getDocs(q);
                snaps.forEach(async (d) => await updateDoc(doc(db, "accounts", d.id), { pushToken: token }));
            }
        });
    }

    // 2. Inventory Listener
    const unsubInv = onSnapshot(query(collection(db, "inventory"), orderBy("name")), (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 3. Requests Listener
    const unsubReq = onSnapshot(query(collection(db, "requests"), where("requestorUsername", "==", user.username)), (snap) => {
      setMyRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubInv(); unsubReq(); };
  }, []);

  // --- NEW: QUANTITY HANDLER ---
  const updateQuantity = (item, change) => {
    setCart(prev => {
        const next = { ...prev };
        const currentQty = next[item.id] ? next[item.id].qty : 0;
        const newQty = currentQty + change;

        // Validation: Don't go below 0
        if (newQty <= 0) {
            delete next[item.id];
            return next;
        }

        // Validation: Don't exceed stock
        if (newQty > item.quantity) {
            Alert.alert("Limit Reached", `Only ${item.quantity} available.`);
            return prev; 
        }

        // Update Cart
        next[item.id] = { 
            ...item, 
            qty: newQty, 
            unit: item.unit || 'pcs', 
            type: item.type || 'CONSUMABLE' 
        };
        return next;
    });
  };

  const submitRequest = async () => {
    try {
        const ids = Object.keys(cart);
        if (ids.length === 0) return;

        await Promise.all(ids.map(id => addDoc(collection(db, "requests"), {
            itemId: id, 
            itemName: cart[id].name, 
            type: cart[id].type || 'CONSUMABLE',
            quantity: cart[id].qty, 
            unit: cart[id].unit,
            requestorName: user.name, 
            requestorUsername: user.username,
            status: "PENDING", 
            timestamp: serverTimestamp()
        })));

        // Notify Owner
        if (sendPushNotification) {
            const q = query(collection(db, "accounts"), where("role", "==", "owner"));
            const snaps = await getDocs(q);
            snaps.forEach(doc => {
                const d = doc.data();
                if(d.pushToken) sendPushNotification(d.pushToken, "New Request 🔔", `${user.name} ordered ${ids.length} items.`);
            });
        }

        Alert.alert("Success", "Requests sent!");
        setCart({}); setShowCart(false);
    } catch (e) { Alert.alert("Error", e.message); }
  };

  // --- RETURN LOGIC ---
  const openReturnModal = (req) => { setSelectedReturnItem(req); setReturnModalVisible(true); };

  const processReturn = async (condition) => {
      if (!selectedReturnItem) return;
      const req = selectedReturnItem;
      try {
          if (condition === 'GOOD') {
              await updateDoc(doc(db, "requests", req.id), { status: "RETURNED" });
              await updateDoc(doc(db, "inventory", req.itemId), { quantity: increment(req.quantity) });
              await addDoc(collection(db, "reports"), { name: req.itemName, type: "RETURNED", quantity: req.quantity, date: new Date().toISOString().split('T')[0], timestamp: serverTimestamp() });
              Alert.alert("Success", "Returned.");
          } else {
              await updateDoc(doc(db, "requests", req.id), { status: "DAMAGED" });
              await addDoc(collection(db, "reports"), { name: req.itemName, type: "DAMAGED_RETURN", quantity: req.quantity, date: new Date().toISOString().split('T')[0], timestamp: serverTimestamp(), note: `Damaged by ${user.name}` });
              Alert.alert("Reported", "Marked as damaged.");
          }
          setReturnModalVisible(false); setSelectedReturnItem(null);
      } catch (e) { Alert.alert("Error", e.message); }
  };

  const sortedRequests = [...myRequests].sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A' }}>{viewMode === 'dashboard' ? 'MY PROFILE' : 'BORROW ITEMS'}</Text>
        <TouchableOpacity onPress={onLogout}><Text style={{ color: '#EF4444', fontWeight: 'bold' }}>Logout</Text></TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', padding: 10, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#eee' }}>
        <TouchableOpacity onPress={() => setViewMode('dashboard')} style={{ flex: 1, padding: 10, alignItems: 'center', borderBottomWidth: 2, borderColor: viewMode==='dashboard'?'#0F172A':'transparent' }}><Text style={{ fontWeight: 'bold', color: viewMode==='dashboard'?'#0F172A':'#64748B' }}>Dashboard</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setViewMode('inventory')} style={{ flex: 1, padding: 10, alignItems: 'center', borderBottomWidth: 2, borderColor: viewMode==='inventory'?'#0F172A':'transparent' }}><Text style={{ fontWeight: 'bold', color: viewMode==='inventory'?'#0F172A':'#64748B' }}>Inventory</Text></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {viewMode === 'dashboard' ? (
            <View>
                <View style={[styles.card, { alignItems: 'center', padding: 20 }]}>
                    <Image source={{ uri: user.imageUri || 'https://via.placeholder.com/100' }} style={{ width: 100, height: 100, borderRadius: 50, marginBottom: 10, backgroundColor: '#ccc' }} />
                    <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#0F172A' }}>{user.name}</Text>
                    <Text style={{ color: '#64748B' }}>{user.position}</Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: 'bold', marginVertical: 15, color: '#334155' }}>History</Text>
                {sortedRequests.map(r => (
                    <View key={r.id} style={styles.row}>
                        <View style={{flex: 1}}>
                            <Text style={{ fontWeight: 'bold', color: '#0F172A' }}>{r.type === 'EQUIPMENT' ? '🔧 ' : '🔩 '} {r.itemName}</Text>
                            <Text style={{ fontSize: 12, color: '#64748B' }}>{r.quantity} {r.unit} • {r.type}</Text>
                            <Text style={{ fontSize: 10, color: '#94a3b8' }}>{r.timestamp ? new Date(r.timestamp.seconds * 1000).toLocaleDateString() : 'Just now'}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 5 }}>
                            <View style={{ backgroundColor: r.status==='APPROVED'?'#10B981':r.status==='PENDING'?'#F59E0B':r.status==='RETURNED'?'#3B82F6':r.status==='DAMAGED'?'#000000':'#EF4444', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
                                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 10 }}>{r.status}</Text>
                            </View>
                            {r.status === 'APPROVED' && r.type === 'EQUIPMENT' && ( <TouchableOpacity onPress={() => openReturnModal(r)} style={{ backgroundColor: '#0F172A', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4 }}><Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>↩ Return</Text></TouchableOpacity> )}
                        </View>
                    </View>
                ))}
            </View>
        ) : (
            <View>
                
                {items.map(item => {
                    const qtyInCart = cart[item.id] ? cart[item.id].qty : 0;
                    return (
                        <View key={item.id} style={[styles.row, qtyInCart > 0 && { backgroundColor: '#F0F9FF', borderColor: '#38BDF8', borderWidth: 1 }]}>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{item.type === 'EQUIPMENT' ? '🔧 ' : '🔩 '} {item.name}</Text>
                                <Text style={{ color: '#64748B' }}>Stock: {item.quantity} {item.unit}</Text>
                            </View>
                            
                            {/* NEW +/- CONTROLS */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                {qtyInCart > 0 ? (
                                    <>
                                        <TouchableOpacity onPress={() => updateQuantity(item, -1)} style={{ width: 35, height: 35, borderRadius: 18, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center' }}>
                                            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 20 }}>-</Text>
                                        </TouchableOpacity>
                                        <Text style={{ fontWeight: 'bold', fontSize: 18, minWidth: 20, textAlign: 'center' }}>{qtyInCart}</Text>
                                        <TouchableOpacity onPress={() => updateQuantity(item, 1)} style={{ width: 35, height: 35, borderRadius: 18, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center' }}>
                                            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 20 }}>+</Text>
                                        </TouchableOpacity>
                                    </>
                                ) : (
                                    <TouchableOpacity onPress={() => updateQuantity(item, 1)} style={{ backgroundColor: '#0F172A', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 }}>
                                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>+ ADD</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    );
                })}
            </View>
        )}
      </ScrollView>

      {viewMode === 'inventory' && Object.keys(cart).length > 0 && (
        <TouchableOpacity style={{ position: 'absolute', bottom: 30, right: 20, backgroundColor: '#0F172A', paddingVertical: 15, paddingHorizontal: 25, borderRadius: 30, elevation: 5 }} onPress={() => setShowCart(true)}>
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Review ({Object.keys(cart).length}) ➔</Text>
        </TouchableOpacity>
      )}

      {/* CONFIRMATION MODAL */}
      <Modal visible={showCart} transparent animationType="slide">
        <View style={styles.backdrop}>
            <View style={[styles.card, { width: '90%', maxHeight: '70%', padding: 20 }]}>
                <Text style={[styles.menuTitle, { marginBottom: 15 }]}>Confirm Requests</Text>
                <ScrollView style={{ marginBottom: 20 }}>
                    {Object.values(cart).map(i => ( 
                        <View key={i.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#f1f5f9' }}>
                            <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{i.name}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <TouchableOpacity onPress={() => updateQuantity(i, -1)} style={{ padding: 5, backgroundColor: '#eee', borderRadius: 5 }}><Text style={{fontWeight:'bold'}}>-</Text></TouchableOpacity>
                                <Text style={{ fontSize: 16, fontWeight: 'bold' }}>{i.qty} {i.unit}</Text>
                                <TouchableOpacity onPress={() => updateQuantity(i, 1)} style={{ padding: 5, backgroundColor: '#eee', borderRadius: 5 }}><Text style={{fontWeight:'bold'}}>+</Text></TouchableOpacity>
                            </View>
                        </View> 
                    ))}
                </ScrollView>
                <View style={{ gap: 10 }}>
                    <Button title="Submit Request" color="#10B981" onPress={submitRequest} />
                    <Button title="Cancel" color="#EF4444" onPress={() => setShowCart(false)} />
                </View>
            </View>
        </View>
      </Modal>

      {/* RETURN MODAL (Unchanged) */}
      <Modal visible={returnModalVisible} transparent animationType="fade">
        <View style={styles.backdrop}>
            <View style={[styles.card, { width: '85%', padding: 25 }]}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 }}>Return Item</Text>
                <Text style={{ textAlign: 'center', color: '#64748B', marginBottom: 20 }}>Is <Text style={{ fontWeight: 'bold', color: '#0F172A' }}>{selectedReturnItem?.itemName}</Text> in good condition?</Text>
                <TouchableOpacity onPress={() => processReturn('GOOD')} style={{ backgroundColor: '#10B981', padding: 15, borderRadius: 8, alignItems: 'center', marginBottom: 10 }}><Text style={{ color: 'white', fontWeight: 'bold' }}>✅ YES - Good Condition</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => processReturn('DAMAGED')} style={{ backgroundColor: '#EF4444', padding: 15, borderRadius: 8, alignItems: 'center', marginBottom: 10 }}><Text style={{ color: 'white', fontWeight: 'bold' }}>⚠️ NO - Damaged / Lost</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setReturnModalVisible(false)} style={{ marginTop: 10 }}><Text style={{ textAlign: 'center', color: '#64748B', fontWeight: 'bold' }}>Cancel</Text></TouchableOpacity>
            </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}