/**
 * Tipos do banco REDE27, espelhando supabase/migrations/.
 * Escrito a mao para nao depender de geracao no meio do desenvolvimento.
 * Para regerar depois:
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 */

export type StatusCorrida = 'aberta' | 'concluida' | 'cancelada';
export type TipoTransacao = 'credito' | 'debito';
export type Passo = 1 | 2 | 3 | 4 | 5;
export type StatusAlerta03 = 'ativo' | 'encerrado';
export type FormaPagamento = 'carteira' | 'dinheiro';
export type TipoChavePix = 'cnpj' | 'cpf' | 'celular' | 'email' | 'aleatoria';

export type CategoriaRow = {
  chave: string;
  nome: string;
  descricao: string;
  tarifa_base_centavos: number;
  preco_km_centavos: number;
  ordem: number;
  ativo: boolean;
  atualizado_em: string;
};

export type PassageiroRow = {
  id: string;
  cpf: string;
  nome: string;
  telefone: string;
  criado_em: string;
};

export type MotoristaRow = {
  id: string;
  nome: string;
  cpf: string;
  telefone: string;
  foto_perfil_url: string | null;
  foto_veiculo_url: string | null;
  veiculo_descricao: string;
  veiculo_placa: string;
  cidade_id: string | null;
  ativo: boolean;
  criado_em: string;
  /** Calculado pelo banco: sem as duas fotos o motorista nao aceita corrida. */
  cadastro_completo: boolean;
};

export type AdministradorRow = {
  id: string;
  nome: string;
  ativo: boolean;
  criado_em: string;
};

export type CidadeRow = {
  id: string;
  nome: string;
  uf: string;
  ativa: boolean;
  criada_em: string;
};

export type ConfiguracaoRow = {
  chave: string;
  valor: string;
  descricao: string;
  atualizado_em: string;
};

export type CarteiraRow = {
  id: string;
  passageiro_id: string;
  saldo_centavos: number;
  atualizado_em: string;
};

export type TransacaoRow = {
  id: string;
  carteira_id: string;
  tipo: TipoTransacao;
  valor_centavos: number;
  descricao: string;
  corrida_id: string | null;
  criado_em: string;
};

export type CorridaRow = {
  id: string;
  passageiro_id: string;
  categoria_chave: string;
  origem_texto: string;
  destino_texto: string;
  distancia_km: number;
  valor_estimado_centavos: number;
  valor_final_centavos: number | null;
  passo_atual: Passo;
  status: StatusCorrida;
  motorista_nome: string | null;
  motorista_id: string | null;
  cidade_id: string | null;
  origem_lat: number | null;
  origem_lng: number | null;
  destino_lat: number | null;
  destino_lng: number | null;
  distancia_aproximada: boolean;
  taxa_empresa_percentual: number | null;
  valor_motorista_centavos: number | null;
  valor_empresa_centavos: number | null;
  forma_pagamento: FormaPagamento;
  /** Somente dinheiro: com quanto o passageiro disse que vai pagar. */
  valor_pago_centavos: number | null;
  /** Somente dinheiro: calculado no servidor. */
  troco_centavos: number | null;
  criada_em: string;
  atualizada_em: string;
};

export type CorridaEventoRow = {
  id: string;
  corrida_id: string;
  passo: Passo;
  chave: string;
  observacao: string;
  criado_em: string;
};

export type ContaRecebimentoRow = {
  id: string;
  banco: string;
  tipo_chave: TipoChavePix;
  chave: string;
  titular: string;
  ativa: boolean;
  ordem: number;
  atualizado_em: string;
};

export type Alerta03Row = {
  id: string;
  passageiro_id: string;
  corrida_id: string | null;
  motorista_id: string | null;
  latitude: number | null;
  longitude: number | null;
  precisao_m: number | null;
  passo_atual: Passo;
  status: StatusAlerta03;
  acionado_em: string;
  encerrado_em: string | null;
  encerrado_por: string | null;
  observacao: string;
};

export type Alerta03EventoRow = {
  id: string;
  alerta_id: string;
  passo: Passo;
  chave: string;
  detalhe: string;
  criado_por: string | null;
  criado_em: string;
};

type Tabela<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      categorias: Tabela<CategoriaRow>;
      passageiros: Tabela<PassageiroRow>;
      motoristas: Tabela<MotoristaRow>;
      administradores: Tabela<AdministradorRow>;
      cidades: Tabela<CidadeRow>;
      configuracoes: Tabela<ConfiguracaoRow>;
      contas_recebimento: Tabela<ContaRecebimentoRow>;
      carteiras: Tabela<CarteiraRow>;
      transacoes: Tabela<TransacaoRow>;
      corridas: Tabela<CorridaRow>;
      corrida_eventos: Tabela<CorridaEventoRow>;
      alertas_03: Tabela<Alerta03Row>;
      alerta_03_eventos: Tabela<Alerta03EventoRow>;
    };
    Views: Record<string, never>;
    Functions: {
      criar_corrida: {
        Args: {
          p_categoria_chave: string;
          p_destino_texto: string;
          p_origem_texto?: string;
          p_origem_lat?: number | null;
          p_origem_lng?: number | null;
          p_destino_lat?: number | null;
          p_destino_lng?: number | null;
          p_cidade_id?: string | null;
          p_forma_pagamento?: FormaPagamento;
          p_valor_pago_centavos?: number | null;
        };
        Returns: CorridaRow;
      };
      aceitar_corrida: {
        Args: { p_corrida_id: string };
        Returns: CorridaRow;
      };
      avancar_protocolo: {
        Args: {
          p_corrida_id: string;
          p_chave?: string;
          p_motorista_nome?: string | null;
        };
        Returns: CorridaRow;
      };
      cancelar_corrida: {
        Args: { p_corrida_id: string };
        Returns: CorridaRow;
      };
      acionar_03: {
        Args: {
          p_corrida_id?: string | null;
          p_latitude?: number | null;
          p_longitude?: number | null;
          p_precisao_m?: number | null;
        };
        Returns: Alerta03Row;
      };
      registrar_passo_03: {
        Args: {
          p_alerta_id: string;
          p_passo: number;
          p_chave: string;
          p_detalhe?: string;
        };
        Returns: Alerta03Row;
      };
      encerrar_03: {
        Args: { p_alerta_id: string; p_observacao?: string };
        Returns: Alerta03Row;
      };
      admin_creditar_carteira: {
        Args: { p_passageiro_id: string; p_valor_centavos: number; p_descricao?: string };
        Returns: number;
      };
      eh_admin: { Args: Record<string, never>; Returns: boolean };
      eh_motorista: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
