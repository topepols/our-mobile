import { StyleSheet, Dimensions } from "react-native";

export const chartConfig = {
  backgroundColor: "#ffffff",
  backgroundGradientFrom: "#ffffff",
  backgroundGradientTo: "#ffffff",
  decimalPlaces: 0,
  // Matches the soft blue branding and slate grey text
  color: (opacity = 1) => `rgba(3, 105, 161, ${opacity})`, 
  labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
  barPercentage: 0.6, 
  propsForBackgroundLines: {
    strokeWidth: 0, // Clean look without grid lines
  },
  propsForLabels: {
    fontSize: 10,
    fontWeight: "600",
  }
};

export default StyleSheet.create({
  // Layout & Global
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

  // Sidebar Menu (Matched to photo reference)
  menu: { 
    position: "absolute", 
    top: 0, bottom: 0, 
    width: 280, 
    backgroundColor: "#F8FAFC", 
    paddingHorizontal: 20, 
    paddingVertical: 40, 
    zIndex: 100, 
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  logoCircle: {
    width: 110,
    height: 110,
    borderRadius: 55, 
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#003366', // Deep blue border
    overflow: 'hidden',
    elevation: 5,
    marginBottom: 15,
  },
  logoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  menuTitle: { 
    color: '#0F172A', 
    fontSize: 26, 
    fontWeight: "900", 
    letterSpacing: -0.5,
    textAlign: 'center' 
  },
  menuSubtitle: { 
    color: "#64748B", 
    fontSize: 13, 
    fontWeight: "600", 
    marginTop: 2,
    textAlign: 'center'
  },
  menuItem: { 
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14, 
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  menuItemActive: { backgroundColor: "#E0F2FE" },
  menuText: { color: "#475569", fontSize: 16, fontWeight: "700" },
  menuTextActive: { color: "#0369A1", fontWeight: "800" },

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
    borderColor: '#FCA5A5',
    marginBottom: 20
  },
  logoutText: { color: "#991B1B", fontWeight: "700", fontSize: 16 },

  // Cards & Dashboard
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
  cardLabel: { fontSize: 15, marginBottom: 6, color: '#64748B', fontWeight: '600' },
  cardVal: { fontWeight: '700', color: '#0F172A', fontSize: 18 },
  
  // Recent Activity Feed
  activityRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    paddingVertical: 10, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F1F5F9' 
  },
  activityName: { fontWeight: '700', fontSize: 14, color: '#1E293B' },
  activityDate: { fontSize: 11, color: '#94A3B8', marginTop: 2 },

  // Report Filter Chips
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#0369A1', 
    borderColor: '#0369A1',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: 'white',
  },

  // List Rows
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