import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Button, Alert, ScrollView, Image, SafeAreaView } from "react-native";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebaseConfig";
import * as ImagePicker from 'expo-image-picker';
import styles from "./styles";

// --- IMPORT THE SEPARATE DASHBOARDS ---
import OwnerDashboard from "./OwnerDashboard";
import EmployeeDashboard from "./EmployeeDashboard";

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  
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

    try {
        const q = query(collection(db, "accounts"), where("username", "==", username), where("password", "==", password));
        const snap = await getDocs(q);

        if (!snap.empty) {
            const userData = snap.docs[0].data();
            setCurrentUser(userData); // <--- THIS SWITCHES THE VIEW
        } else {
            Alert.alert("Error", "Invalid credentials");
        }
    } catch (e) { Alert.alert("Error", "Login failed"); }
  };

  // --- REGISTER FUNCTION ---
  const handleRegister = async () => {
    if (!regName || !regUsername || !regPassword) return Alert.alert("Error", "Fill all fields");
    try {
        await addDoc(collection(db, "accounts"), {
            name: regName, username: regUsername, position: regPosition,
            password: regPassword, imageUri: regImage || "", role: "employee", 
            createdAt: serverTimestamp()
        });
        Alert.alert("Success", "Account created!");
        setIsRegistering(false);
    } catch (e) { Alert.alert("Error", e.message); }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.5 });
    if (!result.canceled) setRegImage(result.assets[0].uri);
  };

  // --- NAVIGATION CONTROLLER ---
  if (currentUser) {
      if (currentUser.role === 'owner') {
          return <OwnerDashboard user={currentUser} onLogout={() => setCurrentUser(null)} />;
      } else {
          return <EmployeeDashboard user={currentUser} onLogout={() => setCurrentUser(null)} />;
      }
  }

  // --- LOGIN SCREEN ---
  return (
    <View style={styles.containerCentered}>
      <Text style={styles.title}>Double JDG Inventory</Text>
      
      {!isRegistering ? (
        // LOGIN FORM
        <View style={{ width: '100%' }}>
            <Text style={{ textAlign: 'center', marginBottom: 20, color: '#64748B' }}>Login to your account</Text>
            <TextInput placeholder="Username" style={styles.input} onChangeText={setUsername} autoCapitalize="none" />
            <TextInput placeholder="Password" secureTextEntry style={styles.input} onChangeText={setPassword} />
            
            <TouchableOpacity style={{ backgroundColor: '#0F172A', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 }} onPress={handleLogin}>
                <Text style={{ color: 'white', fontWeight: 'bold' }}>LOGIN</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setIsRegistering(true)} style={{ marginTop: 20, alignItems: 'center' }}>
                <Text style={{ color: '#0369A1' }}>Register New Employee</Text>
            </TouchableOpacity>
        </View>
      ) : (
        // REGISTER FORM
        <ScrollView contentContainerStyle={{ alignItems: 'center', width: '100%' }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 15 }}>New Employee</Text>
            <TouchableOpacity onPress={pickImage} style={{ marginBottom: 15, width: 80, height: 80, borderRadius: 40, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' }}>
                {regImage ? <Image source={{ uri: regImage }} style={{ width: 80, height: 80, borderRadius: 40 }} /> : <Text>Photo</Text>}
            </TouchableOpacity>
            <TextInput placeholder="Full Name" style={styles.input} onChangeText={setRegName} />
            <TextInput placeholder="Username" style={styles.input} onChangeText={setRegUsername} autoCapitalize="none" />
            <TextInput placeholder="Position" style={styles.input} onChangeText={setRegPosition} />
            <TextInput placeholder="Password" secureTextEntry style={styles.input} onChangeText={setRegPassword} />
            
            <Button title="Create Account" onPress={handleRegister} />
            <Button title="Back to Login" color="#EF4444" onPress={() => setIsRegistering(false)} />
        </ScrollView>
      )}
    </View>
  );
}