import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  title: { fontSize: 20, fontWeight: "700" },
  description: { opacity: 0.75 },

  scrollContent: { paddingBottom: 24 },

  stack: { gap: 12 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  rowItem: { flexGrow: 1, minWidth: 220 },

  section: { borderWidth: 1, borderRadius: 12, padding: 12, borderColor: "#ddd" },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  sectionBody: { gap: 12 },

  field: { gap: 6 },
  label: { fontWeight: "600" },
  errorText: { color: "#b00020" },

  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputError: { borderColor: "#b00020" },

  inlineRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  select: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    overflow: "hidden",
  },
  picker: { height: 44 },

  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  chipActive: { borderColor: "#111" },
  chipText: { fontSize: 13 },

  footer: { flexDirection: "row", gap: 12 },
  buttonPrimary: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#111",
  },
  buttonSecondary: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#111",
  },
  buttonText: { color: "#fff", fontWeight: "700" },

  signatureBox: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, overflow: "hidden" },
  signatureFooter: { flexDirection: "row", alignItems: "center", gap: 12, padding: 8 },
  signatureHint: { opacity: 0.7 },
  signatureFallback: { paddingVertical: 8 },

  fileHint: { marginTop: 6, opacity: 0.7 },
});
