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
  writeBatch
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
  const snapshot = await getDocs(collection(db, "setores"));
  const setores: Setor[] = [];
  snapshot.forEach(doc => {
    setores.push(doc.data() as Setor);
  });
  return setores;
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
  await setDoc(doc(db, "setores", id), novoSetor);
  return novoSetor;
}

export async function fbAtualizarSetor(id: string, updates: Partial<Setor>): Promise<void> {
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
  if (id === "t-automatico") {
    throw new Error("O setor padrão não pode ser excluído");
  }
  await deleteDoc(doc(db, "setores", id));
}

// 3. Registration/Cadastro APIs
export async function fbObterCadastro(setorId?: string): Promise<{ colaboradores: string[]; maquinas: string[] }> {
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
  const snapshot = await getDocs(query(collection(db, "registros"), orderBy("timestamp", "asc")));
  const ncPendentes: NCPendente[] = [];
  const historico: HistoricoItem[] = [];

  snapshot.forEach(doc => {
    const r = doc.data() as Registro;
    const docId = doc.id;
    const rSetorId = r.setorId || "t-automatico";
    if (setorId && rSetorId !== setorId) return;

    const textoNC = r.naoConformidade ? r.naoConformidade.trim().toUpperCase() : "";
    const solucao = r.solucao ? r.solucao.trim() : "";

    if (textoNC !== "" && textoNC !== "OK" && textoNC !== "-" && solucao === "") {
      ncPendentes.push({
        linha: docId as any, // ID of document as key
        colaborador: r.colaborador || "NÃO INFORMADO",
        responsavel: r.responsavel || "NÃO INFORMADO",
        problema: r.naoConformidade,
        maquina: r.maquina,
        hora: r.hora.substring(0, 5),
        data: r.data,
        codigoPeca: r.codigoPeca || "-"
      });
    }

    const isProblem = textoNC !== "OK" && textoNC !== "-" && textoNC !== "";
    if (isProblem) {
      const infoTroca = r.trocaFerramenta === "SIM" ? ` | TROCA: ${r.oQueTrocou} por ${r.quemTrocou}` : "";
      const solucaoCompleta = solucao ? `${solucao}${infoTroca}` : `PENDENTE${infoTroca}`;
      historico.push({
        data: r.data,
        hora: r.hora.substring(0, 5),
        maquina: r.maquina,
        problema: textoNC,
        responsavel: r.responsavel || "NÃO INFORMADO",
        colaborador: r.colaborador || "NÃO INFORMADO",
        solucao: solucaoCompleta,
        codigoPeca: r.codigoPeca || "-",
        quemResolveu: r.quemResolveu || ""
      });
    }
  });

  return { ncPendentes, historico };
}

export async function fbObterUltimoMotivo(maquina: string, setorId?: string): Promise<string> {
  // Query from last to first
  const snapshot = await getDocs(query(collection(db, "registros"), orderBy("timestamp", "desc")));
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
      if (statusDMM === "NÃO") {
        return (motivo !== "" && motivo !== "-") ? motivo : "";
      }
    }
  }
  return motivoEncontrado;
}

export async function fbObterMonitoramento(setorId?: string): Promise<{ paradas: ParadaItem[]; desvios: DesvioItem[] }> {
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

  snapshot.forEach(docSnap => {
    const r = docSnap.data() as Registro;
    const docId = docSnap.id;
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

    if (statusDMM === "NÃO") {
      estadoMaq[maq].divergencia = true;
      estadoMaq[maq].linha = docId;
      estadoMaq[maq].comentarioSupervisor = r.comentarioSupervisor || "";
      if (motivo !== "" && motivo !== "-") {
        estadoMaq[maq].motivo = motivo;
      }
    } else if (statusDMM === "SIM" && solucao === "DIVERGÊNCIA VERIFICADA E LIBERADA") {
      estadoMaq[maq].divergencia = false;
      estadoMaq[maq].motivo = "";
      estadoMaq[maq].linha = undefined;
      estadoMaq[maq].comentarioSupervisor = undefined;
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
        comentarioSupervisor: estadoMaq[m].comentarioSupervisor
      });
    }
  });

  return { paradas, desvios };
}

export async function fbSalvarMedicao(dados: Partial<Registro>, setorId?: string): Promise<void> {
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
    timestamp: Date.now()
  };
  await addDoc(collection(db, "registros"), novoRegistro);
}

export async function fbResolverNC(docId: string, solucao: string, quemResolveu?: string): Promise<void> {
  const cleanUpdates: any = {
    solucao: solucao.trim()
  };
  if (quemResolveu) {
    cleanUpdates.quemResolveu = quemResolveu.trim().toUpperCase();
  }
  await updateDoc(doc(db, "registros", docId), cleanUpdates);
}

export async function fbLiberarDivergencia(maquina: string, colaboradorSupervisor: string, setorId?: string): Promise<void> {
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
  const snapshot = await getDocs(query(collection(db, "registros"), orderBy("timestamp", "asc")));
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
  return list;
}

export async function fbExcluirRegistro(docId: string): Promise<void> {
  await deleteDoc(doc(db, "registros", docId));
}

export async function fbAdicionarComentario(docId: string, comentario: string): Promise<void> {
  await updateDoc(doc(db, "registros", docId), {
    comentarioSupervisor: comentario.trim().toUpperCase()
  });
}
