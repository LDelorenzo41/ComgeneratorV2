export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      appreciations: {
        Row: {
          created_at: string
          detailed: string
          id: string
          summary: string
          tag: string
          user_id: string
        }
        Insert: {
          created_at?: string
          detailed: string
          id?: string
          summary: string
          tag: string
          user_id: string
        }
        Update: {
          created_at?: string
          detailed?: string
          id?: string
          summary?: string
          tag?: string
          user_id?: string
        }
        Relationships: []
      }
      chatbot_answers: {
        Row: {
          id: string
          user_id: string
          title: string
          content: string
          category: string
          subject: string | null
          level: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          content: string
          category: string
          subject?: string | null
          level?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          content?: string
          category?: string
          subject?: string | null
          level?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_answers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }

      articles: {
        Row: {
          created_at: string | null
          description: string | null
          feed_id: string | null
          id: string
          image_url: string | null
          link: string
          pub_date: string
          source: string
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          feed_id?: string | null
          id?: string
          image_url?: string | null
          link: string
          pub_date: string
          source: string
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          feed_id?: string | null
          id?: string
          image_url?: string | null
          link?: string
          pub_date?: string
          source?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_articles_feed_id"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "rss_feeds"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_logs: {
        Row: {
          action: string
          consent_data: Json
          consent_date: string
          consent_version: string
          created_at: string
          id: string
          ip_address: string | null
          page_url: string | null
          previous_consent_id: string | null
          session_id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          consent_data: Json
          consent_date?: string
          consent_version?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          page_url?: string | null
          previous_consent_id?: string | null
          session_id: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          consent_data?: Json
          consent_date?: string
          consent_version?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          page_url?: string | null
          previous_consent_id?: string | null
          session_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_logs_previous_consent_id_fkey"
            columns: ["previous_consent_id"]
            isOneToOne: false
            referencedRelation: "consent_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      criteria: {
        Row: {
          created_at: string | null
          id: string
          importance: number
          name: string
          subject_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          importance: number
          name: string
          subject_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          importance?: number
          name?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "criteria_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      deleted_users_blacklist: {
        Row: {
          deleted_at: string | null
          email: string
        }
        Insert: {
          deleted_at?: string | null
          email: string
        }
        Update: {
          deleted_at?: string | null
          email?: string
        }
        Relationships: []
      }
      lessons: {
        Row: {
          content: string
          created_at: string | null
          duration: number
          id: string
          level: string
          pedagogy_type: string
          subject: string
          topic: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          duration: number
          id?: string
          level: string
          pedagogy_type: string
          subject: string
          topic: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          duration?: number
          id?: string
          level?: string
          pedagogy_type?: string
          subject?: string
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      lessons_bank: {
        Row: {
          content: string
          created_at: string | null
          duration: number
          id: string
          level: string
          pedagogy_type: string
          subject: string
          topic: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          duration: number
          id?: string
          level: string
          pedagogy_type: string
          subject: string
          topic: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          duration?: number
          id?: string
          level?: string
          pedagogy_type?: string
          subject?: string
          topic?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_bank_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      newsletter_logs: {
        Row: {
          id: string
          created_at: string
          subject: string
          audience_type: string
          token_threshold: number | null
          recipients_count: number
          sent_by: string | null
          status: string
        }
        Insert: {
          id?: string
          created_at?: string
          subject: string
          audience_type: string
          token_threshold?: number | null
          recipients_count: number
          sent_by?: string | null
          status?: string
        }
        Update: {
          id?: string
          created_at?: string
          subject?: string
          audience_type?: string
          token_threshold?: number | null
          recipients_count?: number
          sent_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_logs_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles: {
        Row: {
          has_bank_access: boolean | null
          is_admin: boolean | null
          newsletter_subscription: boolean | null
          special_offer_claimed: boolean | null
          tokens: number
          user_id: string
        }
        Insert: {
          has_bank_access?: boolean | null
          is_admin?: boolean | null
          newsletter_subscription?: boolean | null
          special_offer_claimed?: boolean | null
          tokens?: number
          user_id: string
        }
        Update: {
          has_bank_access?: boolean | null
          is_admin?: boolean | null
          newsletter_subscription?: boolean | null
          special_offer_claimed?: boolean | null
          tokens?: number
          user_id?: string
        }
        Relationships: []
      }
      promo_campaigns: {
        Row: {
          id: string
          code: string
          description: string
          tokens_amount: number
          max_redemptions: number | null
          current_redemptions: number
          expires_at: string
          is_active: boolean
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          code: string
          description: string
          tokens_amount: number
          max_redemptions?: number | null
          current_redemptions?: number
          expires_at: string
          is_active?: boolean
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          code?: string
          description?: string
          tokens_amount?: number
          max_redemptions?: number | null
          current_redemptions?: number
          expires_at?: string
          is_active?: boolean
          created_at?: string
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promo_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      promo_redemptions: {
        Row: {
          id: string
          campaign_id: string
          user_id: string
          tokens_received: number
          redeemed_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          user_id: string
          tokens_received: number
          redeemed_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          user_id?: string
          tokens_received?: number
          redeemed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_redemptions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "promo_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_redemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      rss_feeds: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          is_active: boolean
          name: string
          source_domain: string | null
          url: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          source_domain?: string | null
          url: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          source_domain?: string | null
          url?: string
        }
        Relationships: []
      }
      signatures: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      subjects: {
        Row: {
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount_cents: number | null
          bank_access_granted: boolean | null
          created_at: string | null
          id: string
          status: string | null
          stripe_session_id: string | null
          tokens_purchased: number | null
          user_id: string | null
        }
        Insert: {
          amount_cents?: number | null
          bank_access_granted?: boolean | null
          created_at?: string | null
          id?: string
          status?: string | null
          stripe_session_id?: string | null
          tokens_purchased?: number | null
          user_id?: string | null
        }
        Update: {
          amount_cents?: number | null
          bank_access_granted?: boolean | null
          created_at?: string | null
          id?: string
          status?: string | null
          stripe_session_id?: string | null
          tokens_purchased?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_rss_preferences: {
        Row: {
          created_at: string | null
          feed_id: string
          position: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          feed_id: string
          position: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          feed_id?: string
          position?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_rss_preferences_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "rss_feeds"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_user_account: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      fetch_rss_articles: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      redeem_promo_code: {
        Args: { p_code: string }
        Returns: Json
      }
      unsubscribe_newsletter: {
        Args: { user_token: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const


