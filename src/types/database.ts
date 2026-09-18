/**
 * Tipos do banco REDE27, espelhando supabase/migrations/0001_init.sql.
 * Escrito a mao para nao travar o desenvolvimento antes do projeto existir.
 * Depois de aplicar a migracao, da para regerar com:
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 */

export type StatusCorrida = 'aberta' | 'concluida' | 'cancelada';
export type TipoTransacao = 'credito' | 'debito';
export type PassoAtual = 1 | 2 | 3 | 4 | 5;

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
  passo_atual: PassoAtual;
  status: StatusCorrida;
  motorista_nome: string | null;
  criada_em: string;
  atualizada_em: string;
};

export type OperadorRow = {
  id: string;
  nome: string;
  ativo: boolean;
  criado_em: string;
};

export type CorridaEventoRow = {
  id: string;
  corrida_id: string;
  passo: PassoAtual;
  chave: string;
  observacao: string;
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
      carteiras: Tabela<CarteiraRow>;
      transacoes: Tabela<TransacaoRow>;
      corridas: Tabela<CorridaRow>;
      corrida_eventos: Tabela<CorridaEventoRow>;
      operadores: Tabela<OperadorRow>;
    };
    Views: Record<string, never>;
    Functions: {
      criar_corrida: {
        Args: {
          p_categoria_chave: string;
          p_destino_texto: string;
          p_origem_texto?: string;
          p_distancia_km?: number;
        };
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
      /** Sem argumento de proposito: so responde sobre o proprio usuario. */
      eh_operador: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
