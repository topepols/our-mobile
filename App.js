import React, { useState } from "react";
import { 
  View, Text, TextInput, TouchableOpacity, Button, Alert, ScrollView, Image, ActivityIndicator 
} from "react-native";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebaseConfig";
import * as ImagePicker from 'expo-image-picker';
import styles from "./styles";

// --- IMPORT DASHBOARDS ---
import OwnerDashboard from "./OwnerDashboard";
import EmployeeDashboard from "./EmployeeDashboard";

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Login State
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  // Register State
  const [regName, setRegName] = useState("");
  const [regUsername, setRegUsername] = useState(""); 
  const [regPosition, setRegPosition] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regImage, setRegImage] = useState(null);

  // --- LOGIN FUNCTION ---
  const handleLogin = async () => {
    if (!username || !password) return Alert.alert("Error", "Enter credentials");
    
    setIsLoading(true);
    try {
        const q = query(collection(db, "accounts"), where("username", "==", username), where("password", "==", password));
        const snap = await getDocs(q);

        if (!snap.empty) {
            const userData = snap.docs[0].data();
            
            // --- LOG AUDIT TRAIL FOR MOBILE LOGIN ---
            try {
                await addDoc(collection(db, "audit_logs"), {
                    actor: userData.username,
                    action: "MOBILE_LOGIN",
                    details: `${userData.name} logged in via App`,
                    timestamp: serverTimestamp()
                });
            } catch (auditError) {
                console.log("Audit log failed (non-critical):", auditError);
            }
            // ---------------------------------------------

            setCurrentUser(userData); 
        } else {
            Alert.alert("Error", "Invalid credentials");
        }
    } catch (e) { 
        Alert.alert("Error", "Login failed: " + e.message); 
    } finally {
        setIsLoading(false);
    }
  };

  // --- REGISTER FUNCTION ---
  const handleRegister = async () => {
    if (!regName || !regUsername || !regPassword) return Alert.alert("Error", "Fill all fields");
    
    setIsLoading(true);
    try {
        const q = query(collection(db, "accounts"), where("username", "==", regUsername));
        const snap = await getDocs(q);
        if(!snap.empty) {
            Alert.alert("Error", "Username already taken");
            setIsLoading(false);
            return;
        }

        await addDoc(collection(db, "accounts"), {
            name: regName, username: regUsername, position: regPosition,
            password: regPassword, imageUri: regImage || "", role: "employee", 
            createdAt: serverTimestamp()
        });
        
        try {
            await addDoc(collection(db, "audit_logs"), {
                actor: "System",
                action: "MOBILE_REGISTER",
                details: `New user registered: ${regUsername}`,
                timestamp: serverTimestamp()
            });
        } catch(e) {}

        Alert.alert("Success", "Account created! You can now login.");
        setIsRegistering(false);
        setRegName(""); setRegUsername(""); setRegPassword(""); setRegPosition(""); setRegImage(null);
    } catch (e) { 
        Alert.alert("Error", e.message); 
    } finally {
        setIsLoading(false);
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.5 });
    if (!result.canceled) setRegImage(result.assets[0].uri);
  };

  // --- NAVIGATION CONTROLLER ---
  if (currentUser) {
      const isAdmin = currentUser.role === 'owner' || currentUser.role === 'manager';
      
      if (isAdmin) {
          return <OwnerDashboard user={currentUser} onLogout={() => setCurrentUser(null)} />;
      } else {
          return <EmployeeDashboard user={currentUser} onLogout={() => setCurrentUser(null)} />;
      }
  }

  // --- LOGIN / REGISTER SCREEN ---
  return (
    <View style={[
      styles.containerCentered, 
      { 
        backgroundColor: '#F1F5F9',
        flex: 1,                     // Takes full height
        justifyContent: 'center',    // Centers vertically
        alignItems: 'center'         // Centers horizontally
      }
    ]}>
      
      {!isRegistering ? (
        // === LOGIN FORM (CENTERED) ===
        <View style={{ width: '100%', alignItems: 'center' }}>
            <Text style={{ fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 5 }}>Inventory System</Text>
            <Text style={{ fontSize: 14, color: '#64748B', marginBottom: 30 }}>Double JDG</Text>

            <View style={{ width: '90%', backgroundColor: 'white', padding: 25, borderRadius: 15, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 }}>
                <Text style={{ textAlign: 'center', marginBottom: 20, fontWeight: 'bold', fontSize: 18, color: '#334155' }}>LOGIN</Text>
                
                <TextInput 
                    placeholder="Username" 
                    placeholderTextColor="#94a3b8"
                    style={styles.input} 
                    onChangeText={setUsername} 
                    autoCapitalize="none" 
                    value={username}
                />
                <TextInput 
                    placeholder="Password" 
                    placeholderTextColor="#94a3b8"
                    secureTextEntry 
                    style={styles.input} 
                    onChangeText={setPassword}
                    value={password}
                />
                
                <TouchableOpacity 
                    style={{ backgroundColor: '#0F172A', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 }} 
                    onPress={handleLogin}
                    disabled={isLoading}
                >
                    {isLoading ? <ActivityIndicator color="white"/> : <Text style={{ color: 'white', fontWeight: 'bold' }}>SIGN IN</Text>}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setIsRegistering(true)} style={{ marginTop: 20, alignItems: 'center' }}>
                    <Text style={{ color: '#0369A1', fontWeight: '600' }}>Register New Employee</Text>
                </TouchableOpacity>
            </View>
        </View>
      ) : (
        // === REGISTER FORM (SCROLLABLE) ===
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', width: '100%', paddingVertical: 40 }} showsVerticalScrollIndicator={false}>
            <Text style={{ fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 5 }}>Inventory System</Text>
            <Text style={{ fontSize: 14, color: '#64748B', marginBottom: 30 }}>Double JDG</Text>

            <View style={{ width: '90%', backgroundColor: 'white', padding: 20, borderRadius: 15, elevation: 5, marginBottom: 20 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color:'#334155' }}>Create Account</Text>
                
                <View style={{ alignItems: 'center', marginBottom: 20 }}>
                    <TouchableOpacity onPress={pickImage} style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                        {regImage ? <Image source={{ uri: regImage }} style={{ width: 90, height: 90 }} /> : <Text style={{fontSize: 24}}>📷</Text>}
                    </TouchableOpacity>
                    <Text style={{ fontSize: 12, color: '#64748B', marginTop: 5 }}>Tap to add photo</Text>
                </View>

                <TextInput placeholder="Full Name" placeholderTextColor="#94a3b8" style={styles.input} onChangeText={setRegName} />
                <TextInput placeholder="Username" placeholderTextColor="#94a3b8" style={styles.input} onChangeText={setRegUsername} autoCapitalize="none" />
                <TextInput placeholder="Position (e.g. Staff)" placeholderTextColor="#94a3b8" style={styles.input} onChangeText={setRegPosition} />
                <TextInput placeholder="Password" placeholderTextColor="#94a3b8" secureTextEntry style={styles.input} onChangeText={setRegPassword} />
                
                <TouchableOpacity 
                    style={{ backgroundColor: '#22c55e', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 }} 
                    onPress={handleRegister}
                    disabled={isLoading}
                >
                    {isLoading ? <ActivityIndicator color="white"/> : <Text style={{ color: 'white', fontWeight: 'bold' }}>CREATE ACCOUNT</Text>}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setIsRegistering(false)} style={{ marginTop: 15, alignItems: 'center' }}>
                    <Text style={{ color: '#EF4444', fontWeight: 'bold' }}>Cancel</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
      )}
    </View>
  );
}