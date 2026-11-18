export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      db_unidades: {
        Row: {
          id: number;
          nome: string;
        };
        Insert: {
          id?: number;
          nome: string;
        };
        Update: {
          id?: number;
          nome?: string;
        };
        Relationships: [];
      };
      db_categoria_insumo: {
        Row: {
          id: number;
          nome: string;
          user_id: string;
        };
        Insert: {
          id?: number;
          nome: string;
          user_id?: string;
        };
        Update: {
          id?: number;
          nome?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      db_insumos: {
        Row: {
          id_insumo: number;
          nome: string;
          unidade: string;
          categoria: string | null;
          custo_estimado_unitario: number;
          estoque_atual: number;
          ativo: string;
          user_id: string;
        };
        Insert: {
          id_insumo?: number;
          nome: string;
          unidade: string;
          categoria?: string | null;
          custo_estimado_unitario?: number;
          estoque_atual?: number;
          ativo?: string;
          user_id?: string;
        };
        Update: {
          id_insumo?: number;
          nome?: string;
          unidade?: string;
          categoria?: string | null;
          custo_estimado_unitario?: number;
          estoque_atual?: number;
          ativo?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      db_categoria_produto: {
        Row: {
          id: number;
          user_id: string;
          nome: string;
        };
        Insert: {
          id?: number;
          user_id?: string;
          nome: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          nome?: string;
        };
        Relationships: [];
      };
      db_fichas: {
        Row: {
          id_ficha: number;
          user_id: string;
          nome_receita: string;
          rendimento: number;
          custo_embalagem: number;
          custo_mao_obra: number;
          custo_armazenamento: number;
          custo_total: number;
          custo_unitario: number;
          id_categoria: number | null;
          preco_venda: number;
          estoque_atual: number;
          ativo: "Sim" | "Não";
        };
        Insert: {
          id_ficha?: number;
          user_id?: string;
          nome_receita: string;
          rendimento?: number;
          custo_embalagem?: number;
          custo_mao_obra?: number;
          custo_armazenamento?: number;
          custo_total?: number;
          custo_unitario?: number;
          id_categoria?: number | null;
          preco_venda?: number;
          estoque_atual?: number;
          ativo?: "Sim" | "Não";
        };
        Update: {
          id_ficha?: number;
          user_id?: string;
          nome_receita?: string;
          rendimento?: number;
          custo_embalagem?: number;
          custo_mao_obra?: number;
          custo_armazenamento?: number;
          custo_total?: number;
          custo_unitario?: number;
          id_categoria?: number | null;
          preco_venda?: number;
          estoque_atual?: number;
          ativo?: "Sim" | "Não";
        };
        Relationships: [];
      };
      db_fichas_itens: {
        Row: {
          id_item: number;
          user_id: string;
          id_ficha: number;
          id_insumo: number;
          qtd_insumo: number;
        };
        Insert: {
          id_item?: number;
          user_id?: string;
          id_ficha: number;
          id_insumo: number;
          qtd_insumo: number;
        };
        Update: {
          id_item?: number;
          user_id?: string;
          id_ficha?: number;
          id_insumo?: number;
          qtd_insumo?: number;
        };
        Relationships: [];
      };
      db_canais_vendas: {
        Row: {
          id: number;
          user_id: string;
          nome: string;
          endereco: string | null;
          ativo: "Sim" | "Não";
        };
        Insert: {
          id?: number;
          user_id?: string;
          nome: string;
          endereco?: string | null;
          ativo?: "Sim" | "Não";
        };
        Update: {
          id?: number;
          user_id?: string;
          nome?: string;
          endereco?: string | null;
          ativo?: "Sim" | "Não";
        };
        Relationships: [];
      };
      db_producao: {
        Row: {
          id_producao: number;
          user_id: string;
          data_producao: string;
          id_produto: number;
          qtd_produzida: number;
          custo_unitario_momento: number;
          custo_total_lote: number;
          observacao: string | null;
        };
        Insert: {
          id_producao?: number;
          user_id?: string;
          data_producao?: string;
          id_produto: number;
          qtd_produzida: number;
          custo_unitario_momento: number;
          custo_total_lote: number;
          observacao?: string | null;
        };
        Update: {
          id_producao?: number;
          user_id?: string;
          data_producao?: string;
          id_produto?: number;
          qtd_produzida?: number;
          custo_unitario_momento?: number;
          custo_total_lote?: number;
          observacao?: string | null;
        };
        Relationships: [];
      };
      db_producao_itens: {
        Row: {
          id_item: number;
          user_id: string;
          id_producao: number;
          id_insumo: number;
          qtd_consumida: number;
          custo_unitario_momento: number;
          custo_total: number;
        };
        Insert: {
          id_item?: number;
          user_id?: string;
          id_producao: number;
          id_insumo: number;
          qtd_consumida: number;
          custo_unitario_momento: number;
          custo_total: number;
        };
        Update: {
          id_item?: number;
          user_id?: string;
          id_producao?: number;
          id_insumo?: number;
          qtd_consumida?: number;
          custo_unitario_momento?: number;
          custo_total?: number;
        };
        Relationships: [];
      };
      db_ajustes_estoque_produto: {
        Row: {
          id_ajuste: number;
          user_id: string;
          id_ficha: number;
          tipo: "saldo_inicial" | "ajuste";
          quantidade_delta: number;
          motivo: string;
          criado_em: string;
        };
        Insert: {
          id_ajuste?: number;
          user_id?: string;
          id_ficha: number;
          tipo: "saldo_inicial" | "ajuste";
          quantidade_delta: number;
          motivo: string;
          criado_em?: string;
        };
        Update: {
          id_ajuste?: number;
          user_id?: string;
          id_ficha?: number;
          tipo?: "saldo_inicial" | "ajuste";
          quantidade_delta?: number;
          motivo?: string;
          criado_em?: string;
        };
        Relationships: [];
      };
      db_vendas_cabecalho: {
        Row: {
          id: number;
          user_id: string;
          data_venda: string;
          id_canal: number;
          subtotal_pedido: number;
          desconto: number;
          valor_total_pedido: number;
          status: "concluida" | "cancelada";
          observacoes: string | null;
          cancelada_em: string | null;
        };
        Insert: {
          id?: number;
          user_id?: string;
          data_venda?: string;
          id_canal: number;
          subtotal_pedido: number;
          desconto?: number;
          valor_total_pedido: number;
          status?: "concluida" | "cancelada";
          observacoes?: string | null;
          cancelada_em?: string | null;
        };
        Update: {
          id?: number;
          user_id?: string;
          data_venda?: string;
          id_canal?: number;
          subtotal_pedido?: number;
          desconto?: number;
          valor_total_pedido?: number;
          status?: "concluida" | "cancelada";
          observacoes?: string | null;
          cancelada_em?: string | null;
        };
        Relationships: [];
      };
      db_vendas_itens: {
        Row: {
          id_venda_item: number;
          user_id: string;
          id_venda: number;
          id_produto: number;
          nome_produto: string;
          quantidade: number;
          preco_venda_unitario: number;
          custo_unitario_historico: number;
          desconto: number;
          subtotal: number;
        };
        Insert: {
          id_venda_item?: number;
          user_id?: string;
          id_venda: number;
          id_produto: number;
          nome_produto: string;
          quantidade: number;
          preco_venda_unitario: number;
          custo_unitario_historico: number;
          desconto?: number;
          subtotal: number;
        };
        Update: {
          id_venda_item?: number;
          user_id?: string;
          id_venda?: number;
          id_produto?: number;
          nome_produto?: string;
          quantidade?: number;
          preco_venda_unitario?: number;
          custo_unitario_historico?: number;
          desconto?: number;
          subtotal?: number;
        };
        Relationships: [];
      };
      db_vendas_pagamentos: {
        Row: {
          id_pagamento: number;
          user_id: string;
          id_venda: number;
          forma_pagamento:
            | "pix"
            | "dinheiro"
            | "cartao_debito"
            | "cartao_credito"
            | "transferencia"
            | "outro";
          valor: number;
          criado_em: string;
        };
        Insert: {
          id_pagamento?: number;
          user_id?: string;
          id_venda: number;
          forma_pagamento:
            | "pix"
            | "dinheiro"
            | "cartao_debito"
            | "cartao_credito"
            | "transferencia"
            | "outro";
          valor: number;
          criado_em?: string;
        };
        Update: {
          id_pagamento?: number;
          user_id?: string;
          id_venda?: number;
          forma_pagamento?:
            | "pix"
            | "dinheiro"
            | "cartao_debito"
            | "cartao_credito"
            | "transferencia"
            | "outro";
          valor?: number;
          criado_em?: string;
        };
        Relationships: [];
      };
      user_security_settings: {
        Row: {
          user_id: string;
          biometric_enabled: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          biometric_enabled?: boolean;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          biometric_enabled?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_passkeys: {
        Row: {
          credential_id: string;
          user_id: string;
          public_key: string;
          counter: number;
          transports: string[];
          device_type: "singleDevice" | "multiDevice";
          backed_up: boolean;
          created_at: string;
        };
        Insert: {
          credential_id: string;
          user_id: string;
          public_key: string;
          counter?: number;
          transports?: string[];
          device_type: "singleDevice" | "multiDevice";
          backed_up?: boolean;
          created_at?: string;
        };
        Update: {
          credential_id?: string;
          user_id?: string;
          public_key?: string;
          counter?: number;
          transports?: string[];
          device_type?: "singleDevice" | "multiDevice";
          backed_up?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      user_passkey_challenges: {
        Row: {
          challenge: string;
          user_id: string;
          purpose: "registration" | "authentication";
          page_nonce: string;
          expires_at: string;
          consumed_at: string | null;
          created_at: string;
        };
        Insert: {
          challenge: string;
          user_id: string;
          purpose: "registration" | "authentication";
          page_nonce: string;
          expires_at: string;
          consumed_at?: string | null;
          created_at?: string;
        };
        Update: {
          challenge?: string;
          user_id?: string;
          purpose?: "registration" | "authentication";
          page_nonce?: string;
          expires_at?: string;
          consumed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      save_ficha: {
        Args: {
          p_id_ficha: number | null;
          p_nome_receita: string;
          p_rendimento: number;
          p_id_categoria: number | null;
          p_custo_embalagem: number;
          p_custo_mao_obra: number;
          p_custo_armazenamento: number;
          p_preco_venda: number;
          p_ativo: "Sim" | "Não";
          p_itens: Json;
        };
        Returns: number;
      };
      adjust_product_stock: {
        Args: {
          p_id_ficha: number;
          p_quantidade_delta: number;
          p_motivo: string;
        };
        Returns: number;
      };
      register_production: {
        Args: {
          p_id_produto: number;
          p_quantidade: number;
          p_observacao: string | null;
        };
        Returns: number;
      };
      register_sale: {
        Args: {
          p_id_canal: number;
          p_subtotal: number;
          p_desconto: number;
          p_observacoes: string | null;
          p_itens: Json;
          p_pagamentos: Json;
        };
        Returns: number;
      };
      cancel_sale: {
        Args: {
          p_id_venda: number;
        };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
