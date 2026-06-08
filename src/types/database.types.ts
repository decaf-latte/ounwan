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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
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
  public: {
    Tables: {
      body_parts: {
        Row: {
          code: string
          color: string | null
          display_order: number
          icon: string | null
          id: number
          name_ko: string
        }
        Insert: {
          code: string
          color?: string | null
          display_order: number
          icon?: string | null
          id?: number
          name_ko: string
        }
        Update: {
          code?: string
          color?: string | null
          display_order?: number
          icon?: string | null
          id?: number
          name_ko?: string
        }
        Relationships: []
      }
      body_weights: {
        Row: {
          id: string
          log_date: string
          recorded_at: string
          slot: string
          user_id: string
          weight_kg: number
        }
        Insert: {
          id?: string
          log_date: string
          recorded_at?: string
          slot: string
          user_id: string
          weight_kg: number
        }
        Update: {
          id?: string
          log_date?: string
          recorded_at?: string
          slot?: string
          user_id?: string
          weight_kg?: number
        }
        Relationships: []
      }
      cardio_logs: {
        Row: {
          created_at: string | null
          duration_min: number | null
          id: string
          incline: number | null
          machine: string
          session_id: string
          speed: number | null
        }
        Insert: {
          created_at?: string | null
          duration_min?: number | null
          id?: string
          incline?: number | null
          machine: string
          session_id: string
          speed?: number | null
        }
        Update: {
          created_at?: string | null
          duration_min?: number | null
          id?: string
          incline?: number | null
          machine?: string
          session_id?: string
          speed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cardio_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_body_parts: {
        Row: {
          body_part_id: number
          exercise_id: string
          is_primary: boolean | null
        }
        Insert: {
          body_part_id: number
          exercise_id: string
          is_primary?: boolean | null
        }
        Update: {
          body_part_id?: number
          exercise_id?: string
          is_primary?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_body_parts_body_part_id_fkey"
            columns: ["body_part_id"]
            isOneToOne: false
            referencedRelation: "body_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_body_parts_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          created_at: string | null
          default_reps_max: number | null
          default_reps_min: number | null
          default_sets: number | null
          equipment: string | null
          id: string
          is_unilateral: boolean | null
          name: string
          notes: string | null
          parent_exercise_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          default_reps_max?: number | null
          default_reps_min?: number | null
          default_sets?: number | null
          equipment?: string | null
          id?: string
          is_unilateral?: boolean | null
          name: string
          notes?: string | null
          parent_exercise_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          default_reps_max?: number | null
          default_reps_min?: number | null
          default_sets?: number | null
          equipment?: string | null
          id?: string
          is_unilateral?: boolean | null
          name?: string
          notes?: string | null
          parent_exercise_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercises_parent_exercise_id_fkey"
            columns: ["parent_exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      routine_template_body_parts: {
        Row: {
          body_part_id: number
          routine_template_id: string
        }
        Insert: {
          body_part_id: number
          routine_template_id: string
        }
        Update: {
          body_part_id?: number
          routine_template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "routine_template_body_parts_body_part_id_fkey"
            columns: ["body_part_id"]
            isOneToOne: false
            referencedRelation: "body_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_template_body_parts_routine_template_id_fkey"
            columns: ["routine_template_id"]
            isOneToOne: false
            referencedRelation: "routine_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      routine_templates: {
        Row: {
          created_at: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      workout_sessions: {
        Row: {
          created_at: string | null
          ended_at: string | null
          id: string
          overall_notes: string | null
          planned_exercise_ids: string[]
          routine_template_id: string | null
          started_at: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          ended_at?: string | null
          id?: string
          overall_notes?: string | null
          planned_exercise_ids?: string[]
          routine_template_id?: string | null
          started_at: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          ended_at?: string | null
          id?: string
          overall_notes?: string | null
          planned_exercise_ids?: string[]
          routine_template_id?: string | null
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_routine_template_id_fkey"
            columns: ["routine_template_id"]
            isOneToOne: false
            referencedRelation: "routine_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sets: {
        Row: {
          created_at: string | null
          drop_order: number | null
          exercise_id: string
          id: string
          memo: string | null
          parent_set_id: string | null
          reps: number | null
          session_id: string
          set_number: number
          side: string | null
          weight_kg: number | null
        }
        Insert: {
          created_at?: string | null
          drop_order?: number | null
          exercise_id: string
          id?: string
          memo?: string | null
          parent_set_id?: string | null
          reps?: number | null
          session_id: string
          set_number: number
          side?: string | null
          weight_kg?: number | null
        }
        Update: {
          created_at?: string | null
          drop_order?: number | null
          exercise_id?: string
          id?: string
          memo?: string | null
          parent_set_id?: string | null
          reps?: number | null
          session_id?: string
          set_number?: number
          side?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_sets_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sets_parent_set_id_fkey"
            columns: ["parent_set_id"]
            isOneToOne: false
            referencedRelation: "workout_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
