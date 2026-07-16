export interface Registro {
  linha?: string | number; // Para controle no backend
  setorId?: string; // Setor a que pertence o registro
  data: string; // dd/MM/yyyy
  hora: string; // HH:mm:ss
  colaborador: string;
  maquina: string;
  conforme: 'SIM' | 'NÃO';
  naoConformidade: string;
  codigoPeca: string;
  responsavel: string; // Comunicou qual colaborador?
  usoDMM: 'SIM' | 'NÃO'; // Se existe divergência/rasura (SIM para Não existe, NÃO para Existe)
  motivoDMM: string;
  solucao: string;
  trocaFerramenta: 'SIM' | 'NÃO';
  oQueTrocou: string;
  quemTrocou: string;
  modeloPeca: string;
  comentarioSupervisor?: string; // Comentário adicionado pelo supervisor
  quemResolveu?: string; // Nome do colaborador que resolveu a NC
  timestamp?: number; // Timestamp para ordenação
}

export interface Setor {
  id: string;
  titulo: string;
  senha?: string;
  maquinas: string[];
  colaboradores: string[];
}

export interface AlertasResponse {
  ncPendentes: NCPendente[];
  historico: HistoricoItem[];
}

export interface NCPendente {
  linha: number;
  responsavel: string;
  problema: string;
  maquina: string;
  hora: string;
  data: string;
}

export interface HistoricoItem {
  data: string;
  hora: string;
  maquina: string;
  problema: string;
  responsavel: string;
  solucao: string;
}

export interface MonitoramentoResponse {
  paradas: ParadaItem[];
  desvios: DesvioItem[];
}

export interface ParadaItem {
  maq: string;
  hora: string; // horário da última ou "S/R"
}

export interface DesvioItem {
  maq: string;
  motivo: string;
  linha?: number;
  comentarioSupervisor?: string;
}

export interface CadastroResponse {
  colaboradores: string[];
  maquinas: string[];
}
