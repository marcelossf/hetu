export type Database = {
  public: {
    Tables: {
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
