export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      spaces: {
        Row: {
          id: string;
          invite_code: string;
          name: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          invite_code?: string;
          name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          invite_code?: string;
          name?: string | null;
          created_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          space_id: string | null;
          display_name: string;
          avatar_url: string | null;
          total_balance: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          space_id?: string | null;
          display_name?: string;
          avatar_url?: string | null;
          total_balance?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          space_id?: string | null;
          display_name?: string;
          avatar_url?: string | null;
          total_balance?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      checklist_templates: {
        Row: {
          id: string;
          space_id: string;
          user_id: string;
          name: string;
          description: string | null;
          items: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          space_id: string;
          user_id: string;
          name: string;
          description?: string | null;
          items?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          space_id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          items?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      checklists: {
        Row: {
          id: string;
          space_id: string;
          user_id: string;
          date: string;
          template_name: string | null;
          template_id: string | null;
          target_user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          space_id: string;
          user_id: string;
          date: string;
          template_name?: string | null;
          template_id?: string | null;
          target_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          space_id?: string;
          user_id?: string;
          date?: string;
          template_name?: string | null;
          template_id?: string | null;
          target_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      checklist_items: {
        Row: {
          id: string;
          checklist_id: string;
          space_id: string;
          user_id: string;
          content: string;
          points: number;
          is_completed: boolean;
          completed_by: string | null;
          completed_at: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          checklist_id: string;
          space_id: string;
          user_id: string;
          content: string;
          points?: number;
          is_completed?: boolean;
          completed_by?: string | null;
          completed_at?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          checklist_id?: string;
          space_id?: string;
          user_id?: string;
          content?: string;
          points?: number;
          is_completed?: boolean;
          completed_by?: string | null;
          completed_at?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      journal_entries: {
        Row: {
          id: string;
          space_id: string;
          user_id: string;
          content: string;
          is_private: boolean;
          type: Database['public']['Enums']['journal_type'];
          entry_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          space_id: string;
          user_id: string;
          content?: string;
          is_private?: boolean;
          type?: Database['public']['Enums']['journal_type'];
          entry_date?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          space_id?: string;
          user_id?: string;
          content?: string;
          is_private?: boolean;
          type?: Database['public']['Enums']['journal_type'];
          entry_date?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      letters: {
        Row: {
          id: string;
          space_id: string;
          author_id: string;
          recipient_id: string;
          content: string | null;
          title: string;
          unlock_at: string;
          is_read: boolean;
          read_at: string | null;
          letter_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          space_id: string;
          author_id: string;
          recipient_id: string;
          content?: string | null;
          title?: string;
          unlock_at?: string;
          is_read?: boolean;
          read_at?: string | null;
          letter_date?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          space_id?: string;
          author_id?: string;
          recipient_id?: string;
          content?: string | null;
          title?: string;
          unlock_at?: string;
          is_read?: boolean;
          read_at?: string | null;
          letter_date?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      points_ledger: {
        Row: {
          id: string;
          space_id: string;
          from_user: string | null;
          to_user: string;
          amount: number;
          reason: string;
          reference: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          space_id: string;
          from_user?: string | null;
          to_user: string;
          amount: number;
          reason?: string;
          reference?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          space_id?: string;
          from_user?: string | null;
          to_user?: string;
          amount?: number;
          reason?: string;
          reference?: string | null;
          created_at?: string;
        };
      };
      shop_items: {
        Row: {
          id: string;
          space_id: string;
          user_id: string;
          title: string;
          description: string | null;
          cost_points: number;
          cover_image_url: string | null;
          is_claimed: boolean;
          claimed_by: string | null;
          claimed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          space_id: string;
          user_id: string;
          title: string;
          description?: string | null;
          cost_points?: number;
          cover_image_url?: string | null;
          is_claimed?: boolean;
          claimed_by?: string | null;
          claimed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          space_id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          cost_points?: number;
          cover_image_url?: string | null;
          is_claimed?: boolean;
          claimed_by?: string | null;
          claimed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      audio_notes: {
        Row: {
          id: string;
          space_id: string;
          user_id: string;
          storage_path: string;
          duration_ms: number | null;
          note_date: string;
          is_listened: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          space_id: string;
          user_id: string;
          storage_path: string;
          duration_ms?: number | null;
          note_date?: string;
          is_listened?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          space_id?: string;
          user_id?: string;
          storage_path?: string;
          duration_ms?: number | null;
          note_date?: string;
          is_listened?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      wallet: {
        Row: {
          id: string;
          space_id: string;
          balance: number;
          goal_name: string | null;
          goal_target: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          space_id: string;
          balance?: number;
          goal_name?: string | null;
          goal_target?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          space_id?: string;
          balance?: number;
          goal_name?: string | null;
          goal_target?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      journal_type: 'gratitude' | 'feeling' | 'note' | 'memory';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
