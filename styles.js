import { StyleSheet, Dimensions } from "react-native";

export const chartConfig = {
  backgroundColor: "#ffffff",
  backgroundGradientFrom: "#ffffff",
  backgroundGradientTo: "#ffffff",
  decimalPlaces: 0,
  // This matches the soft blue and slate grey text in your images
  color: (opacity = 1) => `rgba(3, 105, 161, ${opacity})`, 
  labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
  barPercentage: 0.6, // Makes bars slightly thinner and more professional
  propsForBackgroundLines: {
    strokeWidth: 0, // Removes background grid lines for that clean look
  },
  propsForLabels: {
    fontSize: 10,
    fontWeight: "600",
  }
};

export default StyleSheet.create({
  // Layout & Global
  // Add or Update these in your styles.js
menu: { 
  position: "absolute", 
  top: 0, bottom: 0, 
  width: 280, 
  backgroundColor: "#F8FAFC", 
  paddingHorizontal: 20, 
  paddingVertical: 40, 
  zIndex: 100, 
  elevation: 10,
},
logoCircle: {
  width: 100,
  height: 100,
  borderRadius: 50, // This makes the square image a circle
  backgroundColor: '#fff',
  justifyContent: 'center',
  alignItems: 'center',
  borderWidth: 3,
  borderColor: '#0369A1', // Branding Blue
  overflow: 'hidden', // Clips the image to the circle
  elevation: 5,
  shadowColor: '#000',
  shadowOpacity: 0.1,
  shadowRadius: 10,
  marginBottom: 15,
},
logoImage: {
  width: '100%',
  height: '100%',
  resizeMode: 'cover', // Ensures the logo fills the circle
},
menuTitle: {
  color: '#0F172A',
  fontSize: 24,
  fontWeight: "900",
  letterSpacing: -0.5,
},
menuSubtitle: {
  color: "#64748B",
  fontSize: 13,
  fontWeight: "600",
  marginTop: 2,
},
menuItem: { 
  paddingVertical: 14, 
  paddingHorizontal: 16,
  borderRadius: 12,
  marginBottom: 10,
},
menuItemActive: {
  backgroundColor: "#E0F2FE", // Soft blue highlight like the reference
},
menuTextActive: {
  color: "#0369A1",
  fontWeight: "800",
},
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  containerCentered: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#F8FAFC" },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 16, 
    backgroundColor: 'white', 
    borderBottomWidth: 1, 
    borderBottomColor: '#E2E8F0' 
  },
  backdrop: { 
    position: 'absolute', 
    top: 0, left: 0, right: 0, bottom: 0, 
    backgroundColor: 'rgba(15, 23, 42, 0.4)', 
    zIndex: 90 
  },

  // Auth/Login
  title: { fontSize: 28, fontWeight: "800", textAlign: "center", marginBottom: 32, color: "#0F172A" },
  input: { 
    backgroundColor: 'white', 
    borderWidth: 1, 
    borderColor: "#E2E8F0", 
    padding: 14, 
    marginBottom: 16, 
    borderRadius: 12, 
    fontSize: 16 
  },

  // Sidebar Menu
  menu: { 
    position: "absolute", 
    top: 0, bottom: 0, 
    width: 280, 
    backgroundColor: "#F8FAFC", 
    paddingHorizontal: 20, 
    paddingVertical: 60, 
    zIndex: 100, 
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  menuTitle: { color: "#0F172A", fontSize: 24, fontWeight: "800", marginBottom: 4 },
  menuSubtitle: { color: "#64748B", fontSize: 14, marginBottom: 30 },
  menuItem: { 
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14, 
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  menuItemActive: { backgroundColor: "#E0F2FE" },
  menuText: { color: "#475569", fontSize: 16, fontWeight: "600" },
  menuTextActive: { color: "#0369A1" },

  // Buttons
  scanBtn: { 
    backgroundColor: '#0F172A', 
    padding: 18, 
    borderRadius: 14, 
    alignItems: 'center', 
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'center'
  },
  sellBtn: { 
    backgroundColor: '#EF4444', 
    width: 44, height: 44, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center',
    elevation: 2
  },
  logoutButton: { 
    marginTop: 'auto', 
    backgroundColor: '#FEE2E2',     
    padding: 16, 
    borderRadius: 12, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FCA5A5'
  },
  logoutText: { color: "#991B1B", fontWeight: "700", fontSize: 16 },

  // Cards & Rows
  card: { 
    backgroundColor: 'white', 
    padding: 20, 
    borderRadius: 16, 
    marginBottom: 16, 
    elevation: 4, 
    shadowColor: '#000', 
    shadowOpacity: 0.05, 
    shadowRadius: 8 
  },
  cardLabel: { fontSize: 15, marginBottom: 6, color: '#64748B' },
  cardVal: { fontWeight: '700', color: '#0F172A', fontSize: 18 },
  row: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: 'center', 
    padding: 16, 
    backgroundColor: "white", 
    marginBottom: 10, 
    borderRadius: 14, 
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },

  // Camera
  cameraOverlay: { position: 'absolute', bottom: 50, left: 0, right: 0, alignItems: 'center' }
  
});

