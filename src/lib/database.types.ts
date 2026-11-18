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
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
