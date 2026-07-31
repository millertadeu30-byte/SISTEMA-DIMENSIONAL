import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  limit,
  writeBatch,
  onSnapshot
} from "firebase/firestore";
import { Setor, Registro, NCPendente, HistoricoItem, ParadaItem, DesvioItem } from "./types";

// Firebase App configuration (publicly safe client-side config)
const firebaseConfig = {
  projectId: "gen-lang-client-0844737316",
  appId: "1:860570413915:web:7d90d41bbaaea9e8b5087e",
  apiKey: "AIzaSyC2wG1w7JZ2n6naHQm61Q_dSL_pNt9LC30",
  authDomain: "gen-lang-client-0844737316.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-controledimensio-6e3c047d-fc65-4f73-85b9-7a4b143c1b74",
  storageBucket: "gen-lang-client-0844737316.firebasestorage.app",
  messagingSenderId: "860570413915"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Helpers to format Brazil timezone times
export function getFormatoBrasil() {
  const agora = new Date();
  
  const formatterData = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });

  const formatterHora = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  return {
    data: formatterData.format(agora), // dd/MM/yyyy
    hora: formatterHora.format(agora), // HH:mm:ss
  };
}

function parseHoraParaMinutos(horaStr: string): number {
  const partes = horaStr.split(":");
  const h = parseInt(partes[0], 10) || 0;
  const m = parseInt(partes[1], 10) || 0;
  return h * 60 + m;
}

export function isOfflineMode(): boolean {
  return localStorage.getItem("modoOfflineLocal") === "true";
}

export function fbAtivarModoOffline(): void {
  localStorage.setItem("modoOfflineLocal", "true");
  
  // Semente de setores se estiver vazio
  if (!localStorage.getItem("local_setores")) {
    const defaultSetores = [
      {
        id: "t-automatico",
        titulo: "SISTEMA DIMENSIONAL T.AUTOMÁTICO",
        senha: "",
        maquinas: ["3", "4", "5", "6", "7", "8", "9", "12", "13", "S1", "S2", "T1", "T2"],
        colaboradores: ["ANSELMO", "ALEXANDER", "IAGO", "DANIEL", "WILSON", "JULIO", "MILLER"]
      }
    ];
    localStorage.setItem("local_setores", JSON.stringify(defaultSetores));
  }
  
  // Semente de registros se estiver vazio
  if (!localStorage.getItem("local_registros")) {
    const { data: hoje } = getFormatoBrasil();
    const defaultRegistros = [
      {
        linha: "reg-1",
        setorId: "t-automatico",
        data: hoje,
        hora: "07:30:00",
        colaborador: "ANSELMO",
        maquina: "7",
        conforme: "SIM",
        naoConformidade: "OK",
        codigoPeca: "-",
        responsavel: "-",
        usoDMM: "SIM",
        motivoDMM: "-",
        solucao: "",
        trocaFerramenta: "NÃO",
        oQueTrocou: "-",
        quemTrocou: "-",
        modeloPeca: "-",
        timestamp: Date.now() - 3600000
      },
      {
        linha: "reg-2",
        setorId: "t-automatico",
        data: hoje,
        hora: "08:15:00",
        colaborador: "ALEXANDER",
        maquina: "13",
        conforme: "NÃO",
        naoConformidade: "DIAMETRO EXTERNO FORA DO LIMITE (+0.05)",
        codigoPeca: "PECA-13B",
        responsavel: "ANSELMO",
        usoDMM: "SIM",
        motivoDMM: "-",
        solucao: "",
        trocaFerramenta: "NÃO",
        oQueTrocou: "-",
        quemTrocou: "-",
        modeloPeca: "EIXO-M13",
        timestamp: Date.now()
      }
    ];
    localStorage.setItem("local_registros", JSON.stringify(defaultRegistros));
  }
}

export function fbDesativarModoOffline(): void {
  localStorage.removeItem("modoOfflineLocal");
}

export function fbExportarBackup(): string {
  const backup = {
    setores: JSON.parse(localStorage.getItem("local_setores") || "[]"),
    registros: JSON.parse(localStorage.getItem("local_registros") || "[]"),
    dataExportacao: new Date().toISOString()
  };
  return JSON.stringify(backup, null, 2);
}

export function fbImportarBackup(jsonStr: string): void {
  try {
    const backup = JSON.parse(jsonStr);
    if (backup.setores && Array.isArray(backup.setores)) {
      localStorage.setItem("local_setores", JSON.stringify(backup.setores));
    }
    if (backup.registros && Array.isArray(backup.registros)) {
      localStorage.setItem("local_registros", JSON.stringify(backup.registros));
    }
  } catch (e) {
    throw new Error("Formato de backup inválido.");
  }
}

// 1. Initializer function to seed Firestore database on startup if it is empty
export async function inicializarBancoFirebase() {
  try {
    const setoresSnapshot = await getDocs(collection(db, "setores"));
    if (setoresSnapshot.empty) {
      console.log("Seeding Firestore with default sectors...");
      const colabsPadrao = ["ANSELMO", "ALEXANDER", "IAGO", "DANIEL", "WILSON", "JULIO", "MILLER"];
      const maqsPadrao = ["3", "4", "5", "6", "7", "8", "9", "12", "13", "S1", "S2", "T1", "T2"];

      // Add default sector
      await setDoc(doc(db, "setores", "t-automatico"), {
        id: "t-automatico",
        titulo: "SISTEMA DIMENSIONAL T.AUTOMÁTICO",
        senha: "",
        maquinas: maqsPadrao,
        colaboradores: colabsPadrao
      });

      // Add default global config
      await setDoc(doc(db, "config", "cadastro"), {
        colaboradores: colabsPadrao,
        maquinas: maqsPadrao
      });

      // Add default registrations
      const { data: hoje } = getFormatoBrasil();
      const registrosIniciais: Partial<Registro>[] = [
        {
          setorId: "t-automatico",
          data: hoje,
          hora: "07:30:00",
          colaborador: "ANSELMO",
          maquina: "7",
          conforme: "SIM",
          naoConformidade: "OK",
          codigoPeca: "-",
          responsavel: "-",
          usoDMM: "SIM",
          motivoDMM: "-",
          solucao: "",
          trocaFerramenta: "NÃO",
          oQueTrocou: "-",
          quemTrocou: "-",
          modeloPeca: "-",
          timestamp: Date.now() - 3600000
        },
        {
          setorId: "t-automatico",
          data: hoje,
          hora: "08:15:00",
          colaborador: "ALEXANDER",
          maquina: "13",
          conforme: "NÃO",
          naoConformidade: "DIAMETRO EXTERNO FORA DO LIMITE (+0.05)",
          codigoPeca: "PECA-13B",
          responsavel: "ANSELMO",
          usoDMM: "SIM",
          motivoDMM: "-",
          solucao: "", // Pendente de solução
          trocaFerramenta: "NÃO",
          oQueTrocou: "-",
          quemTrocou: "-",
          modeloPeca: "EIXO-M13",
          timestamp: Date.now()
        }
      ];

      for (const reg of registrosIniciais) {
        await addDoc(collection(db, "registros"), reg);
      }
      console.log("Firestore successfully seeded with default data!");
    }
  } catch (err) {
    console.error("Error seeding Firestore:", err);
  }
}

// 2. Sector Management APIs
export async function fbObterSetores(): Promise<Setor[]> {
  if (isOfflineMode()) {
    const data = localStorage.getItem("local_setores");
    return data ? JSON.parse(data) : [];
  }
  const snapshot = await getDocs(collection(db, "setores"));
  const setores: Setor[] = [];
  snapshot.forEach(doc => {
    setores.push(doc.data() as Setor);
  });
  return setores;
}

export async function fbCriarSetor(titulo: string, senha?: string): Promise<Setor> {
  if (isOfflineMode()) {
    const id = "setor-" + Date.now();
    const novoSetor: Setor = {
      id,
      titulo: titulo.trim().toUpperCase(),
      senha: senha ? senha.trim() : "",
      maquinas: ["3", "4", "5", "6", "7"],
      colaboradores: ["OPERADOR 1", "OPERADOR 2"]
    };
    const setores = JSON.parse(localStorage.getItem("local_setores") || "[]");
    setores.push(novoSetor);
    localStorage.setItem("local_setores", JSON.stringify(setores));
    return novoSetor;
  }
  const id = "setor-" + Date.now();
  const novoSetor: Setor = {
    id,
    titulo: titulo.trim().toUpperCase(),
    senha: senha ? senha.trim() : "",
    maquinas: ["3", "4", "5", "6", "7"],
    colaboradores: ["OPERADOR 1", "OPERADOR 2"]
  };
  await setDoc(doc(db, "setores", id), novoSetor);
  return novoSetor;
}

export async function fbAtualizarSetor(id: string, updates: Partial<Setor>): Promise<void> {
  if (isOfflineMode()) {
    const setores = JSON.parse(localStorage.getItem("local_setores") || "[]") as Setor[];
    const idx = setores.findIndex(s => s.id === id);
    if (idx !== -1) {
      const cleanUpdates: any = {};
      if (updates.titulo !== undefined) cleanUpdates.titulo = updates.titulo.trim().toUpperCase();
      if (updates.senha !== undefined) cleanUpdates.senha = updates.senha.trim();
      if (updates.maquinas !== undefined) {
        cleanUpdates.maquinas = updates.maquinas.map(m => m.trim().toUpperCase()).filter(Boolean);
      }
      if (updates.colaboradores !== undefined) {
        cleanUpdates.colaboradores = updates.colaboradores.map(c => c.trim().toUpperCase()).filter(Boolean);
      }
      setores[idx] = { ...setores[idx], ...cleanUpdates };
      localStorage.setItem("local_setores", JSON.stringify(setores));
    }
    return;
  }
  const cleanUpdates: any = {};
  if (updates.titulo !== undefined) cleanUpdates.titulo = updates.titulo.trim().toUpperCase();
  if (updates.senha !== undefined) cleanUpdates.senha = updates.senha.trim();
  if (updates.maquinas !== undefined) {
    cleanUpdates.maquinas = updates.maquinas.map(m => m.trim().toUpperCase()).filter(Boolean);
  }
  if (updates.colaboradores !== undefined) {
    cleanUpdates.colaboradores = updates.colaboradores.map(c => c.trim().toUpperCase()).filter(Boolean);
  }
  await updateDoc(doc(db, "setores", id), cleanUpdates);
}

export async function fbExcluirSetor(id: string): Promise<void> {
  if (isOfflineMode()) {
    if (id === "t-automatico") {
      throw new Error("O setor padrão não pode ser excluído");
    }
    const setores = JSON.parse(localStorage.getItem("local_setores") || "[]") as Setor[];
    const filtrados = setores.filter(s => s.id !== id);
    localStorage.setItem("local_setores", JSON.stringify(filtrados));
    return;
  }
  if (id === "t-automatico") {
    throw new Error("O setor padrão não pode ser excluído");
  }
  await deleteDoc(doc(db, "setores", id));
}

// 3. Registration/Cadastro APIs
export async function fbObterCadastro(setorId?: string): Promise<{ colaboradores: string[]; maquinas: string[] }> {
  if (isOfflineMode()) {
    if (setorId) {
      const setores = JSON.parse(localStorage.getItem("local_setores") || "[]") as Setor[];
      const sFound = setores.find(s => s.id === setorId);
      if (sFound) {
        return { colaboradores: sFound.colaboradores || [], maquinas: sFound.maquinas || [] };
      }
    }
    return { colaboradores: [], maquinas: [] };
  }
  if (setorId) {
    const sDoc = await getDoc(doc(db, "setores", setorId));
    if (sDoc.exists()) {
      const sData = sDoc.data() as Setor;
      return { colaboradores: sData.colaboradores || [], maquinas: sData.maquinas || [] };
    }
  }
  const globalDoc = await getDoc(doc(db, "config", "cadastro"));
  if (globalDoc.exists()) {
    const data = globalDoc.data() as { colaboradores: string[]; maquinas: string[] };
    return { colaboradores: data.colaboradores || [], maquinas: data.maquinas || [] };
  }
  return { colaboradores: [], maquinas: [] };
}

export async function fbAdicionarColaborador(nome: string, setorId?: string): Promise<string[]> {
  const nomeLimpo = nome.trim().toUpperCase();
  if (isOfflineMode()) {
    if (setorId) {
      const setores = JSON.parse(localStorage.getItem("local_setores") || "[]") as Setor[];
      const idx = setores.findIndex(s => s.id === setorId);
      if (idx !== -1) {
        const colabs = setores[idx].colaboradores || [];
        if (!colabs.includes(nomeLimpo)) {
          colabs.push(nomeLimpo);
          colabs.sort();
          setores[idx].colaboradores = colabs;
          localStorage.setItem("local_setores", JSON.stringify(setores));
        }
        return colabs;
      }
    }
    return [];
  }
  if (setorId) {
    const sRef = doc(db, "setores", setorId);
    const sDoc = await getDoc(sRef);
    if (sDoc.exists()) {
      const sData = sDoc.data() as Setor;
      const colabs = sData.colaboradores || [];
      if (!colabs.includes(nomeLimpo)) {
        colabs.push(nomeLimpo);
        colabs.sort();
        await updateDoc(sRef, { colaboradores: colabs });
      }
      return colabs;
    }
  }
  const gRef = doc(db, "config", "cadastro");
  const gDoc = await getDoc(gRef);
  let colabs: string[] = [];
  if (gDoc.exists()) {
    colabs = (gDoc.data() as any).colaboradores || [];
  }
  if (!colabs.includes(nomeLimpo)) {
    colabs.push(nomeLimpo);
    colabs.sort();
    await setDoc(gRef, { colaboradores: colabs }, { merge: true });
  }
  return colabs;
}

export async function fbRemoverColaborador(nome: string, setorId?: string): Promise<string[]> {
  const nomeLimpo = nome.trim().toUpperCase();
  if (isOfflineMode()) {
    if (setorId) {
      const setores = JSON.parse(localStorage.getItem("local_setores") || "[]") as Setor[];
      const idx = setores.findIndex(s => s.id === setorId);
      if (idx !== -1) {
        const colabs = (setores[idx].colaboradores || []).filter(c => c !== nomeLimpo);
        setores[idx].colaboradores = colabs;
        localStorage.setItem("local_setores", JSON.stringify(setores));
        return colabs;
      }
    }
    return [];
  }
  if (setorId) {
    const sRef = doc(db, "setores", setorId);
    const sDoc = await getDoc(sRef);
    if (sDoc.exists()) {
      const sData = sDoc.data() as Setor;
      const colabs = (sData.colaboradores || []).filter(c => c !== nomeLimpo);
      await updateDoc(sRef, { colaboradores: colabs });
      return colabs;
    }
  }
  const gRef = doc(db, "config", "cadastro");
  const gDoc = await getDoc(gRef);
  let colabs: string[] = [];
  if (gDoc.exists()) {
    colabs = (gDoc.data() as any).colaboradores || [];
  }
  colabs = colabs.filter(c => c !== nomeLimpo);
  await setDoc(gRef, { colaboradores: colabs }, { merge: true });
  return colabs;
}

export async function fbAdicionarMaquina(codigo: string, setorId?: string): Promise<string[]> {
  const codLimpo = codigo.trim().toUpperCase();
  if (isOfflineMode()) {
    if (setorId) {
      const setores = JSON.parse(localStorage.getItem("local_setores") || "[]") as Setor[];
      const idx = setores.findIndex(s => s.id === setorId);
      if (idx !== -1) {
        const maqs = setores[idx].maquinas || [];
        if (!maqs.includes(codLimpo)) {
          maqs.push(codLimpo);
          maqs.sort();
          setores[idx].maquinas = maqs;
          localStorage.setItem("local_setores", JSON.stringify(setores));
        }
        return maqs;
      }
    }
    return [];
  }
  if (setorId) {
    const sRef = doc(db, "setores", setorId);
    const sDoc = await getDoc(sRef);
    if (sDoc.exists()) {
      const sData = sDoc.data() as Setor;
      const maqs = sData.maquinas || [];
      if (!maqs.includes(codLimpo)) {
        maqs.push(codLimpo);
        maqs.sort();
        await updateDoc(sRef, { maquinas: maqs });
      }
      return maqs;
    }
  }
  const gRef = doc(db, "config", "cadastro");
  const gDoc = await getDoc(gRef);
  let maqs: string[] = [];
  if (gDoc.exists()) {
    maqs = (gDoc.data() as any).maquinas || [];
  }
  if (!maqs.includes(codLimpo)) {
    maqs.push(codLimpo);
    maqs.sort();
    await setDoc(gRef, { maquinas: maqs }, { merge: true });
  }
  return maqs;
}

export async function fbRemoverMaquina(codigo: string, setorId?: string): Promise<string[]> {
  const codLimpo = codigo.trim().toUpperCase();
  if (isOfflineMode()) {
    if (setorId) {
      const setores = JSON.parse(localStorage.getItem("local_setores") || "[]") as Setor[];
      const idx = setores.findIndex(s => s.id === setorId);
      if (idx !== -1) {
        const maqs = (setores[idx].maquinas || []).filter(m => m !== codLimpo);
        setores[idx].maquinas = maqs;
        localStorage.setItem("local_setores", JSON.stringify(setores));
        return maqs;
      }
    }
    return [];
  }
  if (setorId) {
    const sRef = doc(db, "setores", setorId);
    const sDoc = await getDoc(sRef);
    if (sDoc.exists()) {
      const sData = sDoc.data() as Setor;
      const maqs = (sData.maquinas || []).filter(m => m !== codLimpo);
      await updateDoc(sRef, { maquinas: maqs });
      return maqs;
    }
  }
  const gRef = doc(db, "config", "cadastro");
  const gDoc = await getDoc(gRef);
  let maqs: string[] = [];
  if (gDoc.exists()) {
    maqs = (gDoc.data() as any).maquinas || [];
  }
  maqs = maqs.filter(m => m !== codLimpo);
  await setDoc(gRef, { maquinas: maqs }, { merge: true });
  return maqs;
}

// 4. Alert/Monitoring and Measurement APIs
export async function fbObterAlertas(setorId?: string): Promise<{ ncPendentes: NCPendente[]; historico: HistoricoItem[] }> {
  if (isOfflineMode()) {
    const registros = JSON.parse(localStorage.getItem("local_registros") || "[]") as any[];
    
    // 1. Get unresolved NCs
    const ncPendentes: NCPendente[] = [];
    registros.forEach(r => {
      const rSetorId = r.setorId || "t-automatico";
      if (setorId && rSetorId !== setorId) return;

      const solucao = r.solucao ? r.solucao.trim() : "";
      if (solucao !== "") return; // Já resolvido

      const textoNC = r.naoConformidade ? r.naoConformidade.trim().toUpperCase() : "";
      if (textoNC !== "" && textoNC !== "OK" && textoNC !== "-") {
        ncPendentes.push({
          linha: r.linha,
          colaborador: r.colaborador || "NÃO INFORMADO",
          responsavel: r.responsavel || "NÃO INFORMADO",
          problema: r.naoConformidade,
          maquina: r.maquina,
          hora: r.hora.substring(0, 5),
          data: r.data,
          codigoPeca: r.codigoPeca || "-"
        });
      }
    });

    // 2. Get history (sorted by timestamp desc)
    const rawHistory: any[] = [];
    registros.forEach(r => {
      const rSetorId = r.setorId || "t-automatico";
      if (setorId && rSetorId !== setorId) return;

      const textoNC = r.naoConformidade ? r.naoConformidade.trim().toUpperCase() : "";
      const solucao = r.solucao ? r.solucao.trim() : "";
      const isProblem = textoNC !== "OK" && textoNC !== "-" && textoNC !== "";
      
      if (isProblem) {
        const infoTroca = r.trocaFerramenta === "SIM" ? ` | TROCA: ${r.oQueTrocou} por ${r.quemTrocou}` : "";
        const solucaoCompleta = solucao ? `${solucao}${infoTroca}` : `PENDENTE${infoTroca}`;
        rawHistory.push({
          data: r.data,
          hora: r.hora.substring(0, 5),
          maquina: r.maquina,
          problema: textoNC,
          responsavel: r.responsavel || "NÃO INFORMADO",
          colaborador: r.colaborador || "NÃO INFORMADO",
          solucao: solucaoCompleta,
          codigoPeca: r.codigoPeca || "-",
          quemResolveu: r.quemResolveu || "",
          timestamp: r.timestamp || 0
        });
      }
    });

    const historico = rawHistory.sort((a, b) => a.timestamp - b.timestamp);
    return { ncPendentes, historico };
  }

  // 1. Get unresolved NCs (where solucao is "")
  const pendingQuery = query(
    collection(db, "registros"),
    where("solucao", "==", "")
  );
  const pendingSnapshot = await getDocs(pendingQuery);
  const ncPendentes: NCPendente[] = [];
  
  pendingSnapshot.forEach(docSnap => {
    const r = docSnap.data() as Registro;
    const docId = docSnap.id;
    const rSetorId = r.setorId || "t-automatico";
    if (setorId && rSetorId !== setorId) return;

    const textoNC = r.naoConformidade ? r.naoConformidade.trim().toUpperCase() : "";
    if (textoNC !== "" && textoNC !== "OK" && textoNC !== "-") {
      ncPendentes.push({
        linha: docId as any,
        colaborador: r.colaborador || "NÃO INFORMADO",
        responsavel: r.responsavel || "NÃO INFORMADO",
        problema: r.naoConformidade,
        maquina: r.maquina,
        hora: r.hora.substring(0, 5),
        data: r.data,
        codigoPeca: r.codigoPeca || "-"
      });
    }
  });

  // 2. Get the 150 most recent records for the general NC history tab
  const historyQuery = query(
    collection(db, "registros"),
    orderBy("timestamp", "desc"),
    limit(150)
  );
  const historySnapshot = await getDocs(historyQuery);
  const rawHistory: any[] = [];
  
  historySnapshot.forEach(docSnap => {
    const r = docSnap.data() as Registro;
    const rSetorId = r.setorId || "t-automatico";
    if (setorId && rSetorId !== setorId) return;

    const textoNC = r.naoConformidade ? r.naoConformidade.trim().toUpperCase() : "";
    const solucao = r.solucao ? r.solucao.trim() : "";
    const isProblem = textoNC !== "OK" && textoNC !== "-" && textoNC !== "";
    
    if (isProblem) {
      const infoTroca = r.trocaFerramenta === "SIM" ? ` | TROCA: ${r.oQueTrocou} por ${r.quemTrocou}` : "";
      const solucaoCompleta = solucao ? `${solucao}${infoTroca}` : `PENDENTE${infoTroca}`;
      rawHistory.push({
        data: r.data,
        hora: r.hora.substring(0, 5),
        maquina: r.maquina,
        problema: textoNC,
        responsavel: r.responsavel || "NÃO INFORMADO",
        colaborador: r.colaborador || "NÃO INFORMADO",
        solucao: solucaoCompleta,
        codigoPeca: r.codigoPeca || "-",
        quemResolveu: r.quemResolveu || "",
        timestamp: r.timestamp || 0
      });
    }
  });

  // We sort/reverse to keep it ascending so the frontend's slice().reverse() makes it descending
  const historico = rawHistory.sort((a, b) => a.timestamp - b.timestamp);

  return { ncPendentes, historico };
}

export async function fbObterUltimoMotivo(maquina: string, setorId?: string): Promise<string> {
  if (isOfflineMode()) {
    const registros = JSON.parse(localStorage.getItem("local_registros") || "[]") as any[];
    const sorted = [...registros].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    const subset = sorted.slice(0, 200);

    for (const r of subset) {
      const rSetorId = r.setorId || "t-automatico";
      if (setorId && rSetorId !== setorId) continue;

      if (r.maquina === maquina.toUpperCase()) {
        const statusDMM = r.usoDMM ? r.usoDMM.toUpperCase().trim() : "";
        const motivo = r.motivoDMM ? r.motivoDMM.trim() : "";
        const solucao = r.solucao ? r.solucao.trim() : "";

        if (statusDMM === "SIM" && solucao === "DIVERGÊNCIA VERIFICADA E LIBERADA") {
          return "";
        }
        if (statusDMM === "NÃO" && solucao !== "DIVERGÊNCIA VERIFICADA E LIBERADA") {
          return (motivo !== "" && motivo !== "-") ? motivo : "";
        }
      }
    }
    return "";
  }

  // Query only the last 200 records across all machines (instead of ALL records of all time)
  const q = query(
    collection(db, "registros"),
    orderBy("timestamp", "desc"),
    limit(200)
  );
  const snapshot = await getDocs(q);
  let motivoEncontrado = "";

  for (const d of snapshot.docs) {
    const r = d.data() as Registro;
    const rSetorId = r.setorId || "t-automatico";
    if (setorId && rSetorId !== setorId) continue;

    if (r.maquina === maquina.toUpperCase()) {
      const statusDMM = r.usoDMM ? r.usoDMM.toUpperCase().trim() : "";
      const motivo = r.motivoDMM ? r.motivoDMM.trim() : "";
      const solucao = r.solucao ? r.solucao.trim() : "";

      if (statusDMM === "SIM" && solucao === "DIVERGÊNCIA VERIFICADA E LIBERADA") {
        return "";
      }
      if (statusDMM === "NÃO" && solucao !== "DIVERGÊNCIA VERIFICADA E LIBERADA") {
        return (motivo !== "" && motivo !== "-") ? motivo : "";
      }
    }
  }
  return motivoEncontrado;
}

export async function fbObterMonitoramento(setorId?: string): Promise<{ paradas: ParadaItem[]; desvios: DesvioItem[] }> {
  if (isOfflineMode()) {
    let maquinasSetor: string[] = [];
    if (setorId) {
      const setores = JSON.parse(localStorage.getItem("local_setores") || "[]") as Setor[];
      const sFound = setores.find(s => s.id === setorId);
      if (sFound) {
        maquinasSetor = sFound.maquinas || [];
      }
    }
    if (maquinasSetor.length === 0) {
      maquinasSetor = ["3", "4", "5", "6", "7", "8", "9", "12", "13", "S1", "S2", "T1", "T2"];
    }

    const { data: hojeStr, hora: horaAtualStr } = getFormatoBrasil();
    const minutosAgora = parseHoraParaMinutos(horaAtualStr);

    const registros = JSON.parse(localStorage.getItem("local_registros") || "[]") as any[];
    const registrosHoje = registros.filter(r => r.data === hojeStr);

    const paradas: ParadaItem[] = [];
    const desvios: DesvioItem[] = [];

    const estadoMaq: {
      [key: string]: {
        ultimaMedicaoMinutos: number | null;
        formatada: string;
        divergencia: boolean;
        motivo: string;
        linha?: string;
        comentarioSupervisor?: string;
        codAlternativo?: string;
      };
    } = {};

    maquinasSetor.forEach(m => {
      estadoMaq[m] = {
        ultimaMedicaoMinutos: null,
        formatada: "S/R",
        divergencia: false,
        motivo: ""
      };
    });

    const registrosOrdenados = [...registrosHoje].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    registrosOrdenados.forEach(r => {
      const rSetorId = r.setorId || "t-automatico";
      if (setorId && rSetorId !== setorId) return;

      const maq = r.maquina ? r.maquina.toUpperCase().trim() : "";
      if (!estadoMaq[maq]) {
        estadoMaq[maq] = { ultimaMedicaoMinutos: null, formatada: "S/R", divergencia: false, motivo: "" };
      }

      const mins = parseHoraParaMinutos(r.hora);
      const u = estadoMaq[maq].ultimaMedicaoMinutos;
      if (u === null || mins > u) {
        estadoMaq[maq].ultimaMedicaoMinutos = mins;
        estadoMaq[maq].formatada = r.hora.substring(0, 5);
      }

      const statusDMM = r.usoDMM ? r.usoDMM.toUpperCase().trim() : "SIM";
      const solucao = r.solucao ? r.solucao.trim() : "";
      const motivo = r.motivoDMM ? r.motivoDMM.trim() : "";

      if (statusDMM === "NÃO" && solucao !== "DIVERGÊNCIA VERIFICADA E LIBERADA") {
        estadoMaq[maq].divergencia = true;
        estadoMaq[maq].linha = r.linha;
        estadoMaq[maq].comentarioSupervisor = r.comentarioSupervisor || "";
        estadoMaq[maq].codAlternativo = r.codAlternativo || "";
        if (motivo !== "" && motivo !== "-") {
          estadoMaq[maq].motivo = motivo;
        }
      } else if (statusDMM === "SIM" && solucao === "DIVERGÊNCIA VERIFICADA E LIBERADA") {
        estadoMaq[maq].divergencia = false;
        estadoMaq[maq].motivo = "";
        estadoMaq[maq].linha = undefined;
        estadoMaq[maq].comentarioSupervisor = undefined;
        estadoMaq[maq].codAlternativo = undefined;
      }
    });

    const minutosLimite = 60;
    maquinasSetor.forEach(m => {
      const u = estadoMaq[m].ultimaMedicaoMinutos;
      if (u === null || (minutosAgora - u) > minutosLimite) {
        paradas.push({
          maq: m,
          hora: u !== null ? estadoMaq[m].formatada : "S/R"
        });
      }

      if (estadoMaq[m].divergencia) {
        desvios.push({
          maq: m,
          motivo: estadoMaq[m].motivo || "Divergência",
          linha: estadoMaq[m].linha as any,
          comentarioSupervisor: estadoMaq[m].comentarioSupervisor,
          codAlternativo: estadoMaq[m].codAlternativo
        });
      }
    });

    return { paradas, desvios };
  }

  // Obter maquinas
  let maquinasSetor: string[] = [];
  if (setorId) {
    const sDoc = await getDoc(doc(db, "setores", setorId));
    if (sDoc.exists()) {
      maquinasSetor = (sDoc.data() as Setor).maquinas || [];
    }
  }
  if (maquinasSetor.length === 0) {
    const globalDoc = await getDoc(doc(db, "config", "cadastro"));
    if (globalDoc.exists()) {
      maquinasSetor = (globalDoc.data() as any).maquinas || [];
    }
  }

  const { data: hojeStr, hora: horaAtualStr } = getFormatoBrasil();
  const minutosAgora = parseHoraParaMinutos(horaAtualStr);

  const snapshot = await getDocs(query(collection(db, "registros"), where("data", "==", hojeStr)));
  
  const paradas: ParadaItem[] = [];
  const desvios: DesvioItem[] = [];

  const estadoMaq: {
    [key: string]: {
      ultimaMedicaoMinutos: number | null;
      formatada: string;
      divergencia: boolean;
      motivo: string;
      linha?: string;
      comentarioSupervisor?: string;
      codAlternativo?: string;
    };
  } = {};

  maquinasSetor.forEach(m => {
    estadoMaq[m] = {
      ultimaMedicaoMinutos: null,
      formatada: "S/R",
      divergencia: false,
      motivo: ""
    };
  });

  // Sort today's records chronologically to prevent random state flipping
  const docs = snapshot.docs.map(docSnap => ({
    id: docSnap.id,
    data: docSnap.data() as Registro
  }));
  docs.sort((a, b) => {
    const tA = a.data.timestamp || 0;
    const tB = b.data.timestamp || 0;
    if (tA !== tB) {
      return tA - tB;
    }
    return (a.data.hora || "").localeCompare(b.data.hora || "");
  });

  docs.forEach(({ id, data: r }) => {
    const rSetorId = r.setorId || "t-automatico";
    if (setorId && rSetorId !== setorId) return;

    const maq = r.maquina;
    if (!estadoMaq[maq]) {
      estadoMaq[maq] = { ultimaMedicaoMinutos: null, formatada: "S/R", divergencia: false, motivo: "" };
    }

    const minutosReg = parseHoraParaMinutos(r.hora);
    const atualUltimaMinutos = estadoMaq[maq].ultimaMedicaoMinutos;
    if (atualUltimaMinutos === null || minutosReg > atualUltimaMinutos) {
      estadoMaq[maq].ultimaMedicaoMinutos = minutosReg;
      estadoMaq[maq].formatada = r.hora.substring(0, 5);
    }

    const statusDMM = r.usoDMM ? r.usoDMM.toUpperCase().trim() : "";
    const motivo = r.motivoDMM ? r.motivoDMM.trim() : "";
    const solucao = r.solucao ? r.solucao.trim() : "";

    if (statusDMM === "NÃO" && solucao !== "DIVERGÊNCIA VERIFICADA E LIBERADA") {
      estadoMaq[maq].divergencia = true;
      estadoMaq[maq].linha = id;
      estadoMaq[maq].comentarioSupervisor = r.comentarioSupervisor || "";
      estadoMaq[maq].codAlternativo = r.codAlternativo || "";
      if (motivo !== "" && motivo !== "-") {
        estadoMaq[maq].motivo = motivo;
      }
    } else if (statusDMM === "SIM" && solucao === "DIVERGÊNCIA VERIFICADA E LIBERADA") {
      estadoMaq[maq].divergencia = false;
      estadoMaq[maq].motivo = "";
      estadoMaq[maq].linha = undefined;
      estadoMaq[maq].comentarioSupervisor = undefined;
      estadoMaq[maq].codAlternativo = undefined;
    }
  });

  const minutosLimite = 60;
  maquinasSetor.forEach(m => {
    const u = estadoMaq[m].ultimaMedicaoMinutos;
    if (u === null || (minutosAgora - u) > minutosLimite) {
      paradas.push({
        maq: m,
        hora: u !== null ? estadoMaq[m].formatada : "S/R"
      });
    }

    if (estadoMaq[m].divergencia) {
      desvios.push({
        maq: m,
        motivo: estadoMaq[m].motivo || "Divergência",
        linha: estadoMaq[m].linha as any,
        comentarioSupervisor: estadoMaq[m].comentarioSupervisor,
        codAlternativo: estadoMaq[m].codAlternativo
      });
    }
  });

  return { paradas, desvios };
}

export async function fbSalvarMedicao(dados: Partial<Registro>, setorId?: string): Promise<void> {
  if (isOfflineMode()) {
    const { data: dataHoje, hora: horaHoje } = getFormatoBrasil();
    const novoRegistro: any = {
      linha: "reg-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      setorId: setorId || "t-automatico",
      data: dataHoje,
      hora: horaHoje,
      colaborador: (dados.colaborador || "").toUpperCase(),
      maquina: (dados.maquina || "").toUpperCase(),
      conforme: dados.conforme || "SIM",
      naoConformidade: dados.naoConformidade || "OK",
      codigoPeca: dados.codigoPeca || "-",
      responsavel: dados.responsavel || "-",
      usoDMM: dados.usoDMM || "SIM",
      motivoDMM: dados.motivoDMM || "-",
      solucao: "",
      trocaFerramenta: dados.trocaFerramenta || "NÃO",
      oQueTrocou: dados.oQueTrocou || "-",
      quemTrocou: dados.quemTrocou || "-",
      modeloPeca: dados.modeloPeca || "-",
      codAlternativo: (dados.codAlternativo || "-").toUpperCase(),
      timestamp: Date.now()
    };
    const registros = JSON.parse(localStorage.getItem("local_registros") || "[]");
    registros.push(novoRegistro);
    localStorage.setItem("local_registros", JSON.stringify(registros));
    return;
  }

  const { data: dataHoje, hora: horaHoje } = getFormatoBrasil();
  const novoRegistro: Partial<Registro> & { timestamp: number } = {
    setorId: setorId || "t-automatico",
    data: dataHoje,
    hora: horaHoje,
    colaborador: (dados.colaborador || "").toUpperCase(),
    maquina: (dados.maquina || "").toUpperCase(),
    conforme: dados.conforme || "SIM",
    naoConformidade: dados.naoConformidade || "OK",
    codigoPeca: dados.codigoPeca || "-",
    responsavel: dados.responsavel || "-",
    usoDMM: dados.usoDMM || "SIM",
    motivoDMM: dados.motivoDMM || "-",
    solucao: "",
    trocaFerramenta: dados.trocaFerramenta || "NÃO",
    oQueTrocou: dados.oQueTrocou || "-",
    quemTrocou: dados.quemTrocou || "-",
    modeloPeca: dados.modeloPeca || "-",
    codAlternativo: (dados.codAlternativo || "-").toUpperCase(),
    timestamp: Date.now()
  };
  await addDoc(collection(db, "registros"), novoRegistro);
}

export async function fbResolverNC(docId: string, solucao: string, quemResolveu?: string): Promise<void> {
  if (isOfflineMode()) {
    const registros = JSON.parse(localStorage.getItem("local_registros") || "[]") as any[];
    const idx = registros.findIndex(r => r.linha === docId);
    if (idx !== -1) {
      registros[idx].solucao = solucao.trim();
      if (quemResolveu) {
        registros[idx].quemResolveu = quemResolveu.trim().toUpperCase();
      }
      localStorage.setItem("local_registros", JSON.stringify(registros));
    }
    return;
  }

  const cleanUpdates: any = {
    solucao: solucao.trim()
  };
  if (quemResolveu) {
    cleanUpdates.quemResolveu = quemResolveu.trim().toUpperCase();
  }
  await updateDoc(doc(db, "registros", docId), cleanUpdates);
}

export async function fbLiberarDivergencia(docId: string, maquina: string, colaboradorSupervisor: string, setorId?: string): Promise<void> {
  if (isOfflineMode()) {
    const registros = JSON.parse(localStorage.getItem("local_registros") || "[]") as any[];
    if (docId) {
      const idx = registros.findIndex(r => r.linha === docId);
      if (idx !== -1) {
        registros[idx].solucao = "DIVERGÊNCIA VERIFICADA E LIBERADA";
        registros[idx].quemResolveu = colaboradorSupervisor.toUpperCase();
      }
    }

    const { data: dataHoje, hora: horaHoje } = getFormatoBrasil();
    const registroSupervisor: any = {
      linha: "reg-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      setorId: setorId || "t-automatico",
      data: dataHoje,
      hora: horaHoje,
      colaborador: colaboradorSupervisor.toUpperCase(),
      maquina: maquina.toUpperCase(),
      conforme: "SIM",
      naoConformidade: "OK",
      codigoPeca: "-",
      responsavel: "-",
      usoDMM: "SIM",
      motivoDMM: "-",
      solucao: "DIVERGÊNCIA VERIFICADA E LIBERADA",
      trocaFerramenta: "NÃO",
      oQueTrocou: "-",
      quemTrocou: "-",
      modeloPeca: "-",
      timestamp: Date.now()
    };
    registros.push(registroSupervisor);
    localStorage.setItem("local_registros", JSON.stringify(registros));
    return;
  }

  if (docId) {
    await updateDoc(doc(db, "registros", docId), {
      solucao: "DIVERGÊNCIA VERIFICADA E LIBERADA",
      quemResolveu: colaboradorSupervisor.toUpperCase()
    });
  }

  const { data: dataHoje, hora: horaHoje } = getFormatoBrasil();
  const registroSupervisor: Partial<Registro> & { timestamp: number } = {
    setorId: setorId || "t-automatico",
    data: dataHoje,
    hora: horaHoje,
    colaborador: colaboradorSupervisor.toUpperCase(),
    maquina: maquina.toUpperCase(),
    conforme: "SIM",
    naoConformidade: "OK",
    codigoPeca: "-",
    responsavel: "-",
    usoDMM: "SIM", // Liberado
    motivoDMM: "-",
    solucao: "DIVERGÊNCIA VERIFICADA E LIBERADA",
    trocaFerramenta: "NÃO",
    oQueTrocou: "-",
    quemTrocou: "-",
    modeloPeca: "-",
    timestamp: Date.now()
  };
  await addDoc(collection(db, "registros"), registroSupervisor);
}

export async function fbObterTodosRegistros(setorId?: string): Promise<any[]> {
  if (isOfflineMode()) {
    const registros = JSON.parse(localStorage.getItem("local_registros") || "[]") as any[];
    const sorted = [...registros].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    const list = sorted.slice(0, 1500).filter(r => !setorId || r.setorId === setorId);
    return list.reverse();
  }

  const q = query(
    collection(db, "registros"),
    orderBy("timestamp", "desc"),
    limit(1500)
  );
  const snapshot = await getDocs(q);
  const list: any[] = [];
  snapshot.forEach(docSnap => {
    const r = docSnap.data() as Registro;
    const rSetorId = r.setorId || "t-automatico";
    if (!setorId || rSetorId === setorId) {
      list.push({
        ...r,
        linha: docSnap.id // Usar ID do doc como ID único de linha
      });
    }
  });
  return list.reverse();
}

export async function fbExcluirRegistro(docId: string): Promise<void> {
  if (isOfflineMode()) {
    const registros = JSON.parse(localStorage.getItem("local_registros") || "[]") as any[];
    const filtrados = registros.filter(r => r.linha !== docId);
    localStorage.setItem("local_registros", JSON.stringify(filtrados));
    return;
  }

  await deleteDoc(doc(db, "registros", docId));
}

export async function fbExcluirDivergenciasMaquinaHoje(maquina: string, setorId?: string): Promise<void> {
  if (isOfflineMode()) {
    const { data: hojeStr } = getFormatoBrasil();
    const registros = JSON.parse(localStorage.getItem("local_registros") || "[]") as any[];
    const filtrados = registros.filter(r => {
      const rSetorId = r.setorId || "t-automatico";
      const statusDMM = r.usoDMM ? r.usoDMM.toUpperCase().trim() : "";
      const isTarget = r.data === hojeStr && r.maquina === maquina.toUpperCase() && statusDMM === "NÃO" && (!setorId || rSetorId === setorId);
      return !isTarget;
    });
    localStorage.setItem("local_registros", JSON.stringify(filtrados));
    return;
  }

  const { data: hojeStr } = getFormatoBrasil();
  const q = query(
    collection(db, "registros"),
    where("data", "==", hojeStr),
    where("maquina", "==", maquina.toUpperCase())
  );
  const snapshot = await getDocs(q);
  const batch = writeBatch(db);
  let count = 0;
  snapshot.forEach(docSnap => {
    const r = docSnap.data() as Registro;
    const rSetorId = r.setorId || "t-automatico";
    const statusDMM = r.usoDMM ? r.usoDMM.toUpperCase().trim() : "";
    if ((!setorId || rSetorId === setorId) && statusDMM === "NÃO") {
      batch.delete(docSnap.ref);
      count++;
    }
  });
  if (count > 0) {
    await batch.commit();
  }
}

export async function fbAdicionarComentario(docId: string, comentario: string): Promise<void> {
  if (isOfflineMode()) {
    const registros = JSON.parse(localStorage.getItem("local_registros") || "[]") as any[];
    const idx = registros.findIndex(r => r.linha === docId);
    if (idx !== -1) {
      registros[idx].comentarioSupervisor = comentario.trim().toUpperCase();
      localStorage.setItem("local_registros", JSON.stringify(registros));
    }
    return;
  }

  await updateDoc(doc(db, "registros", docId), {
    comentarioSupervisor: comentario.trim().toUpperCase()
  });
}

export function fbSubscreverCadastro(
  setorId: string | undefined,
  callback: (data: { colaboradores: string[]; maquinas: string[] }) => void,
  onError: (error: any) => void
): () => void {
  let unsubscribes: (() => void)[] = [];

  const handleUpdate = (sData: any, globalData: any) => {
    let colabs = sData?.colaboradores || [];
    let maqs = sData?.maquinas || [];

    if (colabs.length === 0 || maqs.length === 0) {
      if (colabs.length === 0) colabs = globalData?.colaboradores || [];
      if (maqs.length === 0) maqs = globalData?.maquinas || [];
    }

    callback({ colaboradores: colabs, maquinas: maqs });
  };

  let sectorData: any = null;
  let globalData: any = null;

  const unsubGlobal = onSnapshot(doc(db, "config", "cadastro"), (snap) => {
    globalData = snap.data();
    handleUpdate(sectorData, globalData);
  }, (error) => {
    onError(error);
  });
  unsubscribes.push(unsubGlobal);

  if (setorId) {
    const unsubSector = onSnapshot(doc(db, "setores", setorId), (snap) => {
      sectorData = snap.data();
      handleUpdate(sectorData, globalData);
    }, (error) => {
      onError(error);
    });
    unsubscribes.push(unsubSector);
  }

  return () => {
    unsubscribes.forEach(unsub => unsub());
  };
}

export function fbSubscreverMonitoramento(
  setorId: string | undefined,
  callback: (data: { paradas: ParadaItem[]; desvios: DesvioItem[] }) => void,
  onError: (error: any) => void
): () => void {
  const { data: hojeStr } = getFormatoBrasil();
  const q = query(collection(db, "registros"), where("data", "==", hojeStr));

  let maquinasSetor: string[] = [];
  let unsubscribes: (() => void)[] = [];

  const updateData = (snapshotDocs: any[]) => {
    const { hora: horaAtualStr } = getFormatoBrasil();
    const minutosAgora = parseHoraParaMinutos(horaAtualStr);

    const paradas: ParadaItem[] = [];
    const desvios: DesvioItem[] = [];

    const estadoMaq: {
      [key: string]: {
        ultimaMedicaoMinutos: number | null;
        formatada: string;
        divergencia: boolean;
        motivo: string;
        linha?: string;
        comentarioSupervisor?: string;
        codAlternativo?: string;
      };
    } = {};

    maquinasSetor.forEach(m => {
      estadoMaq[m] = {
        ultimaMedicaoMinutos: null,
        formatada: "S/R",
        divergencia: false,
        motivo: ""
      };
    });

    const docs = snapshotDocs.map(docSnap => ({
      id: docSnap.id,
      data: docSnap.data() as Registro
    }));
    docs.sort((a, b) => {
      const tA = a.data.timestamp || 0;
      const tB = b.data.timestamp || 0;
      if (tA !== tB) {
        return tA - tB;
      }
      return (a.data.hora || "").localeCompare(b.data.hora || "");
    });

    docs.forEach(({ id, data: r }) => {
      const rSetorId = r.setorId || "t-automatico";
      if (setorId && rSetorId !== setorId) return;

      const maq = r.maquina;
      if (!estadoMaq[maq]) {
        estadoMaq[maq] = { ultimaMedicaoMinutos: null, formatada: "S/R", divergencia: false, motivo: "" };
      }

      const minutosReg = parseHoraParaMinutos(r.hora);
      const atualUltimaMinutos = estadoMaq[maq].ultimaMedicaoMinutos;
      if (atualUltimaMinutos === null || minutosReg > atualUltimaMinutos) {
        estadoMaq[maq].ultimaMedicaoMinutos = minutosReg;
        estadoMaq[maq].formatada = r.hora.substring(0, 5);
      }

      const statusDMM = r.usoDMM ? r.usoDMM.toUpperCase().trim() : "";
      const motivo = r.motivoDMM ? r.motivoDMM.trim() : "";
      const solucao = r.solucao ? r.solucao.trim() : "";

      if (statusDMM === "NÃO" && solucao !== "DIVERGÊNCIA VERIFICADA E LIBERADA") {
        estadoMaq[maq].divergencia = true;
        estadoMaq[maq].linha = id;
        estadoMaq[maq].comentarioSupervisor = r.comentarioSupervisor || "";
        estadoMaq[maq].codAlternativo = r.codAlternativo || "";
        if (motivo !== "" && motivo !== "-") {
          estadoMaq[maq].motivo = motivo;
        }
      } else if (statusDMM === "SIM" && solucao === "DIVERGÊNCIA VERIFICADA E LIBERADA") {
        estadoMaq[maq].divergencia = false;
        estadoMaq[maq].motivo = "";
        estadoMaq[maq].linha = undefined;
        estadoMaq[maq].comentarioSupervisor = undefined;
        estadoMaq[maq].codAlternativo = undefined;
      }
    });

    const minutosLimite = 60;
    maquinasSetor.forEach(m => {
      const u = estadoMaq[m].ultimaMedicaoMinutos;
      if (u === null || (minutosAgora - u) > minutosLimite) {
        paradas.push({
          maq: m,
          hora: u !== null ? estadoMaq[m].formatada : "S/R"
        });
      }

      if (estadoMaq[m].divergencia) {
        desvios.push({
          maq: m,
          motivo: estadoMaq[m].motivo,
          linha: estadoMaq[m].linha,
          comentarioSupervisor: estadoMaq[m].comentarioSupervisor,
          codAlternativo: estadoMaq[m].codAlternativo
        });
      }
    });

    callback({ paradas, desvios });
  };

  const init = async () => {
    try {
      if (setorId) {
        const sDoc = await getDoc(doc(db, "setores", setorId));
        if (sDoc.exists()) {
          maquinasSetor = (sDoc.data() as Setor).maquinas || [];
        }
      }
      if (maquinasSetor.length === 0) {
        const globalDoc = await getDoc(doc(db, "config", "cadastro"));
        if (globalDoc.exists()) {
          maquinasSetor = (globalDoc.data() as any).maquinas || [];
        }
      }

      const unsubRegs = onSnapshot(q, (snapshot) => {
        updateData(snapshot.docs);
      }, (error) => {
        onError(error);
      });
      unsubscribes.push(unsubRegs);
    } catch (err) {
      onError(err);
    }
  };

  init();

  return () => {
    unsubscribes.forEach(u => u());
  };
}

export function fbSubscreverAlertas(
  setorId: string | undefined,
  callback: (data: { ncPendentes: NCPendente[]; historico: HistoricoItem[] }) => void,
  onError: (error: any) => void
): () => void {
  let ncPendentes: NCPendente[] = [];
  let historico: HistoricoItem[] = [];

  const pendingQuery = query(
    collection(db, "registros"),
    where("solucao", "==", "")
  );

  const historyQuery = query(
    collection(db, "registros"),
    orderBy("timestamp", "desc"),
    limit(150)
  );

  const handlePendingUpdate = (snapshotDocs: any[]) => {
    const list: NCPendente[] = [];
    snapshotDocs.forEach(docSnap => {
      const r = docSnap.data() as Registro;
      const docId = docSnap.id;
      const rSetorId = r.setorId || "t-automatico";
      if (setorId && rSetorId !== setorId) return;

      const textoNC = r.naoConformidade ? r.naoConformidade.trim().toUpperCase() : "";
      if (textoNC !== "" && textoNC !== "OK" && textoNC !== "-") {
        list.push({
          linha: docId as any,
          colaborador: r.colaborador || "NÃO INFORMADO",
          responsavel: r.responsavel || "NÃO INFORMADO",
          problema: r.naoConformidade,
          maquina: r.maquina,
          hora: r.hora.substring(0, 5),
          data: r.data,
          codigoPeca: r.codigoPeca || "-"
        });
      }
    });
    ncPendentes = list;
    callback({ ncPendentes, historico });
  };

  const handleHistoryUpdate = (snapshotDocs: any[]) => {
    const rawHistory: any[] = [];
    snapshotDocs.forEach(docSnap => {
      const r = docSnap.data() as Registro;
      const rSetorId = r.setorId || "t-automatico";
      if (setorId && rSetorId !== setorId) return;

      const textoNC = r.naoConformidade ? r.naoConformidade.trim().toUpperCase() : "";
      const solucao = r.solucao ? r.solucao.trim() : "";
      const isProblem = textoNC !== "OK" && textoNC !== "-" && textoNC !== "";

      if (isProblem) {
        const infoTroca = r.trocaFerramenta === "SIM" ? ` | TROCA: ${r.oQueTrocou} por ${r.quemTrocou}` : "";
        const solucaoCompleta = solucao ? `${solucao}${infoTroca}` : `PENDENTE${infoTroca}`;
        rawHistory.push({
          data: r.data,
          hora: r.hora.substring(0, 5),
          maquina: r.maquina,
          problema: textoNC,
          responsavel: r.responsavel || "NÃO INFORMADO",
          colaborador: r.colaborador || "NÃO INFORMADO",
          solucao: solucaoCompleta,
          codigoPeca: r.codigoPeca || "-",
          quemResolveu: r.quemResolveu || "",
          timestamp: r.timestamp || 0
        });
      }
    });
    historico = rawHistory.sort((a, b) => a.timestamp - b.timestamp);
    callback({ ncPendentes, historico });
  };

  const unsubPending = onSnapshot(pendingQuery, (snapshot) => {
    handlePendingUpdate(snapshot.docs);
  }, (error) => {
    onError(error);
  });

  const unsubHistory = onSnapshot(historyQuery, (snapshot) => {
    handleHistoryUpdate(snapshot.docs);
  }, (error) => {
    onError(error);
  });

  return () => {
    unsubPending();
    unsubHistory();
  };
}
