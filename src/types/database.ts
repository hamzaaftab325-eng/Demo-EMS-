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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      attendance_corrections: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          field_name: string
          id: string
          new_value: Json
          old_value: Json | null
          reason: string
          requested_by: string | null
          workday_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          field_name: string
          id?: string
          new_value: Json
          old_value?: Json | null
          reason: string
          requested_by?: string | null
          workday_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          field_name?: string
          id?: string
          new_value?: Json
          old_value?: Json | null
          reason?: string
          requested_by?: string | null
          workday_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_corrections_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_corrections_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_corrections_workday_id_fkey"
            columns: ["workday_id"]
            isOneToOne: false
            referencedRelation: "workdays"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_events: {
        Row: {
          created_at: string
          created_by: string | null
          event_type: Database["public"]["Enums"]["attendance_event_type"]
          id: string
          notes: string | null
          occurred_at: string
          source: string
          workday_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_type: Database["public"]["Enums"]["attendance_event_type"]
          id?: string
          notes?: string | null
          occurred_at?: string
          source?: string
          workday_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_type?: Database["public"]["Enums"]["attendance_event_type"]
          id?: string
          notes?: string | null
          occurred_at?: string
          source?: string
          workday_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_workday_id_fkey"
            columns: ["workday_id"]
            isOneToOne: false
            referencedRelation: "workdays"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          auto_signoff_idle_minutes: number
          company_name: string
          created_at: string
          default_daily_target_minutes: number
          default_schedule_id: string | null
          grace_period_minutes: number
          id: number
          require_final_request_approval: boolean
          require_scrum_for_signin: boolean
          require_scrum_for_signoff: boolean
          timezone: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auto_signoff_idle_minutes?: number
          company_name?: string
          created_at?: string
          default_daily_target_minutes?: number
          default_schedule_id?: string | null
          grace_period_minutes?: number
          id?: number
          require_final_request_approval?: boolean
          require_scrum_for_signin?: boolean
          require_scrum_for_signoff?: boolean
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auto_signoff_idle_minutes?: number
          company_name?: string
          created_at?: string
          default_daily_target_minutes?: number
          default_schedule_id?: string | null
          grace_period_minutes?: number
          id?: number
          require_final_request_approval?: boolean
          require_scrum_for_signin?: boolean
          require_scrum_for_signoff?: boolean
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_default_schedule_id_fkey"
            columns: ["default_schedule_id"]
            isOneToOne: false
            referencedRelation: "work_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      employee_presence: {
        Row: {
          employee_id: string
          last_activity_at: string | null
          last_heartbeat_at: string | null
          status: Database["public"]["Enums"]["presence_status"]
          status_changed_at: string
          tab_connected: boolean
          updated_at: string
          workday_id: string | null
        }
        Insert: {
          employee_id: string
          last_activity_at?: string | null
          last_heartbeat_at?: string | null
          status?: Database["public"]["Enums"]["presence_status"]
          status_changed_at?: string
          tab_connected?: boolean
          updated_at?: string
          workday_id?: string | null
        }
        Update: {
          employee_id?: string
          last_activity_at?: string | null
          last_heartbeat_at?: string | null
          status?: Database["public"]["Enums"]["presence_status"]
          status_changed_at?: string
          tab_connected?: boolean
          updated_at?: string
          workday_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_presence_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_presence_workday_id_fkey"
            columns: ["workday_id"]
            isOneToOne: false
            referencedRelation: "workdays"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          effective_at: string
          employee_id: string
          id: string
          new_status: Database["public"]["Enums"]["employment_status"]
          old_status: Database["public"]["Enums"]["employment_status"] | null
          reason: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          effective_at?: string
          employee_id: string
          id?: string
          new_status: Database["public"]["Enums"]["employment_status"]
          old_status?: Database["public"]["Enums"]["employment_status"] | null
          reason?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          effective_at?: string
          employee_id?: string
          id?: string
          new_status?: Database["public"]["Enums"]["employment_status"]
          old_status?: Database["public"]["Enums"]["employment_status"] | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_status_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          country_code: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          holiday_date: string
          id: string
          is_company_wide: boolean
          name: string
          updated_at: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          holiday_date: string
          id?: string
          is_company_wide?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          holiday_date?: string
          id?: string
          is_company_wide?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "holidays_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holidays_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      import_errors: {
        Row: {
          created_at: string
          field_name: string | null
          id: string
          import_id: string
          message: string
          raw_data: Json | null
          row_number: number
        }
        Insert: {
          created_at?: string
          field_name?: string | null
          id?: string
          import_id: string
          message: string
          raw_data?: Json | null
          row_number: number
        }
        Update: {
          created_at?: string
          field_name?: string | null
          id?: string
          import_id?: string
          message?: string
          raw_data?: Json | null
          row_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_errors_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "imports"
            referencedColumns: ["id"]
          },
        ]
      }
      imports: {
        Row: {
          completed_at: string | null
          created_at: string
          failed_rows: number
          file_name: string
          id: string
          import_type: string
          status: Database["public"]["Enums"]["import_status"]
          successful_rows: number
          total_rows: number
          uploaded_by: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          failed_rows?: number
          file_name: string
          id?: string
          import_type: string
          status?: Database["public"]["Enums"]["import_status"]
          successful_rows?: number
          total_rows?: number
          uploaded_by?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          failed_rows?: number
          file_name?: string
          id?: string
          import_type?: string
          status?: Database["public"]["Enums"]["import_status"]
          successful_rows?: number
          total_rows?: number
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "imports_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_ledger: {
        Row: {
          created_at: string
          created_by: string | null
          days: number
          effective_date: string
          employee_id: string
          id: string
          leave_type_id: string
          note: string | null
          request_id: string | null
          transaction_type: Database["public"]["Enums"]["leave_transaction_type"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          days: number
          effective_date: string
          employee_id: string
          id?: string
          leave_type_id: string
          note?: string | null
          request_id?: string | null
          transaction_type: Database["public"]["Enums"]["leave_transaction_type"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          days?: number
          effective_date?: string
          employee_id?: string
          id?: string
          leave_type_id?: string
          note?: string | null
          request_id?: string | null
          transaction_type?: Database["public"]["Enums"]["leave_transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "leave_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_ledger_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_ledger_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_ledger_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_request_details: {
        Row: {
          days_requested: number
          employee_note: string | null
          leave_type_id: string
          request_id: string
        }
        Insert: {
          days_requested: number
          employee_note?: string | null
          leave_type_id: string
          request_id: string
        }
        Update: {
          days_requested?: number
          employee_note?: string | null
          leave_type_id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_request_details_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_request_details_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_types: {
        Row: {
          code: string
          created_at: string
          default_annual_days: number | null
          id: string
          is_active: boolean
          is_paid: boolean
          name: string
          requires_attachment: boolean
          requires_reason: boolean
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          default_annual_days?: number | null
          id?: string
          is_active?: boolean
          is_paid?: boolean
          name: string
          requires_attachment?: boolean
          requires_reason?: boolean
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          default_annual_days?: number | null
          id?: string
          is_active?: boolean
          is_paid?: boolean
          name?: string
          requires_attachment?: boolean
          requires_reason?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean
          message: string
          read_at: string | null
          recipient_id: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          message: string
          read_at?: string | null
          recipient_id: string
          title: string
          type: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          message?: string
          read_at?: string | null
          recipient_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      presence_events: {
        Row: {
          created_at: string
          employee_id: string
          ended_at: string | null
          id: string
          started_at: string
          status: Database["public"]["Enums"]["presence_status"]
          workday_id: string | null
        }
        Insert: {
          created_at?: string
          employee_id: string
          ended_at?: string | null
          id?: string
          started_at: string
          status: Database["public"]["Enums"]["presence_status"]
          workday_id?: string | null
        }
        Update: {
          created_at?: string
          employee_id?: string
          ended_at?: string | null
          id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["presence_status"]
          workday_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "presence_events_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presence_events_workday_id_fkey"
            columns: ["workday_id"]
            isOneToOne: false
            referencedRelation: "workdays"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auth_user_id: string | null
          avatar_url: string | null
          created_at: string
          created_by: string | null
          deactivated_at: string | null
          deactivation_reason: string | null
          department_id: string
          email: string
          employee_code: string
          employment_status: Database["public"]["Enums"]["employment_status"]
          employment_type: Database["public"]["Enums"]["employment_type"]
          full_name: string
          hire_date: string | null
          id: string
          is_active: boolean
          is_test_account: boolean
          job_title: string
          last_login_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          timezone: string
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          deactivation_reason?: string | null
          department_id: string
          email: string
          employee_code: string
          employment_status?: Database["public"]["Enums"]["employment_status"]
          employment_type?: Database["public"]["Enums"]["employment_type"]
          full_name: string
          hire_date?: string | null
          id?: string
          is_active?: boolean
          is_test_account?: boolean
          job_title: string
          last_login_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          deactivation_reason?: string | null
          department_id?: string
          email?: string
          employee_code?: string
          employment_status?: Database["public"]["Enums"]["employment_status"]
          employment_type?: Database["public"]["Enums"]["employment_type"]
          full_name?: string
          hire_date?: string | null
          id?: string
          is_active?: boolean
          is_test_account?: boolean
          job_title?: string
          last_login_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      reporting_lines: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          employee_id: string
          id: string
          is_primary: boolean
          manager_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          employee_id: string
          id?: string
          is_primary?: boolean
          manager_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          employee_id?: string
          id?: string
          is_primary?: boolean
          manager_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reporting_lines_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reporting_lines_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reporting_lines_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      request_approvals: {
        Row: {
          approver_id: string
          comment: string | null
          created_at: string
          decided_at: string | null
          decision: Database["public"]["Enums"]["approval_decision"]
          id: string
          request_id: string
          stage: Database["public"]["Enums"]["approval_stage"]
          updated_at: string
        }
        Insert: {
          approver_id: string
          comment?: string | null
          created_at?: string
          decided_at?: string | null
          decision?: Database["public"]["Enums"]["approval_decision"]
          id?: string
          request_id: string
          stage: Database["public"]["Enums"]["approval_stage"]
          updated_at?: string
        }
        Update: {
          approver_id?: string
          comment?: string | null
          created_at?: string
          decided_at?: string | null
          decision?: Database["public"]["Enums"]["approval_decision"]
          id?: string
          request_id?: string
          stage?: Database["public"]["Enums"]["approval_stage"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_approvals_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_approvals_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      requests: {
        Row: {
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          current_stage: Database["public"]["Enums"]["approval_stage"] | null
          employee_id: string
          end_date: string
          id: string
          reason: string | null
          request_number: number
          request_type: Database["public"]["Enums"]["request_type"]
          start_date: string
          status: Database["public"]["Enums"]["request_status"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          current_stage?: Database["public"]["Enums"]["approval_stage"] | null
          employee_id: string
          end_date: string
          id?: string
          reason?: string | null
          request_number?: never
          request_type: Database["public"]["Enums"]["request_type"]
          start_date: string
          status?: Database["public"]["Enums"]["request_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          current_stage?: Database["public"]["Enums"]["approval_stage"] | null
          employee_id?: string
          end_date?: string
          id?: string
          reason?: string | null
          request_number?: never
          request_type?: Database["public"]["Enums"]["request_type"]
          start_date?: string
          status?: Database["public"]["Enums"]["request_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_assignments: {
        Row: {
          assigned_by: string | null
          created_at: string
          effective_from: string
          effective_to: string | null
          employee_id: string
          id: string
          schedule_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          effective_from: string
          effective_to?: string | null
          employee_id: string
          id?: string
          schedule_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          employee_id?: string
          id?: string
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_assignments_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "work_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_change_details: {
        Row: {
          is_permanent: boolean
          new_end_time: string
          new_start_time: string
          request_id: string
        }
        Insert: {
          is_permanent?: boolean
          new_end_time: string
          new_start_time: string
          request_id: string
        }
        Update: {
          is_permanent?: boolean
          new_end_time?: string
          new_start_time?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_change_details_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      scrum_entries: {
        Row: {
          created_at: string
          id: string
          signed_in_at: string | null
          signed_off_at: string | null
          status: Database["public"]["Enums"]["scrum_entry_status"]
          updated_at: string
          workday_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          signed_in_at?: string | null
          signed_off_at?: string | null
          status?: Database["public"]["Enums"]["scrum_entry_status"]
          updated_at?: string
          workday_id: string
        }
        Update: {
          created_at?: string
          id?: string
          signed_in_at?: string | null
          signed_off_at?: string | null
          status?: Database["public"]["Enums"]["scrum_entry_status"]
          updated_at?: string
          workday_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scrum_entries_workday_id_fkey"
            columns: ["workday_id"]
            isOneToOne: true
            referencedRelation: "workdays"
            referencedColumns: ["id"]
          },
        ]
      }
      scrum_entry_items: {
        Row: {
          added_at: string
          carried_from_entry_item_id: string | null
          created_at: string
          final_percent: number | null
          id: string
          scrum_entry_id: string
          scrum_item_id: string
          sign_off_note: string | null
          starting_percent: number
        }
        Insert: {
          added_at?: string
          carried_from_entry_item_id?: string | null
          created_at?: string
          final_percent?: number | null
          id?: string
          scrum_entry_id: string
          scrum_item_id: string
          sign_off_note?: string | null
          starting_percent?: number
        }
        Update: {
          added_at?: string
          carried_from_entry_item_id?: string | null
          created_at?: string
          final_percent?: number | null
          id?: string
          scrum_entry_id?: string
          scrum_item_id?: string
          sign_off_note?: string | null
          starting_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "scrum_entry_items_carried_from_entry_item_id_fkey"
            columns: ["carried_from_entry_item_id"]
            isOneToOne: false
            referencedRelation: "scrum_entry_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scrum_entry_items_scrum_entry_id_fkey"
            columns: ["scrum_entry_id"]
            isOneToOne: false
            referencedRelation: "scrum_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scrum_entry_items_scrum_item_id_fkey"
            columns: ["scrum_item_id"]
            isOneToOne: false
            referencedRelation: "scrum_items"
            referencedColumns: ["id"]
          },
        ]
      }
      scrum_item_progress: {
        Row: {
          event_type: Database["public"]["Enums"]["scrum_progress_event"]
          id: string
          note: string | null
          percent: number
          recorded_at: string
          recorded_by: string | null
          scrum_entry_item_id: string
        }
        Insert: {
          event_type?: Database["public"]["Enums"]["scrum_progress_event"]
          id?: string
          note?: string | null
          percent: number
          recorded_at?: string
          recorded_by?: string | null
          scrum_entry_item_id: string
        }
        Update: {
          event_type?: Database["public"]["Enums"]["scrum_progress_event"]
          id?: string
          note?: string | null
          percent?: number
          recorded_at?: string
          recorded_by?: string | null
          scrum_entry_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scrum_item_progress_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scrum_item_progress_scrum_entry_item_id_fkey"
            columns: ["scrum_entry_item_id"]
            isOneToOne: false
            referencedRelation: "scrum_entry_items"
            referencedColumns: ["id"]
          },
        ]
      }
      scrum_items: {
        Row: {
          assigned_by: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          employee_id: string
          id: string
          project_code: string | null
          source: Database["public"]["Enums"]["scrum_item_source"]
          status: Database["public"]["Enums"]["scrum_task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          employee_id: string
          id?: string
          project_code?: string | null
          source?: Database["public"]["Enums"]["scrum_item_source"]
          status?: Database["public"]["Enums"]["scrum_task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          employee_id?: string
          id?: string
          project_code?: string | null
          source?: Database["public"]["Enums"]["scrum_item_source"]
          status?: Database["public"]["Enums"]["scrum_task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scrum_items_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scrum_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scrum_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scrum_obstacles: {
        Row: {
          description: string
          id: string
          reported_at: string
          reported_stage: Database["public"]["Enums"]["obstacle_stage"]
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          scrum_entry_id: string
          status: Database["public"]["Enums"]["obstacle_status"]
        }
        Insert: {
          description: string
          id?: string
          reported_at?: string
          reported_stage: Database["public"]["Enums"]["obstacle_stage"]
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          scrum_entry_id: string
          status?: Database["public"]["Enums"]["obstacle_status"]
        }
        Update: {
          description?: string
          id?: string
          reported_at?: string
          reported_stage?: Database["public"]["Enums"]["obstacle_stage"]
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          scrum_entry_id?: string
          status?: Database["public"]["Enums"]["obstacle_status"]
        }
        Relationships: [
          {
            foreignKeyName: "scrum_obstacles_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scrum_obstacles_scrum_entry_id_fkey"
            columns: ["scrum_entry_id"]
            isOneToOne: false
            referencedRelation: "scrum_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      work_intervals: {
        Row: {
          corrected_by: string | null
          created_at: string
          ended_at: string | null
          id: string
          interval_type: Database["public"]["Enums"]["interval_type"]
          notes: string | null
          started_at: string
          status: Database["public"]["Enums"]["interval_status"]
          updated_at: string
          workday_id: string
        }
        Insert: {
          corrected_by?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          interval_type: Database["public"]["Enums"]["interval_type"]
          notes?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["interval_status"]
          updated_at?: string
          workday_id: string
        }
        Update: {
          corrected_by?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          interval_type?: Database["public"]["Enums"]["interval_type"]
          notes?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["interval_status"]
          updated_at?: string
          workday_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_intervals_corrected_by_fkey"
            columns: ["corrected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_intervals_workday_id_fkey"
            columns: ["workday_id"]
            isOneToOne: false
            referencedRelation: "workdays"
            referencedColumns: ["id"]
          },
        ]
      }
      work_schedules: {
        Row: {
          core_end_time: string | null
          core_start_time: string | null
          created_at: string
          daily_target_minutes: number
          end_time: string | null
          grace_minutes: number
          id: string
          is_active: boolean
          name: string
          schedule_type: Database["public"]["Enums"]["schedule_type"]
          start_time: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          core_end_time?: string | null
          core_start_time?: string | null
          created_at?: string
          daily_target_minutes: number
          end_time?: string | null
          grace_minutes?: number
          id?: string
          is_active?: boolean
          name: string
          schedule_type: Database["public"]["Enums"]["schedule_type"]
          start_time?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          core_end_time?: string | null
          core_start_time?: string | null
          created_at?: string
          daily_target_minutes?: number
          end_time?: string | null
          grace_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          schedule_type?: Database["public"]["Enums"]["schedule_type"]
          start_time?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      workdays: {
        Row: {
          attendance_status:
            | Database["public"]["Enums"]["attendance_status"]
            | null
          closed_at: string | null
          created_at: string
          employee_id: string
          id: string
          notes: string | null
          schedule_id: string | null
          status: Database["public"]["Enums"]["workday_status"]
          timezone: string
          updated_at: string
          work_date: string
        }
        Insert: {
          attendance_status?:
            | Database["public"]["Enums"]["attendance_status"]
            | null
          closed_at?: string | null
          created_at?: string
          employee_id: string
          id?: string
          notes?: string | null
          schedule_id?: string | null
          status?: Database["public"]["Enums"]["workday_status"]
          timezone?: string
          updated_at?: string
          work_date: string
        }
        Update: {
          attendance_status?:
            | Database["public"]["Enums"]["attendance_status"]
            | null
          closed_at?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          notes?: string | null
          schedule_id?: string | null
          status?: Database["public"]["Enums"]["workday_status"]
          timezone?: string
          updated_at?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "workdays_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workdays_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "work_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_create_employee: {
        Args: {
          p_department_id: string
          p_email: string
          p_employee_code: string
          p_employment_type: Database["public"]["Enums"]["employment_type"]
          p_full_name: string
          p_hire_date?: string
          p_is_test_account?: boolean
          p_job_title: string
          p_manager_id?: string
          p_role: Database["public"]["Enums"]["app_role"]
          p_schedule_id?: string
          p_timezone?: string
        }
        Returns: string
      }
      admin_update_employee: {
        Args: {
          p_deactivation_reason?: string
          p_department_id: string
          p_email: string
          p_employee_code: string
          p_employee_id: string
          p_employment_status: Database["public"]["Enums"]["employment_status"]
          p_employment_type: Database["public"]["Enums"]["employment_type"]
          p_full_name: string
          p_hire_date: string
          p_job_title: string
          p_manager_id: string
          p_role: Database["public"]["Enums"]["app_role"]
          p_schedule_id: string
          p_timezone: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "employee" | "manager" | "director" | "super_admin"
      approval_decision: "pending" | "approved" | "rejected"
      approval_stage: "manager" | "final"
      attendance_event_type:
        | "sign_in"
        | "sign_off"
        | "sign_back_in"
        | "auto_sign_off"
        | "correction"
      attendance_status:
        | "present"
        | "late"
        | "absent"
        | "on_leave"
        | "partial"
        | "holiday"
        | "weekend"
        | "missing_sign_off"
      employment_status: "active" | "on_leave" | "deactivated"
      employment_type: "full_time" | "part_time" | "contract" | "intern"
      import_status: "pending" | "processing" | "completed" | "failed"
      interval_status: "active" | "completed" | "corrected"
      interval_type: "break" | "meeting"
      leave_transaction_type:
        | "allocation"
        | "approved_leave"
        | "adjustment"
        | "reversal"
      obstacle_stage: "sign_in" | "during_day" | "sign_off"
      obstacle_status: "open" | "resolved" | "dismissed"
      presence_status:
        | "active"
        | "idle"
        | "away"
        | "on_break"
        | "in_meeting"
        | "offline"
        | "workday_ended"
      request_status:
        | "draft"
        | "pending_manager"
        | "pending_final"
        | "approved"
        | "rejected"
        | "cancelled"
      request_type: "leave" | "shift_change" | "hour_change"
      schedule_type: "fixed" | "flexible" | "flexible_core"
      scrum_entry_status: "draft" | "signed_in" | "signed_off" | "reopened"
      scrum_item_source: "employee" | "manager" | "carried_over" | "backlog"
      scrum_progress_event:
        | "sign_in"
        | "update"
        | "sign_off"
        | "manager_update"
        | "system"
      scrum_task_status: "backlog" | "active" | "completed" | "cancelled"
      workday_status:
        | "not_started"
        | "working"
        | "on_break"
        | "in_meeting"
        | "signed_off"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["employee", "manager", "director", "super_admin"],
      approval_decision: ["pending", "approved", "rejected"],
      approval_stage: ["manager", "final"],
      attendance_event_type: [
        "sign_in",
        "sign_off",
        "sign_back_in",
        "auto_sign_off",
        "correction",
      ],
      attendance_status: [
        "present",
        "late",
        "absent",
        "on_leave",
        "partial",
        "holiday",
        "weekend",
        "missing_sign_off",
      ],
      employment_status: ["active", "on_leave", "deactivated"],
      employment_type: ["full_time", "part_time", "contract", "intern"],
      import_status: ["pending", "processing", "completed", "failed"],
      interval_status: ["active", "completed", "corrected"],
      interval_type: ["break", "meeting"],
      leave_transaction_type: [
        "allocation",
        "approved_leave",
        "adjustment",
        "reversal",
      ],
      obstacle_stage: ["sign_in", "during_day", "sign_off"],
      obstacle_status: ["open", "resolved", "dismissed"],
      presence_status: [
        "active",
        "idle",
        "away",
        "on_break",
        "in_meeting",
        "offline",
        "workday_ended",
      ],
      request_status: [
        "draft",
        "pending_manager",
        "pending_final",
        "approved",
        "rejected",
        "cancelled",
      ],
      request_type: ["leave", "shift_change", "hour_change"],
      schedule_type: ["fixed", "flexible", "flexible_core"],
      scrum_entry_status: ["draft", "signed_in", "signed_off", "reopened"],
      scrum_item_source: ["employee", "manager", "carried_over", "backlog"],
      scrum_progress_event: [
        "sign_in",
        "update",
        "sign_off",
        "manager_update",
        "system",
      ],
      scrum_task_status: ["backlog", "active", "completed", "cancelled"],
      workday_status: [
        "not_started",
        "working",
        "on_break",
        "in_meeting",
        "signed_off",
      ],
    },
  },
} as const
