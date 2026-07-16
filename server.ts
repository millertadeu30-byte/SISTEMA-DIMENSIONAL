import express from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";
import { Registro, NCPendente, HistoricoItem, ParadaItem, DesvioItem, Setor } from "./src/types.js";

const app = express();
const PORT = 3000;

app.use(express.json());

const DATA_DIR = path.join(process.cwd(), "data");
const CADASTRO_FILE = path.join(DATA_DIR, "cadastro.json");
const REGISTROS_FILE = path.join(DATA_DIR, "registros.json");
const SETORES_FILE = path.join(DATA_DIR, "setores.json");

function parseHoraParaMinutos(horaStr: string): number {
  const partes = horaStr.split(":");
  const h = parseInt(partes[0], 10) || 0;
  const m = parseInt(partes[1], 10) || 0;
  return h * 60 + m;
}

// Garante que o diretório e os arquivos de dados existam
function inicializarBanco() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const colabsPadrao = ["ANSELMO", "ALEXANDER", "IAGO", "DANIEL", "WILSON", "JULIO", "MILLER"];
  const maqsPadrao = ["3", "4", "5", "6", "7", "8", "9", "12", "13", "S1", "S2", "T1", "T2"];

  if (!fs.existsSync(CADASTRO_FILE)) {
    fs.writeFileSync(
      CADASTRO_FILE,
      JSON.stringify({ colaboradores: colabsPadrao, maquinas: maqsPadrao }, null, 2),
      "utf8"
    );
  }

  if (!fs.existsSync(SETORES_FILE)) {
    const setoresIniciais: Setor[] = [
      {
        id: "t-automatico",
        titulo: "SISTEMA DIMENSIONAL T.AUTOMÁTICO",
        senha: "",
        maquinas: maqsPadrao,
        colaboradores: colabsPadrao
      }
    ];
    fs.writeFileSync(SETORES_FILE, JSON.stringify(setoresIniciais, null, 2), "utf8");
  }

  if (!fs.existsSync(REGISTROS_FILE)) {
    // Criamos alguns registros iniciais fictícios para povoar a tela
    const registrosIniciais: Registro[] = [
      {
        data: getFormatoBrasil().data,
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
        modeloPeca: "-"
      },
      {
        data: getFormatoBrasil().data,
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
        modeloPeca: "EIXO-M13"
      }
    ];
    fs.writeFileSync(REGISTROS_FILE, JSON.stringify(registrosIniciais, null, 2), "utf8");
  }
}

// Retorna data e hora formatada no fuso de Brasília (America/Sao_Paulo)
function getFormatoBrasil() {
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

  const dataParts = formatterData.format(agora).split("/");
  const horaParts = formatterHora.format(agora).split(":");

  // Cria um objeto Date representativo do fuso brasileiro para cálculos
  const dSP = new Date(agora);
  
  return {
    data: formatterData.format(agora), // dd/MM/yyyy
    hora: formatterHora.format(agora), // HH:mm:ss
    objetoSP: dSP
  };
}

inicializarBanco();

// Helper para ler arquivos
async function lerJSON<T>(filePath: string): Promise<T> {
  const content = await fs.promises.readFile(filePath, "utf8");
  return JSON.parse(content) as T;
}

// Helper para salvar arquivos
async function salvarJSON<T>(filePath: string, data: T): Promise<void> {
  await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

// ==========================================
// ROTAS DE API
// ==========================================

// --- ROTAS DE SETORES (ADMIN PANEL) ---

// Obter todos os setores
app.get("/api/setores", async (req, res) => {
  try {
    const setores = await lerJSON<Setor[]>(SETORES_FILE);
    res.json(setores);
  } catch (error) {
    res.status(500).json({ error: "Erro ao carregar setores" });
  }
});

// Criar novo setor
app.post("/api/setores", async (req, res) => {
  try {
    const { titulo, senha } = req.body;
    if (!titulo) {
      return res.status(400).json({ error: "O título do setor é obrigatório" });
    }
    const setores = await lerJSON<Setor[]>(SETORES_FILE);
    
    // Gera ID único
    const id = "setor-" + Date.now();
    
    const novoSetor: Setor = {
      id,
      titulo: titulo.trim().toUpperCase(),
      senha: senha ? senha.trim() : "",
      maquinas: ["3", "4", "5", "6", "7"], // padrão inicial simples
      colaboradores: ["OPERADOR 1", "OPERADOR 2"] // padrão inicial simples
    };

    setores.push(novoSetor);
    await salvarJSON(SETORES_FILE, setores);
    res.json({ success: true, setor: novoSetor });
  } catch (error) {
    res.status(500).json({ error: "Erro ao criar setor" });
  }
});

// Atualizar um setor (Título, Senha, Máquinas, Colaboradores)
app.put("/api/setores/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, senha, maquinas, colaboradores } = req.body;
    const setores = await lerJSON<Setor[]>(SETORES_FILE);
    const idx = setores.findIndex(s => s.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: "Setor não encontrado" });
    }

    if (titulo !== undefined) setores[idx].titulo = titulo.trim().toUpperCase();
    if (senha !== undefined) setores[idx].senha = senha.trim();
    if (maquinas !== undefined) {
      setores[idx].maquinas = maquinas.map((m: string) => m.trim().toUpperCase()).filter(Boolean);
    }
    if (colaboradores !== undefined) {
      setores[idx].colaboradores = colaboradores.map((c: string) => c.trim().toUpperCase()).filter(Boolean);
    }

    await salvarJSON(SETORES_FILE, setores);
    res.json({ success: true, setor: setores[idx] });
  } catch (error) {
    res.status(500).json({ error: "Erro ao atualizar setor" });
  }
});

// Excluir um setor
app.delete("/api/setores/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (id === "t-automatico") {
      return res.status(400).json({ error: "O setor padrão não pode ser excluído" });
    }
    let setores = await lerJSON<Setor[]>(SETORES_FILE);
    setores = setores.filter(s => s.id !== id);
    await salvarJSON(SETORES_FILE, setores);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erro ao excluir setor" });
  }
});

// 1. Obter colaboradores e máquinas (cadastro)
app.get("/api/cadastro", async (req, res) => {
  try {
    const { setorId } = req.query;
    if (setorId) {
      const setores = await lerJSON<Setor[]>(SETORES_FILE);
      const s = setores.find(x => x.id === setorId);
      if (s) {
        return res.json({ colaboradores: s.colaboradores, maquinas: s.maquinas });
      }
    }
    const cadastro = await lerJSON<{ colaboradores: string[]; maquinas: string[] }>(CADASTRO_FILE);
    res.json(cadastro);
  } catch (error) {
    res.status(500).json({ error: "Erro ao carregar dados de cadastro" });
  }
});

// 2. Adicionar colaborador
app.post("/api/cadastro/colaborador", async (req, res) => {
  try {
    const { nome, setorId } = req.body;
    if (!nome) return res.status(400).json({ error: "Nome é obrigatório" });
    const nomeLimpo = nome.trim().toUpperCase();
    
    if (setorId) {
      const setores = await lerJSON<Setor[]>(SETORES_FILE);
      const sIdx = setores.findIndex(x => x.id === setorId);
      if (sIdx !== -1) {
        if (!setores[sIdx].colaboradores.includes(nomeLimpo)) {
          setores[sIdx].colaboradores.push(nomeLimpo);
          setores[sIdx].colaboradores.sort();
          await salvarJSON(SETORES_FILE, setores);
        }
        return res.json({ success: true, colaboradores: setores[sIdx].colaboradores });
      }
    }

    const cadastro = await lerJSON<{ colaboradores: string[]; maquinas: string[] }>(CADASTRO_FILE);
    if (cadastro.colaboradores.includes(nomeLimpo)) {
      return res.status(400).json({ error: "Colaborador já existe" });
    }
    cadastro.colaboradores.push(nomeLimpo);
    cadastro.colaboradores.sort();
    await salvarJSON(CADASTRO_FILE, cadastro);
    res.json({ success: true, colaboradores: cadastro.colaboradores });
  } catch (error) {
    res.status(500).json({ error: "Erro ao adicionar colaborador" });
  }
});

// 3. Remover colaborador
app.delete("/api/cadastro/colaborador/:nome", async (req, res) => {
  try {
    const { nome } = req.params;
    const { setorId } = req.query;
    const nomeLimpo = nome.toUpperCase();

    if (setorId) {
      const setores = await lerJSON<Setor[]>(SETORES_FILE);
      const sIdx = setores.findIndex(x => x.id === setorId);
      if (sIdx !== -1) {
        setores[sIdx].colaboradores = setores[sIdx].colaboradores.filter(c => c !== nomeLimpo);
        await salvarJSON(SETORES_FILE, setores);
        return res.json({ success: true, colaboradores: setores[sIdx].colaboradores });
      }
    }

    const cadastro = await lerJSON<{ colaboradores: string[]; maquinas: string[] }>(CADASTRO_FILE);
    cadastro.colaboradores = cadastro.colaboradores.filter(c => c !== nomeLimpo);
    await salvarJSON(CADASTRO_FILE, cadastro);
    res.json({ success: true, colaboradores: cadastro.colaboradores });
  } catch (error) {
    res.status(500).json({ error: "Erro ao remover colaborador" });
  }
});

// 4. Adicionar máquina
app.post("/api/cadastro/maquina", async (req, res) => {
  try {
    const { codigo, setorId } = req.body;
    if (!codigo) return res.status(400).json({ error: "Código da máquina é obrigatório" });
    const codLimpo = codigo.trim().toUpperCase();

    if (setorId) {
      const setores = await lerJSON<Setor[]>(SETORES_FILE);
      const sIdx = setores.findIndex(x => x.id === setorId);
      if (sIdx !== -1) {
        if (!setores[sIdx].maquinas.includes(codLimpo)) {
          setores[sIdx].maquinas.push(codLimpo);
          setores[sIdx].maquinas.sort();
          await salvarJSON(SETORES_FILE, setores);
        }
        return res.json({ success: true, maquinas: setores[sIdx].maquinas });
      }
    }

    const cadastro = await lerJSON<{ colaboradores: string[]; maquinas: string[] }>(CADASTRO_FILE);
    if (cadastro.maquinas.includes(codLimpo)) {
      return res.status(400).json({ error: "Máquina já existe" });
    }
    cadastro.maquinas.push(codLimpo);
    cadastro.maquinas.sort();
    await salvarJSON(CADASTRO_FILE, cadastro);
    res.json({ success: true, maquinas: cadastro.maquinas });
  } catch (error) {
    res.status(500).json({ error: "Erro ao adicionar máquina" });
  }
});

// 5. Remover máquina
app.delete("/api/cadastro/maquina/:codigo", async (req, res) => {
  try {
    const { codigo } = req.params;
    const { setorId } = req.query;
    const codLimpo = codigo.toUpperCase();

    if (setorId) {
      const setores = await lerJSON<Setor[]>(SETORES_FILE);
      const sIdx = setores.findIndex(x => x.id === setorId);
      if (sIdx !== -1) {
        setores[sIdx].maquinas = setores[sIdx].maquinas.filter(m => m !== codLimpo);
        await salvarJSON(SETORES_FILE, setores);
        return res.json({ success: true, maquinas: setores[sIdx].maquinas });
      }
    }

    const cadastro = await lerJSON<{ colaboradores: string[]; maquinas: string[] }>(CADASTRO_FILE);
    cadastro.maquinas = cadastro.maquinas.filter(m => m !== codLimpo);
    await salvarJSON(CADASTRO_FILE, cadastro);
    res.json({ success: true, maquinas: cadastro.maquinas });
  } catch (error) {
    res.status(500).json({ error: "Erro ao remover máquina" });
  }
});

// 6. Verificar alertas e histórico de ações
app.get("/api/alertas", async (req, res) => {
  try {
    const { setorId } = req.query;
    const registros = await lerJSON<Registro[]>(REGISTROS_FILE);
    const ncPendentes: NCPendente[] = [];
    const historico: HistoricoItem[] = [];

    registros.forEach((r, idx) => {
      const rSetorId = r.setorId || "t-automatico";
      if (setorId && rSetorId !== setorId) return;

      const textoNC = r.naoConformidade ? r.naoConformidade.trim().toUpperCase() : "";
      const solucao = r.solucao ? r.solucao.trim() : "";
      
      // NC pendente se existe uma NC cadastrada e ela não está resolvida (solução vazia)
      if (textoNC !== "" && textoNC !== "OK" && textoNC !== "-" && solucao === "") {
        ncPendentes.push({
          linha: idx, // usamos o index como identificador original
          responsavel: r.responsavel || "NÃO INFORMADO",
          problema: r.naoConformidade,
          maquina: r.maquina,
          hora: r.hora.substring(0, 5),
          data: r.data
        });
      }

      // Adiciona ao histórico apenas se for uma Não Conformidade (NC) dimensional
      const isProblem = textoNC !== "OK" && textoNC !== "-" && textoNC !== "";
      if (isProblem) {
        const infoTroca = r.trocaFerramenta === "SIM" ? ` | TROCA: ${r.oQueTrocou} por ${r.quemTrocou}` : "";
        const solucaoCompleta = solucao ? `${solucao}${infoTroca}` : `PENDENTE${infoTroca}`;
        historico.push({
          data: r.data,
          hora: r.hora.substring(0, 5),
          maquina: r.maquina,
          problema: textoNC,
          responsavel: r.responsavel || r.colaborador,
          solucao: solucaoCompleta
        });
      }
    });

    res.json({ ncPendentes, historico });
  } catch (error) {
    res.status(500).json({ error: "Erro ao processar alertas e histórico" });
  }
});

// 7. Obter o último motivo de desvio DMM para preenchimento automático
app.get("/api/ultimo-motivo/:maquina", async (req, res) => {
  try {
    const { maquina } = req.params;
    const { setorId } = req.query;
    const registros = await lerJSON<Registro[]>(REGISTROS_FILE);
    
    // Varre de trás para frente
    for (let i = registros.length - 1; i >= 0; i--) {
      const rSetorId = registros[i].setorId || "t-automatico";
      if (setorId && rSetorId !== setorId) continue;

      if (registros[i].maquina === maquina.toUpperCase()) {
        const statusDMM = registros[i].usoDMM ? registros[i].usoDMM.toUpperCase().trim() : "";
        const motivo = registros[i].motivoDMM ? registros[i].motivoDMM.trim() : "";
        const solucao = registros[i].solucao ? registros[i].solucao.trim() : "";

        if (statusDMM === "SIM" && solucao === "DIVERGÊNCIA VERIFICADA E LIBERADA") {
          return res.json({ motivo: "" });
        }
        if (statusDMM === "NÃO") {
          return res.json({ motivo: (motivo !== "" && motivo !== "-") ? motivo : "" });
        }
      }
    }
    res.json({ motivo: "" });
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar último motivo" });
  }
});

// 8. Buscar monitoramento lateral (Paradas de 60 minutos e Divergências de hoje)
app.get("/api/monitoramento", async (req, res) => {
  try {
    const { setorId } = req.query;
    
    // Obter lista de máquinas específicas do setor
    let maquinasSetor: string[] = [];
    if (setorId) {
      const setores = await lerJSON<Setor[]>(SETORES_FILE);
      const s = setores.find(x => x.id === setorId);
      if (s) {
        maquinasSetor = s.maquinas;
      }
    }
    if (maquinasSetor.length === 0) {
      const cadastro = await lerJSON<{ colaboradores: string[]; maquinas: string[] }>(CADASTRO_FILE);
      maquinasSetor = cadastro.maquinas;
    }

    const registros = await lerJSON<Registro[]>(REGISTROS_FILE);
    
    const { data: hojeStr, hora: horaAtualStr } = getFormatoBrasil();
    const minutosAgora = parseHoraParaMinutos(horaAtualStr);
    
    const paradas: ParadaItem[] = [];
    const desvios: DesvioItem[] = [];
    
    // Mapeamento do estado de cada máquina cadastrada no setor
    const estadoMaq: { 
      [key: string]: { 
        ultimaMedicaoMinutos: number | null; 
        formatada: string; 
        divergencia: boolean; 
        motivo: string; 
        linha?: number; 
        comentarioSupervisor?: string;
      } 
    } = {};
    
    maquinasSetor.forEach(m => {
      estadoMaq[m] = {
        ultimaMedicaoMinutos: null,
        formatada: "S/R",
        divergencia: false,
        motivo: ""
      };
    });

    registros.forEach((r, idx) => {
      if (!r.data) return;
      
      // Compara apenas registros do dia de hoje (no fuso do Brasil)
      if (r.data === hojeStr) {
        // Filtrar pelo setor
        const rSetorId = r.setorId || "t-automatico";
        if (setorId && rSetorId !== setorId) return;

        const maq = r.maquina;
        if (!estadoMaq[maq]) {
          estadoMaq[maq] = { ultimaMedicaoMinutos: null, formatada: "S/R", divergencia: false, motivo: "" };
        }

        // Calcula minutos do registro
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
          estadoMaq[maq].linha = idx;
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
      }
    });

    const minutosLimite = 60;
    maquinasSetor.forEach(m => {
      const u = estadoMaq[m].ultimaMedicaoMinutos;
      
      // Se não há medição hoje OU se o tempo desde a última medição ultrapassa 60 minutos
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
          comentarioSupervisor: estadoMaq[m].comentarioSupervisor
        });
      }
    });

    res.json({ paradas, desvios });
  } catch (error) {
    res.status(500).json({ error: "Erro ao processar monitoramento lateral" });
  }
});

// 9. Salvar nova medição
app.post("/api/medicao", async (req, res) => {
  try {
    const dados = req.body as Partial<Registro> & { setorId?: string };
    if (!dados.colaborador || !dados.maquina || !dados.conforme) {
      return res.status(400).json({ error: "Campos obrigatórios ausentes" });
    }

    const registros = await lerJSON<Registro[]>(REGISTROS_FILE);
    const { data: dataHoje, hora: horaHoje } = getFormatoBrasil();

    const novoRegistro: Registro = {
      setorId: dados.setorId || "t-automatico",
      data: dataHoje,
      hora: horaHoje,
      colaborador: dados.colaborador.toUpperCase(),
      maquina: dados.maquina.toUpperCase(),
      conforme: dados.conforme,
      naoConformidade: dados.naoConformidade || "OK",
      codigoPeca: dados.codigoPeca || "-",
      responsavel: dados.responsavel || "-",
      usoDMM: dados.usoDMM || "SIM",
      motivoDMM: dados.motivoDMM || "-",
      solucao: "",
      trocaFerramenta: dados.trocaFerramenta || "NÃO",
      oQueTrocou: dados.oQueTrocou || "-",
      quemTrocou: dados.quemTrocou || "-",
      modeloPeca: dados.modeloPeca || "-"
    };

    registros.push(novoRegistro);
    await salvarJSON(REGISTROS_FILE, registros);
    res.json({ success: true, registro: novoRegistro });
  } catch (error) {
    res.status(500).json({ error: "Erro ao salvar medição" });
  }
});

// 10. Resolver NC pendente
app.post("/api/resolver-nc", async (req, res) => {
  try {
    const { linha, solucao, quemResolveu } = req.body;
    if (linha === undefined || !solucao) {
      return res.status(400).json({ error: "Linha e solução são obrigatórios" });
    }

    const registros = await lerJSON<Registro[]>(REGISTROS_FILE);
    const idx = parseInt(linha, 10);
    
    if (isNaN(idx) || idx < 0 || idx >= registros.length) {
      return res.status(404).json({ error: "Registro não encontrado" });
    }

    registros[idx].solucao = solucao.trim();
    if (quemResolveu) {
      registros[idx].quemResolveu = quemResolveu.trim().toUpperCase();
    }
    await salvarJSON(REGISTROS_FILE, registros);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erro ao resolver NC" });
  }
});

// 11. Liberar divergência de máquina (Gravação do supervisor)
app.post("/api/liberar-divergencia", async (req, res) => {
  try {
    const { maquina, colaboradorSupervisor, setorId } = req.body;
    if (!maquina || !colaboradorSupervisor) {
      return res.status(400).json({ error: "Máquina e colaborador supervisor são obrigatórios" });
    }

    const registros = await lerJSON<Registro[]>(REGISTROS_FILE);
    const { data: dataHoje, hora: horaHoje } = getFormatoBrasil();

    const registroSupervisor: Registro = {
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
      modeloPeca: "-"
    };

    registros.push(registroSupervisor);
    await salvarJSON(REGISTROS_FILE, registros);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erro ao liberar divergência" });
  }
});

// 12. Obter todos os registros arquivados (equivalente à planilha)
app.get("/api/registros", async (req, res) => {
  try {
    const { setorId } = req.query;
    const registros = await lerJSON<Registro[]>(REGISTROS_FILE);
    // Mapeia adicionando o índice original (linha) para manipulação no frontend
    const registrosComLinha = registros.map((r, idx) => ({
      ...r,
      linha: idx
    }));

    const filtrados = registrosComLinha.filter(r => {
      const rSetorId = r.setorId || "t-automatico";
      return !setorId || rSetorId === setorId;
    });

    res.json(filtrados);
  } catch (error) {
    res.status(500).json({ error: "Erro ao carregar registros do arquivo" });
  }
});

// 13. Excluir um registro específico (Ação restrita de supervisor)
app.delete("/api/registros/:linha", async (req, res) => {
  try {
    const { linha } = req.params;
    const idx = parseInt(linha, 10);
    if (isNaN(idx)) {
      return res.status(400).json({ error: "Índice do registro inválido" });
    }

    const registros = await lerJSON<Registro[]>(REGISTROS_FILE);
    if (idx < 0 || idx >= registros.length) {
      return res.status(404).json({ error: "Registro não encontrado para exclusão" });
    }

    // Remove o registro
    registros.splice(idx, 1);
    await salvarJSON(REGISTROS_FILE, registros);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erro ao excluir registro" });
  }
});

// 14. Adicionar comentário do supervisor a um registro (Ação restrita)
app.post("/api/registros/:linha/comentar", async (req, res) => {
  try {
    const { linha } = req.params;
    const { comentario } = req.body;
    const idx = parseInt(linha, 10);
    if (isNaN(idx)) {
      return res.status(400).json({ error: "Índice do registro inválido" });
    }

    if (!comentario) {
      return res.status(400).json({ error: "O comentário é obrigatório" });
    }

    const registros = await lerJSON<Registro[]>(REGISTROS_FILE);
    if (idx < 0 || idx >= registros.length) {
      return res.status(404).json({ error: "Registro não encontrado para inserção de comentário" });
    }

    // Adiciona ou atualiza o comentário do supervisor
    registros[idx].comentarioSupervisor = comentario.trim().toUpperCase();
    await salvarJSON(REGISTROS_FILE, registros);
    res.json({ success: true, registro: registros[idx] });
  } catch (error) {
    res.status(500).json({ error: "Erro ao salvar comentário do supervisor" });
  }
});

// ==========================================
// VITE MIDDLEWARE SETUP
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
