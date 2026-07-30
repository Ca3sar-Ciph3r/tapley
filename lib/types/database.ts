// AUTO-GENERATED — do not edit manually.
// Regenerate after any schema change:
//   npx supabase gen types typescript --project-id jcsiawsztrmffwqxasld > lib/types/database.ts
// Last generated: 2026-07-29

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
      billing_records: {
        Row: {
          amount_zar: number
          billing_date: string
          company_id: string
          created_at: string
          description: string | null
          id: string
          status: string
          type: string
        }
        Insert: {
          amount_zar: number
          billing_date?: string
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          status?: string
          type: string
        }
        Update: {
          amount_zar?: number
          billing_date?: string
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      card_orders: {
        Row: {
          actual_delivery: string | null
          company_id: string
          contact_name: string | null
          contact_phone: string | null
          cost_per_card: number | null
          created_at: string
          delivery_address: string | null
          estimated_delivery: string | null
          id: string
          notes: string | null
          order_date: string
          quantity: number
          status: string
          supplier: string | null
          total_cost: number | null
          tracking_number: string | null
        }
        Insert: {
          actual_delivery?: string | null
          company_id: string
          contact_name?: string | null
          contact_phone?: string | null
          cost_per_card?: number | null
          created_at?: string
          delivery_address?: string | null
          estimated_delivery?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          quantity: number
          status?: string
          supplier?: string | null
          total_cost?: number | null
          tracking_number?: string | null
        }
        Update: {
          actual_delivery?: string | null
          company_id?: string
          contact_name?: string | null
          contact_phone?: string | null
          cost_per_card?: number | null
          created_at?: string
          delivery_address?: string | null
          estimated_delivery?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          quantity?: number
          status?: string
          supplier?: string | null
          total_cost?: number | null
          tracking_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
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
      change_requests: {
        Row: {
          company_id: string
          created_at: string
          details: string
          id: string
          requested_by: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          staff_card_id: string | null
          status: string
          type: string
        }
        Insert: {
          company_id: string
          created_at?: string
          details: string
          id?: string
          requested_by?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          staff_card_id?: string | null
          status?: string
          type?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          details?: string
          id?: string
          requested_by?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          staff_card_id?: string | null
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_requests_staff_card_id_fkey"
            columns: ["staff_card_id"]
            isOneToOne: false
            referencedRelation: "staff_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          archived_at: string | null
          billing_cycle: string
          billing_email: string | null
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
          deletion_scheduled_at: string | null
          dpa_accepted_at: string | null
          dpa_version: string | null
          free_months_balance: number
          id: string
          industry: string | null
          internal_notes: string | null
          is_qr_digital: boolean
          location: string | null
          logo_size: string
          logo_url: string | null
          max_staff_cards: number
          min_cards_committed: number | null
          monthly_rate_override: number | null
          name: string
          next_billing_date: string | null
          nfc_cards_ordered: number | null
          nfc_delivery_address: string | null
          onboarding_checklist: Json
          payfast_subscription_token: string | null
          pricing_tier_id: string | null
          pricing_v2_enabled: boolean
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          primary_contact_whatsapp: string | null
          rate_per_card_zar: number | null
          referral_code: string | null
          referred_by_company_id: string | null
          self_service: boolean
          setup_fee_paid: boolean
          setup_fee_paid_at: string | null
          setup_fee_payfast_token: string | null
          setup_fee_per_card_zar: number | null
          slug: string
          subscription_ends_at: string | null
          subscription_plan: string
          subscription_renewed_at: string | null
          subscription_start: string | null
          subscription_status: string
          tagline: string | null
          trial_ends_at: string | null
          updated_at: string
          wa_admin_number: string | null
          website: string | null
        }
        Insert: {
          archived_at?: string | null
          billing_cycle?: string
          billing_email?: string | null
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
          deletion_scheduled_at?: string | null
          dpa_accepted_at?: string | null
          dpa_version?: string | null
          free_months_balance?: number
          id?: string
          industry?: string | null
          internal_notes?: string | null
          is_qr_digital?: boolean
          location?: string | null
          logo_size?: string
          logo_url?: string | null
          max_staff_cards?: number
          min_cards_committed?: number | null
          monthly_rate_override?: number | null
          name: string
          next_billing_date?: string | null
          nfc_cards_ordered?: number | null
          nfc_delivery_address?: string | null
          onboarding_checklist?: Json
          payfast_subscription_token?: string | null
          pricing_tier_id?: string | null
          pricing_v2_enabled?: boolean
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          primary_contact_whatsapp?: string | null
          rate_per_card_zar?: number | null
          referral_code?: string | null
          referred_by_company_id?: string | null
          self_service?: boolean
          setup_fee_paid?: boolean
          setup_fee_paid_at?: string | null
          setup_fee_payfast_token?: string | null
          setup_fee_per_card_zar?: number | null
          slug: string
          subscription_ends_at?: string | null
          subscription_plan?: string
          subscription_renewed_at?: string | null
          subscription_start?: string | null
          subscription_status?: string
          tagline?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          wa_admin_number?: string | null
          website?: string | null
        }
        Update: {
          archived_at?: string | null
          billing_cycle?: string
          billing_email?: string | null
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
          deletion_scheduled_at?: string | null
          dpa_accepted_at?: string | null
          dpa_version?: string | null
          free_months_balance?: number
          id?: string
          industry?: string | null
          internal_notes?: string | null
          is_qr_digital?: boolean
          location?: string | null
          logo_size?: string
          logo_url?: string | null
          max_staff_cards?: number
          min_cards_committed?: number | null
          monthly_rate_override?: number | null
          name?: string
          next_billing_date?: string | null
          nfc_cards_ordered?: number | null
          nfc_delivery_address?: string | null
          onboarding_checklist?: Json
          payfast_subscription_token?: string | null
          pricing_tier_id?: string | null
          pricing_v2_enabled?: boolean
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          primary_contact_whatsapp?: string | null
          rate_per_card_zar?: number | null
          referral_code?: string | null
          referred_by_company_id?: string | null
          self_service?: boolean
          setup_fee_paid?: boolean
          setup_fee_paid_at?: string | null
          setup_fee_payfast_token?: string | null
          setup_fee_per_card_zar?: number | null
          slug?: string
          subscription_ends_at?: string | null
          subscription_plan?: string
          subscription_renewed_at?: string | null
          subscription_start?: string | null
          subscription_status?: string
          tagline?: string | null
          trial_ends_at?: string | null
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
          {
            foreignKeyName: "companies_referred_by_company_id_fkey"
            columns: ["referred_by_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
          source: string
          staff_card_id: string | null
          status: string
          tags: string[]
          updated_at: string
          whatsapp_number: string | null
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
          source?: string
          staff_card_id?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
          whatsapp_number?: string | null
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
          source?: string
          staff_card_id?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
          whatsapp_number?: string | null
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
          {
            foreignKeyName: "contacts_staff_card_id_fkey"
            columns: ["staff_card_id"]
            isOneToOne: false
            referencedRelation: "staff_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      data_deletion_log: {
        Row: {
          company_id: string
          created_at: string
          executed_at: string | null
          id: string
          notes: string | null
          scheduled_at: string
          triggered_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          executed_at?: string | null
          id?: string
          notes?: string | null
          scheduled_at: string
          triggered_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          executed_at?: string | null
          id?: string
          notes?: string | null
          scheduled_at?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_deletion_log_company_id_fkey"
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
      referrals: {
        Row: {
          created_at: string
          credited_at: string | null
          id: string
          referred_company_id: string
          referrer_company_id: string
          status: string
        }
        Insert: {
          created_at?: string
          credited_at?: string | null
          id?: string
          referred_company_id: string
          referrer_company_id: string
          status?: string
        }
        Update: {
          created_at?: string
          credited_at?: string | null
          id?: string
          referred_company_id?: string
          referrer_company_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_company_id_fkey"
            columns: ["referred_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_company_id_fkey"
            columns: ["referrer_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
          location: string | null
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
          location?: string | null
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
          location?: string | null
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
      increment_free_months: {
        Args: { company_id_arg: string }
        Returns: undefined
      }
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
