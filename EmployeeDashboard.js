import React, { useState, useEffect } from "react";
import { 
  View, Text, TouchableOpacity, ScrollView, Modal, SafeAreaView, Image, Alert, Button 
} from "react-native";
import { 
  collection, onSnapshot, query, orderBy, where, addDoc, serverTimestamp, updateDoc, doc, increment, getDocs 
} from "firebase/firestore";
import { db } from "./firebaseConfig";
import styles from "./styles";

// IMPORT NOTIFICATION HELPERS
import { registerForPushNotificationsAsync, sendPushNotification } from "./notifications";

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
    // 1. REGISTER FOR PUSH NOTIFICATIONS
    registerForPushNotificationsAsync().then(async (token) => {
        if (token) {
            // Save token to this user's account in Firestore
            // We assume 'user.id' is available. If not, you might need to query accounts by username first.
            // For now, we update assuming we can query by username
            const q = query(collection(db, "accounts"), where("username", "==", user.username));
            const snapshot = await getDocs(q);
            snapshot.forEach(async (d) => {
                await updateDoc(doc(db, "accounts", d.id), { pushToken: token });
            });
        }
    });

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

  // --- SORTING ---
  const getSortedRequests = () => {
    const sorted = [...myRequests];
    return sorted.sort((a, b) => {
        const timeA = a.timestamp ? a.timestamp.seconds : 0;
        const timeB = b.timestamp ? b.timestamp.seconds : 0;
        if (sortMode === "newest") return timeB - timeA;
        if (sortMode === "oldest") return timeA - timeB;
        if (sortMode === "status") {
            const priority = { PENDING: 1, APPROVED: 2, RETURNED: 3, DAMAGED: 4, DECLINED: 5 };
            return (priority[a.status] || 99) - (priority[b.status] || 99);
        }
        return 0;
    });
  };

  const toggleCart = (item) => {
    setCart(prev => {
        const next = { ...prev };
        if (next[item.id]) delete next[item.id];
        else next[item.id] = { ...item, qty: 1, unit: item.unit || 'pcs' };
        return next;
    });
  };

  // --- SUBMIT WITH NOTIFICATION ---
  const submitRequest = async () => {
    try {
        const ids = Object.keys(cart);
        if (ids.length === 0) return;

        // 1. Save to DB
        await Promise.all(ids.map(id => addDoc(collection(db, "requests"), {
            itemId: id, 
            itemName: cart[id].name, 
            quantity: cart[id].qty, 
            unit: cart[id].unit,
            requestorName: user.name, 
            requestorUsername: user.username,
            status: "PENDING", 
            timestamp: serverTimestamp()
        })));

        // 2. NOTIFY OWNERS
        // Find all users with role 'owner'
        const ownerQuery = query(collection(db, "accounts"), where("role", "==", "owner"));
        const ownerSnaps = await getDocs(ownerQuery);
        
        ownerSnaps.forEach(doc => {
            const ownerData = doc.data();
            if (ownerData.pushToken) {
                sendPushNotification(
                    ownerData.pushToken, 
                    "New Request 🔔", 
                    `${user.name} requested ${ids.length} item(s).`
                );
            }
        });

        Alert.alert("Success", "Requests sent & Owner notified!");
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
              await addDoc(collection(db, "reports"), {
                  name: req.itemName, type: "RETURNED", quantity: req.quantity,
                  date: new Date().toISOString().split('T')[0], timestamp: serverTimestamp()
              });
              Alert.alert("Success", "Item returned to inventory.");
          } else {
              await updateDoc(doc(db, "requests", req.id), { status: "DAMAGED" });
              await addDoc(collection(db, "reports"), {
                  name: req.itemName, type: "DAMAGED_RETURN", quantity: req.quantity,
                  date: new Date().toISOString().split('T')[0], timestamp: serverTimestamp(),
                  note: `Reported damaged by ${user.name}`
              });
              
              // NOTIFY OWNER OF DAMAGE
              const ownerQuery = query(collection(db, "accounts"), where("role", "==", "owner"));
              const ownerSnaps = await getDocs(ownerQuery);
              ownerSnaps.forEach(doc => {
                  const ownerData = doc.data();
                  if (ownerData.pushToken) {
                      sendPushNotification(ownerData.pushToken, "⚠️ Damaged Item", `${req.itemName} reported damaged by ${user.name}`);
                  }
              });

              Alert.alert("Reported", "Item marked as Damaged.");
          }
          setReturnModalVisible(false); setSelectedReturnItem(null);
      } catch (e) { Alert.alert("Error", e.message); }
  };

  const sortedRequests = getSortedRequests();

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
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 15 }}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#334155' }}>History</Text>
                    <View style={{ flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 8, padding: 2 }}>
                        {['newest', 'oldest', 'status'].map(mode => (
                            <TouchableOpacity key={mode} onPress={() => setSortMode(mode)} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: sortMode === mode ? '#ffffff' : 'transparent', elevation: sortMode === mode ? 1 : 0 }}>
                                <Text style={{ fontSize: 10, fontWeight: 'bold', color: sortMode === mode ? '#0F172A' : '#64748B', textTransform: 'capitalize' }}>{mode}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
                {sortedRequests.map(r => (
                    <View key={r.id} style={styles.row}>
                        <View style={{flex: 1}}>
                            <Text style={{ fontWeight: 'bold', color: '#0F172A' }}>{r.itemName}</Text>
                            <Text style={{ fontSize: 12, color: '#64748B' }}>{r.quantity} {r.unit}</Text>
                            <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{r.timestamp ? new Date(r.timestamp.seconds * 1000).toLocaleDateString() : 'Just now'}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 5 }}>
                            <View style={{ backgroundColor: r.status==='APPROVED'?'#10B981':r.status==='PENDING'?'#F59E0B':r.status==='RETURNED'?'#3B82F6':r.status==='DAMAGED'?'#000000':'#EF4444', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
                                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 10 }}>{r.status}</Text>
                            </View>
                            {r.status === 'APPROVED' && ( <TouchableOpacity onPress={() => openReturnModal(r)} style={{ backgroundColor: '#0F172A', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4 }}><Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>↩ Return</Text></TouchableOpacity> )}
                        </View>
                    </View>
                ))}
            </View>
        ) : (
            <View>
                <Text style={{ textAlign: 'center', color: '#64748B', marginBottom: 10 }}>Tap items to select</Text>
                {items.map(item => {
                    const selected = !!cart[item.id];
                    return (
                        <TouchableOpacity key={item.id} onPress={() => toggleCart(item)} style={[styles.row, selected && { backgroundColor: '#E0F2FE', borderColor: '#38BDF8', borderWidth: 1 }]}>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{item.name}</Text>
                                <Text style={{ color: '#64748B' }}>Stock: {item.quantity} {item.unit}</Text>
                            </View>
                            {selected && <Text style={{ color: '#0284C7', fontWeight: 'bold' }}>Selected</Text>}
                        </TouchableOpacity>
                    );
                })}
            </View>
        )}
      </ScrollView>

      {viewMode === 'inventory' && Object.keys(cart).length > 0 && (
        <TouchableOpacity style={{ position: 'absolute', bottom: 30, right: 20, backgroundColor: '#0F172A', paddingVertical: 15, paddingHorizontal: 25, borderRadius: 30, elevation: 5 }} onPress={() => setShowCart(true)}>
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Request ({Object.keys(cart).length}) ➔</Text>
        </TouchableOpacity>
      )}

      <Modal visible={showCart} transparent animationType="slide">
        <View style={styles.backdrop}>
            <View style={[styles.card, { width: '90%', maxHeight: '70%', padding: 20 }]}>
                <Text style={[styles.menuTitle, { marginBottom: 15 }]}>Confirm Requests</Text>
                <ScrollView style={{ marginBottom: 20 }}>{Object.values(cart).map(i => ( <View key={i.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#f1f5f9' }}><Text style={{ fontWeight: 'bold' }}>{i.name}</Text><Text>x{i.qty} {i.unit}</Text></View> ))}</ScrollView>
                <View style={{ gap: 10 }}><Button title="Submit Request" color="#10B981" onPress={submitRequest} /><Button title="Cancel" color="#EF4444" onPress={() => setShowCart(false)} /></View>
            </View>
        </View>
      </Modal>

      <Modal visible={returnModalVisible} transparent animationType="fade">
        <View style={styles.backdrop}>
            <View style={[styles.card, { width: '85%', padding: 25 }]}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 }}>Return Item</Text>
                <Text style={{ textAlign: 'center', color: '#64748B', marginBottom: 20 }}>Is <Text style={{ fontWeight: 'bold', color: '#0F172A' }}>{selectedReturnItem?.itemName}</Text> in good condition?</Text>
                <TouchableOpacity onPress={() => processReturn('GOOD')} style={{ backgroundColor: '#10B981', padding: 15, borderRadius: 8, alignItems: 'center', marginBottom: 10 }}><Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>✅ YES - Good Condition</Text><Text style={{ color: '#d1fae5', fontSize: 12 }}>(Restock Inventory)</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => processReturn('DAMAGED')} style={{ backgroundColor: '#EF4444', padding: 15, borderRadius: 8, alignItems: 'center', marginBottom: 10 }}><Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>⚠️ NO - Damaged / Lost</Text><Text style={{ color: '#fee2e2', fontSize: 12 }}>(Report Issue, Do Not Restock)</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setReturnModalVisible(false)} style={{ marginTop: 10 }}><Text style={{ textAlign: 'center', color: '#64748B', fontWeight: 'bold' }}>Cancel</Text></TouchableOpacity>
            </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}