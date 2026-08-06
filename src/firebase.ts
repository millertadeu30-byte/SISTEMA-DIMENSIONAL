import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut
} from "firebase/auth";
import {
  getFirestore,
  doc,
  collection,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
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
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Setup Google OAuth provider (kept for UI profile/sign-in flows)
const provider = new GoogleAuthProvider();

let cachedAccessToken: string | null = null;

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

export function getBackendUrl(): string {
  if (typeof window === "undefined") return "";
  const hostname = window.location.hostname;
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.includes("run.app") ||
    hostname.includes("aistudio-preview.net")
  ) {
    return "";
  }
  return "https://ais-pre-ronann3digcd7qkrwc3nay-25708931279.us-west1.run.app";
}

// Active/offline modes based on explicit user setting - completely disabled as requested by user
export function isOfflineMode(): boolean {
  return false;
}

export function fbAtivarModoOffline(): void {
  try {
    localStorage.setItem("offline_mode_active", "false");
  } catch {}
}

export function fbDesativarModoOffline(): void {
  try {
    localStorage.setItem("offline_mode_active", "false");
  } catch {}
}

// Export backup from localStorage
export function fbExportarBackup(): string {
  const setores = localStorage.getItem("local_setores") ? JSON.parse(localStorage.getItem("local_setores")!) : [];
  const registros = localStorage.getItem("local_registros") ? JSON.parse(localStorage.getItem("local_registros")!) : [];
  return JSON.stringify({ setores, registros }, null, 2);
}

// Import/Restore backup to local storage, Cloud Run server, and Firestore
export async function fbRestaurarBackupCompleto(jsonStr: string): Promise<void> {
  try {
    const backup = JSON.parse(jsonStr);
    const setores = backup.setores || [];
    const registros = backup.registros || [];

    // 1. Guardar no localStorage
    if (Array.isArray(setores) && setores.length > 0) {
      localStorage.setItem("local_setores", JSON.stringify(setores));
    }
    if (Array.isArray(registros) && registros.length > 0) {
      localStorage.setItem("local_registros", JSON.stringify(registros));
    }

    // 2. Enviar para o servidor Cloud Run
    try {
      const url = `${getBackendUrl()}/api/backup/restaurar`;
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setores, registros })
      });
    } catch (e) {
      console.warn("Aviso ao enviar backup ao servidor local:", e);
    }

    // 3. Tentar salvar no Firestore se houver conexão
    try {
      if (Array.isArray(setores) && setores.length > 0) {
        const batchSetores = writeBatch(db);
        setores.forEach((s: any) => {
          if (s.id) {
            const dRef = doc(db, "setores", s.id);
            batchSetores.set(dRef, s, { merge: true });
          }
        });
        await batchSetores.commit();
      }

      if (Array.isArray(registros) && registros.length > 0) {
        const chunkSize = 400;
        for (let i = 0; i < registros.length; i += chunkSize) {
          const chunk = registros.slice(i, i + chunkSize);
          const batchRegs = writeBatch(db);
          chunk.forEach((r: any, idx: number) => {
            const docId = r.linha || `reg-${Date.now()}-${i + idx}`;
            const dRef = doc(db, "registros", docId);
            batchRegs.set(dRef, { ...r, linha: docId }, { merge: true });
          });
          await batchRegs.commit();
        }
      }
    } catch (e) {
      console.warn("Aviso ao enviar backup ao Firestore:", e);
    }
  } catch (e: any) {
    throw new Error("Formato de arquivo JSON inválido: " + e.message);
  }
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

// ==========================================
// AUTOMATIC COLA / SERVER FALLBACK ENGINE
// ==========================================
interface FallbackState {
  isFallbackActive: boolean;
  lastFailureDate: string;
}

function getFallbackState(): FallbackState {
  try {
    const active = localStorage.getItem("fb_fallback_active") === "true";
    const lastDate = localStorage.getItem("fb_fallback_date") || "";
    return { isFallbackActive: active, lastFailureDate: lastDate };
  } catch {
    return { isFallbackActive: false, lastFailureDate: "" };
  }
}

function setFallbackState(active: boolean) {
  try {
    const { data: hojeStr } = getFormatoBrasil();
    localStorage.setItem("fb_fallback_active", String(active));
    localStorage.setItem("fb_fallback_date", hojeStr);
    if (active) {
      console.warn(`[Firebase Fallback] Fallback activated on ${hojeStr}. Routing all queries to local server.`);
    } else {
      console.info("[Firebase Fallback] Resetting fallback. Trying Firestore again.");
    }
  } catch (e) {
    console.error("Erro ao salvar fallback state", e);
  }
}

export function checkUseFallback(): boolean {
  const state = getFallbackState();
  if (!state.isFallbackActive) {
    return false;
  }
  const { data: hojeStr } = getFormatoBrasil();
  if (state.lastFailureDate !== hojeStr) {
    setFallbackState(false);
    return false;
  }
  return true;
}

async function executeWithFallback<T>(
  firestoreCall: () => Promise<T>,
  serverCall: () => Promise<T>
): Promise<T> {
  if (checkUseFallback()) {
    console.info("[Fallback Mode] Executing database operation on local server API.");
    return await serverCall();
  }

  let timeoutId: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("Firestore operation timed out"));
    }, 15000); // 15 seconds generous timeout for slow factory networks
  });

  try {
    const result = await Promise.race([
      firestoreCall().then((res) => {
        clearTimeout(timeoutId);
        return res;
      }),
      timeoutPromise
    ]);
    return result;
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error("[Firestore Error] Firestore operation failed or timed out:", error);
    const errMessage = String(error?.message || error).toLowerCase();
    const isQuotaError = 
      errMessage.includes("quota") || 
      errMessage.includes("resource-exhausted") || 
      errMessage.includes("exceeded") || 
      errMessage.includes("permission-denied") ||
      errMessage.includes("insufficient permissions") ||
      errMessage.includes("offline") ||
      errMessage.includes("timeout") ||
      errMessage.includes("timed out") ||
      errMessage.includes("failed to get document");

    if (isQuotaError) {
      console.warn("[Quota / Network / Timeout Error] Activating automatic fallback to local server database.");
      setFallbackState(true);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("firebase-quota-exceeded"));
      }
      return await serverCall();
    }
    throw error;
  }
}

// Auth compatibility layer
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  let active = true;
  getAccessToken().then((token) => {
    if (!active) return;
    if (token) {
      const mockUser = {
        uid: "service-account",
        email: "service-account@google.com",
        displayName: "Operador Autorizado",
      } as unknown as User;
      if (onAuthSuccess) onAuthSuccess(mockUser, token);
    } else {
      onAuthStateChanged(auth, async (user: User | null) => {
        if (!active) return;
        if (user) {
          const userToken = cachedAccessToken || "firebase-auth-token";
          if (onAuthSuccess) onAuthSuccess(user, userToken);
        } else {
          if (onAuthFailure) onAuthFailure();
        }
      });
    }
  }).catch(() => {
    if (!active) return;
    onAuthStateChanged(auth, async (user: User | null) => {
      if (!active) return;
      if (user) {
        const userToken = cachedAccessToken || "firebase-auth-token";
        if (onAuthSuccess) onAuthSuccess(user, userToken);
      } else {
        if (onAuthFailure) onAuthFailure();
      }
    });
  });

  return () => {
    active = false;
  };
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || "firebase-auth-token";
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("Erro no login do Google:", error);
    throw error;
  }
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken) return cachedAccessToken;
  try {
    const res = await fetch(`${getBackendUrl()}/api/google-token`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.accessToken) {
        cachedAccessToken = data.accessToken;
        return cachedAccessToken;
      }
    }
  } catch (e) {
    console.warn("Erro ao buscar token do servidor:", e);
  }
  return null;
};

// ==========================================
// DATA AGGREGATION & CONVERSION HELPERS
// ==========================================
function processAlertasAndHistorico(registros: any[], setorId?: string) {
  const ncPendentes: NCPendente[] = [];
  const historico: HistoricoItem[] = [];

  registros.forEach((r) => {
    const rSetorId = r.setorId || "t-automatico";
    if (setorId && rSetorId !== setorId) return;

    const textoNC = r.naoConformidade ? r.naoConformidade.trim().toUpperCase() : "";
    const solucao = r.solucao ? r.solucao.trim() : "";
    
    if (textoNC !== "" && textoNC !== "OK" && textoNC !== "-" && solucao === "") {
      ncPendentes.push({
        linha: r.linha,
        colaborador: r.colaborador || "NÃO INFORMADO",
        responsavel: r.responsavel || "NÃO INFORMADO",
        problema: r.naoConformidade,
        maquina: r.maquina,
        hora: r.hora ? r.hora.substring(0, 5) : "",
        data: r.data,
        codigoPeca: r.codigoPeca || r.codAlternativo || "-"
      });
    }

    const isProblem = (textoNC !== "OK" && textoNC !== "-" && textoNC !== "") || (r.usoDMM === "NÃO");
    if (isProblem) {
      let problemaExibido = "";
      if (textoNC !== "OK" && textoNC !== "-" && textoNC !== "") {
        problemaExibido = textoNC;
        if (r.usoDMM === "NÃO" && r.motivoDMM && r.motivoDMM !== "-") {
          problemaExibido += ` | DIVERGÊNCIA: ${r.motivoDMM.trim().toUpperCase()}`;
        }
      } else if (r.usoDMM === "NÃO" && r.motivoDMM) {
        problemaExibido = r.motivoDMM.trim().toUpperCase();
      }

      const infoTroca = r.trocaFerramenta === "SIM" ? ` | TROCA: ${r.oQueTrocou} por ${r.quemTrocou}` : "";
      const solucaoCompleta = solucao ? `${solucao}${infoTroca}` : `PENDENTE${infoTroca}`;
      
      const codPecaHistorico = (r.codigoPeca && r.codigoPeca !== "-")
        ? r.codigoPeca.trim().toUpperCase()
        : ((r.codAlternativo && r.codAlternativo !== "-") ? r.codAlternativo.trim().toUpperCase() : "-");

      historico.push({
        data: r.data,
        hora: r.hora ? r.hora.substring(0, 5) : "",
        maquina: r.maquina,
        problema: problemaExibido,
        responsavel: r.responsavel || "NÃO INFORMADO",
        colaborador: r.colaborador || "NÃO INFORMADO",
        solucao: solucaoCompleta,
        codigoPeca: codPecaHistorico
      });
    }
  });

  return { ncPendentes, historico };
}

function processMonitoramento(registros: any[], maquinasSetor: string[], setorId?: string) {
  const { data: hojeStr, hora: horaAtualStr } = getFormatoBrasil();
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
    } 
  } = {};
  
  maquinasSetor.forEach(m => {
    estadoMaq[m] = {
      ultimaMedicaoMinutos: null,
      formatada: "S/R",
      divergencia: false,
      motivo: "",
      codAlternativo: ""
    };
  });

  registros.forEach((r) => {
    if (!r.data) return;
    
    if (r.data === hojeStr) {
      const rSetorId = r.setorId || "t-automatico";
      if (setorId && rSetorId !== setorId) return;

      const maq = r.maquina;
      if (!estadoMaq[maq]) {
        estadoMaq[maq] = { ultimaMedicaoMinutos: null, formatada: "S/R", divergencia: false, motivo: "", codAlternativo: "" };
      }

      const minutesReg = parseHoraParaMinutos(r.hora || "");

      const currentLatest = estadoMaq[maq].ultimaMedicaoMinutos;
      if (currentLatest === null || minutesReg > currentLatest) {
        estadoMaq[maq].ultimaMedicaoMinutos = minutesReg;
        estadoMaq[maq].formatada = r.hora ? r.hora.substring(0, 5) : "S/R";
      }

      const statusDMM = r.usoDMM ? r.usoDMM.toUpperCase().trim() : "";
      const motivo = r.motivoDMM ? r.motivoDMM.trim() : "";
      const solucao = r.solucao ? r.solucao.trim() : "";

      if (statusDMM === "NÃO") {
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
        estadoMaq[maq].codAlternativo = "";
      }
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
        linha: estadoMaq[m].linha,
        comentarioSupervisor: estadoMaq[m].comentarioSupervisor,
        codAlternativo: estadoMaq[m].codAlternativo || ""
      });
    }
  });

  return { paradas, desvios };
}

// ==========================================
// CORE CRUD API & PERSISTENCE
// ==========================================

export async function inicializarBancoFirebase(): Promise<void> {
  // Clear any expired fallback flags on load
  checkUseFallback();
}

export async function fbObterSetores(): Promise<Setor[]> {
  if (isOfflineMode()) {
    return JSON.parse(localStorage.getItem("local_setores") || "[]") as Setor[];
  }

  const defaultSetoresPadrao: Setor[] = [
    {
      id: "dimensional-t-automatico",
      titulo: "SISTEMA DIMENSIONAL TORNO AUT.",
      senha: "1234",
      maquinas: ["3", "4", "5", "6", "7", "8", "9", "12", "13", "S1", "S2", "T1", "T2"],
      colaboradores: ["ANSELMO", "ALEXANDER", "IAGO", "DANIEL", "WILSON", "JULIO", "MILLER"]
    },
    {
      id: "dimensional-t-cnc",
      titulo: "SISTEMA DIMENSIONAL TCNC",
      senha: "1234",
      maquinas: ["04", "06", "07", "08", "09"],
      colaboradores: ["GABRIEL", "DIEGO", "CLEMILSON", "CRISTIAN", "MILLER", "CAIO", "CARLOS", "IGOR"]
    }
  ];

  return executeWithFallback<Setor[]>(
    async () => {
      const q = collection(db, "setores");
      const snap = await getDocs(q);
      const list: Setor[] = [];
      snap.forEach(docSnap => {
        list.push({ ...docSnap.data(), id: docSnap.id } as Setor);
      });
      
      if (list.length === 0) {
        const batch = writeBatch(db);
        defaultSetoresPadrao.forEach(s => {
          const dRef = doc(db, "setores", s.id);
          batch.set(dRef, s);
        });
        await batch.commit();
        return defaultSetoresPadrao;
      }

      let mudou = false;
      const batch = writeBatch(db);

      // Verificar TORNO AUT
      const temAut = list.some(s => s.id === "t-automatico" || s.id === "dimensional-t-automatico" || s.titulo.includes("TORNO AUT") || s.titulo.includes("AUTOMÁTICO"));
      if (!temAut) {
        list.unshift(defaultSetoresPadrao[0]);
        batch.set(doc(db, "setores", defaultSetoresPadrao[0].id), defaultSetoresPadrao[0]);
        mudou = true;
      }

      // Verificar TCNC
      const temCNC = list.some(s => s.id === "t-cnc" || s.id === "dimensional-t-cnc" || s.titulo.includes("TCNC") || s.titulo.includes("T.CNC"));
      if (!temCNC) {
        list.push(defaultSetoresPadrao[1]);
        batch.set(doc(db, "setores", defaultSetoresPadrao[1].id), defaultSetoresPadrao[1]);
        mudou = true;
      }

      if (mudou) {
        try { await batch.commit(); } catch (e) { console.warn("Erro ao salvar setores padrão:", e); }
      }

      return list;
    },
    async () => {
      const url = `${getBackendUrl()}/api/setores`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Erro ao obter setores do servidor local");
      return await res.json();
    }
  );
}

export async function fbCriarSetor(titulo: string, senha?: string): Promise<void> {
  const id = "setor-" + Date.now();
  const novoSetor: Setor = {
    id,
    titulo: titulo.trim().toUpperCase(),
    senha: senha ? senha.trim() : "",
    maquinas: ["3", "4", "5", "6", "7"],
    colaboradores: ["OPERADOR 1", "OPERADOR 2"]
  };

  if (isOfflineMode()) {
    const setores = JSON.parse(localStorage.getItem("local_setores") || "[]") as Setor[];
    setores.push(novoSetor);
    localStorage.setItem("local_setores", JSON.stringify(setores));
    return;
  }

  await executeWithFallback<void>(
    async () => {
      const dRef = doc(db, "setores", id);
      await setDoc(dRef, novoSetor);
    },
    async () => {
      const url = `${getBackendUrl()}/api/setores`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo, senha })
      });
      if (!res.ok) throw new Error("Erro ao criar setor no servidor local");
    }
  );
}

export async function fbAtualizarSetor(id: string, data: Partial<Setor>): Promise<void> {
  if (isOfflineMode()) {
    const setores = JSON.parse(localStorage.getItem("local_setores") || "[]") as Setor[];
    const idx = setores.findIndex(s => s.id === id);
    if (idx !== -1) {
      setores[idx] = { ...setores[idx], ...data };
      localStorage.setItem("local_setores", JSON.stringify(setores));
    }
    return;
  }

  await executeWithFallback<void>(
    async () => {
      const dRef = doc(db, "setores", id);
      await updateDoc(dRef, data);
    },
    async () => {
      const url = `${getBackendUrl()}/api/setores/${id}`;
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Erro ao atualizar setor no servidor local");
    }
  );
}

export async function fbExcluirSetor(id: string): Promise<void> {
  if (isOfflineMode()) {
    const setores = JSON.parse(localStorage.getItem("local_setores") || "[]") as Setor[];
    const filtrados = setores.filter(s => s.id !== id);
    localStorage.setItem("local_setores", JSON.stringify(filtrados));
    return;
  }

  await executeWithFallback<void>(
    async () => {
      const dRef = doc(db, "setores", id);
      await deleteDoc(dRef);
    },
    async () => {
      const url = `${getBackendUrl()}/api/setores/${id}`;
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao excluir setor no servidor local");
    }
  );
}

export async function fbObterCadastro(setorId?: string): Promise<{ colaboradores: string[]; maquinas: string[] }> {
  if (isOfflineMode()) {
    const setores = JSON.parse(localStorage.getItem("local_setores") || "[]") as Setor[];
    if (setorId) {
      const s = setores.find(x => x.id === setorId);
      if (s) {
        return { colaboradores: s.colaboradores || [], maquinas: s.maquinas || [] };
      }
    }
    let colaboradores: string[] = [];
    let maquinas: string[] = [];
    setores.forEach(s => {
      if (s.colaboradores) colaboradores.push(...s.colaboradores);
      if (s.maquinas) maquinas.push(...s.maquinas);
    });
    return {
      colaboradores: Array.from(new Set(colaboradores)).sort(),
      maquinas: Array.from(new Set(maquinas)).sort()
    };
  }

  return executeWithFallback<{ colaboradores: string[]; maquinas: string[] }>(
    async () => {
      if (setorId) {
        const dRef = doc(db, "setores", setorId);
        const snap = await getDoc(dRef);
        if (snap.exists()) {
          const data = snap.data();
          return {
            colaboradores: data.colaboradores || [],
            maquinas: data.maquinas || []
          };
        }
      }
      
      const q = collection(db, "setores");
      const snap = await getDocs(q);
      let colaboradores: string[] = [];
      let maquinas: string[] = [];
      snap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.colaboradores) colaboradores.push(...data.colaboradores);
        if (data.maquinas) maquinas.push(...data.maquinas);
      });
      return {
        colaboradores: Array.from(new Set(colaboradores)).sort(),
        maquinas: Array.from(new Set(maquinas)).sort()
      };
    },
    async () => {
      const url = `${getBackendUrl()}/api/cadastro${setorId ? `?setorId=${setorId}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Erro ao obter cadastro do servidor local");
      return await res.json();
    }
  );
}

export async function fbAdicionarColaborador(setorId: string | undefined, nome: string): Promise<void> {
  const nomeLimpo = nome.trim().toUpperCase();
  if (!setorId) return;

  if (isOfflineMode()) {
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
    }
    return;
  }

  await executeWithFallback<void>(
    async () => {
      const dRef = doc(db, "setores", setorId);
      const snap = await getDoc(dRef);
      if (snap.exists()) {
        const data = snap.data();
        const colabs = data.colaboradores || [];
        if (!colabs.includes(nomeLimpo)) {
          colabs.push(nomeLimpo);
          colabs.sort();
          await updateDoc(dRef, { colaboradores: colabs });
        }
      }
    },
    async () => {
      const url = `${getBackendUrl()}/api/cadastro/colaborador`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nomeLimpo, setorId })
      });
      if (!res.ok) throw new Error("Erro ao adicionar colaborador no servidor local");
    }
  );
}

export async function fbRemoverColaborador(setorId: string | undefined, nome: string): Promise<void> {
  const nomeLimpo = nome.trim().toUpperCase();
  if (!setorId) return;

  if (isOfflineMode()) {
    const setores = JSON.parse(localStorage.getItem("local_setores") || "[]") as Setor[];
    const idx = setores.findIndex(s => s.id === setorId);
    if (idx !== -1) {
      setores[idx].colaboradores = (setores[idx].colaboradores || []).filter(c => c !== nomeLimpo);
      localStorage.setItem("local_setores", JSON.stringify(setores));
    }
    return;
  }

  await executeWithFallback<void>(
    async () => {
      const dRef = doc(db, "setores", setorId);
      const snap = await getDoc(dRef);
      if (snap.exists()) {
        const data = snap.data();
        const colabs = (data.colaboradores || []).filter((c: string) => c !== nomeLimpo);
        await updateDoc(dRef, { colaboradores: colabs });
      }
    },
    async () => {
      const url = `${getBackendUrl()}/api/cadastro/colaborador/${encodeURIComponent(nomeLimpo)}?setorId=${setorId}`;
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao remover colaborador no servidor local");
    }
  );
}

export async function fbAdicionarMaquina(setorId: string | undefined, codigo: string): Promise<void> {
  const codLimpo = codigo.trim().toUpperCase();
  if (!setorId) return;

  if (isOfflineMode()) {
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
    }
    return;
  }

  await executeWithFallback<void>(
    async () => {
      const dRef = doc(db, "setores", setorId);
      const snap = await getDoc(dRef);
      if (snap.exists()) {
        const data = snap.data();
        const maqs = data.maquinas || [];
        if (!maqs.includes(codLimpo)) {
          maqs.push(codLimpo);
          maqs.sort();
          await updateDoc(dRef, { maquinas: maqs });
        }
      }
    },
    async () => {
      const url = `${getBackendUrl()}/api/cadastro/maquina`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: codLimpo, setorId })
      });
      if (!res.ok) throw new Error("Erro ao adicionar máquina no servidor local");
    }
  );
}

export async function fbRemoverMaquina(setorId: string | undefined, codigo: string): Promise<void> {
  const codLimpo = codigo.trim().toUpperCase();
  if (!setorId) return;

  if (isOfflineMode()) {
    const setores = JSON.parse(localStorage.getItem("local_setores") || "[]") as Setor[];
    const idx = setores.findIndex(s => s.id === setorId);
    if (idx !== -1) {
      setores[idx].maquinas = (setores[idx].maquinas || []).filter(m => m !== codLimpo);
      localStorage.setItem("local_setores", JSON.stringify(setores));
    }
    return;
  }

  await executeWithFallback<void>(
    async () => {
      const dRef = doc(db, "setores", setorId);
      const snap = await getDoc(dRef);
      if (snap.exists()) {
        const data = snap.data();
        const maqs = (data.maquinas || []).filter((m: string) => m !== codLimpo);
        await updateDoc(dRef, { maquinas: maqs });
      }
    },
    async () => {
      const url = `${getBackendUrl()}/api/cadastro/maquina/${encodeURIComponent(codLimpo)}?setorId=${setorId}`;
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao remover máquina no servidor local");
    }
  );
}

export async function fbObterAlertas(setorId?: string): Promise<{ ncPendentes: NCPendente[]; historico: HistoricoItem[] }> {
  if (isOfflineMode()) {
    const registros = JSON.parse(localStorage.getItem("local_registros") || "[]") as any[];
    return processAlertasAndHistorico(registros, setorId);
  }

  return executeWithFallback<{ ncPendentes: NCPendente[]; historico: HistoricoItem[] }>(
    async () => {
      const q = collection(db, "registros");
      const snap = await getDocs(q);
      const list: any[] = [];
      snap.forEach(docSnap => {
        list.push({ ...docSnap.data(), linha: docSnap.id });
      });
      return processAlertasAndHistorico(list, setorId);
    },
    async () => {
      const url = `${getBackendUrl()}/api/alertas${setorId ? `?setorId=${setorId}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Erro ao obter alertas do servidor local");
      return await res.json();
    }
  );
}

export async function fbObterUltimoMotivo(maquina: string, setorId?: string): Promise<{ motivo: string }> {
  if (isOfflineMode()) {
    const registros = JSON.parse(localStorage.getItem("local_registros") || "[]") as any[];
    const sorted = [...registros].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    for (const r of sorted) {
      const rSetorId = r.setorId || "t-automatico";
      if (setorId && rSetorId !== setorId) continue;
      if (r.maquina === maquina.toUpperCase()) {
        const statusDMM = r.usoDMM ? r.usoDMM.toUpperCase().trim() : "";
        const motivo = r.motivoDMM ? r.motivoDMM.trim() : "";
        const solucao = r.solucao ? r.solucao.trim() : "";
        if (statusDMM === "SIM" && solucao === "DIVERGÊNCIA VERIFICADA E LIBERADA") {
          return { motivo: "" };
        }
        if (statusDMM === "NÃO") {
          return { motivo: (motivo !== "" && motivo !== "-") ? motivo : "" };
        }
      }
    }
    return { motivo: "" };
  }

  return executeWithFallback<{ motivo: string }>(
    async () => {
      const q = collection(db, "registros");
      const snap = await getDocs(q);
      const list: any[] = [];
      snap.forEach(docSnap => {
        list.push({ ...docSnap.data(), linha: docSnap.id });
      });
      
      const sorted = list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      for (const r of sorted) {
        const rSetorId = r.setorId || "t-automatico";
        if (setorId && rSetorId !== setorId) continue;

        if (r.maquina === maquina.toUpperCase()) {
          const statusDMM = r.usoDMM ? r.usoDMM.toUpperCase().trim() : "";
          const motivo = r.motivoDMM ? r.motivoDMM.trim() : "";
          const solucao = r.solucao ? r.solucao.trim() : "";

          if (statusDMM === "SIM" && solucao === "DIVERGÊNCIA VERIFICADA E LIBERADA") {
            return { motivo: "" };
          }
          if (statusDMM === "NÃO") {
            return { motivo: (motivo !== "" && motivo !== "-") ? motivo : "" };
          }
        }
      }
      return { motivo: "" };
    },
    async () => {
      const url = `${getBackendUrl()}/api/ultimo-motivo/${encodeURIComponent(maquina)}${setorId ? `?setorId=${setorId}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Erro ao obter último motivo do servidor local");
      return await res.json();
    }
  );
}

export async function fbObterMonitoramento(setorId?: string): Promise<{ paradas: ParadaItem[]; desvios: DesvioItem[] }> {
  if (isOfflineMode()) {
    const config = await fbObterCadastro(setorId);
    const maquinasSetor = config.maquinas;
    const registros = JSON.parse(localStorage.getItem("local_registros") || "[]") as any[];
    return processMonitoramento(registros, maquinasSetor, setorId);
  }

  return executeWithFallback<{ paradas: ParadaItem[]; desvios: DesvioItem[] }>(
    async () => {
      const config = await fbObterCadastro(setorId);
      const maquinasSetor = config.maquinas;

      const q = collection(db, "registros");
      const snap = await getDocs(q);
      const list: any[] = [];
      snap.forEach(docSnap => {
        list.push({ ...docSnap.data(), linha: docSnap.id });
      });

      return processMonitoramento(list, maquinasSetor, setorId);
    },
    async () => {
      const url = `${getBackendUrl()}/api/monitoramento${setorId ? `?setorId=${setorId}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Erro ao obter monitoramento do servidor local");
      return await res.json();
    }
  );
}

export async function fbSalvarMedicao(dados: Partial<Registro>, setorId?: string): Promise<void> {
  const { data: dataHoje, hora: horaHoje } = getFormatoBrasil();
  const id = "reg-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
  
  const novoRegistro: Registro = {
    linha: id,
    setorId: setorId || dados.setorId || "t-automatico",
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
    codAlternativo: dados.codAlternativo || "-",
    timestamp: Date.now()
  };

  if (isOfflineMode()) {
    const registros = JSON.parse(localStorage.getItem("local_registros") || "[]") as any[];
    registros.push(novoRegistro);
    localStorage.setItem("local_registros", JSON.stringify(registros));
    return;
  }

  await executeWithFallback<void>(
    async () => {
      const dRef = doc(db, "registros", id);
      await setDoc(dRef, novoRegistro);
    },
    async () => {
      const url = `${getBackendUrl()}/api/medicao`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...dados, setorId: setorId || dados.setorId })
      });
      if (!res.ok) throw new Error("Erro ao salvar medição no servidor local");
    }
  );
}

export async function fbResolverNC(linha: string | number, solucao: string, quemResolveu?: string): Promise<void> {
  const qResolveu = quemResolveu ? quemResolveu.trim().toUpperCase() : "";
  const solucaoLimpa = solucao.trim();

  if (isOfflineMode()) {
    const registros = JSON.parse(localStorage.getItem("local_registros") || "[]") as any[];
    const idx = registros.findIndex(r => r.linha === linha);
    if (idx !== -1) {
      registros[idx].solucao = solucaoLimpa;
      registros[idx].quemResolveu = qResolveu;
      localStorage.setItem("local_registros", JSON.stringify(registros));
    }
    return;
  }

  await executeWithFallback<void>(
    async () => {
      const dRef = doc(db, "registros", String(linha));
      await updateDoc(dRef, {
        solucao: solucaoLimpa,
        quemResolveu: qResolveu
      });
    },
    async () => {
      const url = `${getBackendUrl()}/api/resolver-nc`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linha, solucao, quemResolveu })
      });
      if (!res.ok) throw new Error("Erro ao resolver NC no servidor local");
    }
  );
}

export async function fbLiberarDivergencia(
  docId: string | number,
  maquina: string,
  colaboradorSupervisor: string,
  setorId?: string
): Promise<void> {
  const { data: dataHoje, hora: horaHoje } = getFormatoBrasil();
  const id = "reg-" + Date.now() + "-" + Math.floor(Math.random() * 1000);

  const registroSupervisor: Registro = {
    linha: id,
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

  if (isOfflineMode()) {
    const registros = JSON.parse(localStorage.getItem("local_registros") || "[]") as any[];
    registros.push(registroSupervisor);
    localStorage.setItem("local_registros", JSON.stringify(registros));
    return;
  }

  await executeWithFallback<void>(
    async () => {
      // 1. Write the release record
      const dRef = doc(db, "registros", id);
      await setDoc(dRef, registroSupervisor);

      // 2. Also optionally update the original divergence record to show it was marked
      if (docId) {
        try {
          const origRef = doc(db, "registros", String(docId));
          await updateDoc(origRef, {
            comentarioSupervisor: "LIBERADO PELO SUPERVISOR"
          });
        } catch (err) {
          console.warn("Could not write comentario to original divergence:", err);
        }
      }
    },
    async () => {
      const url = `${getBackendUrl()}/api/liberar-divergencia`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maquina, colaboradorSupervisor, setorId })
      });
      if (!res.ok) throw new Error("Erro ao liberar divergência no servidor local");
    }
  );
}

export async function fbObterTodosRegistros(setorId?: string): Promise<any[]> {
  if (isOfflineMode()) {
    const registros = JSON.parse(localStorage.getItem("local_registros") || "[]") as any[];
    const sorted = [...registros].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    const list = sorted.slice(0, 1500).filter(r => !setorId || r.setorId === setorId);
    return list.reverse();
  }

  return executeWithFallback<any[]>(
    async () => {
      const q = collection(db, "registros");
      const snap = await getDocs(q);
      const list: any[] = [];
      snap.forEach(docSnap => {
        list.push({ ...docSnap.data(), linha: docSnap.id });
      });
      
      const sorted = list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      const filtered = sorted.filter(r => !setorId || r.setorId === setorId);
      return filtered.slice(0, 1500).reverse();
    },
    async () => {
      const url = `${getBackendUrl()}/api/registros${setorId ? `?setorId=${setorId}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Erro ao obter registros do servidor local");
      return await res.json();
    }
  );
}

export async function fbExcluirRegistro(docId: string | number): Promise<void> {
  if (isOfflineMode()) {
    const registros = JSON.parse(localStorage.getItem("local_registros") || "[]") as any[];
    const filtrados = registros.filter(r => r.linha !== docId);
    localStorage.setItem("local_registros", JSON.stringify(filtrados));
    return;
  }

  await executeWithFallback<void>(
    async () => {
      const dRef = doc(db, "registros", String(docId));
      await deleteDoc(dRef);
    },
    async () => {
      const url = `${getBackendUrl()}/api/registros/${docId}`;
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao excluir registro no servidor local");
    }
  );
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

  await executeWithFallback<void>(
    async () => {
      const { data: hojeStr } = getFormatoBrasil();
      const q = collection(db, "registros");
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      let count = 0;
      snap.forEach(docSnap => {
        const r = docSnap.data();
        const rSetorId = r.setorId || "t-automatico";
        const statusDMM = r.usoDMM ? r.usoDMM.toUpperCase().trim() : "";
        const isTarget = r.data === hojeStr && r.maquina === maquina.toUpperCase() && statusDMM === "NÃO" && (!setorId || rSetorId === setorId);
        if (isTarget) {
          batch.delete(docSnap.ref);
          count++;
        }
      });
      if (count > 0) {
        await batch.commit();
      }
    },
    async () => {
      const { data: hojeStr } = getFormatoBrasil();
      const url = `${getBackendUrl()}/api/registros${setorId ? `?setorId=${setorId}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Erro ao obter registros para exclusão");
      const list = await res.json() as any[];
      
      const targets = list.filter(r => {
        const rSetorId = r.setorId || "t-automatico";
        const statusDMM = r.usoDMM ? r.usoDMM.toUpperCase().trim() : "";
        return r.data === hojeStr && r.maquina === maquina.toUpperCase() && statusDMM === "NÃO" && (!setorId || rSetorId === setorId);
      });

      targets.sort((a, b) => b.linha - a.linha);
      for (const t of targets) {
        const delUrl = `${getBackendUrl()}/api/registros/${t.linha}`;
        await fetch(delUrl, { method: "DELETE" });
      }
    }
  );
}

export async function fbAdicionarComentario(docId: string | number, comentario: string): Promise<void> {
  const comentarioLimpo = comentario.trim().toUpperCase();

  if (isOfflineMode()) {
    const registros = JSON.parse(localStorage.getItem("local_registros") || "[]") as any[];
    const idx = registros.findIndex(r => r.linha === docId);
    if (idx !== -1) {
      registros[idx].comentarioSupervisor = comentarioLimpo;
      localStorage.setItem("local_registros", JSON.stringify(registros));
    }
    return;
  }

  await executeWithFallback<void>(
    async () => {
      const dRef = doc(db, "registros", String(docId));
      await updateDoc(dRef, {
        comentarioSupervisor: comentarioLimpo
      });
    },
    async () => {
      const url = `${getBackendUrl()}/api/registros/${docId}/comentar`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comentario: comentarioLimpo })
      });
      if (!res.ok) throw new Error("Erro ao salvar comentário no servidor local");
    }
  );
}

export async function limparDadosAba(abaName: string): Promise<void> {
  if (abaName !== "registros") return;

  if (isOfflineMode()) {
    localStorage.removeItem("local_registros");
    return;
  }

  await executeWithFallback<void>(
    async () => {
      const q = collection(db, "registros");
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.forEach(docSnap => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
    },
    async () => {
      const url = `${getBackendUrl()}/api/registros`;
      const res = await fetch(url);
      if (res.ok) {
        const list = await res.json() as any[];
        for (const item of list) {
          const delUrl = `${getBackendUrl()}/api/registros/${item.linha}`;
          await fetch(delUrl, { method: "DELETE" });
        }
      }
    }
  );
}

// ==========================================
// REAL-TIME SUBSCRIPTION LAYER (WITH COLA FALLBACKS)
// ==========================================

export function fbSubscreverCadastro(
  setorId: string | undefined,
  callback: (data: { colaboradores: string[]; maquinas: string[] }) => void,
  onError: (error: any) => void
): () => void {
  if (checkUseFallback() || isOfflineMode()) {
    let active = true;
    const poll = async () => {
      while (active) {
        try {
          const data = await fbObterCadastro(setorId);
          if (active) callback(data);
        } catch (err) {
          if (active) onError(err);
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    };
    poll();
    return () => { active = false; };
  }

  try {
    if (setorId) {
      const q = doc(db, "setores", setorId);
      return onSnapshot(q, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          callback({
            colaboradores: data.colaboradores || [],
            maquinas: data.maquinas || []
          });
        } else {
          callback({ colaboradores: [], maquinas: [] });
        }
      }, (err) => {
        console.warn("Erro onSnapshot setores, falling back to REST API polling.", err);
        onError(err);
      });
    } else {
      const q = collection(db, "setores");
      return onSnapshot(q, (snapshot) => {
        let colaboradores: string[] = [];
        let maquinas: string[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.colaboradores) colaboradores.push(...data.colaboradores);
          if (data.maquinas) maquinas.push(...data.maquinas);
        });
        callback({
          colaboradores: Array.from(new Set(colaboradores)).sort(),
          maquinas: Array.from(new Set(maquinas)).sort()
        });
      }, (err) => {
        console.warn("Erro onSnapshot setores list, falling back to REST API polling.", err);
        onError(err);
      });
    }
  } catch (err) {
    onError(err);
    return () => {};
  }
}

export function fbSubscreverMonitoramento(
  setorId: string | undefined,
  callback: (data: { paradas: ParadaItem[]; desvios: DesvioItem[] }) => void,
  onError: (error: any) => void
): () => void {
  if (checkUseFallback() || isOfflineMode()) {
    let active = true;
    const poll = async () => {
      while (active) {
        try {
          const data = await fbObterMonitoramento(setorId);
          if (active) callback(data);
        } catch (err) {
          if (active) onError(err);
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    };
    poll();
    return () => { active = false; };
  }

  try {
    const q = collection(db, "registros");
    return onSnapshot(q, async (snapshot) => {
      const config = await fbObterCadastro(setorId);
      const maquinasSetor = config.maquinas;
      
      const registrations: any[] = [];
      snapshot.forEach((docSnap) => {
        registrations.push({ ...docSnap.data(), linha: docSnap.id });
      });
      
      const data = processMonitoramento(registrations, maquinasSetor, setorId);
      callback(data);
    }, (err) => {
      console.warn("Erro onSnapshot monitoramento, falling back to REST API polling.", err);
      onError(err);
    });
  } catch (err) {
    onError(err);
    return () => {};
  }
}

export function fbSubscreverAlertas(
  setorId: string | undefined,
  callback: (data: { ncPendentes: NCPendente[]; historico: HistoricoItem[] }) => void,
  onError: (error: any) => void
): () => void {
  if (checkUseFallback() || isOfflineMode()) {
    let active = true;
    const poll = async () => {
      while (active) {
        try {
          const data = await fbObterAlertas(setorId);
          if (active) callback(data);
        } catch (err) {
          if (active) onError(err);
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    };
    poll();
    return () => { active = false; };
  }

  try {
    const q = collection(db, "registros");
    return onSnapshot(q, (snapshot) => {
      const registrations: any[] = [];
      snapshot.forEach((docSnap) => {
        registrations.push({ ...docSnap.data(), linha: docSnap.id });
      });
      
      const data = processAlertasAndHistorico(registrations, setorId);
      callback(data);
    }, (err) => {
      console.warn("Erro onSnapshot alertas, falling back to REST API polling.", err);
      onError(err);
    });
  } catch (err) {
    onError(err);
    return () => {};
  }
}
