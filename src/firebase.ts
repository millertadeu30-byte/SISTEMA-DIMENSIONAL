import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut
} from "firebase/auth";
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

// Setup Google OAuth provider with Sheets and Drive.file scopes
const provider = new GoogleAuthProvider();
provider.addScope("https://www.googleapis.com/auth/spreadsheets");
provider.addScope("https://www.googleapis.com/auth/drive.file");

let isSigningIn = false;
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

// Global spreadsheet ID provided by user
const SPREADSHEET_ID = "1Yxa2jtn73HGAeYR6hQF9OAUWtMa-r20KnTjyGEjzy_g";
let sheetIdsCache: Record<string, number> = {};

// Cache Google Sheet tab ID mapping
export async function obterSheetId(sheetName: string): Promise<number> {
  if (sheetIdsCache[sheetName] !== undefined) {
    return sheetIdsCache[sheetName];
  }
  const token = await getAccessToken();
  if (!token) throw new Error("Não autenticado com o Google");

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    throw new Error("Erro ao obter metadados da planilha");
  }
  const data = await res.json();
  const sheets = data.sheets || [];
  for (const s of sheets) {
    const title = s.properties?.title;
    const id = s.properties?.sheetId;
    if (title && id !== undefined) {
      sheetIdsCache[title] = id;
    }
  }
  if (sheetIdsCache[sheetName] === undefined) {
    throw new Error(`Aba ${sheetName} não encontrada na planilha`);
  }
  return sheetIdsCache[sheetName];
}

// Active/offline mode toggled based on Google sign in state
export function isOfflineMode(): boolean {
  return !cachedAccessToken;
}

export function fbAtivarModoOffline(): void {
  // Offline fallback is automatic when not logged in
}

export function fbDesativarModoOffline(): void {
  // Handled via Sign In
}

// Export backup from local localStorage if offline
export function fbExportarBackup(): string {
  const setores = localStorage.getItem("local_setores") ? JSON.parse(localStorage.getItem("local_setores")!) : [];
  const registros = localStorage.getItem("local_registros") ? JSON.parse(localStorage.getItem("local_registros")!) : [];
  return JSON.stringify({ setores, registros }, null, 2);
}

// Import backup to local localStorage if offline
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

// Google Authentication API
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Não foi possível obter o token de acesso do Google.");
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("Erro no login do Google:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

// Seeding and initializing Google Sheets structures
export async function inicializarBancoFirebase() {
  const token = await getAccessToken();
  if (!token) {
    // Se não autenticado, inicializa os dados locais de simulação
    if (!localStorage.getItem("local_setores")) {
      const defaultSetores = [
        {
          id: "dimensional-t-automatico",
          titulo: "DIMENSIONAL T.AUTOMÁTICO",
          senha: "1234",
          maquinas: ["3", "4", "5", "6", "7", "8", "9", "12", "13", "S1", "S2", "T1", "T2"],
          colaboradores: ["ANSELMO", "ALEXANDER", "IAGO", "DANIEL", "WILSON", "JULIO", "MILLER"]
        },
        {
          id: "dimensional-t-cnc",
          titulo: "DIMENSIONAL T.CNC",
          senha: "1234",
          maquinas: ["04", "06", "07", "08", "09"],
          colaboradores: ["GABRIEL", "DIEGO", "CLEMILSON", "CRISTIAN", "MILLER", "CAIO", "CARLOS", "IGOR"]
        }
      ];
      localStorage.setItem("local_setores", JSON.stringify(defaultSetores));
    }
    if (!localStorage.getItem("local_registros")) {
      const { data: hoje } = getFormatoBrasil();
      const defaultRegistros = [
        {
          linha: "reg-1",
          setorId: "dimensional-t-automatico",
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
          setorId: "dimensional-t-cnc",
          data: hoje,
          hora: "08:15:00",
          colaborador: "GABRIEL",
          maquina: "07",
          conforme: "NÃO",
          naoConformidade: "DIAMETRO EXTERNO FORA DO LIMITE (+0.05)",
          codigoPeca: "PECA-13B",
          responsavel: "GABRIEL",
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
    return;
  }

  try {
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!res.ok) {
      throw new Error(`Erro ao obter metadados da planilha: ${res.statusText}`);
    }

    const data = await res.json();
    const sheets = data.sheets || [];
    const titulos = sheets.map((s: any) => s.properties?.title);
    
    sheets.forEach((s: any) => {
      if (s.properties?.title && s.properties?.sheetId !== undefined) {
        sheetIdsCache[s.properties.title] = s.properties.sheetId;
      }
    });

    const requests: any[] = [];
    
    if (!titulos.includes("setores")) {
      requests.push({
        addSheet: {
          properties: {
            title: "setores"
          }
        }
      });
    }

    if (!titulos.includes("registros")) {
      requests.push({
        addSheet: {
          properties: {
            title: "registros"
          }
        }
      });
    }

    if (requests.length > 0) {
      const createRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ requests })
      });
      if (!createRes.ok) {
        throw new Error("Erro ao criar as abas necessárias na planilha");
      }
      
      const updatedMetaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (updatedMetaRes.ok) {
        const updatedData = await updatedMetaRes.json();
        (updatedData.sheets || []).forEach((s: any) => {
          if (s.properties?.title && s.properties?.sheetId !== undefined) {
            sheetIdsCache[s.properties.title] = s.properties.sheetId;
          }
        });
      }
    }

    // Verify header rows and seed if empty
    const setoresRows = await lerAba("setores");
    if (setoresRows.length === 0) {
      const header = ["id", "titulo", "senha", "maquinas", "colaboradores"];
      const defaultSetores = [
        {
          id: "dimensional-t-automatico",
          titulo: "DIMENSIONAL T.AUTOMÁTICO",
          senha: "1234",
          maquinas: ["3", "4", "5", "6", "7", "8", "9", "12", "13", "S1", "S2", "T1", "T2"],
          colaboradores: ["ANSELMO", "ALEXANDER", "IAGO", "DANIEL", "WILSON", "JULIO", "MILLER"]
        },
        {
          id: "dimensional-t-cnc",
          titulo: "DIMENSIONAL T.CNC",
          senha: "1234",
          maquinas: ["04", "06", "07", "08", "09"],
          colaboradores: ["GABRIEL", "DIEGO", "CLEMILSON", "CRISTIAN", "MILLER", "CAIO", "CARLOS", "IGOR"]
        }
      ];
      
      const bodyValues = [header, ...defaultSetores.map(setorToRow)];
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/setores!A1:E${bodyValues.length}?valueInputOption=USER_ENTERED`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ values: bodyValues })
      });
    }

    const registrosRows = await lerAba("registros");
    if (registrosRows.length === 0) {
      const header = [
        "linha", "setorId", "data", "hora", "colaborador", "maquina", "conforme", "naoConformidade",
        "codigoPeca", "responsavel", "usoDMM", "motivoDMM", "solucao", "trocaFerramenta", "oQueTrocou",
        "quemTrocou", "modeloPeca", "codAlternativo", "comentarioSupervisor", "quemResolveu", "timestamp"
      ];
      const { data: hoje } = getFormatoBrasil();
      const defaultRegistros: Registro[] = [
        {
          linha: "reg-1",
          setorId: "dimensional-t-automatico",
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
          setorId: "dimensional-t-cnc",
          data: hoje,
          hora: "08:15:00",
          colaborador: "GABRIEL",
          maquina: "07",
          conforme: "NÃO",
          naoConformidade: "DIAMETRO EXTERNO FORA DO LIMITE (+0.05)",
          codigoPeca: "PECA-13B",
          responsavel: "GABRIEL",
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

      const bodyValues = [header, ...defaultRegistros.map(registroToRow)];
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/registros!A1:U${bodyValues.length}?valueInputOption=USER_ENTERED`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ values: bodyValues })
      });
    }
  } catch (err) {
    console.error("Erro na inicialização da planilha:", err);
  }
}

// Google Sheets Low-level Reader/Writer helpers
export async function lerAba(sheetName: string): Promise<any[][]> {
  const token = await getAccessToken();
  if (!token) throw new Error("Não autenticado com o Google");
  
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${sheetName}!A:Z`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    console.error("Erro ao ler aba:", errData);
    throw new Error(`Erro ao ler aba ${sheetName}: ${errData?.error?.message || res.statusText}`);
  }
  const data = await res.json();
  return data.values || [];
}

export async function adicionarLinhaAba(sheetName: string, valores: any[]): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error("Não autenticado com o Google");

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${sheetName}!A:Z:append?valueInputOption=USER_ENTERED`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      values: [valores]
    })
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(`Erro ao adicionar linha em ${sheetName}: ${errData?.error?.message || res.statusText}`);
  }
}

export async function atualizarLinhaAba(sheetName: string, rowIndex: number, valores: any[]): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error("Não autenticado com o Google");

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${sheetName}!A${rowIndex}:Z${rowIndex}?valueInputOption=USER_ENTERED`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      values: [valores]
    })
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(`Erro ao atualizar linha em ${sheetName}: ${errData?.error?.message || res.statusText}`);
  }
}

export async function excluirLinhaAba(sheetName: string, rowIndex: number): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error("Não autenticado com o Google");

  const sheetId = await obterSheetId(sheetName);

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheetId,
              dimension: "ROWS",
              startIndex: rowIndex - 1,
              endIndex: rowIndex
            }
          }
        }
      ]
    })
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(`Erro ao excluir linha: ${errData?.error?.message || res.statusText}`);
  }
}

export async function limparDadosAba(sheetName: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error("Não autenticado com o Google");

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${sheetName}!A2:Z10000:clear`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    throw new Error(`Erro ao limpar dados da aba ${sheetName}`);
  }
}

// Data parser mappings
function parsedSetorRow(row: any[]): Setor {
  return {
    id: String(row[0] || ""),
    titulo: String(row[1] || ""),
    senha: String(row[2] || ""),
    maquinas: row[3] ? String(row[3]).split(",").map(s => s.trim()).filter(Boolean) : [],
    colaboradores: row[4] ? String(row[4]).split(",").map(s => s.trim()).filter(Boolean) : []
  };
}

function setorToRow(s: Setor): any[] {
  return [
    s.id,
    s.titulo,
    s.senha,
    s.maquinas.join(", "),
    s.colaboradores.join(", ")
  ];
}

function parsedRegistroRow(row: any[]): Registro {
  return {
    linha: String(row[0] || ""),
    setorId: String(row[1] || ""),
    data: String(row[2] || ""),
    hora: String(row[3] || ""),
    colaborador: String(row[4] || ""),
    maquina: String(row[5] || ""),
    conforme: (row[6] === "SIM" || row[6] === "NÃO") ? row[6] as 'SIM' | 'NÃO' : "SIM",
    naoConformidade: String(row[7] || ""),
    codigoPeca: String(row[8] || ""),
    responsavel: String(row[9] || ""),
    usoDMM: (row[10] === "SIM" || row[10] === "NÃO") ? row[10] as 'SIM' | 'NÃO' : "SIM",
    motivoDMM: String(row[11] || ""),
    solucao: String(row[12] || ""),
    trocaFerramenta: (row[13] === "SIM" || row[13] === "NÃO") ? row[13] as 'SIM' | 'NÃO' : "NÃO",
    oQueTrocou: String(row[14] || ""),
    quemTrocou: String(row[15] || ""),
    modeloPeca: String(row[16] || ""),
    codAlternativo: String(row[17] || ""),
    comentarioSupervisor: String(row[18] || ""),
    quemResolveu: String(row[19] || ""),
    timestamp: row[20] ? Number(row[20]) : Date.now()
  };
}

function registroToRow(r: Registro): any[] {
  return [
    r.linha || "",
    r.setorId || "",
    r.data || "",
    r.hora || "",
    r.colaborador || "",
    r.maquina || "",
    r.conforme || "SIM",
    r.naoConformidade || "",
    r.codigoPeca || "",
    r.responsavel || "",
    r.usoDMM || "SIM",
    r.motivoDMM || "",
    r.solucao || "",
    r.trocaFerramenta || "NÃO",
    r.oQueTrocou || "",
    r.quemTrocou || "",
    r.modeloPeca || "",
    r.codAlternativo || "",
    r.comentarioSupervisor || "",
    r.quemResolveu || "",
    r.timestamp || Date.now()
  ];
}

// Sector Management APIs
export async function fbObterSetores(): Promise<Setor[]> {
  if (isOfflineMode()) {
    const data = localStorage.getItem("local_setores");
    return data ? JSON.parse(data) : [];
  }
  try {
    const rows = await lerAba("setores");
    if (rows.length <= 1) return [];
    return rows.slice(1).map(parsedSetorRow);
  } catch (e) {
    console.error("Erro ao obter setores:", e);
    const data = localStorage.getItem("local_setores");
    return data ? JSON.parse(data) : [];
  }
}

export async function fbCriarSetor(titulo: string, senha?: string): Promise<Setor> {
  const id = "setor-" + Date.now();
  const novoSetor: Setor = {
    id,
    titulo: titulo.trim().toUpperCase(),
    senha: senha ? senha.trim() : "",
    maquinas: ["3", "4", "5", "6", "7"],
    colaboradores: ["OPERADOR 1", "OPERADOR 2"]
  };
  if (isOfflineMode()) {
    const setores = JSON.parse(localStorage.getItem("local_setores") || "[]");
    setores.push(novoSetor);
    localStorage.setItem("local_setores", JSON.stringify(setores));
    return novoSetor;
  }
  await adicionarLinhaAba("setores", setorToRow(novoSetor));
  return novoSetor;
}

export async function fbAtualizarSetor(id: string, updates: Partial<Setor>): Promise<void> {
  if (isOfflineMode()) {
    const setores = JSON.parse(localStorage.getItem("local_setores") || "[]") as Setor[];
    const idx = setores.findIndex(s => s.id === id);
    if (idx !== -1) {
      setores[idx] = { ...setores[idx], ...updates };
      localStorage.setItem("local_setores", JSON.stringify(setores));
    }
    return;
  }
  const rows = await lerAba("setores");
  const rowIndex = rows.findIndex(row => row[0] === id);
  if (rowIndex === -1) {
    throw new Error("Setor não encontrado");
  }
  const currentSetor = parsedSetorRow(rows[rowIndex]);
  const updatedSetor: Setor = { ...currentSetor, ...updates };
  await atualizarLinhaAba("setores", rowIndex + 1, setorToRow(updatedSetor));
}

export async function fbExcluirSetor(id: string): Promise<void> {
  if (isOfflineMode()) {
    const setores = JSON.parse(localStorage.getItem("local_setores") || "[]") as Setor[];
    const filtrados = setores.filter(s => s.id !== id);
    localStorage.setItem("local_setores", JSON.stringify(filtrados));
    return;
  }
  const rows = await lerAba("setores");
  const rowIndex = rows.findIndex(row => row[0] === id);
  if (rowIndex === -1) {
    throw new Error("Setor não encontrado");
  }
  await excluirLinhaAba("setores", rowIndex + 1);
}

export async function fbObterCadastro(setorId?: string): Promise<{ colaboradores: string[]; maquinas: string[] }> {
  if (!setorId) return { colaboradores: [], maquinas: [] };
  const setores = await fbObterSetores();
  const setor = setores.find(s => s.id === setorId);
  if (!setor) return { colaboradores: [], maquinas: [] };
  return {
    colaboradores: setor.colaboradores || [],
    maquinas: setor.maquinas || []
  };
}

export async function fbAdicionarColaborador(nome: string, setorId?: string): Promise<string[]> {
  if (!setorId) throw new Error("ID de setor é obrigatório");
  const setores = await fbObterSetores();
  const setor = setores.find(s => s.id === setorId);
  if (!setor) throw new Error("Setor não encontrado");
  
  const novosColaboradores = [...(setor.colaboradores || [])];
  const colabFormatado = nome.trim().toUpperCase();
  if (!novosColaboradores.includes(colabFormatado)) {
    novosColaboradores.push(colabFormatado);
    await fbAtualizarSetor(setorId, { colaboradores: novosColaboradores });
  }
  return novosColaboradores;
}

export async function fbRemoverColaborador(nome: string, setorId?: string): Promise<string[]> {
  if (!setorId) throw new Error("ID de setor é obrigatório");
  const setores = await fbObterSetores();
  const setor = setores.find(s => s.id === setorId);
  if (!setor) throw new Error("Setor não encontrado");
  
  const novosColaboradores = (setor.colaboradores || []).filter(c => c !== nome);
  await fbAtualizarSetor(setorId, { colaboradores: novosColaboradores });
  return novosColaboradores;
}

export async function fbAdicionarMaquina(codigo: string, setorId?: string): Promise<string[]> {
  if (!setorId) throw new Error("ID de setor é obrigatório");
  const setores = await fbObterSetores();
  const setor = setores.find(s => s.id === setorId);
  if (!setor) throw new Error("Setor não encontrado");
  
  const novasMaquinas = [...(setor.maquinas || [])];
  const maqFormatada = codigo.trim().toUpperCase();
  if (!novasMaquinas.includes(maqFormatada)) {
    novasMaquinas.push(maqFormatada);
    await fbAtualizarSetor(setorId, { maquinas: novasMaquinas });
  }
  return novasMaquinas;
}

export async function fbRemoverMaquina(codigo: string, setorId?: string): Promise<string[]> {
  if (!setorId) throw new Error("ID de setor é obrigatório");
  const setores = await fbObterSetores();
  const setor = setores.find(s => s.id === setorId);
  if (!setor) throw new Error("Setor não encontrado");
  
  const novasMaquinas = (setor.maquinas || []).filter(m => m !== codigo);
  await fbAtualizarSetor(setorId, { maquinas: novasMaquinas });
  return novasMaquinas;
}

// Measurement and alerting APIs
export async function fbObterAlertas(setorId?: string): Promise<{ ncPendentes: NCPendente[]; historico: HistoricoItem[] }> {
  const registros = await fbObterTodosRegistros(setorId);
  
  // 1. Get unresolved NCs
  const ncPendentes: NCPendente[] = [];
  registros.forEach(r => {
    const rSetorId = r.setorId || "t-automatico";
    if (setorId && rSetorId !== setorId) return;

    const solucao = r.solucao ? r.solucao.trim() : "";
    if (solucao !== "") return; // Already resolved

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

  // 2. Get history (sorted descending by timestamp)
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

  const historico = rawHistory.sort((a, b) => b.timestamp - a.timestamp);
  return { ncPendentes, historico };
}

export async function fbObterUltimoMotivo(maquina: string, setorId?: string): Promise<string> {
  const registros = await fbObterTodosRegistros(setorId);
  // Records are already ordered chronologically (or reverse), let's sort desc
  const sorted = [...registros].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  for (const r of sorted) {
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

export async function fbObterMonitoramento(setorId?: string): Promise<{ paradas: ParadaItem[]; desvios: DesvioItem[] }> {
  let maquinasSetor: string[] = [];
  if (setorId) {
    const setores = await fbObterSetores();
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

  const registros = await fbObterTodosRegistros(setorId);
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

export async function fbSalvarMedicao(dados: Partial<Registro>, setorId?: string): Promise<void> {
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

  if (isOfflineMode()) {
    const registros = JSON.parse(localStorage.getItem("local_registros") || "[]");
    registros.push(novoRegistro);
    localStorage.setItem("local_registros", JSON.stringify(registros));
    return;
  }

  await adicionarLinhaAba("registros", registroToRow(novoRegistro));
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

  const rows = await lerAba("registros");
  const rowIndex = rows.findIndex(row => row[0] === docId);
  if (rowIndex === -1) {
    throw new Error("Registro não encontrado");
  }

  const r = parsedRegistroRow(rows[rowIndex]);
  r.solucao = solucao.trim();
  if (quemResolveu) {
    r.quemResolveu = quemResolveu.trim().toUpperCase();
  }

  await atualizarLinhaAba("registros", rowIndex + 1, registroToRow(r));
}

export async function fbLiberarDivergencia(docId: string, maquina: string, colaboradorSupervisor: string, setorId?: string): Promise<void> {
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

  if (isOfflineMode()) {
    const registros = JSON.parse(localStorage.getItem("local_registros") || "[]") as any[];
    if (docId) {
      const idx = registros.findIndex(r => r.linha === docId);
      if (idx !== -1) {
        registros[idx].solucao = "DIVERGÊNCIA VERIFICADA E LIBERADA";
        registros[idx].quemResolveu = colaboradorSupervisor.toUpperCase();
      }
    }
    registros.push(registroSupervisor);
    localStorage.setItem("local_registros", JSON.stringify(registros));
    return;
  }

  if (docId) {
    const rows = await lerAba("registros");
    const rowIndex = rows.findIndex(row => row[0] === docId);
    if (rowIndex !== -1) {
      const r = parsedRegistroRow(rows[rowIndex]);
      r.solucao = "DIVERGÊNCIA VERIFICADA E LIBERADA";
      r.quemResolveu = colaboradorSupervisor.toUpperCase();
      await atualizarLinhaAba("registros", rowIndex + 1, registroToRow(r));
    }
  }

  await adicionarLinhaAba("registros", registroToRow(registroSupervisor));
}

export async function fbObterTodosRegistros(setorId?: string): Promise<any[]> {
  if (isOfflineMode()) {
    const registros = JSON.parse(localStorage.getItem("local_registros") || "[]") as any[];
    const sorted = [...registros].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    const list = sorted.slice(0, 1500).filter(r => !setorId || r.setorId === setorId);
    return list.reverse();
  }

  try {
    const rows = await lerAba("registros");
    if (rows.length <= 1) return [];
    const list = rows.slice(1).map(parsedRegistroRow);
    const sorted = [...list].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    const filtered = sorted.slice(0, 1500).filter(r => !setorId || r.setorId === setorId);
    return filtered.reverse();
  } catch (e) {
    console.error("Erro ao obter todos os registros:", e);
    const registros = JSON.parse(localStorage.getItem("local_registros") || "[]") as any[];
    const sorted = [...registros].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    const list = sorted.slice(0, 1500).filter(r => !setorId || r.setorId === setorId);
    return list.reverse();
  }
}

export async function fbExcluirRegistro(docId: string): Promise<void> {
  if (isOfflineMode()) {
    const registros = JSON.parse(localStorage.getItem("local_registros") || "[]") as any[];
    const filtrados = registros.filter(r => r.linha !== docId);
    localStorage.setItem("local_registros", JSON.stringify(filtrados));
    return;
  }

  const rows = await lerAba("registros");
  const rowIndex = rows.findIndex(row => row[0] === docId);
  if (rowIndex === -1) {
    throw new Error("Registro não encontrado");
  }
  await excluirLinhaAba("registros", rowIndex + 1);
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
  const rows = await lerAba("registros");
  // Find all rows that match target criteria and collect indices
  // To avoid index shifting during deletes, we can delete them starting from the bottom!
  const rowsToDelete: number[] = [];
  rows.forEach((row, index) => {
    if (index === 0) return; // Header
    const r = parsedRegistroRow(row);
    const rSetorId = r.setorId || "t-automatico";
    const statusDMM = r.usoDMM ? r.usoDMM.toUpperCase().trim() : "";
    const isTarget = r.data === hojeStr && r.maquina === maquina.toUpperCase() && statusDMM === "NÃO" && (!setorId || rSetorId === setorId);
    if (isTarget) {
      rowsToDelete.push(index + 1); // 1-based index
    }
  });

  // Sort descending to delete from bottom to top safely
  rowsToDelete.sort((a, b) => b - a);
  for (const rowIndex of rowsToDelete) {
    await excluirLinhaAba("registros", rowIndex);
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

  const rows = await lerAba("registros");
  const rowIndex = rows.findIndex(row => row[0] === docId);
  if (rowIndex === -1) {
    throw new Error("Registro não encontrado");
  }
  const r = parsedRegistroRow(rows[rowIndex]);
  r.comentarioSupervisor = comentario.trim().toUpperCase();
  await atualizarLinhaAba("registros", rowIndex + 1, registroToRow(r));
}

// Dummy subscription functions since we now poll or reload on demand for sheets
export function fbSubscreverCadastro(
  setorId: string | undefined,
  callback: (data: { colaboradores: string[]; maquinas: string[] }) => void,
  onError: (error: any) => void
): () => void {
  let active = true;
  const poll = async () => {
    while (active) {
      try {
        const data = await fbObterCadastro(setorId);
        if (active) callback(data);
      } catch (err) {
        if (active) onError(err);
      }
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
  };
  poll();
  return () => {
    active = false;
  };
}

export function fbSubscreverMonitoramento(
  setorId: string | undefined,
  callback: (data: { paradas: ParadaItem[]; desvios: DesvioItem[] }) => void,
  onError: (error: any) => void
): () => void {
  let active = true;
  const poll = async () => {
    while (active) {
      try {
        const data = await fbObterMonitoramento(setorId);
        if (active) callback(data);
      } catch (err) {
        if (active) onError(err);
      }
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
  };
  poll();
  return () => {
    active = false;
  };
}

export function fbSubscreverAlertas(
  setorId: string | undefined,
  callback: (data: { ncPendentes: NCPendente[]; historico: HistoricoItem[] }) => void,
  onError: (error: any) => void
): () => void {
  let active = true;
  const poll = async () => {
    while (active) {
      try {
        const data = await fbObterAlertas(setorId);
        if (active) callback(data);
      } catch (err) {
        if (active) onError(err);
      }
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
  };
  poll();
  return () => {
    active = false;
  };
}
