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
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { CameraView, useCameraPermissions } from "expo-camera";
import { BarChart } from "react-native-chart-kit";
import * as Notifications from "expo-notifications";

export default function App() {
  const [page, setPage] = useState("login");

  // Login
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Inventory & Reports
  const [items, setItems] = useState([]);
  const [reports, setReports] = useState([]);

  // Camera
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [scanLock, setScanLock] = useState(false);

  // Sidebar toggle
  const [menuOpen, setMenuOpen] = useState(false);

  // Notification Panel
  const [notifications, setNotifications] = useState([]);

  // Load saved inventory + reports
  useEffect(() => {
    (async () => {
      const inv = JSON.parse(await AsyncStorage.getItem("inventory") || "[]");
      const rep = JSON.parse(await AsyncStorage.getItem("reports") || "[]");
      setItems(inv);
      setReports(rep);

      if (!permission) await requestPermission();

      await Notifications.requestPermissionsAsync();
    })();
  }, []);

  const saveInventory = async (list) => {
    setItems(list);
    await AsyncStorage.setItem("inventory", JSON.stringify(list));
  };

  const saveReports = async (list) => {
    setReports(list);
    await AsyncStorage.setItem("reports", JSON.stringify(list));
  };

  // 🔔 Add notification (auto-hide after 5 sec)
  const notifyNewReport = (report) => {
    const id = Date.now();
    const notif = { ...report, id };

    setNotifications((prev) => [notif, ...prev]);

    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  };

  // Login function
  const login = () => {
    if (
      (username === "admin" && password === "admin") ||
      (username === "manager" && password === "manager")
    ) {
      setPage("dashboard");
    } else {
      Alert.alert("Invalid Login", "Use admin/admin or manager/manager");
    }
  };

  const logout = () => {
    setUsername("");
    setPassword("");
    setPage("login");
  };

  // ---------------------------------------------------------------------------
  //  UPDATED QR SCAN — now saves PCS, BOX, TUB prices
  // ---------------------------------------------------------------------------
  const onScan = async ({ data }) => {
    if (scanLock) return;
    setScanLock(true);
    Vibration.vibrate(200);

    let parsed;
    try {
      parsed = JSON.parse(data);
    } catch {
      parsed = { productName: data, quantity: 1, unit: "pcs" };
    }

    const newItem = {
      id: Date.now(),
      productName: parsed.productName || parsed.name || data,
      quantity: parsed.quantity || 1,
      unit: parsed.unit || "pcs",

      // NEW FIELDS for PCS / BOX / TUB prices
      pricePCS: parsed.pricePCS || 0,
      priceBOX: parsed.priceBOX || 0,
      priceTUB: parsed.priceTUB || 0,

      date: new Date().toISOString().slice(0, 10),
    };

    await saveInventory([newItem, ...items]);

    const newReport = { 
      ...newItem,
      savedAt: new Date().toISOString(),
    };

    await saveReports([newReport, ...reports]);

    notifyNewReport(newReport);

    Alert.alert("Success", "QR scanned and item saved", [
      {
        text: "OK",
        onPress: () => {
          setScanning(false);
          setScanLock(false);
          setPage("inventory");
        },
      },
    ]);
  };
  // ---------------------------------------------------------------------------

  // Sidebar menu
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
          <Text style={styles.menuText}>
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
      <View style={{ flex: 1 }} />
      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={{ color: "white", fontWeight: "700" }}>Logout</Text>
      </TouchableOpacity>
    </View>
  );

  // Login Page
  if (page === "login")
    return (
      <View style={styles.containerCentered}>
        <Text style={styles.title}>Inventory Management</Text>
        <TextInput
          placeholder="Username"
          value={username}
          onChangeText={setUsername}
          style={styles.input}
        />
        <TextInput
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={styles.input}
        />
        <Button title="Login" onPress={login} />
      </View>
    );

  // Stats
  const totalItems = items.length;
  const lowStock = items.filter((i) => i.quantity <= (i.low || 5)).length;

  return (
    <View style={{ flex: 1 }}>
      <Menu />

      {/* Notification Panel */}
      <View style={styles.notifContainer}>
        {notifications.map((notif) => (
          <View key={notif.id} style={styles.notifPanel}>
            <TouchableOpacity
              style={styles.notifCloseBtn}
              onPress={() =>
                setNotifications((prev) =>
                  prev.filter((n) => n.id !== notif.id)
                )
              }
            >
              <Text style={{ color: "white", fontWeight: "700" }}>✕ Close</Text>
            </TouchableOpacity>
            <Text style={styles.notifTitle}>New Report Added</Text>
            <Text style={{ fontWeight: "700" }}>{notif.productName}</Text>
            <Text>Qty: {notif.quantity}</Text>
            <Text>Saved: {notif.savedAt.slice(0, 19)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.menuToggle}>
        <TouchableOpacity onPress={() => setMenuOpen(!menuOpen)}>
          <Text style={{ fontSize: 24 }}>☰</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.mainContent} contentContainerStyle={{ padding: 16 }}>

        {/* DASHBOARD */}
        {page === "dashboard" && (
          <View>
            <Text style={styles.pageTitle}>Dashboard</Text>
            <Text style={styles.dashboardText}>Total Items: {totalItems}</Text>
            <Text style={styles.dashboardText}>Low Stock Alerts: {lowStock}</Text>

            {items.length > 0 && (
              <BarChart
                data={{
                  labels: items.map((i) => i.productName).slice(0, 6),
                  datasets: [{ data: items.map((i) => i.quantity).slice(0, 6) }],
                }}
                width={Dimensions.get("window").width - 40}
                height={220}
                chartConfig={{
                  backgroundGradientFrom: "#f0f4f7",
                  backgroundGradientTo: "#f0f4f7",
                  decimalPlaces: 0,
                  color: (opacity) => `rgba(0,100,200,${opacity})`,
                  labelColor: () => "#333",
                }}
                style={{ marginTop: 16, borderRadius: 12 }}
              />
            )}
          </View>
        )}

        {/* INVENTORY */}
        {page === "inventory" && (
          <View>
            <Text style={styles.pageTitle}>Inventory</Text>

            {/*  SCAN BUTTON MOVED TO TOP */}
            <View style={{ marginBottom: 20 }}>
              {!permission?.granted ? (
                <Button title="Allow Camera" onPress={requestPermission} />
              ) : !scanning ? (
                <Button title="Scan QR Code" onPress={() => setScanning(true)} />
              ) : (
                <View style={{ height: 350, marginTop: 10 }}>
                  <CameraView
                    style={{ flex: 1, borderRadius: 12 }}
                    onBarcodeScanned={scanLock ? undefined : onScan}
                    barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                  />
                  <Button title="Stop Scan" onPress={() => setScanning(false)} />
                </View>
              )}
            </View>

            <View style={[styles.row, { backgroundColor: "#e6eef5" }]}>
              <Text style={[styles.itemText, { fontWeight: "700", flex: 1 }]}>Product</Text>
              <Text style={[styles.itemText, { fontWeight: "700", flex: 1 }]}>Qty</Text>
              <Text style={[styles.itemText, { fontWeight: "700", flex: 1 }]}>Date</Text>
              <Text style={[styles.itemText, { fontWeight: "700", flex: 1 }]}>Unit</Text>
              <Text style={[styles.itemText, { fontWeight: "700", flex: 1 }]}>Prices</Text>
            </View>

            <FlatList
              data={items}
              keyExtractor={(i) => String(i.id)}
              renderItem={({ item }) => (
                <View style={styles.row}>
                  <Text style={[styles.itemText, { flex: 1 }]}>{item.productName}</Text>
                  <Text style={[styles.itemText, { flex: 1 }]}>{item.quantity}</Text>
                  <Text style={[styles.itemText, { flex: 1 }]}>{item.date}</Text>
                  <Text style={[styles.itemText, { flex: 1 }]}>{item.unit}</Text>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemText}>PCS: ₱{item.pricePCS}</Text>
                    <Text style={styles.itemText}>BOX: ₱{item.priceBOX}</Text>
                    <Text style={styles.itemText}>TUB: ₱{item.priceTUB}</Text>
                  </View>
                </View>
              )}
            />
          </View>
        )}

        {/* REPORTS */}
        {page === "reports" && (
          <View>
            <Text style={styles.pageTitle}>Reports</Text>
            <View style={[styles.row, { backgroundColor: "#e6eef5" }]}>
              <Text style={[styles.itemText, { fontWeight: "700" }]}>Product</Text>
              <Text style={[styles.itemText, { fontWeight: "700" }]}>Saved At</Text>
            </View>
            <FlatList
              data={reports}
              keyExtractor={(i) => String(i.id || i.savedAt)}
              renderItem={({ item }) => (
                <View style={styles.row}>
                  <Text>
                    {item.productName} - {item.quantity} | PCS: ₱{item.pricePCS} | BOX: ₱{item.priceBOX} | TUB: ₱{item.priceTUB}
                  </Text>
                  <Text>{item.savedAt.slice(0, 19)}</Text>
                </View>
              )}
            />
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  containerCentered: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#f0f4f7",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 20,
    color: "#003366",
    textAlign: "center",
  },
  menu: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 220,
    backgroundColor: "#f5f5f5",
    padding: 16,
    zIndex: 100,
    left: -220,
  },
  menuTitle: { fontWeight: "700", marginBottom: 16, fontSize: 20 },
  menuItem: { paddingVertical: 12 },
  menuText: { fontWeight: "600", fontSize: 16 },
  logoutButton: {
    backgroundColor: "#e53935",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  menuToggle: { position: "absolute", top: 36, left: 16, zIndex: 200 },
  mainContent: { flex: 1, marginTop: 50 },
  pageTitle: {
    fontWeight: "700",
    fontSize: 22,
    marginBottom: 16,
    color: "#003366",
  },
  dashboardText: { fontSize: 16, marginBottom: 8 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
    borderRadius: 8,
    marginBottom: 6,
  },
  itemText: { fontSize: 16 },
  notifContainer: { position: "absolute", top: 50, left: 20, right: 20, zIndex: 999 },
  notifPanel: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  notifCloseBtn: {
    alignSelf: "flex-end",
    padding: 6,
    paddingHorizontal: 10,
    backgroundColor: "#003366",
    borderRadius: 6,
    marginBottom: 10,
  },
  notifTitle: {
    fontWeight: "700",
    fontSize: 18,
    marginBottom: 10,
  },
});
