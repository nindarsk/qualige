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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: string
          id: string
          organization_id: string
          user_id: string
          user_name: string
          user_role: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: string
          id?: string
          organization_id: string
          user_id: string
          user_name?: string
          user_role?: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: string
          id?: string
          organization_id?: string
          user_id?: string
          user_name?: string
          user_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          certificate_id: string
          course_id: string
          created_at: string
          employee_id: string
          id: string
          issued_at: string
          organization_id: string
          pdf_url: string | null
        }
        Insert: {
          certificate_id: string
          course_id: string
          created_at?: string
          employee_id: string
          id?: string
          issued_at?: string
          organization_id: string
          pdf_url?: string | null
        }
        Update: {
          certificate_id?: string
          course_id?: string
          created_at?: string
          employee_id?: string
          id?: string
          issued_at?: string
          organization_id?: string
          pdf_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      course_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          course_id: string
          created_at: string
          due_date: string | null
          employee_id: string
          id: string
          organization_id: string
          overdue_notified: boolean
          reminder_1day_sent: boolean
          reminder_3day_sent: boolean
          status: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          course_id: string
          created_at?: string
          due_date?: string | null
          employee_id: string
          id?: string
          organization_id: string
          overdue_notified?: boolean
          reminder_1day_sent?: boolean
          reminder_3day_sent?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          course_id?: string
          created_at?: string
          due_date?: string | null
          employee_id?: string
          id?: string
          organization_id?: string
          overdue_notified?: boolean
          reminder_1day_sent?: boolean
          reminder_3day_sent?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      course_modules: {
        Row: {
          content: string
          course_id: string
          created_at: string
          id: string
          key_points: string[] | null
          module_number: number
          title: string
        }
        Insert: {
          content?: string
          course_id: string
          created_at?: string
          id?: string
          key_points?: string[] | null
          module_number: number
          title: string
        }
        Update: {
          content?: string
          course_id?: string
          created_at?: string
          id?: string
          key_points?: string[] | null
          module_number?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_progress: {
        Row: {
          assignment_id: string
          completed_at: string | null
          completed_modules: string[]
          course_id: string
          created_at: string
          current_module: number
          employee_id: string
          id: string
          started_at: string
          updated_at: string
        }
        Insert: {
          assignment_id: string
          completed_at?: string | null
          completed_modules?: string[]
          course_id: string
          created_at?: string
          current_module?: number
          employee_id: string
          id?: string
          started_at?: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          completed_at?: string | null
          completed_modules?: string[]
          course_id?: string
          created_at?: string
          current_module?: number
          employee_id?: string
          id?: string
          started_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_progress_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: true
            referencedRelation: "course_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_progress_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_progress_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          category: string
          created_at: string
          created_by: string
          description: string | null
          duration_minutes: number | null
          id: string
          language: string
          learning_objectives: string[] | null
          organization_id: string
          source_file_path: string | null
          source_youtube_url: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          language?: string
          learning_objectives?: string[] | null
          organization_id: string
          source_file_path?: string | null
          source_youtube_url?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          language?: string
          learning_objectives?: string[] | null
          organization_id?: string
          source_file_path?: string | null
          source_youtube_url?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_requests: {
        Row: {
          billing_cycle: string | null
          created_at: string | null
          email: string
          full_name: string
          id: string
          message: string | null
          metadata: Json | null
          organization_name: string
          phone: string | null
          plan_name: string | null
          requested_action: string | null
          type: string
        }
        Insert: {
          billing_cycle?: string | null
          created_at?: string | null
          email: string
          full_name: string
          id?: string
          message?: string | null
          metadata?: Json | null
          organization_name: string
          phone?: string | null
          plan_name?: string | null
          requested_action?: string | null
          type: string
        }
        Update: {
          billing_cycle?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          message?: string | null
          metadata?: Json | null
          organization_name?: string
          phone?: string | null
          plan_name?: string | null
          requested_action?: string | null
          type?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          created_at: string
          department: string | null
          email: string
          full_name: string
          id: string
          invited_at: string
          joined_at: string | null
          organization_id: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          department?: string | null
          email: string
          full_name: string
          id?: string
          invited_at?: string
          joined_at?: string | null
          organization_id: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string
          id?: string
          invited_at?: string
          joined_at?: string | null
          organization_id?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          default_language: string | null
          id: string
          industry: string | null
          logo_url: string | null
          max_employees: number
          name: string
          notify_assignment: boolean
          notify_completion: boolean
          notify_overdue: boolean
          notify_reminder: boolean
          plan: string
          plan_ends_at: string | null
          plan_started_at: string | null
          plan_status: string
          primary_contact_email: string | null
          primary_contact_name: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_language?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          max_employees?: number
          name: string
          notify_assignment?: boolean
          notify_completion?: boolean
          notify_overdue?: boolean
          notify_reminder?: boolean
          plan?: string
          plan_ends_at?: string | null
          plan_started_at?: string | null
          plan_status?: string
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_language?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          max_employees?: number
          name?: string
          notify_assignment?: boolean
          notify_completion?: boolean
          notify_overdue?: boolean
          notify_reminder?: boolean
          plan?: string
          plan_ends_at?: string | null
          plan_started_at?: string | null
          plan_status?: string
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          language: string
          organization_id: string | null
          updated_at: string
          user_id: string
          welcome_banner_dismissed: boolean
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id?: string
          language?: string
          organization_id?: string | null
          updated_at?: string
          user_id: string
          welcome_banner_dismissed?: boolean
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          language?: string
          organization_id?: string | null
          updated_at?: string
          user_id?: string
          welcome_banner_dismissed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          answers: Json
          attempted_at: string
          course_id: string
          created_at: string
          employee_id: string
          id: string
          passed: boolean
          score: number
        }
        Insert: {
          answers?: Json
          attempted_at?: string
          course_id: string
          created_at?: string
          employee_id: string
          id?: string
          passed?: boolean
          score: number
        }
        Update: {
          answers?: Json
          attempted_at?: string
          course_id?: string
          created_at?: string
          employee_id?: string
          id?: string
          passed?: boolean
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          correct_answer: string
          course_id: string
          created_at: string
          explanation: string | null
          id: string
          options: string[]
          question: string
          question_number: number
        }
        Insert: {
          correct_answer: string
          course_id: string
          created_at?: string
          explanation?: string | null
          id?: string
          options?: string[]
          question: string
          question_number: number
        }
        Update: {
          correct_answer?: string
          course_id?: string
          created_at?: string
          explanation?: string | null
          id?: string
          options?: string[]
          question?: string
          question_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      organizations_safe: {
        Row: {
          created_at: string | null
          default_language: string | null
          id: string | null
          industry: string | null
          logo_url: string | null
          max_employees: number | null
          name: string | null
          notify_assignment: boolean | null
          notify_completion: boolean | null
          notify_overdue: boolean | null
          notify_reminder: boolean | null
          plan: string | null
          plan_ends_at: string | null
          plan_started_at: string | null
          plan_status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          default_language?: string | null
          id?: string | null
          industry?: string | null
          logo_url?: string | null
          max_employees?: number | null
          name?: string | null
          notify_assignment?: boolean | null
          notify_completion?: boolean | null
          notify_overdue?: boolean | null
          notify_reminder?: boolean | null
          plan?: string | null
          plan_ends_at?: string | null
          plan_started_at?: string | null
          plan_status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          default_language?: string | null
          id?: string | null
          industry?: string | null
          logo_url?: string | null
          max_employees?: number | null
          name?: string | null
          notify_assignment?: boolean | null
          notify_completion?: boolean | null
          notify_overdue?: boolean | null
          notify_reminder?: boolean | null
          plan?: string | null
          plan_ends_at?: string | null
          plan_started_at?: string | null
          plan_status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      quiz_questions_safe: {
        Row: {
          course_id: string | null
          created_at: string | null
          id: string | null
          options: string[] | null
          question: string | null
          question_number: number | null
        }
        Insert: {
          course_id?: string | null
          created_at?: string | null
          id?: string | null
          options?: string[] | null
          question?: string | null
          question_number?: number | null
        }
        Update: {
          course_id?: string | null
          created_at?: string | null
          id?: string | null
          options?: string[] | null
          question?: string | null
          question_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_user_organization_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "hr_admin" | "employee"
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
      app_role: ["super_admin", "hr_admin", "employee"],
    },
  },
} as const
