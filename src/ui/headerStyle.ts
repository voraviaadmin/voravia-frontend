// src/ui/headerStyle.ts
import { Theme } from "./theme";
import { Screen } from "@/src/ui/Screen";
import { S } from "@/src/ui/spacing";

export const headerStyles = {
  base: {
    headerTitleAlign: "center" as const,
    headerShadowVisible: false,
    headerStyle: {
      backgroundColor: Theme.colors.bg,
      height: 52,
    },
    headerTitleStyle: {
      fontSize: 16,
      fontWeight: "800" as const,
      color: Theme.colors.textPrimary,
    },
  },

  rightButton: {
    minWidth: 78,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: "rgba(15,118,110,0.18)",
  },

  rightButtonText: {
    fontSize: 13,
    fontWeight: "900" as const,
    color: "#0F172A",
    includeFontPadding: false,
  },


//Tabs
//---------------------------------------------------------------------------------------------------------------------------//  
//                                                        Home                                                               //
//---------------------------------------------------------------------------------------------------------------------------//  



  brand: { fontSize: 28, fontWeight: "800" as const, color: "#0B2A2F", letterSpacing: 0.2 },
  subtitle: { marginTop: 4, fontSize: 13, color: "#4A6468" },
  meHint: { marginTop: 6, fontSize: 12, color: "#6B8387", fontWeight: "700" as const},


// Scan Button 
  primaryBtn: { flex: 1, backgroundColor: "#0E7C86", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 12 },
  primaryBtnText: { color: "#FFFFFF", fontWeight: "800" as const, fontSize: 14 },
  primaryBtnSub: { marginTop: 4, color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "600" as const},


// Restaurant Button  
  secondaryBtn: {
    flex: 1,
    backgroundColor: "#F1FBFC",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#CFE8EA",
  },
  secondaryBtnText: { color: "#0B2A2F", fontWeight: "800" as const, fontSize: 14 },
  secondaryBtnSub: { marginTop: 4, color: "#4A6468", fontSize: 12, fontWeight: "600" as const},

  


//---------------------------------------------------------------------------------------------------------------------------//  
//                                                        Other Tabs Common                                                              //
//---------------------------------------------------------------------------------------------------------------------------//  


  title: { fontSize: 28, fontWeight: "800" as const, color: "#0B2A2F", letterSpacing: 0.2 },

  cardTitle: { fontSize: 16, fontWeight: "900" as const },
  cardSub: { marginTop: 6, opacity: 0.7 },
  page: { flex: 1, backgroundColor: Theme.colors.bg},  
  content: { padding: 16, paddingBottom: 28 },


// Below Button is used in 1) Group for Assign, invite, Join, Add Member  2) Profile for Add   


  smallBtn: {
    borderRadius: Theme.radius.lg,
    paddingVertical: S.sm,
    paddingHorizontal: S.sm,
    backgroundColor: "rgba(15,118,110,0.12)",
    borderWidth: 1,
    borderColor: "rgba(15,118,110,0.35)",
  },
  smallBtnText: { fontWeight: "700" as const, color: "#0F766E" },

  addMemberBtn: {
    marginTop: S.md,
    backgroundColor: "rgba(15,118,110,0.12)",
    borderRadius: Theme.radius.lg,
    paddingVertical: S.sm,
    alignItems: "center" as const,
    borderWidth: 1,
    borderColor: "rgba(15,118,110,0.35)",
  },
  addMemberBtnText: { fontWeight: "700" as const, color: "#0F766E", fontSize: 14 },


  addBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(15,118,110,0.12)",
    borderWidth: 1,
    borderColor: "rgba(15,118,110,0.35)",
  },
  addBtnText: { color: "#0b1220", fontWeight: "700" as const},




//---------------------------------------------------------------------------------------------------------------------------//  
//                                                        Groups Tabs                                                               //
//---------------------------------------------------------------------------------------------------------------------------//  

gcontent: { paddingHorizontal: S.lg, paddingBottom: 24, marginTop:-30 },


segRow: {
  marginTop: S.lg,
  flexDirection: "row" as const,
  backgroundColor: "rgba(0,0,0,0.06)",
  borderRadius: Theme.radius.lg,
  padding: 6,
  gap: 6,
},
segPill: {
  flex: 1,
  paddingVertical: S.md,
  borderRadius: Theme.radius.lg,
  alignItems: "center" as const,
},
segPillOn: {
  backgroundColor: "#0F766E",
},
segText: {
  fontWeight: "900" as const,
  color: "rgba(0,0,0,0.55)",
},
segTextOn: {
  color: "white",
},

noFamilyCard: {
  marginTop: S.md,
  backgroundColor: Theme.colors.bg,
  borderRadius: Theme.radius.lg,
  padding: 16,
},
noFamilyTitle: { fontSize: 18, fontWeight: "900" as const, color: "#0F172A" },
noFamilySub: { marginTop: 6, color: "rgba(0,0,0,0.55)", fontWeight: "700" as const },

gcprimaryBtn: {
  marginTop: S.md,
  backgroundColor: "#0F766E",
  borderRadius: Theme.radius.lg,
  paddingVertical: S.md,
  paddingHorizontal: S.lg,
  alignItems: "center" as const,
},
gcprimaryBtnText: { color: "white", fontWeight: "900" as const, fontSize: 16 },

ghostBtn: {
  marginTop: S.md,
  backgroundColor: "rgba(15,118,110,0.10)",
  borderRadius: Theme.radius.lg,
  paddingVertical: S.md,
  paddingHorizontal: S.lg,
  alignItems: "center" as const,
},
ghostBtnText: { color: "#0F766E", fontWeight: "900" as const, fontSize: 16 },

membersCard: {
  marginTop: S.md,
  backgroundColor: "rgba(15,118,110,0.08)",
  borderRadius: Theme.radius.lg,
  padding: 14,
},
membersHeader: {
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
},
membersTitle: { fontSize: 16, fontWeight: "800" as const, color: "#0F172A" },
membersCount: { marginTop: 2, fontWeight: "800" as const, color: "rgba(0,0,0,0.55)" },
chevSmall: { fontSize: 20, fontWeight: "900" as const, color: "rgba(0,0,0,0.45)" },

membersTopRow: { flexDirection: "row" as const, gap: 10, flexWrap: "wrap" as const, marginTop: S.md },




addBox: {
  marginTop: S.md,
  backgroundColor: Theme.colors.bg,
  borderRadius: Theme.radius.lg,
  padding: 14,
},
gclabel: { fontWeight: "900" as const, color: "#0F172A", marginTop: S.md },
gcinput: {
  marginTop: S.md,
  borderWidth: 1,
  borderColor: Theme.colors.divider,
  borderRadius: Theme.radius.lg,
  paddingVertical: S.md,
  paddingHorizontal: S.lg,
  backgroundColor: Theme.colors.bg,
  fontWeight: "800" as const,
},
typePill: {
  marginTop: S.md,
  alignSelf: "flex-start" as const,
  paddingVertical: S.md,
  paddingHorizontal: S.lg,
  borderRadius: 999,
  backgroundColor: "rgba(15,118,110,0.10)",
},

typePillText: { 
  fontWeight: "700" as const, 
  color: "#0F766E", 
  //borderRadius: Theme.radius.lg,
  //paddingVertical: S.sm,
  //paddingHorizontal: S.sm,
  //backgroundColor: "rgba(15,118,110,0.12)",
  //borderWidth: 1,
  borderColor: "rgba(15,118,110,0.35)",
},

memberMsg: { marginTop: 10, fontWeight: "900" as const, color: "rgba(0,0,0,0.65)" },

memberRow: {
  marginTop: S.md,
  backgroundColor: "rgba(255,255,255,0.65)",
  borderRadius: Theme.radius.lg,
  padding: 14,
  flexDirection: "row" as const,
  alignItems: "center" as const,
},
memberName: { fontWeight: "900" as const, fontSize: 18, color: "#0F172A" },
memberMetaRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10, marginTop: S.md, flexWrap: "wrap" as const },

typePillSmall: {
  paddingVertical: S.md,
  paddingHorizontal: S.lg,
  borderRadius: 999,
  backgroundColor: "rgba(15,118,110,0.12)",
},
typePillSmallText: { fontWeight: "900" as const, color: "#0F766E" },

memberMetaText: { fontWeight: "900" as const, color: "rgba(0,0,0,0.55)" },

deleteBtn: {
  backgroundColor: "rgba(220,38,38,0.10)",
  borderRadius: 999,
  paddingVertical: S.md,
  paddingHorizontal: S.lg,
},
deleteBtnText: { fontWeight: "900" as const, color: "rgba(220,38,38,0.90)" },

memberRowCompact: {
  marginTop: 10,
  backgroundColor: "rgba(255,255,255,0.75)",
  borderRadius: Theme.radius.lg,
  paddingVertical: 10,
  paddingHorizontal: 12,
  flexDirection: "row" as const,
  alignItems: "center" as const,
},

memberTopLine: {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "space-between" as const,
  gap: 10,
},

memberTopRight: {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 8,
},

memberNameCompact: {
  flex: 1,
  fontWeight: "900" as const,
  fontSize: 16,
  color: "#0F172A",
},

memberMetaTextCompact: {
  marginTop: 6,
  fontWeight: "800" as const,
  fontSize: 12,
  color: "rgba(0,0,0,0.55)",
},


deleteBtnTiny: {
  backgroundColor: "rgba(220,38,38,0.10)",
  borderRadius: 999,
  paddingVertical: 6,
  paddingHorizontal: 10,
},

deleteBtnTinyText: {
  fontWeight: "900" as const,
  fontSize: 12,
  color: "rgba(220,38,38,0.90)",
},

memberGrid: {
  marginTop: 10,
  flexDirection: "row" as const,
  flexWrap: "wrap" as const,
  gap: 10,
},

memberTile: {
  width: "48%" as const,
  backgroundColor: "rgba(255,255,255,0.65)",
  borderRadius: Theme.radius.lg,
  paddingVertical: 10,
  paddingHorizontal: 12,
  borderWidth: 1,
  borderColor: "rgba(15,118,110,0.10)",
},

memberTileTop: {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "space-between" as const,
  gap: 8,
},

memberTileName: {
  flex: 1,
  fontSize: 15,
  fontWeight: "900" as const,
  color: "#0F172A",
},

trashBtn: {
  padding: 6,
  borderRadius: 999,
  backgroundColor: "rgba(0,0,0,0.04)",
},

typePillTiny: {
  marginTop: 8,
  alignSelf: "flex-start" as const,
  paddingVertical: 5,
  paddingHorizontal: 10,
  borderRadius: 999,
  backgroundColor: "rgba(15,118,110,0.12)",
},

typePillTinyText: {
  fontSize: 11,
  fontWeight: "900" as const,
  color: "#0F766E",
},

memberTileMeta: {
  marginTop: 8,
  fontSize: 11,
  fontWeight: "800" as const,
  color: "rgba(0,0,0,0.50)",
},



//---------------------------------------------------------------------------------------------------------------------------//  
//                                                        Profile Tabs                                                               //
//---------------------------------------------------------------------------------------------------------------------------//  



  stprimaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: Theme.colors.teal,
    alignSelf: "flex-start" as const,
  },
  stprimaryBtnText: {
    color: "white",
    fontWeight: "900" as const,
  },

 
  

  card: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Theme.colors.card,
  },

  label: { fontWeight: "800" as const, opacity: 0.8, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "white",
  },

  saved: { fontWeight: "900" as const, color: "#0f766e" },
  hint: { marginTop: 10, opacity: 0.6 },


  toggleRow: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  },
  toggleLabel: { color: "#0b1220", fontSize: 14, fontWeight: "700" as const },

  pill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999 },
  pillOn: {
    backgroundColor: "rgba(15,118,110,0.12)",
    borderWidth: 1,
    borderColor: "rgba(15,118,110,0.35)",
  },
  pillOff: {
    backgroundColor: "rgba(0,0,0,0.04)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.10)",
  },
  pillText: { color: "#0b1220", fontSize: 12, fontWeight: "800" as const },

  sectionLabel: { marginTop: 8, color: "#52606d", fontSize: 12, fontWeight: "800" as const},

  chipRow: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 10, marginTop: 10 },
  chip: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1 },
  chipOn: {
    backgroundColor: "rgba(15,118,110,0.12)",
    borderColor: "rgba(15,118,110,0.35)",
  },
  chipOff: { backgroundColor: "white", borderColor: "rgba(0,0,0,0.12)" },
  chipText: { fontSize: 13, fontWeight: "800" as const },
  chipTextOn: { color: "#0b1220" },
  chipTextOff: { color: "#52606d" },

  inputRow: { flexDirection: "row" as const, gap: 10, marginTop: 10, alignItems: "center" as const },
  
  smallMuted: { color: "#52606d", fontSize: 12 },

  footerRow: { marginTop: 14, flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const },

};
