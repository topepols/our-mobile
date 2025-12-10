import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Button,
  StyleSheet,
  FlatList,
  Alert,
  Vibration,
  Dimensions,
  ScrollView,
  Modal,
} from "react-native";

// --- FIREBASE IMPORTS ---
import { db } from "./firebaseConfig"; // Ensure this file exists
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp 
} from "firebase/firestore";

import { CameraView, useCameraPermissions } from "expo-camera";
import { BarChart } from "react-native-chart-kit";

export default function App() {
  const [page, setPage] = useState("login");

  // Login
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Data
  const [items, setItems] = useState([]);
  const [reports, setReports] = useState([]);

  // Camera
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [scanLock, setScanLock] = useState(false);

  // UI
  const [menuOpen, setMenuOpen] = useState(false);

  // ---------------------------------------------------------
  // 1. REAL-TIME DATABASE LISTENERS (Matches renderers.js)
  // ---------------------------------------------------------
  useEffect(() => {
    // Permission check
    if (!permission) requestPermission();

    // Listen to Inventory
    const qInventory = query(collection(db, "inventory"), orderBy("name"));
    const unsubInv = onSnapshot(qInventory, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setItems(list);
    });

    // Listen to Reports
    const qReports = query(collection(db, "reports"), orderBy("timestamp", "desc"));
    const unsubRep = onSnapshot(qReports, (snapshot) => {
      const list = snapshot.docs.map((doc) => {
        const data = doc.data();
        // Convert timestamp to readable string if it exists
        const dateStr = data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleString() : "Just now";
        return { ...data, id: doc.id, displayDate: dateStr };
      });
      setReports(list);
    });

    return () => {
      unsubInv();
      unsubRep();
    };
  }, []);

  // ---------------------------------------------------------
  // 2. SCANNING LOGIC (Matches Electron Structure)
  // ---------------------------------------------------------
  const onScan = async ({ data }) => {
    if (scanLock) return;
    setScanLock(true);
    Vibration.vibrate(200);

    // Try to parse JSON (like your Electron QR generator makes)
    let parsed;
    try {
      parsed = JSON.parse(data);
    } catch {
      // Fallback for plain text
      parsed = { name: data, unit: "pcs", prices: { pcs: 0, box: 0, tub: 0 } };
    }

    // NORMALIZE DATA
    const scanName = parsed.name || parsed.productName || data;
    const scanUnit = parsed.unit || "pcs";
    // Handle price structure (if scan is flat vs nested)
    const scanPrices = parsed.prices || {
      pcs: parsed.pricePCS || 0,
      box: parsed.priceBOX || 0,
      tub: parsed.priceTUB || 0,
    };

    // CHECK DUPLICATES
    const existingItem = items.find(
      (i) => i.name.toLowerCase() === scanName.toLowerCase()
    );

    try {
      if (existingItem) {
        // UPDATE Existing
        const newQty = (existingItem.quantity || 0) + 1;
        await updateDoc(doc(db, "inventory", existingItem.id), {
          quantity: newQty,
        });
        Alert.alert("Updated", `Added +1 to ${existingItem.name}`);
        
        // Log Report
        await addReport(existingItem.name, "RESTOCK", 1, existingItem.prices, scanUnit);
      } else {
        // CREATE New
        const newItem = {
          name: scanName,
          quantity: 1,
          unit: scanUnit,
          date: new Date().toISOString().slice(0, 10),
          prices: scanPrices, // Save as nested object to match Electron
        };
        await addDoc(collection(db, "inventory"), newItem);
        Alert.alert("Success", "New Item Added");

        // Log Report
        await addReport(newItem.name, "NEW ITEM", 1, newItem.prices, scanUnit);
      }
    } catch (error) {
      Alert.alert("Error", error.message);
    }

    setScanning(false);
    setTimeout(() => setScanLock(false), 2000);
  };

  const addReport = async (name, type, qty, prices, unit) => {
    const unitPrice = prices?.[unit] || 0;
    await addDoc(collection(db, "reports"), {
      name,
      type,
      quantity: qty,
      unitPrice,
      date: new Date().toISOString().split('T')[0],
      timestamp: serverTimestamp(),
    });
  };

  // ---------------------------------------------------------
  // 3. UI COMPONENTS
  // ---------------------------------------------------------
  
  const login = () => {
    // 1. Define accounts exactly like in your Electron app
    const accounts = { 
        admin: "admin123", 
        manager: "manager123" 
    };

    // 2. Check if username exists AND password matches
    if (accounts[username] && accounts[username] === password) {
       setPage("dashboard");
       setUsername(""); // Optional: Clear fields after login
       setPassword("");
    } else {
       Alert.alert("Access Denied", "Invalid username or password");
    }
  };

  const Menu = () => (
    <View style={[styles.menu, { left: menuOpen ? 0 : -220 }]}>
      <Text style={styles.menuTitle}>Inventory App</Text>
      {["dashboard", "inventory", "reports"].map((p) => (
        <TouchableOpacity
          key={p}
          style={styles.menuItem}
          onPress={() => {
            setPage(p);
            setMenuOpen(false);
          }}
        >
          <Text style={styles.menuText}>{p.toUpperCase()}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={styles.logoutButton} onPress={() => setPage("login")}>
        <Text style={{ color: "white" }}>Logout</Text>
      </TouchableOpacity>
    </View>
  );

  if (page === "login") {
    return (
      <View style={styles.containerCentered}>
        <Text style={styles.title}>Inventory Mobile</Text>
        <TextInput placeholder="Username" style={styles.input} onChangeText={setUsername} />
        <TextInput placeholder="Password" secureTextEntry style={styles.input} onChangeText={setPassword} />
        <Button title="Login" onPress={login} />
      </View>
    );
  }

  // Stats for Dashboard
  const lowStockCount = items.filter(i => i.quantity < 5).length;
  const totalValue = items.reduce((acc, curr) => {
     const p = curr.prices?.[curr.unit] || 0;
     return acc + (curr.quantity * p);
  }, 0);

  return (
    <View style={{ flex: 1, backgroundColor: "#f5f5f5" }}>
      <Menu />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setMenuOpen(!menuOpen)}>
          <Text style={{ fontSize: 24 }}>☰</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{page.toUpperCase()}</Text>
        <View style={{width: 20}} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        
        {/* DASHBOARD VIEW */}
        {page === "dashboard" && (
          <View>
             <View style={styles.card}>
               <Text>Total Items: {items.length}</Text>
               <Text>Total Value: ₱{totalValue.toLocaleString()}</Text>
               <Text style={{color:'red'}}>Low Stock: {lowStockCount}</Text>
             </View>
             
             {items.length > 0 && (
                <BarChart
                  data={{
                    labels: items.slice(0,5).map(i => i.name.substring(0,5)),
                    datasets: [{ data: items.slice(0,5).map(i => i.quantity) }]
                  }}
                  width={Dimensions.get("window").width - 40}
                  height={220}
                  chartConfig={{
                    backgroundColor: "#ffffff",
                    backgroundGradientFrom: "#ffffff",
                    backgroundGradientTo: "#ffffff",
                    color: (opacity) => `rgba(0, 0, 0, ${opacity})`,
                  }}
                  style={{ borderRadius: 8, marginTop: 10 }}
                />
             )}
          </View>
        )}

        {/* INVENTORY VIEW */}
        {page === "inventory" && (
          <View>
            <Button title="Scan QR" onPress={() => setScanning(true)} />
            
            {/* INVENTORY LIST */}
            {items.map((item) => (
              <View key={item.id} style={styles.row}>
                <View style={{flex:1}}>
                  <Text style={{fontWeight:'bold', fontSize:16}}>{item.name}</Text>
                  <Text style={{color:'#666'}}>{item.unit} | {item.date}</Text>
                </View>
                <View style={{alignItems:'flex-end'}}>
                  <Text style={{fontSize:18, fontWeight:'bold', color: '#2ecc71'}}>Qty: {item.quantity}</Text>
                  {/* Safe check for prices object */}
                  <Text style={{fontSize:12}}>PCS: ₱{item.prices?.pcs || 0}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* REPORTS VIEW */}
        {page === "reports" && (
           <View>
             {reports.map((rep) => (
               <View key={rep.id} style={styles.row}>
                 <View>
                   <Text style={{fontWeight:'bold'}}>{rep.name}</Text>
                   <Text style={{fontSize:12, color:'#888'}}>{rep.displayDate}</Text>
                 </View>
                 <View style={{alignItems:'flex-end'}}>
                   <Text style={{
                     fontWeight:'bold', 
                     color: rep.type === 'RESTOCK' ? 'green' : rep.type === 'SOLD' ? 'red' : 'blue'
                   }}>
                     {rep.type}
                   </Text>
                   <Text>Qty: {rep.quantity}</Text>
                 </View>
               </View>
             ))}
           </View>
        )}

      </ScrollView>

      {/* FULL SCREEN CAMERA MODAL */}
      <Modal visible={scanning} animationType="slide">
        <View style={{flex:1}}>
          <CameraView
            style={{ flex: 1 }}
            onBarcodeScanned={scanLock ? undefined : onScan}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          />
          <Button title="Close Camera" onPress={() => setScanning(false)} />
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  // ... (keep your existing container/input styles if you have them) ...
  containerCentered: { flex: 1, justifyContent: "center", padding: 20 },
  input: { borderWidth: 1, borderColor: "#ccc", padding: 10, marginBottom: 10, borderRadius: 5 },
  title: { fontSize: 24, fontWeight: "bold", textAlign: "center", marginBottom: 20 },
  
  // --- UPDATED SIDEBAR STYLES ---
  menu: { 
    position: "absolute", 
    top: 0, 
    bottom: 0, 
    width: 220, 
    backgroundColor: "#E6F2FF", // Light Blue background
    padding: 20, 
    zIndex: 100,
    elevation: 5, // Adds a subtle shadow on Android
    shadowColor: "#000", // Shadow for iOS
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  menuTitle: {
    color: "#003366", // Dark Blue for contrast
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
  },
  menuItem: { 
    paddingVertical: 15, 
    borderBottomWidth: 1, 
    borderBottomColor: "#BDD7EE" // Slightly darker blue divider
  },
  menuText: { 
    color: "#003366", // Dark Blue text to read clearly on light background
    fontSize: 18, 
    fontWeight: "bold" 
  },
  logoutButton: { 
    marginTop: 20, 
    backgroundColor: 'red', // Kept Red as requested
    padding: 12, 
    borderRadius: 5,
    alignItems: 'center' // Centers the text inside the button
  },
  // ------------------------------

  header: { flexDirection:'row', justifyContent:'space-between', padding: 15, paddingTop: 40, backgroundColor: 'white', elevation: 2 },
  card: { backgroundColor:'white', padding: 15, borderRadius: 8, marginBottom: 15, elevation: 2 },
  row: { flexDirection: "row", justifyContent: "space-between", padding: 15, backgroundColor: "white", marginBottom: 5, borderRadius: 8, elevation: 1 },
});