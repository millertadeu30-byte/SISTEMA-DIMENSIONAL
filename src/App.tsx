import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Settings,
  History,
  User,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Search,
  ArrowLeft,
  Check,
  Plus,
  Trash2,
  Clock,
  Lock,
  ShieldAlert,
  Wrench,
  Loader2,
  RefreshCw,
  Sliders,
  ChevronRight,
  MessageSquare,
  Info
} from "lucide-react";
import {
  Registro,
  NCPendente,
  HistoricoItem,
  ParadaItem,
  DesvioItem,
  CadastroResponse,
  AlertasResponse,
  MonitoramentoResponse,
  Setor
} from "./types";
import {
  inicializarBancoFirebase,
  fbObterSetores,
  fbCriarSetor,
  fbAtualizarSetor,
  fbExcluirSetor,
  fbObterCadastro,
  fbAdicionarColaborador,
  fbRemoverColaborador,
  fbAdicionarMaquina,
  fbRemoverMaquina,
  fbObterAlertas,
  fbObterUltimoMotivo,
  fbObterMonitoramento,
  fbSalvarMedicao,
  fbResolverNC,
  fbLiberarDivergencia,
  fbObterTodosRegistros,
  fbExcluirRegistro,
  fbAdicionarComentario
} from "./firebase";

export default function App() {
  // Estados de navegação e fluxos
  const [step, setStep] = useState<number | "loading" | "historico" | "resolverNC" | "liberarDiv" | "config" | "registros">(1);
  const [loadingText, setLoadingText] = useState("CARREGANDO...");

  // Estados de setores e ADM
  const [setores, setSetores] = useState<Setor[]>([]);
  const [setorSelecionado, setSetorSelecionado] = useState<Setor | null>(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminSenhaInput, setAdminSenhaInput] = useState("");
  const [adminError, setAdminError] = useState("");
  const [sectorSenhaInput, setSectorSenhaInput] = useState("");
  const [sectorSenhaError, setSectorSenhaError] = useState("");
  const [sectorAbertoParaSenha, setSectorAbertoParaSenha] = useState<Setor | null>(null);

  // Estados para o Modal Unificado de Acesso / Sair
  const [acessoModalOpen, setAcessoModalOpen] = useState(false);
  const [acessoSenhaInput, setAcessoSenhaInput] = useState("");
  const [acessoErro, setAcessoErro] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [revelados, setRevelados] = useState<{[key: string]: boolean}>({});

  // Estados para o Admin Panel
  const [novoSetorTitulo, setNovoSetorTitulo] = useState("");
  const [novoSetorSenha, setNovoSetorSenha] = useState("");
  const [setorEmEdicao, setSetorEmEdicao] = useState<Setor | null>(null);
  const [editSetorTitulo, setEditSetorTitulo] = useState("");
  const [editSetorSenha, setEditSetorSenha] = useState("");
  const [editSetorMaquinas, setEditSetorMaquinas] = useState("");
  const [editSetorColaboradores, setEditSetorColaboradores] = useState("");

  // Cadastro e dados carregados do servidor
  const [colaboradores, setColaboradores] = useState<string[]>([]);
  const [maquinas, setMaquinas] = useState<string[]>([]);
  
  // Alertas e dados de monitoramento
  const [ncPendentes, setNcPendentes] = useState<NCPendente[]>([]);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [paradas, setParadas] = useState<ParadaItem[]>([]);
  const [desvios, setDesvios] = useState<DesvioItem[]>([]);

  // Estado para busca e filtros
  const [buscaHistorico, setBuscaHistorico] = useState("");
  const [buscaColaborador, setBuscaColaborador] = useState("");
  const [dataFiltroHistorico, setDataFiltroHistorico] = useState("");

  // Estado para planilha de registros brutos
  const [registrosCompletos, setRegistrosCompletos] = useState<Registro[]>([]);
  const [buscaRegistros, setBuscaRegistros] = useState("");
  const [dataFiltroRegistrosInicio, setDataFiltroRegistrosInicio] = useState("");
  const [dataFiltroRegistrosFim, setDataFiltroRegistrosFim] = useState("");
  const [comentariosDivergencia, setComentariosDivergencia] = useState<{ [linha: number]: string }>({});
  const [maquinaFiltroRegistros, setMaquinaFiltroRegistros] = useState("");
  const [quemResolveuNC, setQuemResolveuNC] = useState<{ [linha: number]: string }>({});
  const [quemLiberouDMM, setQuemLiberouDMM] = useState<{ [maq: string]: string }>({});

  // Estados para clicar em quem resolveu na planilha
  const [modalResolvidoPorOpen, setModalResolvidoPorOpen] = useState(false);
  const [registroSelecionadoParaResolvidoPor, setRegistroSelecionadoParaResolvidoPor] = useState<number | null>(null);

  const atualizarResolvidoPorPeloRegistro = async (linha: number, quem: string) => {
    try {
      const reg = registrosCompletos.find(r => r.linha === linha);
      if (!reg) return;

      await fbResolverNC(String(linha), reg.solucao || "REGULADO CONFORME PROCESSO", quem);

      setModalResolvidoPorOpen(false);
      setRegistroSelecionadoParaResolvidoPor(null);
      await carregarRegistros();
      alert("RESPONSÁVEL PELA RESOLUÇÃO ATUALIZADO COM SUCESSO!");
    } catch (e) {
      console.error(e);
      alert("Erro ao atualizar o responsável.");
    }
  };

  // Payload da medição atual
  const [payload, setPayload] = useState<Partial<Registro>>({
    colaborador: "",
    maquina: "",
    conforme: "SIM",
    naoConformidade: "OK",
    codigoPeca: "-",
    responsavel: "-",
    usoDMM: "SIM",
    motivoDMM: "-",
    trocaFerramenta: "NÃO",
    oQueTrocou: "-",
    quemTrocou: "-",
    modeloPeca: "-"
  });

  // Formulários temporários
  const [tempNC, setTempNC] = useState("");
  const [tempCod, setTempCod] = useState("");
  const [tempModelo, setTempModelo] = useState("");
  const [tempResp, setTempResp] = useState("");

  const [tempDMM, setTempDMM] = useState("");
  const [tempTrocaOQue, setTempTrocaOQue] = useState("");
  const [tempTrocaQuem, setTempTrocaQuem] = useState("");

  // Formulários de controle de cadastro (Supervisor)
  const [novoColaborador, setNovoColaborador] = useState("");
  const [novaMaquina, setNovaMaquina] = useState("");

  // Estados para diálogos customizados (Evitando prompt, confirm, alert nativos que travam em iframes)
  const [modalSenhaOpen, setModalSenhaOpen] = useState(false);
  const [modalSenhaCallback, setModalSenhaCallback] = useState<(() => void) | null>(null);
  const [modalSenhaInput, setModalSenhaInput] = useState("");
  const [modalSenhaErro, setModalSenhaErro] = useState("");

  const [modalComentarioOpen, setModalComentarioOpen] = useState(false);
  const [modalComentarioLinha, setModalComentarioLinha] = useState<number | null>(null);
  const [modalComentarioInput, setModalComentarioInput] = useState("");
  const [modalComentarioMsg, setModalComentarioMsg] = useState("");

  const [modalConfirmOpen, setModalConfirmOpen] = useState(false);
  const [modalConfirmCallback, setModalConfirmCallback] = useState<(() => void) | null>(null);
  const [modalConfirmMsg, setModalConfirmMsg] = useState("");

  const [modalAlertOpen, setModalAlertOpen] = useState(false);
  const [modalAlertMsg, setModalAlertMsg] = useState("");

  // Alerta customizado que substitui o alert global
  const alert = (msg: string) => {
    setModalAlertMsg(msg);
    setModalAlertOpen(true);
  };

  // Estado da hora atual exibida na barra superior
  const [currentTime, setCurrentTime] = useState("");

  const carregarSetores = async () => {
    try {
      const data = await fbObterSetores();
      setSetores(data);
      
      const savedSetorId = localStorage.getItem("setorAtivoId");
      if (savedSetorId && !setorSelecionado) {
        const found = data.find(s => s.id === savedSetorId);
        if (found) {
          setSetorSelecionado(found);
          carregarCadastro(found.id);
          carregarAlertas(found.id);
          carregarMonitoramento(found.id);
        }
      }
    } catch (e) {
      console.error("Erro ao carregar setores:", e);
    }
  };

  const processarAcessoModal = () => {
    const senha = acessoSenhaInput.trim();
    if (!senha) {
      setAcessoErro("POR FAVOR, INSIRA UMA SENHA!");
      return;
    }

    // 1. Verificar Admin Geral ("8619")
    if (senha === "8619") {
      setIsAdmin(true);
      setAcessoModalOpen(false);
      setAcessoSenhaInput("");
      setAcessoErro("");
      setStep("config");
      return;
    }

    // 2. Verificar Supervisor Geral ("5211")
    if (senha === "5211") {
      setIsAdmin(false);
      setAcessoModalOpen(false);
      setAcessoSenhaInput("");
      setAcessoErro("");
      setStep("config");
      return;
    }

    // 3. Verificar senha de cada setor
    const setorEncontrado = setores.find(s => s.senha === senha);
    if (setorEncontrado) {
      setSetorSelecionado(setorEncontrado);
      localStorage.setItem("setorAtivoId", setorEncontrado.id);
      setIsAdmin(false);
      setAcessoModalOpen(false);
      setAcessoSenhaInput("");
      setAcessoErro("");
      carregarCadastro(setorEncontrado.id);
      carregarAlertas(setorEncontrado.id);
      carregarMonitoramento(setorEncontrado.id);
      resetarFluxo();
      return;
    }

    setAcessoErro("SENHA INVÁLIDA! TENTE NOVAMENTE.");
  };

  const processarAcessoInicial = (senha: string) => {
    const pin = senha.trim();
    if (!pin) {
      setAcessoErro("POR FAVOR, INSIRA UMA SENHA!");
      return;
    }

    // 1. Verificar Admin Geral ("8619")
    if (pin === "8619") {
      setIsAdmin(true);
      setAcessoSenhaInput("");
      setAcessoErro("");
      setStep("config");
      return;
    }

    // 2. Verificar Supervisor Geral ("5211")
    if (pin === "5211") {
      setIsAdmin(false);
      setAcessoSenhaInput("");
      setAcessoErro("");
      setStep("config");
      return;
    }

    // 3. Verificar senha de cada setor
    const setorEncontrado = setores.find(s => s.senha === pin);
    if (setorEncontrado) {
      setSetorSelecionado(setorEncontrado);
      localStorage.setItem("setorAtivoId", setorEncontrado.id);
      setIsAdmin(false);
      setAcessoSenhaInput("");
      setAcessoErro("");
      carregarCadastro(setorEncontrado.id);
      carregarAlertas(setorEncontrado.id);
      carregarMonitoramento(setorEncontrado.id);
      resetarFluxo();
      return;
    }

    setAcessoErro("SENHA INCORRETA! TENTE NOVAMENTE.");
  };

  const realizarLogoutCompleto = () => {
    setSetorSelecionado(null);
    localStorage.removeItem("setorAtivoId");
    setIsAdmin(false);
    setAcessoModalOpen(false);
    setAcessoSenhaInput("");
    setAcessoErro("");
    carregarCadastro("");
    carregarAlertas("");
    carregarMonitoramento("");
    resetarFluxo();
  };

  const criarNovoSetor = async () => {
    if (!novoSetorTitulo.trim()) {
      alert("POR FAVOR, INSIRA O TÍTULO DO NOVO SETOR!");
      return;
    }
    try {
      await fbCriarSetor(novoSetorTitulo, novoSetorSenha);
      setNovoSetorTitulo("");
      setNovoSetorSenha("");
      await carregarSetores();
      alert("SETOR CRIADO COM SUCESSO!");
    } catch (e) {
      console.error(e);
      alert("Erro ao criar setor.");
    }
  };

  const deletarSetor = async (id: string) => {
    solicitarConfirmacao("DESEJA REALMENTE EXCLUIR ESTE SETOR? ESTA AÇÃO NÃO PODE SER DESFEITA.", async () => {
      try {
        await fbExcluirSetor(id);
        if (setorSelecionado?.id === id) {
          realizarLogoutCompleto();
        } else {
          await carregarSetores();
        }
        alert("SETOR EXCLUÍDO COM SUCESSO!");
      } catch (e) {
        console.error(e);
        alert(e instanceof Error ? e.message : "Erro ao excluir setor.");
      }
    });
  };

  const salvarEdicaoSetor = async () => {
    if (!setorEmEdicao) return;
    if (!editSetorTitulo.trim()) {
      alert("O TÍTULO DO SETOR NÃO PODE SER VAZIO!");
      return;
    }
    try {
      await fbAtualizarSetor(setorEmEdicao.id, {
        titulo: editSetorTitulo,
        senha: editSetorSenha,
        maquinas: editSetorMaquinas.split(",").map(m => m.trim()).filter(Boolean),
        colaboradores: editSetorColaboradores.split(",").map(c => c.trim()).filter(Boolean)
      });
      setSetorEmEdicao(null);
      await carregarSetores();
      alert("SETOR ATUALIZADO COM SUCESSO!");
    } catch (e) {
      console.error(e);
      alert("Erro ao atualizar setor.");
    }
  };

  const verificarSenhaSetorClick = (s: Setor) => {
    if (sectorSenhaInput === s.senha) {
      setSetorSelecionado(s);
      localStorage.setItem("setorAtivoId", s.id);
      setSectorAbertoParaSenha(null);
      setSectorSenhaInput("");
      setSectorSenhaError("");
      carregarCadastro(s.id);
      carregarAlertas(s.id);
      carregarMonitoramento(s.id);
      resetarFluxo();
    } else {
      setSectorSenhaError("SENHA DE SETOR INCORRETA!");
    }
  };

  // Inicialização e Carregamento de Dados
  useEffect(() => {
    const initAndLoad = async () => {
      await inicializarBancoFirebase();
      await carregarSetores();
    };
    initAndLoad();

    // Atualiza relógio
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false
        })
      );
    };
    updateTime();
    const intervalTime = setInterval(updateTime, 1000);

    return () => {
      clearInterval(intervalTime);
    };
  }, []);

  // Monitoramento secundário e autoreload de 30 segundos
  useEffect(() => {
    if (!setorSelecionado) return;

    carregarCadastro(setorSelecionado.id);
    carregarAlertas(setorSelecionado.id);
    carregarMonitoramento(setorSelecionado.id);

    const intervalMonitor = setInterval(() => {
      carregarMonitoramento(setorSelecionado.id);
    }, 30000);

    return () => {
      clearInterval(intervalMonitor);
    };
  }, [setorSelecionado]);

  // Busca dados de cadastro
  const carregarCadastro = async (sId?: string) => {
    try {
      const activeId = sId || (setorSelecionado ? setorSelecionado.id : "");
      const data = await fbObterCadastro(activeId);
      setColaboradores(data.colaboradores);
      setMaquinas(data.maquinas);
    } catch (e) {
      console.error("Erro ao carregar cadastro:", e);
    }
  };

  // Busca histórico e NCs pendentes
  const carregarAlertas = async (sId?: string) => {
    try {
      const activeId = sId || (setorSelecionado ? setorSelecionado.id : "");
      const data = await fbObterAlertas(activeId);
      setNcPendentes(data.ncPendentes);
      setHistorico(data.historico);
    } catch (e) {
      console.error("Erro ao carregar alertas:", e);
    }
  };

  // Busca paradas e divergências ativas
  const carregarMonitoramento = async (sId?: string) => {
    try {
      const activeId = sId || (setorSelecionado ? setorSelecionado.id : "");
      const data = await fbObterMonitoramento(activeId);
      const listaParadas = data.paradas || [];
      // Ordena as paradas: quem tem hora (em vermelho) fica no topo, ordenado ascendentemente (mais antigo primeiro); quem é "S/R" fica abaixo.
      listaParadas.sort((a, b) => {
        const aHasTime = a.hora !== "S/R";
        const bHasTime = b.hora !== "S/R";
        if (aHasTime && !bHasTime) return -1;
        if (!aHasTime && bHasTime) return 1;
        if (aHasTime && bHasTime) {
          return a.hora.localeCompare(b.hora);
        }
        return a.maq.localeCompare(b.maq, undefined, { numeric: true });
      });
      setParadas(listaParadas);
      setDesvios(data.desvios || []);
    } catch (e) {
      console.error("Erro ao carregar monitoramento:", e);
    }
  };

  // Reseta fluxo de medição
  const resetarFluxo = () => {
    setPayload({
      colaborador: "",
      maquina: "",
      conforme: "SIM",
      naoConformidade: "OK",
      codigoPeca: "-",
      responsavel: "-",
      usoDMM: "SIM",
      motivoDMM: "-",
      trocaFerramenta: "NÃO",
      oQueTrocou: "-",
      quemTrocou: "-",
      modeloPeca: "-"
    });
    setTempNC("");
    setTempCod("");
    setTempModelo("");
    setTempResp("");
    setTempDMM("");
    setTempTrocaOQue("");
    setTempTrocaQuem("");
    setBuscaColaborador("");
    setQuemResolveuNC({});
    setStep(1);
    if (setorSelecionado) {
      carregarAlertas(setorSelecionado.id);
      carregarMonitoramento(setorSelecionado.id);
    }
  };

  // Escolhe Colaborador
  const escolherColaborador = (nome: string) => {
    setPayload(prev => ({ ...prev, colaborador: nome }));
    setStep(2);
  };

  // Escolhe Máquina e faz busca de histórico de desvio
  const escolherMaquina = async (maq: string) => {
    setLoadingText("ANALISANDO HISTÓRICO DA MÁQUINA...");
    setStep("loading");
    
    // Configura máquina no payload
    setPayload(prev => ({ ...prev, maquina: maq }));

    try {
      const motivo = await fbObterUltimoMotivo(maq, setorSelecionado?.id);
      if (motivo) {
        // Se tiver um motivo pendente de desvio DMM, pré-preenche o formulário temporário
        setTempDMM(motivo);
        setPayload(prev => ({ ...prev, usoDMM: "NÃO" }));
      } else {
        setTempDMM("");
        setPayload(prev => ({ ...prev, usoDMM: "SIM" }));
      }
    } catch (e) {
      console.error("Erro ao buscar último motivo:", e);
      setTempDMM("");
      setPayload(prev => ({ ...prev, usoDMM: "SIM" }));
    }
    setStep(3);
  };

  // Trata conformidade dimensional (Passo 3)
  const setConformidade = (conforme: "SIM" | "NÃO") => {
    if (conforme === "SIM") {
      setPayload(prev => ({
        ...prev,
        conforme: "SIM",
        naoConformidade: "OK",
        codigoPeca: "-",
        modeloPeca: "-",
        responsavel: "-"
      }));
      setStep(4);
    } else {
      setPayload(prev => ({ ...prev, conforme: "NÃO" }));
      // Permanece no passo 3 exibindo o formulário de NC
    }
  };

  // Valida e avança no formulário de NC (Passo 3)
  const salvarNCForm = () => {
    if (!tempNC.trim()) {
      alert("POR FAVOR, DESCREVA A NÃO CONFORMIDADE!");
      return;
    }
    if (!tempResp) {
      alert("SELECIONE O COLABORADOR COMUNICADO!");
      return;
    }

    setPayload(prev => ({
      ...prev,
      naoConformidade: tempNC.trim().toUpperCase(),
      codigoPeca: tempCod.trim().toUpperCase() || "-",
      modeloPeca: tempModelo.trim().toUpperCase() || "-",
      responsavel: tempResp
    }));

    setStep(4);
  };

  // Trata divergência (Passo 4)
  const setDMMConformidade = (temDivergencia: boolean) => {
    if (!temDivergencia) {
      setPayload(prev => ({
        ...prev,
        usoDMM: "SIM", // "SIM" significa que o DMM está conforme (não há divergência)
        motivoDMM: "-"
      }));
      setStep(5);
    } else {
      setPayload(prev => ({ ...prev, usoDMM: "NÃO" })); // "NÃO" significa que o DMM tem desvio/não conforme
      // Abre formulário para digitar o desvio
    }
  };

  // Valida e avança no formulário de DMM (Passo 4)
  const salvarDMMForm = () => {
    if (!tempDMM.trim()) {
      alert("POR FAVOR, DESCREVA A DIVERGÊNCIA!");
      return;
    }
    setPayload(prev => ({
      ...prev,
      motivoDMM: tempDMM.trim().toUpperCase()
    }));
    setStep(5);
  };

  // Trata troca de ferramenta (Passo 5)
  const setTrocaConformidade = (houveTroca: boolean) => {
    if (!houveTroca) {
      finalizarMedicao({
        ...payload,
        trocaFerramenta: "NÃO",
        oQueTrocou: "-",
        quemTrocou: "-"
      });
    } else {
      setPayload(prev => ({ ...prev, trocaFerramenta: "SIM" }));
      // Abre formulário de troca
    }
  };

  // Valida e finaliza medição com troca de ferramenta
  const salvarTrocaForm = () => {
    if (!tempTrocaOQue.trim()) {
      alert("POR FAVOR, DESCREVA A FERRAMENTA TROCADA!");
      return;
    }
    if (!tempTrocaQuem) {
      alert("SELECIONE QUEM REALIZOU A TROCA!");
      return;
    }

    finalizarMedicao({
      ...payload,
      trocaFerramenta: "SIM",
      oQueTrocou: tempTrocaOQue.trim().toUpperCase(),
      quemTrocou: tempTrocaQuem
    });
  };

  // Envia medição ao servidor
  const finalizarMedicao = async (dadosFinais: Partial<Registro>) => {
    setLoadingText("SALVANDO REGISTRO...");
    setStep("loading");
    try {
      await fbSalvarMedicao(dadosFinais, setorSelecionado?.id);
      resetarFluxo();
    } catch (e) {
      console.error("Erro ao enviar dados:", e);
      alert("Falha ao salvar medição.");
      setStep(5);
    }
  };

  // Resolve uma NC específica
  const resolverNCOnServer = async (linha: any, solucao: string, quemResolveu: string) => {
    if (!solucao.trim()) {
      alert("DESCREVA A SOLUÇÃO ADOTADA!");
      return;
    }
    if (!quemResolveu) {
      alert("POR FAVOR, SELECIONE O COLABORADOR QUE RESOLVEU A NÃO CONFORMIDADE!");
      return;
    }
    setLoadingText("SALVANDO SOLUÇÃO...");
    setStep("loading");
    try {
      await fbResolverNC(linha, solucao, quemResolveu);
      setQuemResolveuNC(prev => {
        const copy = { ...prev };
        delete copy[linha];
        return copy;
      });
      resetarFluxo();
    } catch (e) {
      console.error(e);
      alert("Erro ao resolver NC.");
      setStep("resolverNC");
    }
  };

  // Libera divergência de máquina (Supervisor)
  const liberarDivergenciaOnServer = async (maquina: string) => {
    setLoadingText("LIBERANDO MÁQUINA...");
    setStep("loading");
    try {
      await fbLiberarDivergencia(maquina, "SUPERVISOR", setorSelecionado?.id);
      resetarFluxo();
    } catch (e) {
      console.error(e);
      alert("Erro ao liberar máquina.");
      setStep("liberarDiv");
    }
  };

  // Pede senha do supervisor para funções restritas usando modal customizado
  const verificarSenhaSupervisor = (acao: () => void) => {
    setModalSenhaInput("");
    setModalSenhaErro("");
    setModalSenhaCallback(() => acao);
    setModalSenhaOpen(true);
  };

  const confirmarModalSenha = () => {
    if (modalSenhaInput === "5211") {
      setModalSenhaOpen(false);
      if (modalSenhaCallback) {
        modalSenhaCallback();
      }
    } else {
      setModalSenhaErro("SENHA INCORRETA!");
    }
  };

  // Pede confirmação usando modal customizado
  const solicitarConfirmacao = (msg: string, acao: () => void) => {
    setModalConfirmMsg(msg);
    setModalConfirmCallback(() => acao);
    setModalConfirmOpen(true);
  };

  // Busca todos os registros do arquivo (Planilha)
  const carregarRegistros = async () => {
    try {
      const data = await fbObterTodosRegistros(setorSelecionado?.id);
      setRegistrosCompletos(data);
    } catch (e) {
      console.error("Erro ao carregar registros completos:", e);
    }
  };

  // Salva comentário do supervisor em uma divergência específica
  const salvarComentarioSupervisor = async (linha: any, comentario: string) => {
    if (!comentario.trim()) {
      alert("POR FAVOR, DIGITE UM COMENTÁRIO!");
      return;
    }
    setLoadingText("SALVANDO COMENTÁRIO...");
    setStep("loading");
    try {
      await fbAdicionarComentario(linha, comentario);
      resetarFluxo();
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar comentário do supervisor.");
      setStep("liberarDiv");
    }
  };

  // Exclui uma divergência (mudar/remover registro) direto do painel do supervisor
  const excluirDivergenciaPeloSupervisor = async (linha: any) => {
    solicitarConfirmacao("DESEJA EXCLUIR ESTE REGISTRO DE DIVERGÊNCIA?", async () => {
      setLoadingText("EXCLUINDO REGISTRO...");
      setStep("loading");
      try {
        await fbExcluirRegistro(linha);
        resetarFluxo();
      } catch (e) {
        console.error(e);
        alert("Erro ao excluir divergência.");
        setStep("liberarDiv");
      }
    });
  };

  // Exclui registro completo a partir da planilha de registros arquivados
  const excluirRegistroPeloRegistro = (linha: any) => {
    verificarSenhaSupervisor(async () => {
      setLoadingText("EXCLUINDO REGISTRO...");
      setStep("loading");
      try {
        await fbExcluirRegistro(linha);
        await carregarRegistros();
        setStep("registros");
      } catch (e) {
        console.error(e);
        alert("Erro ao excluir registro.");
        setStep("registros");
      }
    });
  };

  // Adiciona comentário de divergência a partir da planilha de registros arquivados
  const comentarDivergenciaPeloRegistro = (linha: any) => {
    const reg = registrosCompletos.find(r => r.linha === linha);
    if (!reg) return;

    const motivo = reg.motivoDMM && reg.motivoDMM !== "-" ? reg.motivoDMM : "NÃO INFORMADA";
    const comentarioAtual = reg.comentarioSupervisor || "";

    const msg = `⚠️ DETALHES DA DIVERGÊNCIA (MÁQUINA ${reg.maquina}):\n` +
                `"${motivo}"\n\n` +
                `💬 COMENTÁRIO ATUAL DO SUPERVISOR:\n` +
                `"${comentarioAtual || "NENHUM"}"`;

    setModalComentarioMsg(msg);
    setModalComentarioInput(comentarioAtual);
    setModalComentarioLinha(linha as any);
    setModalComentarioOpen(true);
  };

  const confirmarModalComentario = () => {
    if (!modalComentarioInput.trim()) {
      alert("COMENTÁRIO NÃO PODE SER VAZIO!");
      return;
    }
    const linha = modalComentarioLinha;
    if (linha === null) return;
    const comentario = modalComentarioInput;

    setModalComentarioOpen(false);
    verificarSenhaSupervisor(async () => {
      setLoadingText("SALVANDO COMENTÁRIO...");
      setStep("loading");
      try {
        await fbAdicionarComentario(linha as any, comentario);
        await carregarRegistros();
        setStep("registros");
      } catch (e) {
        console.error(e);
        alert("Erro ao salvar comentário.");
        setStep("registros");
      }
    });
  };

  // Exportar registros como CSV para Excel/Sheets
  const exportarCSV = () => {
    const headers = [
      "Data",
      "Hora",
      "Colaborador",
      "Maquina",
      "Conforme",
      "Nao Conformidade",
      "Codigo Peca",
      "Modelo Peca",
      "Comunicado",
      "Uso DMM",
      "Motivo Divergencia DMM",
      "Troca Ferramenta",
      "O Que Trocou",
      "Quem Trocou",
      "Solucao NC",
      "Quem Resolveu",
      "Comentario Supervisor"
    ];

    const rows = registrosFiltrados.map(r => [
      r.data,
      r.hora,
      r.colaborador,
      r.maquina,
      r.conforme,
      r.naoConformidade,
      r.codigoPeca,
      r.modeloPeca,
      r.responsavel,
      r.usoDMM,
      r.motivoDMM,
      r.trocaFerramenta,
      r.oQueTrocou,
      r.quemTrocou,
      r.solucao,
      r.quemResolveu || "",
      r.comentarioSupervisor || ""
    ]);

    // Monta o arquivo CSV (usando ponto e vírgula ";" para suporte padrão no Excel em português)
    const csvContent = [
      headers.join(";"),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(";"))
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `registros_dimensional_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Cadastra novo colaborador
  const adicionarColaborador = async () => {
    if (!novoColaborador.trim()) return;
    try {
      const data = await fbAdicionarColaborador(novoColaborador, setorSelecionado?.id);
      setColaboradores(data);
      setNovoColaborador("");
    } catch (e) {
      console.error(e);
      alert("Erro ao adicionar colaborador.");
    }
  };

  // Remove colaborador
  const removerColaborador = async (nome: string) => {
    solicitarConfirmacao(`DESEJA EXCLUIR O COLABORADOR ${nome}?`, async () => {
      try {
        const data = await fbRemoverColaborador(nome, setorSelecionado?.id);
        setColaboradores(data);
      } catch (e) {
        console.error(e);
        alert("Erro ao remover colaborador.");
      }
    });
  };

  // Cadastra nova máquina
  const adicionarMaquina = async () => {
    if (!novaMaquina.trim()) return;
    try {
      const data = await fbAdicionarMaquina(novaMaquina, setorSelecionado?.id);
      setMaquinas(data);
      setNovaMaquina("");
    } catch (e) {
      console.error(e);
      alert("Erro ao adicionar máquina.");
    }
  };

  // Remove máquina
  const removerMaquina = async (codigo: string) => {
    solicitarConfirmacao(`DESEJA EXCLUIR A MÁQUINA ${codigo}?`, async () => {
      try {
        const data = await fbRemoverMaquina(codigo, setorSelecionado?.id);
        setMaquinas(data);
      } catch (e) {
        console.error(e);
        alert("Erro ao remover máquina.");
      }
    });
  };

  // Filtros de colaboradores para busca rápida
  const colaboradoresFiltrados = colaboradores.filter(c =>
    c.toLowerCase().includes(buscaColaborador.toLowerCase())
  );

  // Filtro de registros completo (Planilha)
  const registrosFiltrados = registrosCompletos
    .slice()
    .reverse()
    .filter(r => {
      // Filtro de máquina dedicado
      if (maquinaFiltroRegistros && r.maquina !== maquinaFiltroRegistros) {
        return false;
      }

      // Filtro de busca de texto geral
      const query = buscaRegistros.toLowerCase();
      const matchesText = (
        r.colaborador.toLowerCase().includes(query) ||
        r.maquina.toLowerCase().includes(query) ||
        (r.naoConformidade && r.naoConformidade.toLowerCase().includes(query)) ||
        (r.codigoPeca && r.codigoPeca.toLowerCase().includes(query)) ||
        (r.modeloPeca && r.modeloPeca.toLowerCase().includes(query)) ||
        (r.motivoDMM && r.motivoDMM.toLowerCase().includes(query)) ||
        (r.comentarioSupervisor && r.comentarioSupervisor.toLowerCase().includes(query)) ||
        (r.solucao && r.solucao.toLowerCase().includes(query))
      );

      // Filtro de datas (Intervalo)
      if (!r.data) return matchesText;

      // Converter r.data ("dd/MM/yyyy") em objeto Date para comparação
      const [dia, mes, ano] = r.data.split("/");
      const dataRegistroObj = new Date(parseInt(ano, 10), parseInt(mes, 10) - 1, parseInt(dia, 10));

      if (dataFiltroRegistrosInicio) {
        const [anoI, mesI, diaI] = dataFiltroRegistrosInicio.split("-");
        const dataInicioObj = new Date(parseInt(anoI, 10), parseInt(mesI, 10) - 1, parseInt(diaI, 10));
        if (dataRegistroObj < dataInicioObj) return false;
      }

      if (dataFiltroRegistrosFim) {
        const [anoF, mesF, diaF] = dataFiltroRegistrosFim.split("-");
        const dataFimObj = new Date(parseInt(anoF, 10), parseInt(mesF, 10) - 1, parseInt(diaF, 10));
        if (dataRegistroObj > dataFimObj) return false;
      }

      return matchesText;
    });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-blue-600 selection:text-white overflow-x-hidden pb-12">
      {/* Barra de Status Superior */}
      <header className="bg-slate-950 border-b border-slate-800 px-4 py-3 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 bg-emerald-500 rounded-full animate-pulse" />
            <h1 className="font-mono text-base md:text-lg font-bold tracking-widest text-blue-400 flex items-center gap-2 uppercase">
              {setorSelecionado ? setorSelecionado.titulo : "SISTEMA DIMENSIONAL TCNC"}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs md:text-sm font-mono text-slate-400 bg-slate-900 px-3.5 py-2 rounded-2xl border border-slate-800">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Clock size={14} className="text-blue-400" /> {currentTime} (BRT)
            </span>
            <span className="text-slate-600">|</span>
            <button
              onClick={() => {
                carregarCadastro(setorSelecionado?.id || "");
                carregarAlertas(setorSelecionado?.id || "");
                carregarMonitoramento(setorSelecionado?.id || "");
              }}
              className="hover:text-blue-400 flex items-center gap-1 transition"
              title="Sincronizar dados"
            >
              <RefreshCw size={13} /> ATUALIZAR
            </button>
            <span className="text-slate-600">|</span>
            <button
              onClick={() => {
                setAcessoModalOpen(true);
                setAcessoSenhaInput("");
                setAcessoErro("");
              }}
              className="text-red-400 hover:text-red-300 font-black cursor-pointer flex items-center gap-1 transition px-2.5 py-0.5 bg-red-950/30 border border-red-900/40 rounded-lg hover:bg-red-950/60 text-xs uppercase"
              title="Acessar painel ou mudar de setor"
            >
              SAIR
            </button>
          </div>
        </div>
      </header>

      {/* Alerta de NC pendente no topo */}
      {ncPendentes.length > 0 && step === 1 && (
        <div className="bg-red-950/90 border-b border-red-700/60 py-3.5 px-4 text-center">
          <button
            onClick={() => setStep("resolverNC")}
            className="inline-flex items-center gap-3 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold px-6 py-2.5 rounded-full text-sm shadow-lg tracking-wider animate-bounce transition duration-200 uppercase"
          >
            <AlertTriangle size={18} className="animate-pulse" />
            ⚠️ {ncPendentes.length} NC PENDENTE - RESOLVER AGORA
          </button>
        </div>
      )}

      {/* Conteúdo Principal */}
      <main className="max-w-7xl mx-auto px-4 mt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Painel Central / Fluxo */}
          <div className={`${(setorSelecionado && step !== "config") ? "lg:col-span-8" : "lg:col-span-12 max-w-6xl mx-auto w-full"} bg-slate-800/50 backdrop-blur-sm border border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl`}>
            
            {/* Header Interno de Navegação */}
            {step !== 1 && step !== "loading" && (
              <div className="bg-slate-950/40 border-b border-slate-800/80 px-6 py-4 flex justify-between items-center">
                <button
                  onClick={() => {
                    if (typeof step === "number") {
                      if (step === 2) setStep(1);
                      else if (step === 3) setStep(2);
                      else if (step === 4) setStep(3);
                      else if (step === 5) setStep(4);
                    } else {
                      resetarFluxo();
                    }
                  }}
                  className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition font-semibold"
                >
                  <ArrowLeft size={16} /> VOLTAR
                </button>
                <div className="text-xs font-mono font-bold uppercase tracking-wider text-blue-400 bg-blue-950/40 px-2.5 py-1 rounded border border-blue-900/40">
                  {typeof step === "number" ? `PASSO ${step} DE 5` : step}
                </div>
              </div>
            )}

            <div className="p-6 md:p-8">
              <AnimatePresence mode="wait">
                
                {/* 1. TELA DE CARREGAMENTO */}
                {step === "loading" && (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center py-16 text-center"
                  >
                    <Loader2 size={56} className="text-blue-500 animate-spin mb-6" />
                    <h3 className="text-xl md:text-2xl font-black font-mono tracking-wider text-slate-200">
                      {loadingText}
                    </h3>
                    <p className="text-sm text-slate-400 mt-2">Por favor, aguarde...</p>
                  </motion.div>
                )}

                {/* TELA DE SELEÇÃO DE SETOR / PORTAL DE ACESSO COM SENHA */}
                {!setorSelecionado && step === 1 && (
                  <motion.div
                    key="initial_password_portal"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="max-w-md mx-auto space-y-6 text-center py-10"
                  >
                    <div className="space-y-2">
                      <div className="w-16 h-16 rounded-full bg-blue-950/40 border border-blue-900/40 flex items-center justify-center text-blue-400 mx-auto group-hover:scale-110 transition mb-4">
                        <Lock size={26} className="text-blue-500 animate-pulse" />
                      </div>
                      <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center justify-center gap-2 uppercase">
                        Acesso ao Sistema
                      </h2>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto font-bold uppercase leading-relaxed">
                        Insira a senha do seu setor ou do painel de administrador para continuar:
                      </p>
                    </div>

                    <div className="space-y-4">
                      <input
                        type="password"
                        autoComplete="off"
                        value={acessoSenhaInput}
                        onChange={e => {
                          setAcessoSenhaInput(e.target.value);
                          setAcessoErro("");
                        }}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            processarAcessoInicial(acessoSenhaInput);
                          }
                        }}
                        placeholder="••••"
                        className="w-full bg-slate-950 border-2 border-slate-800 focus:border-blue-500 focus:outline-none rounded-2xl px-4 py-3.5 text-center text-xl font-mono tracking-widest text-white font-black"
                        autoFocus
                      />

                      {acessoErro && (
                        <div className="text-red-500 text-xs font-black uppercase text-center animate-bounce">
                          ⚠️ {acessoErro}
                        </div>
                      )}

                      <button
                        onClick={() => processarAcessoInicial(acessoSenhaInput)}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl text-sm shadow-lg hover:shadow-blue-900/30 transition uppercase cursor-pointer flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 size={16} /> Confirmar Senha
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* 2. PASSO 1: COLABORADOR */}
                {step === 1 && setorSelecionado && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="space-y-6"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-2">
                          <User className="text-blue-500" size={26} /> QUEM ESTÁ MEDINDO?
                        </h2>
                        <p className="text-sm text-slate-400 mt-1">Selecione seu nome para iniciar o registro</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => {
                            carregarRegistros();
                            setStep("registros");
                          }}
                          className="bg-slate-950/60 hover:bg-slate-950 border border-slate-800 hover:border-emerald-500/30 text-slate-400 hover:text-slate-200 font-bold px-3 py-2 rounded-xl text-[11px] flex items-center gap-1.5 shadow transition"
                        >
                          <Search size={12} className="text-emerald-500/80" /> PLANILHA DE REGISTROS
                        </button>
                        <button
                          onClick={() => setStep("historico")}
                          className="bg-slate-950/60 hover:bg-slate-950 border border-slate-800 hover:border-blue-500/30 text-slate-400 hover:text-slate-200 font-bold px-3 py-2 rounded-xl text-[11px] flex items-center gap-1.5 shadow transition"
                        >
                          <History size={12} className="text-blue-500/80" /> HISTÓRICO
                        </button>
                        <button
                          onClick={() => verificarSenhaSupervisor(() => setStep("config"))}
                          className="bg-slate-950/60 hover:bg-slate-950 border border-slate-800 hover:border-yellow-500/30 text-slate-400 hover:text-slate-200 font-bold px-3 py-2 rounded-xl text-[11px] flex items-center gap-1.5 shadow transition"
                          title="Configurações do sistema"
                        >
                          <Settings size={12} className="text-yellow-500/80" /> AJUSTES
                        </button>
                      </div>
                    </div>

                    {/* Barra de busca de colaborador */}
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-slate-500">
                        <Search size={20} />
                      </span>
                      <input
                        type="text"
                        placeholder="DIGITE PARA FILTRAR COLABORADOR..."
                        value={buscaColaborador}
                        onChange={e => setBuscaColaborador(e.target.value)}
                        className="w-full bg-slate-900/40 border-2 border-slate-800 focus:border-blue-500 focus:outline-none rounded-2xl pl-12 pr-4 py-4 text-base font-bold text-white transition-all uppercase placeholder:text-slate-600"
                      />
                    </div>

                    {/* Grid de colaboradores - Importante: Botões maiores e mais destacados */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-h-[380px] overflow-y-auto pr-2 custom-scrollbar">
                      {colaboradoresFiltrados.map(nome => (
                        <button
                          key={nome}
                          onClick={() => escolherColaborador(nome)}
                          className="bg-slate-900/40 hover:bg-slate-950 hover:border-blue-500 border border-slate-800 text-left font-black text-lg md:text-xl text-slate-100 py-6 px-6 rounded-2xl transition duration-150 transform hover:-translate-y-0.5 hover:shadow-xl active:scale-95 cursor-pointer uppercase flex items-center justify-between group"
                        >
                          <span>{nome}</span>
                          <ChevronRight size={22} className="text-slate-600 group-hover:text-blue-400 transition" />
                        </button>
                      ))}
                      {colaboradoresFiltrados.length === 0 && (
                        <div className="col-span-full py-12 text-center text-slate-500">
                          Nenhum colaborador encontrado com "{buscaColaborador}"
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* 3. PASSO 2: MÁQUINA */}
                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -15 }}
                    className="space-y-6"
                  >
                    <div>
                      <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                        <Cpu className="text-blue-500" size={20} /> QUAL A MÁQUINA?
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">Selecione a máquina que realizou o dimensional</p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {maquinas.map(maq => (
                        <button
                          key={maq}
                          onClick={() => escolherMaquina(maq)}
                          className="bg-slate-900/30 hover:bg-slate-950 border-2 border-blue-600 hover:border-blue-400 text-blue-400 hover:text-white font-black text-lg md:text-xl py-5 rounded-2xl transition duration-150 transform hover:-translate-y-0.5 hover:shadow-lg active:scale-95 cursor-pointer flex items-center justify-center gap-2 font-mono"
                        >
                          {maq}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* 4. PASSO 3: CONFORMIDADE DIMENSIONAL */}
                {step === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -15 }}
                    className="space-y-6"
                  >
                    <div className="bg-yellow-400 text-slate-950 p-6 rounded-2xl border-l-8 border-yellow-600 shadow-lg text-center">
                      <h2 className="text-xl md:text-2xl font-black tracking-tight leading-snug uppercase">
                        DIMENSIONAL E PERFIL DA PEÇA ESTÁ CONFORME O DESENHO?
                      </h2>
                    </div>

                    {payload.conforme === "SIM" && !tempNC && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button
                          onClick={() => setConformidade("SIM")}
                          className="bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 hover:border-emerald-400 text-white font-black text-2xl py-8 rounded-2xl shadow-xl transition transform active:scale-95 flex flex-col items-center justify-center gap-2"
                        >
                          <CheckCircle2 size={36} />
                          <span>SIM</span>
                        </button>
                        <button
                          onClick={() => setConformidade("NÃO")}
                          className="bg-red-600 hover:bg-red-500 border border-red-500 hover:border-red-400 text-white font-black text-2xl py-8 rounded-2xl shadow-xl transition transform active:scale-95 flex flex-col items-center justify-center gap-2"
                        >
                          <AlertTriangle size={36} />
                          <span>NÃO</span>
                        </button>
                      </div>
                    )}

                    {/* Formulário se NÃO Conforme */}
                    {payload.conforme === "NÃO" && (
                      <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-4">
                        <h3 className="text-red-400 font-bold text-sm tracking-widest uppercase mb-2">
                          REGISTRAR NÃO CONFORMIDADE (NC)
                        </h3>

                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                              QUAL A NÃO CONFORMIDADE? *
                            </label>
                            <input
                              type="text"
                              value={tempNC}
                              onChange={e => setTempNC(e.target.value)}
                              placeholder="EX: DIAMETRO INTERNO FORA DE MEDIDA"
                              className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 focus:outline-none rounded-xl px-4 py-3 text-base text-white font-bold uppercase placeholder:text-slate-600"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                                CÓDIGO ALTERNATIVO DA PEÇA:
                              </label>
                              <input
                                type="text"
                                value={tempCod}
                                onChange={e => setTempCod(e.target.value)}
                                placeholder="EX: PCA-102"
                                className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 focus:outline-none rounded-xl px-4 py-3 text-base text-white font-bold uppercase placeholder:text-slate-600"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                                MODELO DA PEÇA (NOVO):
                              </label>
                              <input
                                type="text"
                                value={tempModelo}
                                onChange={e => setTempModelo(e.target.value)}
                                placeholder="EX: MODELO-XYZ"
                                className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 focus:outline-none rounded-xl px-4 py-3 text-base text-white font-bold uppercase placeholder:text-slate-600"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                              COMUNICOU QUAL COLABORADOR? *
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[140px] overflow-y-auto pr-1.5 custom-scrollbar">
                              {colaboradores.map(c => (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => setTempResp(c)}
                                  className={`px-3 py-2.5 rounded-xl font-bold text-xs uppercase border transition ${
                                    tempResp === c
                                      ? "bg-red-600 border-red-500 text-white"
                                      : "bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                                  }`}
                                >
                                  {c}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="pt-4 flex gap-3">
                          <button
                            onClick={() => {
                              setPayload(prev => ({ ...prev, conforme: "SIM" }));
                              setTempNC("");
                              setTempCod("");
                              setTempModelo("");
                              setTempResp("");
                            }}
                            className="w-1/3 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-white font-bold py-3.5 rounded-xl text-sm transition"
                          >
                            CANCELAR
                          </button>
                          <button
                            onClick={salvarNCForm}
                            className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3.5 rounded-xl text-sm shadow-lg hover:shadow-red-900/30 transition transform active:scale-95"
                          >
                            PRÓXIMO
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* 5. PASSO 4: DIVERGÊNCIA DMM */}
                {step === 4 && (
                  <motion.div
                    key="step4"
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -15 }}
                    className="space-y-6"
                  >
                    <div className="bg-orange-600 text-white p-6 rounded-2xl border-l-8 border-orange-800 shadow-lg text-center">
                      <h2 className="text-xl md:text-2xl font-black tracking-tight leading-snug uppercase">
                        EXISTE ALGUMA DIVERGÊNCIA OU RASURA NA FOLHA DE PROCESSO / DESENHO OU DMMS?
                      </h2>
                    </div>

                    {payload.usoDMM === "SIM" && !tempDMM && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button
                          onClick={() => setDMMConformidade(true)}
                          className="bg-orange-600 hover:bg-orange-500 border border-orange-500 hover:border-orange-400 text-white font-black text-2xl py-8 rounded-2xl shadow-xl transition transform active:scale-95 flex flex-col items-center justify-center gap-2"
                        >
                          <AlertTriangle size={36} />
                          <span>SIM</span>
                        </button>
                        <button
                          onClick={() => setDMMConformidade(false)}
                          className="bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 hover:border-emerald-400 text-white font-black text-2xl py-8 rounded-2xl shadow-xl transition transform active:scale-95 flex flex-col items-center justify-center gap-2"
                        >
                          <CheckCircle2 size={36} />
                          <span>NÃO</span>
                        </button>
                      </div>
                    )}

                    {/* Formulário se HÁ Divergência */}
                    {payload.usoDMM === "NÃO" && (
                      <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-4">
                        <h3 className="text-orange-400 font-bold text-sm tracking-widest uppercase mb-2">
                          DESCREVER DIVERGÊNCIA / RASURA
                        </h3>

                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                            QUAL O DESVIO CONSTATADO? *
                          </label>
                          <input
                            type="text"
                            value={tempDMM}
                            onChange={e => setTempDMM(e.target.value)}
                            placeholder="EX: DESENHO SEM MEDIDA DO CHANFRO DE ENTRADA"
                            className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500 focus:outline-none rounded-xl px-4 py-3.5 text-base text-white font-bold uppercase placeholder:text-slate-600"
                          />
                        </div>

                        <div className="pt-4 flex gap-3">
                          <button
                            onClick={() => {
                              setPayload(prev => ({ ...prev, usoDMM: "SIM" }));
                              setTempDMM("");
                            }}
                            className="w-1/3 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-white font-bold py-3.5 rounded-xl text-sm transition"
                          >
                            CANCELAR
                          </button>
                          <button
                            onClick={salvarDMMForm}
                            className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-bold py-3.5 rounded-xl text-sm shadow-lg hover:shadow-orange-900/30 transition transform active:scale-95"
                          >
                            PRÓXIMO
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* 6. PASSO 5: TROCA DE FERRAMENTA */}
                {step === 5 && (
                  <motion.div
                    key="step5"
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -15 }}
                    className="space-y-6"
                  >
                    <div className="bg-blue-600 text-white p-6 rounded-2xl border-l-8 border-blue-800 shadow-lg text-center">
                      <h2 className="text-xl md:text-2xl font-black tracking-tight leading-snug uppercase">
                        HOUVE TROCA DE FERRAMENTA?
                      </h2>
                    </div>

                    {payload.trocaFerramenta === "NÃO" && !tempTrocaOQue && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button
                          onClick={() => setTrocaConformidade(true)}
                          className="bg-blue-600 hover:bg-blue-500 border border-blue-500 hover:border-blue-400 text-white font-black text-2xl py-8 rounded-2xl shadow-xl transition transform active:scale-95 flex flex-col items-center justify-center gap-2"
                        >
                          <Wrench size={36} />
                          <span>SIM</span>
                        </button>
                        <button
                          onClick={() => setTrocaConformidade(false)}
                          className="bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 hover:border-emerald-400 text-white font-black text-2xl py-8 rounded-2xl shadow-xl transition transform active:scale-95 flex flex-col items-center justify-center gap-2"
                        >
                          <CheckCircle2 size={36} />
                          <span>NÃO</span>
                        </button>
                      </div>
                    )}

                    {/* Formulário se HOUVE Troca */}
                    {payload.trocaFerramenta === "SIM" && (
                      <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-4">
                        <h3 className="text-blue-400 font-bold text-sm tracking-widest uppercase mb-2">
                          REGISTRAR TROCA DE FERRAMENTA
                        </h3>

                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                              O QUE FOI TROCADO? *
                            </label>
                            <input
                              type="text"
                              value={tempTrocaOQue}
                              onChange={e => setTempTrocaOQue(e.target.value)}
                              placeholder="EX: PASTILHA DO ACABAMENTO - SUPORTE T3"
                              className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 focus:outline-none rounded-xl px-4 py-3.5 text-base text-white font-bold uppercase placeholder:text-slate-600"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                              QUEM REALIZOU A TROCA? *
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[140px] overflow-y-auto pr-1.5 custom-scrollbar">
                              {colaboradores.map(c => (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => setTempTrocaQuem(c)}
                                  className={`px-3 py-2.5 rounded-xl font-bold text-xs uppercase border transition ${
                                    tempTrocaQuem === c
                                      ? "bg-blue-600 border-blue-500 text-white"
                                      : "bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                                  }`}
                                >
                                  {c}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="pt-4 flex gap-3">
                          <button
                            onClick={() => {
                              setPayload(prev => ({ ...prev, trocaFerramenta: "NÃO" }));
                              setTempTrocaOQue("");
                              setTempTrocaQuem("");
                            }}
                            className="w-1/3 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-white font-bold py-3.5 rounded-xl text-sm transition"
                          >
                            CANCELAR
                          </button>
                          <button
                            onClick={salvarTrocaForm}
                            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl text-sm shadow-lg hover:shadow-blue-900/30 transition transform active:scale-95"
                          >
                            FINALIZAR
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* 7. PAINEL DE HISTÓRICO */}
                {step === "historico" && (
                  <motion.div
                    key="historico"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="space-y-6"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h2 className="text-xl font-black text-white flex items-center gap-2">
                          <History className="text-blue-500" size={22} /> HISTÓRICO DE AÇÕES
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">Histórico completo de medições registradas</p>
                      </div>
                      <button
                        onClick={resetarFluxo}
                        className="bg-slate-900 hover:bg-slate-950 text-slate-400 hover:text-white px-4 py-2 rounded-xl text-xs font-bold border border-slate-800 transition"
                      >
                        FECHAR
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                      <div className="md:col-span-2">
                        <input
                          type="text"
                          placeholder="🔍 PESQUISAR POR MÁQUINA, PROBLEMA, RESPONSÁVEL..."
                          value={buscaHistorico}
                          onChange={e => setBuscaHistorico(e.target.value)}
                          className="w-full bg-slate-950 border-2 border-slate-800 focus:border-blue-500 focus:outline-none rounded-xl px-4 py-3 text-sm font-bold uppercase text-white placeholder:text-slate-600 transition-all"
                        />
                      </div>
                      <div className="relative">
                        <input
                          type="date"
                          value={dataFiltroHistorico}
                          onChange={e => setDataFiltroHistorico(e.target.value)}
                          className="w-full bg-slate-950 border-2 border-slate-800 focus:border-blue-500 focus:outline-none rounded-xl px-4 py-3 text-sm font-bold text-white transition-all"
                        />
                        {dataFiltroHistorico && (
                          <button
                            onClick={() => setDataFiltroHistorico("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white font-black text-xs cursor-pointer bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700"
                          >
                            LIMPAR
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3.5 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
                      {historico
                        .slice()
                        .reverse()
                        .filter(item => {
                          // Garante que o histórico mostre apenas as Não Conformidades (NC) dimensionais
                          const isProblem = item.problema && item.problema !== "OK" && item.problema !== "CONFORME";
                          if (!isProblem) return false;

                          const query = buscaHistorico.toLowerCase().trim();
                          const cleanQuery = query.replace(/^m[aá]quina\s+/g, "").replace(/^maq[:\s]*/g, "");

                          const matchesText = (
                            item.maquina.toLowerCase().includes(cleanQuery) ||
                            item.maquina.toLowerCase().includes(query) ||
                            `maquina ${item.maquina.toLowerCase()}`.includes(query) ||
                            `maq: ${item.maquina.toLowerCase()}`.includes(query) ||
                            `maq ${item.maquina.toLowerCase()}`.includes(query) ||
                            item.problema.toLowerCase().includes(query) ||
                            item.responsavel.toLowerCase().includes(query) ||
                            (item.solucao && item.solucao.toLowerCase().includes(query))
                          );

                          if (!dataFiltroHistorico) return matchesText;

                          // item.data está no formato dd/MM/yyyy. O input de data está no formato yyyy-mm-dd
                          const [ano, mes, dia] = dataFiltroHistorico.split("-");
                          const dataFormatada = `${dia}/${mes}/${ano}`;
                          return matchesText && item.data === dataFormatada;
                        })
                        .map((item, idx) => {
                          const isProblem = item.problema && item.problema !== "OK" && item.problema !== "CONFORME";
                          return (
                            <div
                              key={idx}
                              className={`p-4 rounded-2xl border ${
                                isProblem
                                  ? "bg-red-950/20 border-red-900/40 border-l-4 border-l-red-500"
                                  : "bg-slate-900/30 border-slate-800/80 border-l-4 border-l-emerald-500"
                              } text-left flex flex-col gap-2`}
                            >
                              <div className="flex justify-between items-center">
                                <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] font-mono border border-slate-700/60 flex items-center gap-1">
                                  <Clock size={10} /> {item.data} às {item.hora}
                                </span>
                                <span className="text-xs font-mono font-black text-blue-400">
                                  MAQ: {item.maquina}
                                </span>
                              </div>
                              <div className="text-sm">
                                <span className="text-slate-400 text-xs uppercase font-bold block mb-0.5">PROBLEMA / STATUS:</span>
                                <span className={`font-black ${isProblem ? "text-red-400" : "text-emerald-400"}`}>
                                  {item.problema}
                                </span>
                              </div>
                              <div className="text-xs bg-slate-950/40 p-2.5 rounded-xl border border-slate-900">
                                <div className="mb-1 text-slate-400">
                                  <span className="font-bold">RESPONSÁVEL:</span> {item.responsavel}
                                </div>
                                <div className="text-slate-300">
                                  <span className="font-bold text-slate-400">SOLUÇÃO:</span> {item.solucao || "-"}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      {historico.length === 0 && (
                        <div className="text-center py-12 text-slate-500 font-bold">
                          Nenhum registro encontrado no histórico.
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* 8. PAINEL DE SOLUÇÃO DE NCs PENDENTES */}
                {step === "resolverNC" && (
                  <motion.div
                    key="resolverNC"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="space-y-6"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h2 className="text-xl font-black text-red-400 flex items-center gap-2">
                          <ShieldAlert size={22} /> RESOLVER NÃO CONFORMIDADES (NC)
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">Preencha as soluções para as NCs em aberto</p>
                      </div>
                      <button
                        onClick={resetarFluxo}
                        className="bg-slate-900 hover:bg-slate-950 text-slate-400 hover:text-white px-4 py-2 rounded-xl text-xs font-bold border border-slate-800 transition"
                      >
                        FECHAR
                      </button>
                    </div>

                    <div className="space-y-4 max-h-[440px] overflow-y-auto pr-1 custom-scrollbar">
                      {ncPendentes.map(nc => (
                        <div
                          key={nc.linha}
                          className="p-5 bg-slate-900/70 rounded-2xl border-2 border-red-900/30 border-l-8 border-l-red-600 flex flex-col gap-4 text-left shadow-lg"
                        >
                          <div>
                            <span className="bg-red-950/80 text-red-400 border border-red-900/50 px-2.5 py-0.5 rounded text-[10px] font-mono tracking-wider font-bold">
                              MAQ: {nc.maquina} | {nc.data} às {nc.hora}
                            </span>
                            <div className="text-slate-400 text-xs font-bold uppercase mt-2">
                              Identificado por: <span className="text-red-400">{nc.responsavel}</span>
                            </div>
                            <div className="text-lg font-black text-slate-100 mt-1 uppercase">
                              {nc.problema}
                            </div>
                          </div>

                          <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 space-y-4">
                            <div className="space-y-1.5">
                              <label className="block text-xs font-black text-slate-300 uppercase tracking-wider">
                                O QUE FOI FEITO PARA RESOLVER?
                              </label>
                              <input
                                type="text"
                                id={`solucao_input_${nc.linha}`}
                                placeholder="EX: REGULAGEM DO COMPRIMENTO DE FERRAMENTA T2 (+0.08MM)"
                                className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:outline-none rounded-xl px-4 py-3 text-sm text-white font-bold uppercase placeholder:text-slate-600"
                                onKeyDown={e => {
                                  if (e.key === "Enter") {
                                    const val = (e.target as HTMLInputElement).value;
                                    const quem = quemResolveuNC[nc.linha];
                                    if (!quem) {
                                      alert("POR FAVOR, SELECIONE O COLABORADOR QUE RESOLVEU A NÃO CONFORMIDADE!");
                                      return;
                                    }
                                    resolverNCOnServer(nc.linha, val, quem);
                                  }
                                }}
                              />
                            </div>

                            <div className="space-y-1.5 border-t border-slate-900 pt-3">
                              <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1">
                                QUEM RESOLVEU? (CLIQUE PARA SELECIONAR):
                              </label>
                              <div className="flex flex-wrap gap-1.5">
                                {colaboradores.map(colab => {
                                  const isSelected = quemResolveuNC[nc.linha] === colab;
                                  return (
                                    <button
                                      key={colab}
                                      type="button"
                                      onClick={() => setQuemResolveuNC(prev => ({ ...prev, [nc.linha]: colab }))}
                                      className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all duration-150 cursor-pointer ${
                                        isSelected
                                          ? "bg-blue-600 text-white border border-blue-400 shadow-md shadow-blue-950/50"
                                          : "bg-slate-950 border border-slate-800 text-slate-500 hover:text-white hover:bg-slate-900"
                                      }`}
                                    >
                                      {colab}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <button
                              onClick={() => {
                                const input = document.getElementById(`solucao_input_${nc.linha}`) as HTMLInputElement;
                                const val = input ? input.value : "";
                                const quem = quemResolveuNC[nc.linha];
                                if (!val.trim()) {
                                  alert("DESCREVA A SOLUÇÃO ADOTADA!");
                                  return;
                                }
                                if (!quem) {
                                  alert("POR FAVOR, SELECIONE O COLABORADOR QUE RESOLVEU A NÃO CONFORMIDADE!");
                                  return;
                                }
                                resolverNCOnServer(nc.linha, val, quem);
                              }}
                              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl text-sm transition transform active:scale-95 flex items-center justify-center gap-2 shadow"
                            >
                              <CheckCircle2 size={16} /> SALVAR SOLUÇÃO
                            </button>
                          </div>
                        </div>
                      ))}

                      {ncPendentes.length === 0 && (
                        <div className="text-center py-12 text-slate-500 font-bold">
                          Nenhuma Não Conformidade pendente!
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* 9. TELA DE CONFIGURAÇÕES DE CADASTRO */}
                {step === "config" && (
                  <motion.div
                    key="config"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="space-y-6 text-left"
                  >
                    <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                      <div>
                        <h2 className="text-xl font-black text-yellow-500 flex items-center gap-2">
                          <Sliders size={22} /> CADASTRO DA FÁBRICA
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">Gerenciamento de operadores e máquinas</p>
                      </div>
                      <button
                        onClick={resetarFluxo}
                        className="bg-slate-900 hover:bg-slate-950 text-slate-400 hover:text-white px-4 py-2 rounded-xl text-xs font-bold border border-slate-800 transition"
                      >
                        FECHAR
                      </button>
                    </div>

                    <div className={`grid grid-cols-1 gap-6 ${
                      setorSelecionado 
                        ? (isAdmin ? "md:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-2") 
                        : "max-w-xl mx-auto w-full"
                    }`}>
                      {/* Colaboradores */}
                      {setorSelecionado && (
                        <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-800 space-y-4 flex flex-col">
                          <h3 className="font-bold text-sm tracking-wider text-blue-400 uppercase">Colaboradores</h3>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="NOVO OPERADOR..."
                              value={novoColaborador}
                              onChange={e => setNovoColaborador(e.target.value)}
                              onKeyDown={e => e.key === "Enter" && adicionarColaborador()}
                              className="flex-1 bg-slate-950 border border-slate-800 focus:border-blue-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm font-bold uppercase text-white"
                            />
                            <button
                              onClick={adicionarColaborador}
                              className="bg-blue-600 hover:bg-blue-500 text-white font-bold p-3 rounded-xl transition flex items-center justify-center shadow"
                            >
                              <Plus size={18} />
                            </button>
                          </div>
                          <div className="flex-1 max-h-[220px] overflow-y-auto pr-1.5 custom-scrollbar space-y-1.5">
                            {colaboradores.map(colab => (
                              <div
                                key={colab}
                                className="bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800/60 flex justify-between items-center font-bold text-xs"
                              >
                                <span className="uppercase">{colab}</span>
                                <button
                                  onClick={() => removerColaborador(colab)}
                                  className="text-slate-500 hover:text-red-400 transition"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Máquinas */}
                      {setorSelecionado && (
                        <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-800 space-y-4 flex flex-col">
                          <h3 className="font-bold text-sm tracking-wider text-blue-400 uppercase">Máquinas</h3>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="CÓDIGO MÁQUINA..."
                              value={novaMaquina}
                              onChange={e => setNovaMaquina(e.target.value)}
                              onKeyDown={e => e.key === "Enter" && adicionarMaquina()}
                              className="flex-1 bg-slate-950 border border-slate-800 focus:border-blue-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm font-bold uppercase text-white"
                            />
                            <button
                              onClick={adicionarMaquina}
                              className="bg-blue-600 hover:bg-blue-500 text-white font-bold p-3 rounded-xl transition flex items-center justify-center shadow"
                            >
                              <Plus size={18} />
                            </button>
                          </div>
                          <div className="flex-1 max-h-[220px] overflow-y-auto pr-1.5 custom-scrollbar space-y-1.5">
                            {maquinas.map(maq => (
                              <div
                                key={maq}
                                className="bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800/60 flex justify-between items-center font-bold text-xs font-mono"
                              >
                                <span className="uppercase text-blue-400">{maq}</span>
                                <button
                                  onClick={() => removerMaquina(maq)}
                                  className="text-slate-500 hover:text-red-400 transition"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Projetos / Setores (Apenas para Admin "8619" ou se setorSelecionado é nulo) */}
                      {(isAdmin || !setorSelecionado) && (
                        <div className={`bg-slate-900/50 p-5 rounded-2xl border border-slate-800 space-y-4 flex flex-col ${setorSelecionado ? "md:col-span-2 lg:col-span-1" : "w-full"}`}>
                          <h3 className="font-bold text-sm tracking-wider text-blue-400 uppercase flex items-center gap-1.5">
                            <Lock size={15} className="text-yellow-500 animate-pulse" /> Projetos & Setores
                          </h3>
                          
                          {/* Form de Criação */}
                          <div className="space-y-2 p-3 bg-slate-950/40 rounded-xl border border-slate-800/80">
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Novo Setor / Projeto</div>
                            <input
                              type="text"
                              placeholder="Nome do Setor..."
                              value={novoSetorTitulo}
                              onChange={e => setNovoSetorTitulo(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 focus:outline-none rounded-xl px-3 py-2 text-xs font-bold uppercase text-white"
                            />
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Senha do Setor..."
                                value={novoSetorSenha}
                                onChange={e => setNovoSetorSenha(e.target.value)}
                                className="flex-1 bg-slate-950 border border-slate-800 focus:border-blue-500 focus:outline-none rounded-xl px-3 py-2 text-xs font-bold text-white"
                              />
                              <button
                                onClick={criarNovoSetor}
                                className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-2 rounded-xl transition flex items-center justify-center shadow text-xs uppercase"
                                title="Criar novo setor"
                              >
                                Criar
                              </button>
                            </div>
                          </div>

                          {/* Lista de Setores */}
                          <div className="flex-1 max-h-[220px] overflow-y-auto pr-1.5 custom-scrollbar space-y-1.5">
                            {setores.map(s => {
                              const isEditing = setorEmEdicao?.id === s.id;
                              return (
                                <div
                                  key={s.id}
                                  className="bg-slate-950 p-3 rounded-xl border border-slate-800/60 flex flex-col gap-2 font-bold text-xs"
                                >
                                  {isEditing ? (
                                    <div className="space-y-2">
                                      <div className="text-[9px] text-yellow-500 uppercase">Editando Setor</div>
                                      <input
                                        type="text"
                                        value={editSetorTitulo}
                                        onChange={e => setEditSetorTitulo(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 focus:outline-none rounded-lg px-2.5 py-1.5 text-xs text-white uppercase font-bold"
                                      />
                                      <input
                                        type="text"
                                        value={editSetorSenha}
                                        onChange={e => setEditSetorSenha(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 focus:outline-none rounded-lg px-2.5 py-1.5 text-xs text-white font-bold"
                                        placeholder="Senha do Setor"
                                      />
                                      <div className="space-y-1">
                                        <label className="text-[8px] text-slate-500 uppercase font-black block text-left">Colaboradores (Separados por vírgula)</label>
                                        <input
                                          type="text"
                                          value={editSetorColaboradores}
                                          onChange={e => setEditSetorColaboradores(e.target.value)}
                                          className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 focus:outline-none rounded-lg px-2.5 py-1.5 text-xs text-white uppercase font-bold"
                                          placeholder="Ex: OPERADOR 1, OPERADOR 2"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[8px] text-slate-500 uppercase font-black block text-left">Máquinas (Separadas por vírgula)</label>
                                        <input
                                          type="text"
                                          value={editSetorMaquinas}
                                          onChange={e => setEditSetorMaquinas(e.target.value)}
                                          className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 focus:outline-none rounded-lg px-2.5 py-1.5 text-xs text-white uppercase font-bold font-mono"
                                          placeholder="Ex: 3, 4, 5"
                                        />
                                      </div>
                                      <div className="flex gap-1.5 justify-end">
                                        <button
                                          onClick={() => setSetorEmEdicao(null)}
                                          className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded text-[10px] uppercase transition"
                                        >
                                          Cancelar
                                        </button>
                                        <button
                                          onClick={salvarEdicaoSetor}
                                          className="bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1 rounded text-[10px] uppercase transition"
                                        >
                                          Salvar
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex justify-between items-start gap-1">
                                      <div className="flex flex-col">
                                        <span className="uppercase text-slate-200 truncate max-w-[130px]" title={s.titulo}>
                                          {s.titulo}
                                        </span>
                                        <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1.5">
                                          Senha:{" "}
                                          <span
                                            onClick={() => setRevelados(prev => ({ ...prev, [s.id]: !prev[s.id] }))}
                                            className="text-yellow-500 font-bold cursor-pointer select-none border-b border-dashed border-yellow-500/40 hover:text-yellow-400 transition flex items-center gap-1"
                                            title="Clique para revelar/ocultar senha"
                                          >
                                            {revelados[s.id] ? (s.senha || "N/A") : "••••"} <span className="text-[10px] opacity-70">👁️</span>
                                          </span>
                                        </span>
                                      </div>
                                      <div className="flex gap-1">
                                        <button
                                          onClick={() => {
                                            setSetorEmEdicao(s);
                                            setEditSetorTitulo(s.titulo);
                                            setEditSetorSenha(s.senha || "");
                                            setEditSetorMaquinas((s.maquinas || []).join(","));
                                            setEditSetorColaboradores((s.colaboradores || []).join(","));
                                          }}
                                          className="text-slate-400 hover:text-blue-400 p-1 transition"
                                          title="Editar setor"
                                        >
                                          ✏️
                                        </button>
                                        <button
                                          onClick={() => deletarSetor(s.id)}
                                          className="text-slate-500 hover:text-red-400 p-1 transition"
                                          title="Deletar setor"
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* 10. TELA DE LIBERAÇÃO DE DIVERGÊNCIAS (Supervisor) */}
                {step === "liberarDiv" && (
                  <motion.div
                    key="liberarDiv"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="space-y-6"
                  >
                    <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                      <div>
                        <h2 className="text-xl font-black text-orange-400 flex items-center gap-2">
                          <Lock size={22} className="text-orange-500" /> GERENCIAR DIVERGÊNCIAS (DMM)
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">Assinatura de Supervisor para liberação, comentários ou exclusão de registros</p>
                      </div>
                      <button
                        onClick={resetarFluxo}
                        className="bg-slate-900 hover:bg-slate-950 text-slate-400 hover:text-white px-4 py-2 rounded-xl text-xs font-bold border border-slate-800 transition"
                      >
                        FECHAR
                      </button>
                    </div>
 
                    <div className="space-y-4 max-h-[440px] overflow-y-auto pr-1 custom-scrollbar">
                      {desvios.map(d => (
                        <div
                          key={d.maq}
                          className="p-5 bg-slate-900/70 rounded-2xl border-2 border-orange-900/30 border-l-8 border-l-orange-500 flex flex-col gap-4 text-left shadow-lg"
                        >
                          <div>
                            <div className="flex justify-between items-center">
                              <span className="bg-orange-950/80 text-orange-400 border border-orange-900/50 px-2.5 py-0.5 rounded text-[10px] font-mono tracking-wider font-bold">
                                MÁQUINA: {d.maq}
                              </span>
                              {d.linha !== undefined && (
                                <span className="text-[10px] text-slate-500 font-mono">
                                  ID REGISTRO: #{d.linha}
                                </span>
                              )}
                            </div>
                            <div className="text-lg font-black text-slate-100 mt-2 uppercase">
                              MOTIVO: {d.motivo}
                            </div>
                            {d.comentarioSupervisor && (
                              <div className="mt-2.5 text-xs bg-slate-950/80 px-3.5 py-2.5 rounded-xl border border-slate-800 text-yellow-500 font-bold">
                                💬 COMENTÁRIO DO SUPERVISOR: {d.comentarioSupervisor}
                              </div>
                            )}
                          </div>

                          {/* Campo para Inserir/Editar Comentário */}
                          <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/60 space-y-2">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                              Adicionar / Alterar Comentário do Supervisor
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="EX: AJUSTADO PARAMETROS DO PROCESSO NA MAQUINA"
                                value={comentariosDivergencia[d.linha!] ?? ""}
                                onChange={e => setComentariosDivergencia(prev => ({ ...prev, [d.linha!]: e.target.value }))}
                                onKeyDown={e => {
                                  if (e.key === "Enter") {
                                    salvarComentarioSupervisor(d.linha!, comentariosDivergencia[d.linha!] ?? "");
                                  }
                                }}
                                className="flex-1 bg-slate-900 border border-slate-800 focus:border-yellow-500 focus:outline-none rounded-xl px-3.5 py-2.5 text-xs text-white uppercase font-bold"
                              />
                              <button
                                onClick={() => salvarComentarioSupervisor(d.linha!, comentariosDivergencia[d.linha!] ?? "")}
                                className="bg-yellow-600 hover:bg-yellow-500 text-white font-black px-4 py-2.5 rounded-xl text-xs transition active:scale-95 whitespace-nowrap shadow"
                              >
                                SALVAR
                              </button>
                            </div>
                          </div>

                          {/* Ações de Liberação e Exclusão */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                            <button
                              onClick={() => liberarDivergenciaOnServer(d.maq)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3.5 rounded-xl text-xs transition transform active:scale-95 flex items-center justify-center gap-1.5 shadow"
                            >
                              <CheckCircle2 size={14} /> LIBERAR MÁQUINA (RESOLVER)
                            </button>
                            <button
                              onClick={() => excluirDivergenciaPeloSupervisor(d.linha!)}
                              className="bg-red-700 hover:bg-red-600 text-white font-black py-3.5 rounded-xl text-xs transition transform active:scale-95 flex items-center justify-center gap-1.5 shadow"
                            >
                              <Trash2 size={14} /> DELETAR DIVERGÊNCIA
                            </button>
                          </div>
                        </div>
                      ))}
 
                      {desvios.length === 0 && (
                        <div className="text-center py-12 text-slate-500 font-bold">
                          Nenhuma divergência DMM pendente de liberação no momento!
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* 11. PLANILHA DE REGISTROS COMPLETA (Banco de dados industrial) */}
                {step === "registros" && (() => {
                  const todasMaquinasRegistradas = Array.from(
                    new Set([
                      ...maquinas,
                      ...registrosCompletos.map(r => r.maquina)
                    ])
                  ).filter(Boolean).sort();

                  return (
                    <motion.div
                      key="registros"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="space-y-6 text-left"
                    >
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
                        <div>
                          <h2 className="text-xl font-black text-emerald-400 flex items-center gap-2">
                            <History size={22} className="text-emerald-500" /> PLANILHA DE REGISTROS ARQUIVADOS
                          </h2>
                          <p className="text-xs text-slate-400 mt-0.5">Banco de dados completo de medições, desvios e trocas de ferramentas</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={exportarCSV}
                            className="bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow cursor-pointer"
                          >
                            📥 EXPORTAR EXCEL (CSV)
                          </button>
                          <button
                            onClick={resetarFluxo}
                            className="bg-slate-900 hover:bg-slate-950 text-slate-400 hover:text-white px-4 py-2 rounded-xl text-xs font-bold border border-slate-800 transition cursor-pointer"
                          >
                            FECHAR
                          </button>
                        </div>
                      </div>

                      {/* Filtros da Planilha */}
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
                        <div className="md:col-span-1">
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Pesquisa Geral</label>
                          <input
                            type="text"
                            placeholder="🔍 COLABORADOR, PEÇA, NC..."
                            value={buscaRegistros}
                            onChange={e => setBuscaRegistros(e.target.value)}
                            className="w-full bg-slate-950 border-2 border-slate-800 focus:border-blue-500 focus:outline-none rounded-xl px-4 py-2 text-xs font-bold uppercase text-white placeholder:text-slate-650 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Filtrar Setor</label>
                          <select
                            value={setorSelecionado?.id || ""}
                            onChange={e => {
                              const selectedId = e.target.value;
                              if (selectedId === "") {
                                setSetorSelecionado(null);
                                localStorage.removeItem("setorAtivoId");
                                carregarCadastro("");
                                carregarAlertas("");
                                carregarMonitoramento("");
                              } else {
                                const s = setores.find(x => x.id === selectedId);
                                if (s) {
                                  setSetorSelecionado(s);
                                  localStorage.setItem("setorAtivoId", s.id);
                                  carregarCadastro(s.id);
                                  carregarAlertas(s.id);
                                  carregarMonitoramento(s.id);
                                }
                              }
                            }}
                            className="w-full bg-slate-950 border-2 border-slate-800 focus:border-blue-500 focus:outline-none rounded-xl px-4 py-2 text-xs font-bold text-white transition-all uppercase cursor-pointer"
                          >
                            <option value="">TODOS OS SETORES</option>
                            {setores.map(s => (
                              <option key={s.id} value={s.id}>{s.titulo}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Filtrar Máquina</label>
                          <select
                            value={maquinaFiltroRegistros}
                            onChange={e => setMaquinaFiltroRegistros(e.target.value)}
                            className="w-full bg-slate-950 border-2 border-slate-800 focus:border-blue-500 focus:outline-none rounded-xl px-4 py-2 text-xs font-bold text-white transition-all uppercase cursor-pointer"
                          >
                            <option value="">TODAS AS MÁQUINAS</option>
                            {todasMaquinasRegistradas.map(m => (
                              <option key={m} value={m}>MÁQUINA {m}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Data Inicial</label>
                          <input
                            type="date"
                            value={dataFiltroRegistrosInicio}
                            onChange={e => setDataFiltroRegistrosInicio(e.target.value)}
                            className="w-full bg-slate-950 border-2 border-slate-800 focus:border-blue-500 focus:outline-none rounded-xl px-4 py-2 text-xs font-bold text-white transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Data Final</label>
                          <div className="relative">
                            <input
                              type="date"
                              value={dataFiltroRegistrosFim}
                              onChange={e => setDataFiltroRegistrosFim(e.target.value)}
                              className="w-full bg-slate-950 border-2 border-slate-800 focus:border-blue-500 focus:outline-none rounded-xl px-4 py-2 text-xs font-bold text-white transition-all"
                            />
                            {(dataFiltroRegistrosInicio || dataFiltroRegistrosFim || maquinaFiltroRegistros) && (
                              <button
                                onClick={() => {
                                  setDataFiltroRegistrosInicio("");
                                  setDataFiltroRegistrosFim("");
                                  setMaquinaFiltroRegistros("");
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white font-black text-xs cursor-pointer bg-slate-900 px-1 py-0.5 rounded border border-slate-800"
                              >
                                X
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Tabela de Registros Brutos */}
                      <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40 shadow-xl">
                        <div className="overflow-x-auto max-h-[420px] custom-scrollbar">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono text-[10px]">
                                <th className="py-3.5 px-4 font-black">Data / Hora (Colorido)</th>
                                <th className="py-3.5 px-4 font-black">Setor</th>
                                <th className="py-3.5 px-4 font-black">Colaborador</th>
                                <th className="py-3.5 px-4 font-black text-center">MAQ</th>
                                <th className="py-3.5 px-4 font-black">Não Conformidade (NC)</th>
                                <th className="py-3.5 px-4 font-black">Modelo/Cód. Peça</th>
                                <th className="py-3.5 px-4 font-black">Divergência (DMM)</th>
                                <th className="py-3.5 px-4 font-black">Troca Ferramenta</th>
                                <th className="py-3.5 px-4 font-black">Resolvido por (Clicável)</th>
                                <th className="py-3.5 px-4 font-black text-right whitespace-nowrap">
                                  <span className="inline-flex items-center gap-1 justify-end">
                                    AÇÕES <Lock size={12} className="text-slate-500" />
                                  </span>
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-900 font-medium">
                              {registrosFiltrados.map((r, idx) => {
                                const isProblem = r.conforme === "NÃO" || (r.naoConformidade && r.naoConformidade !== "OK" && r.naoConformidade !== "-");
                                const isDMMDesvio = r.usoDMM === "NÃO";
                                const rSetorName = setores.find(s => s.id === (r.setorId || "t-automatico"))?.titulo || "GERAL";

                                return (
                                  <tr key={r.linha ?? idx} className="hover:bg-slate-900/40 transition">
                                    <td className="py-3 px-4 whitespace-nowrap">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-lg">
                                          {r.data}
                                        </span>
                                        {isProblem || isDMMDesvio ? (
                                          <span className="text-[11px] font-black text-red-400 bg-red-950/90 border border-red-700/60 px-2.5 py-1 rounded-lg font-mono tracking-wider shadow-md shadow-red-950 animate-pulse flex items-center gap-1">
                                            ⚠️ {r.hora.substring(0, 5)}
                                          </span>
                                        ) : (
                                          <span className="text-[11px] font-black text-cyan-400 bg-cyan-950/90 border border-cyan-700/40 px-2.5 py-1 rounded-lg font-mono tracking-wider shadow-md shadow-cyan-950 flex items-center gap-1">
                                            ⏱️ {r.hora.substring(0, 5)}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-3 px-4 font-bold uppercase whitespace-nowrap text-slate-400 text-[10px]">
                                      <span className="bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                                        {rSetorName.replace("SISTEMA DIMENSIONAL", "").trim()}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 font-bold uppercase whitespace-nowrap text-slate-200">{r.colaborador}</td>
                                    <td className="py-3 px-4 font-mono font-black text-center text-blue-400">{r.maquina}</td>
                                    <td className="py-3 px-4 max-w-[200px] truncate uppercase">
                                      {isProblem ? (
                                        <span className="text-red-400 font-bold block text-xs" title={r.naoConformidade}>
                                          {r.naoConformidade}
                                        </span>
                                      ) : (
                                        <span className="text-slate-500 font-mono">-</span>
                                      )}
                                      {r.solucao && (
                                        <span className="text-[10px] text-emerald-400 block font-semibold truncate mt-0.5" title={`Solução: ${r.solucao}`}>
                                          S: {r.solucao}
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-3 px-4 uppercase whitespace-nowrap">
                                      {r.modeloPeca !== "-" || r.codigoPeca !== "-" ? (
                                        <span className="text-slate-300">
                                          {r.modeloPeca} {r.codigoPeca !== "-" ? `(${r.codigoPeca})` : ""}
                                        </span>
                                      ) : (
                                        <span className="text-slate-600">-</span>
                                      )}
                                    </td>
                                    <td className="py-3 px-4">
                                      {isDMMDesvio ? (
                                        <div className="flex flex-col gap-0.5">
                                          <span className="text-orange-400 font-bold uppercase text-[10px]">DIVERGENTE</span>
                                          <span className="text-[10px] text-slate-500 italic block truncate max-w-[150px]" title={r.motivoDMM}>
                                            {r.motivoDMM}
                                          </span>
                                          {r.comentarioSupervisor && (
                                            <span className="text-[10px] text-yellow-500 font-bold block truncate max-w-[150px]" title={`Comentário: ${r.comentarioSupervisor}`}>
                                              💬 {r.comentarioSupervisor}
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-emerald-500 font-bold">CONFORME</span>
                                      )}
                                    </td>
                                    <td className="py-3 px-4">
                                      {r.trocaFerramenta === "SIM" ? (
                                        <div className="flex flex-col gap-0.5">
                                          <span className="text-blue-400 font-bold uppercase text-[10px] flex items-center gap-1">
                                            <Wrench size={10} /> SIM
                                          </span>
                                          <span className="text-[10px] text-slate-300 block truncate max-w-[130px]" title={r.oQueTrocou}>
                                            {r.oQueTrocou}
                                          </span>
                                          <span className="text-[9px] text-slate-500 block truncate" title={`Responsável: ${r.quemTrocou}`}>
                                            POR: {r.quemTrocou}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-slate-500 font-mono">-</span>
                                      )}
                                    </td>
                                    <td className="py-3 px-4 uppercase whitespace-nowrap">
                                      {isProblem ? (
                                        r.quemResolveu ? (
                                          <button
                                            onClick={() => {
                                              setRegistroSelecionadoParaResolvidoPor(r.linha!);
                                              setModalResolvidoPorOpen(true);
                                            }}
                                            className="bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-800/40 px-3 py-1.5 rounded-xl font-bold font-mono text-[10px] uppercase transition cursor-pointer flex items-center gap-1"
                                            title="Clique para alterar quem resolveu"
                                          >
                                            {r.quemResolveu} ✏️
                                          </button>
                                        ) : (
                                          <button
                                            onClick={() => {
                                              setRegistroSelecionadoParaResolvidoPor(r.linha!);
                                              setModalResolvidoPorOpen(true);
                                            }}
                                            className="bg-red-950/60 hover:bg-red-900/60 text-red-400 border border-red-800/40 px-3 py-1.5 rounded-xl font-bold text-[10px] uppercase transition cursor-pointer flex items-center gap-1 animate-pulse"
                                            title="Clique para selecionar quem resolveu"
                                          >
                                            Pendente ⚠️
                                          </button>
                                        )
                                      ) : (
                                        <span className="text-slate-500 font-mono">-</span>
                                      )}
                                    </td>
                                    <td className="py-3 px-4 text-right whitespace-nowrap">
                                      <div className="flex items-center justify-end gap-1.5">
                                        {isDMMDesvio && (
                                          <button
                                            onClick={() => comentarDivergenciaPeloRegistro(r.linha!)}
                                            className="p-1.5 bg-slate-850 hover:bg-yellow-600 text-slate-400 hover:text-white rounded-lg transition cursor-pointer text-xs flex items-center justify-center gap-1 px-2.5 py-1.5 border border-slate-800"
                                            title="Comentar Divergência (Líder)"
                                          >
                                            <span>💬</span> <Lock size={10} className="text-yellow-500/80" />
                                          </button>
                                        )}
                                        <button
                                          onClick={() => excluirRegistroPeloRegistro(r.linha!)}
                                          className="p-1.5 bg-slate-850 hover:bg-red-600 text-slate-400 hover:text-white rounded-lg transition cursor-pointer flex items-center justify-center gap-1 px-2.5 py-1.5 border border-slate-800"
                                          title="Excluir Registro (Líder)"
                                        >
                                          <Trash2 size={11} /> <Lock size={10} className="text-red-500/80" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                              {registrosFiltrados.length === 0 && (
                                <tr>
                                  <td colSpan={10} className="text-center py-12 text-slate-500 font-bold uppercase font-sans">
                                    Nenhum registro encontrado com os filtros selecionados.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </motion.div>
                  );
                })()}

              </AnimatePresence>
            </div>
          </div>

          {/* Barra Lateral de Monitoramento (Monitoramento Lateral) */}
          {setorSelecionado && step !== "config" && (
            <div className="lg:col-span-4 space-y-6">
              
              {/* Bloco 1: Sem medir em 60 min */}
              <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-800/80 rounded-3xl p-5 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
                  <h3 className="font-mono text-xs font-black tracking-wider text-amber-500 flex items-center gap-2">
                    <Clock size={16} /> 🕒 SEM MEDIR EM 60 MIN (ANALISAR)
                  </h3>
                  <span className="bg-amber-950 text-amber-400 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                    {paradas.length} MAQ
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2 max-h-[250px] overflow-y-auto pr-1.5 custom-scrollbar font-mono text-sm">
                  {paradas.map(p => (
                    <div
                      key={p.maq}
                      className="bg-slate-900/40 border border-slate-800 px-4 py-2.5 rounded-xl flex justify-between items-center"
                    >
                      <span className="font-bold text-slate-200">MÁQUINA {p.maq}</span>
                      <span
                        className={`font-black px-2 py-0.5 rounded-lg text-xs ${
                          p.hora === "S/R"
                            ? "bg-slate-950 text-slate-500 border border-slate-800"
                            : "bg-red-950 text-red-400 border border-red-900/50"
                        }`}
                      >
                        {p.hora === "S/R" ? "SEM REGISTRO HOJE" : `Última: ${p.hora}`}
                      </span>
                    </div>
                  ))}
                  {paradas.length === 0 && (
                    <div className="text-center py-6 text-slate-500 font-bold text-xs uppercase">
                      Todas as máquinas em dia!
                    </div>
                  )}
                </div>
              </div>

              {/* Bloco 2: Divergências de DMM/Folha */}
              <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-800/80 rounded-3xl p-5 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
                  <button
                    onClick={() => verificarSenhaSupervisor(() => setStep("liberarDiv"))}
                    className="font-mono text-xs font-black tracking-wider text-red-500 flex items-center gap-2 hover:text-red-400 transition text-left"
                    title="Clique para liberar com senha de supervisor"
                  >
                    <Lock size={15} className="text-red-500 animate-pulse" /> 🚫 DIVERGÊNCIA NA FOLHA / DMM
                  </button>
                  <span className="bg-red-950 text-red-400 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                    {desvios.length} ALERTA
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2 max-h-[250px] overflow-y-auto pr-1.5 custom-scrollbar font-mono text-xs">
                  {desvios.map(d => (
                    <div
                      key={d.maq}
                      onClick={() => verificarSenhaSupervisor(() => setStep("liberarDiv"))}
                      className="bg-red-950/20 border border-red-900/30 hover:border-red-500 px-4 py-3 rounded-xl cursor-pointer transition flex flex-col gap-1 text-left group relative"
                    >
                      <div className="flex justify-between items-center font-bold">
                        <span className="text-red-400 group-hover:text-red-300 flex items-center gap-1">
                          <Lock size={12} className="text-red-500/80 animate-pulse" /> MAQ: {d.maq}
                        </span>
                        <div className="flex items-center gap-2">
                          {d.comentarioSupervisor && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                alert(`💬 COMENTÁRIO DO SUPERVISOR PARA MÁQUINA ${d.maq}:\n\n"${d.comentarioSupervisor}"`);
                              }}
                              className="p-1 bg-yellow-600 hover:bg-yellow-500 text-white rounded transition flex items-center justify-center cursor-pointer"
                              title="Ver comentário do supervisor"
                            >
                              <MessageSquare size={11} />
                            </button>
                          )}
                          <span className="text-[10px] bg-red-950 text-red-400 border border-red-900/60 px-2 py-0.5 rounded group-hover:bg-red-600 group-hover:text-white transition flex items-center gap-1">
                            <Lock size={9} /> LIBERAR
                          </span>
                        </div>
                      </div>
                      <div className="text-slate-300 text-[11px] truncate uppercase pr-12">
                        {d.motivo}
                      </div>
                    </div>
                  ))}
                  {desvios.length === 0 && (
                    <div className="text-center py-6 text-slate-500 font-bold text-xs uppercase">
                      Nenhuma divergência activa!
                    </div>
                  )}
                </div>
              </div>

              {/* Crédito sutil de engenharia - Limpo e discreto */}
              <div className="text-center text-[10px] font-mono text-slate-600 tracking-wider">
                SISTEMA TCNC OPERANDO VIA CLOUD INDUSTRIAL
              </div>

            </div>
          )}

        </div>
      </main>

      {/* ================= MODALS CUSTOMIZADOS (ANTI-SANDBOX BLOCK) ================= */}

      {/* 1. Modal de Senha do Supervisor */}
      {modalSenhaOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl text-left space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-2.5 text-yellow-500 border-b border-slate-800 pb-3">
              <Lock size={22} className="animate-pulse" />
              <h3 className="text-lg font-black uppercase tracking-wider">Acesso de Supervisor</h3>
            </div>
            
            <p className="text-xs text-slate-400 uppercase font-bold">
              ESTA FUNÇÃO É RESTRITA. DIGITE A SENHA DO SUPERVISOR PARA CONTINUAR:
            </p>

            <input
              type="text"
              name="pinCode"
              autoComplete="off"
              style={{ WebkitTextSecurity: "disc", textSecurity: "disc" }}
              value={modalSenhaInput}
              onChange={e => {
                setModalSenhaInput(e.target.value);
                setModalSenhaErro("");
              }}
              onKeyDown={e => {
                if (e.key === "Enter") confirmarModalSenha();
              }}
              placeholder="••••"
              className="w-full bg-slate-950 border-2 border-slate-800 focus:border-yellow-500 focus:outline-none rounded-2xl px-4 py-3.5 text-center text-xl font-mono tracking-widest text-white uppercase font-black"
              autoFocus
            />

            {modalSenhaErro && (
              <div className="text-red-500 text-xs font-black uppercase text-center animate-bounce">
                ⚠️ {modalSenhaErro}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setModalSenhaOpen(false)}
                className="w-1/2 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-white font-bold py-3.5 rounded-2xl text-xs transition uppercase"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarModalSenha}
                className="w-1/2 bg-yellow-600 hover:bg-yellow-500 text-white font-black py-3.5 rounded-2xl text-xs shadow-lg hover:shadow-yellow-900/30 transition uppercase"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal de Comentário de Divergência */}
      {modalComentarioOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl text-left space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-2.5 text-blue-500 border-b border-slate-800 pb-3">
              <MessageSquare size={22} />
              <h3 className="text-lg font-black uppercase tracking-wider">Comentar Divergência</h3>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-line uppercase">
              {modalComentarioMsg}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-400 uppercase">
                Comentário do Supervisor:
              </label>
              <textarea
                value={modalComentarioInput}
                onChange={e => setModalComentarioInput(e.target.value)}
                placeholder="DIGITE O COMENTÁRIO DO SUPERVISOR..."
                className="w-full h-24 bg-slate-950 border-2 border-slate-800 focus:border-blue-500 focus:outline-none rounded-2xl px-4 py-3 text-sm text-white font-bold uppercase resize-none placeholder:text-slate-600"
                autoFocus
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setModalComentarioOpen(false)}
                className="w-1/2 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-white font-bold py-3.5 rounded-2xl text-xs transition uppercase"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarModalComentario}
                className="w-1/2 bg-blue-600 hover:bg-blue-500 text-white font-black py-3.5 rounded-2xl text-xs shadow-lg hover:shadow-blue-900/30 transition uppercase"
              >
                Salvar Comentário
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modal de Confirmação Reutilizável */}
      {modalConfirmOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl text-left space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-2.5 text-red-500 border-b border-slate-800 pb-3">
              <AlertTriangle size={22} className="animate-pulse" />
              <h3 className="text-lg font-black uppercase tracking-wider">Confirmar Ação</h3>
            </div>

            <p className="text-sm text-slate-200 font-bold uppercase leading-relaxed text-center py-2">
              {modalConfirmMsg}
            </p>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setModalConfirmOpen(false)}
                className="w-1/2 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-white font-bold py-3.5 rounded-2xl text-xs transition uppercase"
              >
                Não
              </button>
              <button
                onClick={() => {
                  setModalConfirmOpen(false);
                  if (modalConfirmCallback) modalConfirmCallback();
                }}
                className="w-1/2 bg-red-600 hover:bg-red-500 text-white font-black py-3.5 rounded-2xl text-xs shadow-lg hover:shadow-red-900/30 transition uppercase"
              >
                Sim, Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Modal de Alerta Customizado (Substitui alert nativo) */}
      {modalAlertOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl text-left space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-2.5 text-blue-500 border-b border-slate-800 pb-3">
              <Info size={22} />
              <h3 className="text-lg font-black uppercase tracking-wider">Aviso do Sistema</h3>
            </div>

            <p className="text-sm text-slate-200 font-bold uppercase leading-relaxed text-center py-4">
              {modalAlertMsg}
            </p>

            <div className="pt-2">
              <button
                onClick={() => setModalAlertOpen(false)}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3.5 rounded-2xl text-sm shadow-lg hover:shadow-blue-900/30 transition uppercase cursor-pointer"
              >
                Ok, Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Modal de Acesso Unificado / Caixinha de Senha (SAIR / ADM / SETORES) */}
      {acessoModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl text-left space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-2.5 text-blue-500 border-b border-slate-800 pb-3">
              <Lock size={22} className="animate-pulse text-yellow-500" />
              <h3 className="text-lg font-black uppercase tracking-wider">Controle de Acesso / Sair</h3>
            </div>
            
            <p className="text-xs text-slate-400 uppercase font-bold text-center leading-relaxed">
              DIGITE A SENHA DE ACESSO PARA ENTRAR NO SISTEMA OU NO PAINEL ADMINISTRADOR:
            </p>

            <input
              type="text"
              name="acessoPin"
              autoComplete="off"
              style={{ WebkitTextSecurity: "disc", textSecurity: "disc" }}
              value={acessoSenhaInput}
              onChange={e => {
                setAcessoSenhaInput(e.target.value);
                setAcessoErro("");
              }}
              onKeyDown={e => {
                if (e.key === "Enter") processarAcessoModal();
              }}
              placeholder="••••"
              className="w-full bg-slate-950 border-2 border-slate-800 focus:border-blue-500 focus:outline-none rounded-2xl px-4 py-3.5 text-center text-xl font-mono tracking-widest text-white uppercase font-black"
              autoFocus
            />

            {acessoErro && (
              <div className="text-red-500 text-xs font-black uppercase text-center animate-bounce">
                ⚠️ {acessoErro}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => {
                  setAcessoModalOpen(false);
                  setAcessoSenhaInput("");
                  setAcessoErro("");
                }}
                className="bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-450 hover:text-white font-bold py-3.5 rounded-2xl text-xs transition uppercase cursor-pointer"
              >
                Voltar
              </button>
              <button
                onClick={processarAcessoModal}
                className="bg-blue-600 hover:bg-blue-500 text-white font-black py-3.5 rounded-2xl text-xs shadow-lg hover:shadow-blue-900/30 transition uppercase cursor-pointer"
              >
                Confirmar
              </button>
            </div>

            {setorSelecionado && (
              <div className="pt-3 border-t border-slate-800/80 text-center">
                <button
                  onClick={() => {
                    setAcessoModalOpen(false);
                    realizarLogoutCompleto();
                  }}
                  className="bg-red-950 hover:bg-red-900 text-red-400 hover:text-white font-black px-4 py-2 rounded-xl text-[10px] transition uppercase cursor-pointer flex items-center justify-center gap-1 mx-auto border border-red-900/50"
                >
                  🚪 DESCONECTAR DO SETOR ATUAL ({setorSelecionado.titulo.replace("SISTEMA DIMENSIONAL", "").trim()})
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. Modal de Senha do Setor Especificado */}
      {sectorAbertoParaSenha && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl text-left space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-2.5 text-blue-500 border-b border-slate-800 pb-3">
              <Lock size={22} className="text-yellow-500 animate-pulse" />
              <h3 className="text-base font-black uppercase tracking-wider truncate">
                Senha: {sectorAbertoParaSenha.titulo.replace("SISTEMA DIMENSIONAL", "").trim()}
              </h3>
            </div>

            <p className="text-xs text-slate-400 font-bold uppercase leading-relaxed text-center">
              Este setor de produção é restrito. Digite a senha de acesso específica do setor para continuar:
            </p>

            <input
              type="text"
              autoComplete="off"
              style={{ WebkitTextSecurity: "disc", textSecurity: "disc" }}
              value={sectorSenhaInput}
              onChange={e => {
                setSectorSenhaInput(e.target.value);
                setSectorSenhaError("");
              }}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  if (sectorSenhaInput.trim() === sectorAbertoParaSenha.senha) {
                    setSetorSelecionado(sectorAbertoParaSenha);
                    localStorage.setItem("setorAtivoId", sectorAbertoParaSenha.id);
                    carregarCadastro(sectorAbertoParaSenha.id);
                    carregarAlertas(sectorAbertoParaSenha.id);
                    carregarMonitoramento(sectorAbertoParaSenha.id);
                    setSectorAbertoParaSenha(null);
                    setSectorSenhaInput("");
                  } else {
                    setSectorSenhaError("SENHA INCORRETA!");
                  }
                }
              }}
              placeholder="••••"
              className="w-full bg-slate-950 border-2 border-slate-800 focus:border-blue-500 focus:outline-none rounded-2xl px-4 py-3.5 text-center text-xl font-mono tracking-widest text-white uppercase font-black"
              autoFocus
            />

            {sectorSenhaError && (
              <div className="text-red-500 text-xs font-black uppercase text-center animate-bounce">
                ⚠️ {sectorSenhaError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => {
                  setSectorAbertoParaSenha(null);
                  setSectorSenhaInput("");
                  setSectorSenhaError("");
                }}
                className="bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-450 hover:text-white font-bold py-3.5 rounded-2xl text-xs transition uppercase cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (sectorSenhaInput.trim() === sectorAbertoParaSenha.senha) {
                    setSetorSelecionado(sectorAbertoParaSenha);
                    localStorage.setItem("setorAtivoId", sectorAbertoParaSenha.id);
                    carregarCadastro(sectorAbertoParaSenha.id);
                    carregarAlertas(sectorAbertoParaSenha.id);
                    carregarMonitoramento(sectorAbertoParaSenha.id);
                    setSectorAbertoParaSenha(null);
                    setSectorSenhaInput("");
                  } else {
                    setSectorSenhaError("SENHA INCORRETA!");
                  }
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white font-black py-3.5 rounded-2xl text-xs shadow-lg hover:shadow-blue-900/30 transition uppercase cursor-pointer"
              >
                Entrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Modal "Quem Resolveu" - Click to Select (Photo 3) */}
      {modalResolvidoPorOpen && registroSelecionadoParaResolvidoPor !== null && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl text-left space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-2.5 text-emerald-500 border-b border-slate-800 pb-3">
              <CheckCircle2 size={22} className="text-emerald-500 animate-pulse" />
              <h3 className="text-base font-black uppercase tracking-wider">Quem resolveu a NC?</h3>
            </div>

            <p className="text-xs text-slate-400 font-bold uppercase leading-relaxed text-center">
              Selecione na lista de colaboradores abaixo quem foi o responsável pela resolução desta não conformidade:
            </p>

            <div className="max-h-[220px] overflow-y-auto pr-1.5 custom-scrollbar space-y-2 py-2">
              {colaboradores.map(c => (
                <button
                  key={c}
                  onClick={() => atualizarResolvidoPorPeloRegistro(registroSelecionadoParaResolvidoPor, c)}
                  className="w-full bg-slate-950 hover:bg-emerald-950/40 border border-slate-800 hover:border-emerald-700/50 text-slate-200 hover:text-emerald-400 font-bold p-3.5 rounded-xl text-xs transition uppercase flex items-center justify-between group cursor-pointer"
                >
                  <span>{c}</span>
                  <span className="text-[9px] bg-slate-900 text-slate-500 group-hover:bg-emerald-900 group-hover:text-emerald-400 px-2 py-0.5 rounded transition font-mono uppercase">
                    SELECIONAR ✓
                  </span>
                </button>
              ))}
              {colaboradores.length === 0 && (
                <div className="text-center py-6 text-slate-500 font-bold text-xs uppercase font-mono">
                  Cadastre colaboradores no painel para selecionar!
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-800/60">
              <button
                onClick={() => {
                  setModalResolvidoPorOpen(false);
                  setRegistroSelecionadoParaResolvidoPor(null);
                }}
                className="w-full bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-450 hover:text-white font-bold py-3.5 rounded-2xl text-xs transition uppercase cursor-pointer"
              >
                Voltar / Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
