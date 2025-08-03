export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      subjects: {
        Row: {
          id: string;
          name: string;
          user_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          user_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          user_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      criteria: {
        Row: {
          id: string;
          subject_id: string;
          name: string;
          importance: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          subject_id: string;
          name: string;
          importance: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          subject_id?: string;
          name?: string;
          importance?: number;
          created_at?: string;
        };
      };
      profiles: {
        Row: {
          user_id: string;
          tokens: number;
        };
        Insert: {
          user_id: string;
          tokens?: number;
        };
        Update: {
          user_id?: string;
          tokens?: number;
        };
      };
      articles: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          link: string;
          source: string;
          pub_date: string;
          image_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          link: string;
          source: string;
          pub_date: string;
          image_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          link?: string;
          source?: string;
          pub_date?: string;
          image_url?: string | null;
          created_at?: string;
        };
      };
      appreciations: {
        Row: {
          user_id: string;
          detailed: string;
          summary: string;
          tag: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          detailed: string;
          summary: string;
          tag: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          detailed?: string;
          summary?: string;
          tag?: string;
          created_at?: string;
        };
      };
    };
  };
}
