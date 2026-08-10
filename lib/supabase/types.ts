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
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_insights: {
        Row: {
          computed_at: string
          expires_at: string
          id: string
          kind: Database["public"]["Enums"]["ai_kind"]
          payload: Json
          prompt_hash: string
          user_id: string
        }
        Insert: {
          computed_at?: string
          expires_at: string
          id?: string
          kind: Database["public"]["Enums"]["ai_kind"]
          payload: Json
          prompt_hash: string
          user_id: string
        }
        Update: {
          computed_at?: string
          expires_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["ai_kind"]
          payload?: Json
          prompt_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_insights_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      attempts: {
        Row: {
          context: Database["public"]["Enums"]["attempt_context"]
          created_at: string
          id: string
          is_correct: boolean
          question_id: string
          selected_answer: string
          time_taken_ms: number | null
          user_id: string
        }
        Insert: {
          context?: Database["public"]["Enums"]["attempt_context"]
          created_at?: string
          id?: string
          is_correct: boolean
          question_id: string
          selected_answer: string
          time_taken_ms?: number | null
          user_id: string
        }
        Update: {
          context?: Database["public"]["Enums"]["attempt_context"]
          created_at?: string
          id?: string
          is_correct?: boolean
          question_id?: string
          selected_answer?: string
          time_taken_ms?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          id: string
          note: string | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          note?: string | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          note?: string | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          name: string
          slug: string
          subject_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name: string
          slug: string
          subject_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name?: string
          slug?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          awarded_at: string
          id: string
          pdf_generated_at: string | null
          pdf_url: string | null
          tier: number
          user_id: string
        }
        Insert: {
          awarded_at?: string
          id?: string
          pdf_generated_at?: string | null
          pdf_url?: string | null
          tier: number
          user_id: string
        }
        Update: {
          awarded_at?: string
          id?: string
          pdf_generated_at?: string | null
          pdf_url?: string | null
          tier?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_subscriptions: {
        Row: {
          category: Database["public"]["Enums"]["email_category"]
          email: string
          id: string
          subscribed_at: string
          unsubscribed_at: string | null
          user_id: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["email_category"]
          email: string
          id?: string
          subscribed_at?: string
          unsubscribed_at?: string | null
          user_id?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["email_category"]
          email?: string
          id?: string
          subscribed_at?: string
          unsubscribed_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_modules: {
        Row: {
          created_at: string
          display_order: number
          exam_id: string
          id: string
          module_number: number
          subject_id: string
          time_limit_seconds: number | null
          updated_at: string
          variant: Database["public"]["Enums"]["module_variant"] | null
        }
        Insert: {
          created_at?: string
          display_order?: number
          exam_id: string
          id?: string
          module_number: number
          subject_id: string
          time_limit_seconds?: number | null
          updated_at?: string
          variant?: Database["public"]["Enums"]["module_variant"] | null
        }
        Update: {
          created_at?: string
          display_order?: number
          exam_id?: string
          id?: string
          module_number?: number
          subject_id?: string
          time_limit_seconds?: number | null
          updated_at?: string
          variant?: Database["public"]["Enums"]["module_variant"] | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_modules_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_modules_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_questions: {
        Row: {
          created_at: string
          id: string
          module_id: string
          position: number
          question_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          module_id: string
          position: number
          question_id: string
        }
        Update: {
          created_at?: string
          id?: string
          module_id?: string
          position?: number
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_questions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "exam_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          created_at: string
          created_by: string | null
          display_order: number
          id: string
          status: Database["public"]["Enums"]["exam_status"]
          title: string
          updated_at: string
          version: string
          year: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_order?: number
          id?: string
          status?: Database["public"]["Enums"]["exam_status"]
          title: string
          updated_at?: string
          version: string
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_order?: number
          id?: string
          status?: Database["public"]["Enums"]["exam_status"]
          title?: string
          updated_at?: string
          version?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "exams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      import_job_items: {
        Row: {
          accepted_answers: string[]
          category_id: string | null
          chart_svg: string | null
          correct_answer: string | null
          created_at: string
          difficulty: Database["public"]["Enums"]["difficulty"] | null
          explanation: string | null
          id: string
          job_id: string
          options: Json
          passage: string | null
          question_id: string | null
          question_image_url: string | null
          question_text: string | null
          question_type: Database["public"]["Enums"]["question_type"]
          source_ref: string | null
          status: Database["public"]["Enums"]["import_item_status"]
          subject_id: string | null
          topic_id: string | null
          updated_at: string
          validation_errors: Json | null
          verification_notes: Json | null
        }
        Insert: {
          accepted_answers?: string[]
          category_id?: string | null
          chart_svg?: string | null
          correct_answer?: string | null
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty"] | null
          explanation?: string | null
          id?: string
          job_id: string
          options?: Json
          passage?: string | null
          question_id?: string | null
          question_image_url?: string | null
          question_text?: string | null
          question_type?: Database["public"]["Enums"]["question_type"]
          source_ref?: string | null
          status?: Database["public"]["Enums"]["import_item_status"]
          subject_id?: string | null
          topic_id?: string | null
          updated_at?: string
          validation_errors?: Json | null
          verification_notes?: Json | null
        }
        Update: {
          accepted_answers?: string[]
          category_id?: string | null
          chart_svg?: string | null
          correct_answer?: string | null
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty"] | null
          explanation?: string | null
          id?: string
          job_id?: string
          options?: Json
          passage?: string | null
          question_id?: string | null
          question_image_url?: string | null
          question_text?: string | null
          question_type?: Database["public"]["Enums"]["question_type"]
          source_ref?: string | null
          status?: Database["public"]["Enums"]["import_item_status"]
          subject_id?: string | null
          topic_id?: string | null
          updated_at?: string
          validation_errors?: Json | null
          verification_notes?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "import_job_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_job_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_job_items_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_job_items_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          completed_at: string | null
          config: Json
          created_at: string
          created_by: string
          error: string | null
          failed_count: number
          id: string
          source_filename: string | null
          source_format: string
          source_html_path: string | null
          source_pdf_path: string | null
          status: Database["public"]["Enums"]["import_job_status"]
          success_count: number
          total_count: number
          trigger_run_id: string | null
          type: Database["public"]["Enums"]["import_job_type"]
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          config?: Json
          created_at?: string
          created_by: string
          error?: string | null
          failed_count?: number
          id?: string
          source_filename?: string | null
          source_format?: string
          source_html_path?: string | null
          source_pdf_path?: string | null
          status?: Database["public"]["Enums"]["import_job_status"]
          success_count?: number
          total_count?: number
          trigger_run_id?: string | null
          type: Database["public"]["Enums"]["import_job_type"]
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          config?: Json
          created_at?: string
          created_by?: string
          error?: string | null
          failed_count?: number
          id?: string
          source_filename?: string | null
          source_format?: string
          source_html_path?: string | null
          source_pdf_path?: string | null
          status?: Database["public"]["Enums"]["import_job_status"]
          success_count?: number
          total_count?: number
          trigger_run_id?: string | null
          type?: Database["public"]["Enums"]["import_job_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      points_ledger: {
        Row: {
          created_at: string
          delta: number
          id: string
          reason: string
          reference_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          reason: string
          reference_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          reason?: string
          reference_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      qod_answers: {
        Row: {
          created_at: string
          id: string
          is_correct: boolean
          points_awarded: number
          qod_id: string
          selected_answer: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_correct: boolean
          points_awarded?: number
          qod_id: string
          selected_answer: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_correct?: boolean
          points_awarded?: number
          qod_id?: string
          selected_answer?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qod_answers_qod_id_fkey"
            columns: ["qod_id"]
            isOneToOne: false
            referencedRelation: "qod_schedule"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qod_answers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      qod_schedule: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          question_id: string
          scheduled_date: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          question_id: string
          scheduled_date: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          question_id?: string
          scheduled_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "qod_schedule_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qod_schedule_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_ai_explanations: {
        Row: {
          created_at: string
          payload: Json
          question_id: string
        }
        Insert: {
          created_at?: string
          payload: Json
          question_id: string
        }
        Update: {
          created_at?: string
          payload?: Json
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_ai_explanations_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: true
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          accepted_answers: string[]
          category_id: string
          chart_svg: string | null
          correct_answer: string
          created_at: string
          created_by: string | null
          difficulty: Database["public"]["Enums"]["difficulty"]
          explanation: string
          id: string
          options: Json
          passage: string | null
          question_image_url: string | null
          question_text: string
          question_type: Database["public"]["Enums"]["question_type"]
          status: Database["public"]["Enums"]["question_status"]
          subject_id: string
          tags: string[]
          topic_id: string | null
          updated_at: string
        }
        Insert: {
          accepted_answers?: string[]
          category_id: string
          chart_svg?: string | null
          correct_answer: string
          created_at?: string
          created_by?: string | null
          difficulty: Database["public"]["Enums"]["difficulty"]
          explanation: string
          id?: string
          options: Json
          passage?: string | null
          question_image_url?: string | null
          question_text: string
          question_type?: Database["public"]["Enums"]["question_type"]
          status?: Database["public"]["Enums"]["question_status"]
          subject_id: string
          tags?: string[]
          topic_id?: string | null
          updated_at?: string
        }
        Update: {
          accepted_answers?: string[]
          category_id?: string
          chart_svg?: string | null
          correct_answer?: string
          created_at?: string
          created_by?: string | null
          difficulty?: Database["public"]["Enums"]["difficulty"]
          explanation?: string
          id?: string
          options?: Json
          passage?: string | null
          question_image_url?: string | null
          question_text?: string
          question_type?: Database["public"]["Enums"]["question_type"]
          status?: Database["public"]["Enums"]["question_status"]
          subject_id?: string
          tags?: string[]
          topic_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_events: {
        Row: {
          id: string
          processed_at: string
          raw: Json
          stripe_event_id: string
          type: string
        }
        Insert: {
          id?: string
          processed_at?: string
          raw: Json
          stripe_event_id: string
          type: string
        }
        Update: {
          id?: string
          processed_at?: string
          raw?: Json
          stripe_event_id?: string
          type?: string
        }
        Relationships: []
      }
      subjects: {
        Row: {
          created_at: string
          display_order: number
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          id: string
          payme_transaction_id: string | null
          provider: Database["public"]["Enums"]["subscription_provider"]
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: Database["public"]["Enums"]["user_tier"]
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          payme_transaction_id?: string | null
          provider: Database["public"]["Enums"]["subscription_provider"]
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier: Database["public"]["Enums"]["user_tier"]
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          payme_transaction_id?: string | null
          provider?: Database["public"]["Enums"]["subscription_provider"]
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: Database["public"]["Enums"]["user_tier"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          current_period_end: string | null
          email: string
          exam_date: string | null
          full_name: string | null
          id: string
          last_qod_answered_at: string | null
          marketing_opt_in: boolean
          points: number
          role: Database["public"]["Enums"]["user_role"]
          streak_days: number
          stripe_customer_id: string | null
          subscription_id: string | null
          subscription_status:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          target_sat_score: number | null
          tier: Database["public"]["Enums"]["user_tier"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          email: string
          exam_date?: string | null
          full_name?: string | null
          id: string
          last_qod_answered_at?: string | null
          marketing_opt_in?: boolean
          points?: number
          role?: Database["public"]["Enums"]["user_role"]
          streak_days?: number
          stripe_customer_id?: string | null
          subscription_id?: string | null
          subscription_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          target_sat_score?: number | null
          tier?: Database["public"]["Enums"]["user_tier"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          email?: string
          exam_date?: string | null
          full_name?: string | null
          id?: string
          last_qod_answered_at?: string | null
          marketing_opt_in?: boolean
          points?: number
          role?: Database["public"]["Enums"]["user_role"]
          streak_days?: number
          stripe_customer_id?: string | null
          subscription_id?: string | null
          subscription_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          target_sat_score?: number | null
          tier?: Database["public"]["Enums"]["user_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      vocab_cache: {
        Row: {
          created_at: string
          definition: string
          display: string
          part_of_speech: string | null
          ru: string
          uz: string
          word: string
        }
        Insert: {
          created_at?: string
          definition: string
          display: string
          part_of_speech?: string | null
          ru: string
          uz: string
          word: string
        }
        Update: {
          created_at?: string
          definition?: string
          display?: string
          part_of_speech?: string | null
          ru?: string
          uz?: string
          word?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      ai_kind: "weakness" | "plan" | "prediction"
      attempt_context: "practice" | "qod" | "mock"
      difficulty: "easy" | "medium" | "hard"
      email_category: "engagement" | "marketing"
      exam_status: "draft" | "published" | "archived"
      module_variant: "easy" | "hard"
      import_item_status:
        | "pending_review"
        | "verification_failed"
        | "approved"
        | "rejected"
      import_job_status: "queued" | "running" | "completed" | "failed"
      import_job_type: "extract" | "generate"
      question_status: "draft" | "published" | "archived"
      question_type: "mcq" | "grid_in"
      subscription_provider: "stripe" | "payme"
      subscription_status:
        | "active"
        | "past_due"
        | "canceled"
        | "incomplete"
        | "trialing"
      user_role: "student" | "admin"
      user_tier: "free" | "pro" | "elite"
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
    Enums: {
      ai_kind: ["weakness", "plan", "prediction"],
      attempt_context: ["practice", "qod", "mock"],
      difficulty: ["easy", "medium", "hard"],
      email_category: ["engagement", "marketing"],
      exam_status: ["draft", "published", "archived"],
      module_variant: ["easy", "hard"],
      import_item_status: [
        "pending_review",
        "verification_failed",
        "approved",
        "rejected",
      ],
      import_job_status: ["queued", "running", "completed", "failed"],
      import_job_type: ["extract", "generate"],
      question_status: ["draft", "published", "archived"],
      question_type: ["mcq", "grid_in"],
      subscription_provider: ["stripe", "payme"],
      subscription_status: [
        "active",
        "past_due",
        "canceled",
        "incomplete",
        "trialing",
      ],
      user_role: ["student", "admin"],
      user_tier: ["free", "pro", "elite"],
    },
  },
} as const
