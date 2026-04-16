// AUTO-GENERATED — do not edit manually.
// Regenerate after any schema change:
//   npx supabase gen types typescript --project-id jcsiawsztrmffwqxasld > lib/types/database.ts
// Last generated: 2026-04-08

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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      card_views: {
        Row: {
          browser: string | null
          city: string | null
          country: string
          cta_clicked: boolean
          device_type: string | null
          duration_seconds: number | null
          id: string
          nfc_card_id: string
          os: string | null
          referrer_url: string | null
          session_id: string
          source: string
          staff_card_id: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          vcf_downloaded: boolean
          viewed_at: string
          wa_clicked: boolean
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string
          cta_clicked?: boolean
          device_type?: string | null
          duration_seconds?: number | null
          id?: string
          nfc_card_id: string
          os?: string | null
          referrer_url?: string | null
          session_id: string
          source?: string
          staff_card_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          vcf_downloaded?: boolean
          viewed_at?: string
          wa_clicked?: boolean
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string
          cta_clicked?: boolean
          device_type?: string | null
          duration_seconds?: number | null
          id?: string
          nfc_card_id?: string
          os?: string | null
          referrer_url?: string | null
          session_id?: string
          source?: string
          staff_card_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          vcf_downloaded?: boolean
          viewed_at?: string
          wa_clicked?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "card_views_nfc_card_id_fkey"
            columns: ["nfc_card_id"]
            isOneToOne: false
            referencedRelation: "nfc_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_views_staff_card_id_fkey"
            columns: ["staff_card_id"]
            isOneToOne: false
            referencedRelation: "staff_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          brand_dark_mode: boolean
          brand_primary_color: string
          brand_secondary_color: string
          card_template: string
          contract_end_date: string | null
          contract_start_date: string | null
          created_at: string
          cta_label: string
          cta_url: string | null
          custom_domain: string | null
          id: string
          internal_notes: string | null
          logo_url: string | null
          max_staff_cards: number
          min_cards_committed: number | null
          name: string
          next_billing_date: string | null
          nfc_cards_ordered: number | null
          nfc_delivery_address: string | null
          onboarding_checklist: Json
          pricing_tier_id: string | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          primary_contact_whatsapp: string | null
          rate_per_card_zar: number | null
          setup_fee_per_card_zar: number | null
          slug: string
          subscription_ends_at: string | null
          subscription_plan: string
          subscription_status: string
          tagline: string | null
          updated_at: string
          wa_admin_number: string | null
          website: string | null
        }
        Insert: {
          brand_dark_mode?: boolean
          brand_primary_color?: string
          brand_secondary_color?: string
          card_template?: string
          contract_end_date?: string | null
          contract_start_date?: string | null
          created_at?: string
          cta_label?: string
          cta_url?: string | null
          custom_domain?: string | null
          id?: string
          internal_notes?: string | null
          logo_url?: string | null
          max_staff_cards?: number
          min_cards_committed?: number | null
          name: string
          next_billing_date?: string | null
          nfc_cards_ordered?: number | null
          nfc_delivery_address?: string | null
          onboarding_checklist?: Json
          pricing_tier_id?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          primary_contact_whatsapp?: string | null
          rate_per_card_zar?: number | null
          setup_fee_per_card_zar?: number | null
          slug: string
          subscription_ends_at?: string | null
          subscription_plan?: string
          subscription_status?: string
          tagline?: string | null
          updated_at?: string
          wa_admin_number?: string | null
          website?: string | null
        }
        Update: {
          brand_dark_mode?: boolean
          brand_primary_color?: string
          brand_secondary_color?: string
          card_template?: string
          contract_end_date?: string | null
          contract_start_date?: string | null
          created_at?: string
          cta_label?: string
          cta_url?: string | null
          custom_domain?: string | null
          id?: string
          internal_notes?: string | null
          logo_url?: string | null
          max_staff_cards?: number
          min_cards_committed?: number | null
          name?: string
          next_billing_date?: string | null
          nfc_cards_ordered?: number | null
          nfc_delivery_address?: string | null
          onboarding_checklist?: Json
          pricing_tier_id?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          primary_contact_whatsapp?: string | null
          rate_per_card_zar?: number | null
          setup_fee_per_card_zar?: number | null
          slug?: string
          subscription_ends_at?: string | null
          subscription_plan?: string
          subscription_status?: string
          tagline?: string | null
          updated_at?: string
          wa_admin_number?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_pricing_tier_id_fkey"
            columns: ["pricing_tier_id"]
            isOneToOne: false
            referencedRelation: "pricing_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      company_admins: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_admins_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          captured_via_card_id: string | null
          card_view_id: string | null
          company_id: string
          company_name: string | null
          created_at: string
          custom_fields: Json
          email: string | null
          follow_up_at: string | null
          full_name: string | null
          id: string
          job_title: string | null
          notes: string | null
          phone: string | null
          popia_consent: boolean
          popia_consent_at: string | null
          popia_consent_ip: string | null
          popia_consent_text: string | null
          status: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          captured_via_card_id?: string | null
          card_view_id?: string | null
          company_id: string
          company_name?: string | null
          created_at?: string
          custom_fields?: Json
          email?: string | null
          follow_up_at?: string | null
          full_name?: string | null
          id?: string
          job_title?: string | null
          notes?: string | null
          phone?: string | null
          popia_consent?: boolean
          popia_consent_at?: string | null
          popia_consent_ip?: string | null
          popia_consent_text?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          captured_via_card_id?: string | null
          card_view_id?: string | null
          company_id?: string
          company_name?: string | null
          created_at?: string
          custom_fields?: Json
          email?: string | null
          follow_up_at?: string | null
          full_name?: string | null
          id?: string
          job_title?: string | null
          notes?: string | null
          phone?: string | null
          popia_consent?: boolean
          popia_consent_at?: string | null
          popia_consent_ip?: string | null
          popia_consent_text?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_captured_via_card_id_fkey"
            columns: ["captured_via_card_id"]
            isOneToOne: false
            referencedRelation: "staff_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_card_view_id_fkey"
            columns: ["card_view_id"]
            isOneToOne: false
            referencedRelation: "card_views"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      impersonation_log: {
        Row: {
          ended_at: string | null
          id: string
          reason: string | null
          started_at: string
          super_admin_user_id: string
          target_company_id: string
        }
        Insert: {
          ended_at?: string | null
          id?: string
          reason?: string | null
          started_at?: string
          super_admin_user_id: string
          target_company_id: string
        }
        Update: {
          ended_at?: string | null
          id?: string
          reason?: string | null
          started_at?: string
          super_admin_user_id?: string
          target_company_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_log_target_company_id_fkey"
            columns: ["target_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      nfc_cards: {
        Row: {
          activated_at: string | null
          chip_uid: string | null
          company_id: string
          created_at: string
          deactivated_at: string | null
          id: string
          notes: string | null
          order_status: string
          print_batch_id: string | null
          programmed_at: string | null
          slug: string
        }
        Insert: {
          activated_at?: string | null
          chip_uid?: string | null
          company_id: string
          created_at?: string
          deactivated_at?: string | null
          id?: string
          notes?: string | null
          order_status?: string
          print_batch_id?: string | null
          programmed_at?: string | null
          slug: string
        }
        Update: {
          activated_at?: string | null
          chip_uid?: string | null
          company_id?: string
          created_at?: string
          deactivated_at?: string | null
          id?: string
          notes?: string | null
          order_status?: string
          print_batch_id?: string | null
          programmed_at?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "nfc_cards_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_tiers: {
        Row: {
          created_at: string
          display_name: string
          id: string
          max_cards: number | null
          min_cards: number
          name: string
          rate_per_card_zar: number
          setup_fee_per_card_zar: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          max_cards?: number | null
          min_cards: number
          name: string
          rate_per_card_zar: number
          setup_fee_per_card_zar: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          max_cards?: number | null
          min_cards?: number
          name?: string
          rate_per_card_zar?: number
          setup_fee_per_card_zar?: number
          sort_order?: number
        }
        Relationships: []
      }
      staff_cards: {
        Row: {
          bio: string | null
          company_id: string
          created_at: string
          cta_label: string | null
          cta_url: string | null
          department: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          job_title: string
          nfc_card_id: string | null
          phone: string | null
          photo_url: string | null
          show_email: boolean
          show_optin_form: boolean
          show_phone: boolean
          social_links: Json
          updated_at: string
          user_id: string | null
          wa_notify_enabled: boolean
          whatsapp_number: string | null
        }
        Insert: {
          bio?: string | null
          company_id: string
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          department?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          job_title: string
          nfc_card_id?: string | null
          phone?: string | null
          photo_url?: string | null
          show_email?: boolean
          show_optin_form?: boolean
          show_phone?: boolean
          social_links?: Json
          updated_at?: string
          user_id?: string | null
          wa_notify_enabled?: boolean
          whatsapp_number?: string | null
        }
        Update: {
          bio?: string | null
          company_id?: string
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          department?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          job_title?: string
          nfc_card_id?: string | null
          phone?: string | null
          photo_url?: string | null
          show_email?: boolean
          show_optin_form?: boolean
          show_phone?: boolean
          social_links?: Json
          updated_at?: string
          user_id?: string | null
          wa_notify_enabled?: boolean
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_cards_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_cards_nfc_card_id_fkey"
            columns: ["nfc_card_id"]
            isOneToOne: true
            referencedRelation: "nfc_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_notifications_log: {
        Row: {
          channel: string
          company_id: string | null
          contact_id: string | null
          error_message: string | null
          id: string
          message_body: string | null
          message_template: string
          recipient_number: string
          sent_at: string
          staff_card_id: string | null
          status: string
        }
        Insert: {
          channel?: string
          company_id?: string | null
          contact_id?: string | null
          error_message?: string | null
          id?: string
          message_body?: string | null
          message_template: string
          recipient_number: string
          sent_at?: string
          staff_card_id?: string | null
          status?: string
        }
        Update: {
          channel?: string
          company_id?: string | null
          contact_id?: string | null
          error_message?: string | null
          id?: string
          message_body?: string | null
          message_template?: string
          recipient_number?: string
          sent_at?: string
          staff_card_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_notifications_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_notifications_log_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_notifications_log_staff_card_id_fkey"
            columns: ["staff_card_id"]
            isOneToOne: false
            referencedRelation: "staff_cards"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_company_id: { Args: never; Returns: string }
      auth_staff_card_id: { Args: never; Returns: string }
      generate_unique_slug: { Args: never; Returns: string }
      is_super_admin: { Args: never; Returns: boolean }
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
