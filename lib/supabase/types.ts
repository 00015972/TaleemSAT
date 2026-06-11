/**
 * Generated from Supabase project hueyugiqprnsnogngcjn via MCP.
 * To regenerate: run mcp__claude_ai_Supabase__generate_typescript_types,
 * or `npx supabase gen types typescript --project-id hueyugiqprnsnogngcjn`.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      ai_insights: {
        Row: {
          computed_at: string;
          expires_at: string;
          id: string;
          kind: Database['public']['Enums']['ai_kind'];
          payload: Json;
          prompt_hash: string;
          user_id: string;
        };
        Insert: {
          computed_at?: string;
          expires_at: string;
          id?: string;
          kind: Database['public']['Enums']['ai_kind'];
          payload: Json;
          prompt_hash: string;
          user_id: string;
        };
        Update: {
          computed_at?: string;
          expires_at?: string;
          id?: string;
          kind?: Database['public']['Enums']['ai_kind'];
          payload?: Json;
          prompt_hash?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      attempts: {
        Row: {
          context: Database['public']['Enums']['attempt_context'];
          created_at: string;
          id: string;
          is_correct: boolean;
          question_id: string;
          selected_answer: string;
          time_taken_ms: number | null;
          user_id: string;
        };
        Insert: {
          context?: Database['public']['Enums']['attempt_context'];
          created_at?: string;
          id?: string;
          is_correct: boolean;
          question_id: string;
          selected_answer: string;
          time_taken_ms?: number | null;
          user_id: string;
        };
        Update: {
          context?: Database['public']['Enums']['attempt_context'];
          created_at?: string;
          id?: string;
          is_correct?: boolean;
          question_id?: string;
          selected_answer?: string;
          time_taken_ms?: number | null;
          user_id?: string;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          action: string;
          actor_user_id: string | null;
          after: Json | null;
          before: Json | null;
          created_at: string;
          id: string;
          note: string | null;
          target_id: string | null;
          target_type: string;
        };
        Insert: {
          action: string;
          actor_user_id?: string | null;
          after?: Json | null;
          before?: Json | null;
          created_at?: string;
          id?: string;
          note?: string | null;
          target_id?: string | null;
          target_type: string;
        };
        Update: {
          action?: string;
          actor_user_id?: string | null;
          after?: Json | null;
          before?: Json | null;
          created_at?: string;
          id?: string;
          note?: string | null;
          target_id?: string | null;
          target_type?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          created_at: string;
          description: string | null;
          display_order: number;
          id: string;
          name: string;
          slug: string;
          subject_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          display_order?: number;
          id?: string;
          name: string;
          slug: string;
          subject_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          display_order?: number;
          id?: string;
          name?: string;
          slug?: string;
          subject_id?: string;
        };
        Relationships: [];
      };
      certificates: {
        Row: {
          awarded_at: string;
          id: string;
          pdf_generated_at: string | null;
          pdf_url: string | null;
          tier: number;
          user_id: string;
        };
        Insert: {
          awarded_at?: string;
          id?: string;
          pdf_generated_at?: string | null;
          pdf_url?: string | null;
          tier: number;
          user_id: string;
        };
        Update: {
          awarded_at?: string;
          id?: string;
          pdf_generated_at?: string | null;
          pdf_url?: string | null;
          tier?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      email_subscriptions: {
        Row: {
          category: Database['public']['Enums']['email_category'];
          email: string;
          id: string;
          subscribed_at: string;
          unsubscribed_at: string | null;
          user_id: string | null;
        };
        Insert: {
          category: Database['public']['Enums']['email_category'];
          email: string;
          id?: string;
          subscribed_at?: string;
          unsubscribed_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          category?: Database['public']['Enums']['email_category'];
          email?: string;
          id?: string;
          subscribed_at?: string;
          unsubscribed_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      points_ledger: {
        Row: {
          created_at: string;
          delta: number;
          id: string;
          reason: string;
          reference_id: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          delta: number;
          id?: string;
          reason: string;
          reference_id?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          delta?: number;
          id?: string;
          reason?: string;
          reference_id?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      qod_answers: {
        Row: {
          created_at: string;
          id: string;
          is_correct: boolean;
          points_awarded: number;
          qod_id: string;
          selected_answer: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_correct: boolean;
          points_awarded?: number;
          qod_id: string;
          selected_answer: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_correct?: boolean;
          points_awarded?: number;
          qod_id?: string;
          selected_answer?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      qod_schedule: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          question_id: string;
          scheduled_date: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          question_id: string;
          scheduled_date: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          question_id?: string;
          scheduled_date?: string;
        };
        Relationships: [];
      };
      questions: {
        Row: {
          category_id: string;
          correct_answer: string;
          created_at: string;
          created_by: string | null;
          difficulty: Database['public']['Enums']['difficulty'];
          explanation: string;
          id: string;
          options: Json;
          passage: string | null;
          question_text: string;
          status: Database['public']['Enums']['question_status'];
          subject_id: string;
          tags: string[];
          updated_at: string;
        };
        Insert: {
          category_id: string;
          correct_answer: string;
          created_at?: string;
          created_by?: string | null;
          difficulty: Database['public']['Enums']['difficulty'];
          explanation: string;
          id?: string;
          options: Json;
          passage?: string | null;
          question_text: string;
          status?: Database['public']['Enums']['question_status'];
          subject_id: string;
          tags?: string[];
          updated_at?: string;
        };
        Update: {
          category_id?: string;
          correct_answer?: string;
          created_at?: string;
          created_by?: string | null;
          difficulty?: Database['public']['Enums']['difficulty'];
          explanation?: string;
          id?: string;
          options?: Json;
          passage?: string | null;
          question_text?: string;
          status?: Database['public']['Enums']['question_status'];
          subject_id?: string;
          tags?: string[];
          updated_at?: string;
        };
        Relationships: [];
      };
      stripe_events: {
        Row: {
          id: string;
          processed_at: string;
          raw: Json;
          stripe_event_id: string;
          type: string;
        };
        Insert: {
          id?: string;
          processed_at?: string;
          raw: Json;
          stripe_event_id: string;
          type: string;
        };
        Update: {
          id?: string;
          processed_at?: string;
          raw?: Json;
          stripe_event_id?: string;
          type?: string;
        };
        Relationships: [];
      };
      subjects: {
        Row: {
          created_at: string;
          display_order: number;
          id: string;
          name: string;
          slug: string;
        };
        Insert: {
          created_at?: string;
          display_order?: number;
          id?: string;
          name: string;
          slug: string;
        };
        Update: {
          created_at?: string;
          display_order?: number;
          id?: string;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean;
          created_at: string;
          current_period_end: string | null;
          id: string;
          payme_transaction_id: string | null;
          provider: Database['public']['Enums']['subscription_provider'];
          status: Database['public']['Enums']['subscription_status'];
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          tier: Database['public']['Enums']['user_tier'];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          cancel_at_period_end?: boolean;
          created_at?: string;
          current_period_end?: string | null;
          id?: string;
          payme_transaction_id?: string | null;
          provider: Database['public']['Enums']['subscription_provider'];
          status: Database['public']['Enums']['subscription_status'];
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          tier: Database['public']['Enums']['user_tier'];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          cancel_at_period_end?: boolean;
          created_at?: string;
          current_period_end?: string | null;
          id?: string;
          payme_transaction_id?: string | null;
          provider?: Database['public']['Enums']['subscription_provider'];
          status?: Database['public']['Enums']['subscription_status'];
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          tier?: Database['public']['Enums']['user_tier'];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      users: {
        Row: {
          created_at: string;
          current_period_end: string | null;
          email: string;
          exam_date: string | null;
          full_name: string | null;
          id: string;
          last_qod_answered_at: string | null;
          marketing_opt_in: boolean;
          points: number;
          role: Database['public']['Enums']['user_role'];
          streak_days: number;
          stripe_customer_id: string | null;
          subscription_id: string | null;
          subscription_status:
            | Database['public']['Enums']['subscription_status']
            | null;
          target_sat_score: number | null;
          tier: Database['public']['Enums']['user_tier'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          current_period_end?: string | null;
          email: string;
          exam_date?: string | null;
          full_name?: string | null;
          id: string;
          last_qod_answered_at?: string | null;
          marketing_opt_in?: boolean;
          points?: number;
          role?: Database['public']['Enums']['user_role'];
          streak_days?: number;
          stripe_customer_id?: string | null;
          subscription_id?: string | null;
          subscription_status?:
            | Database['public']['Enums']['subscription_status']
            | null;
          target_sat_score?: number | null;
          tier?: Database['public']['Enums']['user_tier'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          current_period_end?: string | null;
          email?: string;
          exam_date?: string | null;
          full_name?: string | null;
          id?: string;
          last_qod_answered_at?: string | null;
          marketing_opt_in?: boolean;
          points?: number;
          role?: Database['public']['Enums']['user_role'];
          streak_days?: number;
          stripe_customer_id?: string | null;
          subscription_id?: string | null;
          subscription_status?:
            | Database['public']['Enums']['subscription_status']
            | null;
          target_sat_score?: number | null;
          tier?: Database['public']['Enums']['user_tier'];
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: { Args: never; Returns: boolean };
    };
    Enums: {
      ai_kind: 'weakness' | 'plan' | 'prediction';
      attempt_context: 'practice' | 'qod' | 'mock';
      difficulty: 'easy' | 'medium' | 'hard';
      email_category: 'engagement' | 'marketing';
      question_status: 'draft' | 'published' | 'archived';
      subscription_provider: 'stripe' | 'payme';
      subscription_status:
        | 'active'
        | 'past_due'
        | 'canceled'
        | 'incomplete'
        | 'trialing';
      user_role: 'student' | 'admin';
      user_tier: 'free' | 'pro' | 'elite';
    };
    CompositeTypes: Record<string, never>;
  };
};
