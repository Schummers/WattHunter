export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      auction_bids: {
        Row: {
          amount: number
          auction_id: string
          created_at: string
          id: string
          placed_at: string
          rider_id: string
          round: number
          status: string
          team_id: string
        }
        Insert: {
          amount: number
          auction_id: string
          created_at?: string
          id?: string
          placed_at?: string
          rider_id: string
          round?: number
          status?: string
          team_id: string
        }
        Update: {
          amount?: number
          auction_id?: string
          created_at?: string
          id?: string
          placed_at?: string
          rider_id?: string
          round?: number
          status?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auction_bids_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_bids_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_bids_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      auctions: {
        Row: {
          closes_at: string
          created_at: string
          id: string
          league_id: string
          name: string
          opens_at: string
          resolved_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          closes_at: string
          created_at?: string
          id?: string
          league_id: string
          name: string
          opens_at: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          closes_at?: string
          created_at?: string
          id?: string
          league_id?: string
          name?: string
          opens_at?: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auctions_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          created_at: string
          id: string
          last_salary_paid: string | null
          league_id: string
          locked_salary: number
          phase_recruited_id: number | null
          purchased_at: string
          release_date: string | null
          released_at: string | null
          rider_id: string
          status: string
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_salary_paid?: string | null
          league_id: string
          locked_salary: number
          phase_recruited_id?: number | null
          purchased_at?: string
          release_date?: string | null
          released_at?: string | null
          rider_id: string
          status?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_salary_paid?: string | null
          league_id?: string
          locked_salary?: number
          phase_recruited_id?: number | null
          purchased_at?: string
          release_date?: string | null
          released_at?: string | null
          rider_id?: string
          status?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_bids: {
        Row: {
          amount: number
          created_at: string
          id: string
          league_id: string
          rider_id: string
          team_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          league_id: string
          rider_id: string
          team_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          league_id?: string
          rider_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "draft_bids_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_bids_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_bids_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      gt_daily_classifications: {
        Row: {
          classification_type: string
          created_at: string
          race_slug: string
          rank: number
          rider_id: string
          stage: string
        }
        Insert: {
          classification_type: string
          created_at?: string
          race_slug: string
          rank: number
          rider_id: string
          stage: string
        }
        Update: {
          classification_type?: string
          created_at?: string
          race_slug?: string
          rank?: number
          rider_id?: string
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "gt_daily_classifications_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      gt_role_assignments: {
        Row: {
          applied_at: string
          created_at: string
          id: string
          phase_id: number
          rider_id: string
          role: string
          team_id: string
          year: number
        }
        Insert: {
          applied_at?: string
          created_at?: string
          id?: string
          phase_id: number
          rider_id: string
          role: string
          team_id: string
          year: number
        }
        Update: {
          applied_at?: string
          created_at?: string
          id?: string
          phase_id?: number
          rider_id?: string
          role?: string
          team_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "gt_role_assignments_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gt_role_assignments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      gt_squad: {
        Row: {
          created_at: string
          id: string
          phase_id: number
          rider_id: string
          team_id: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          phase_id: number
          rider_id: string
          team_id: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          phase_id?: number
          rider_id?: string
          team_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "gt_squad_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gt_squad_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      gt_tactic_activations: {
        Row: {
          created_at: string
          id: string
          nemesis_target_role: string | null
          nemesis_target_team_id: string | null
          outcome: string | null
          phase_id: number
          resolved_at: string | null
          resolved_attacker_rider_id: string | null
          resolved_target_rider_id: string | null
          stage_slug: string
          tactic_type: string
          team_id: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          nemesis_target_role?: string | null
          nemesis_target_team_id?: string | null
          outcome?: string | null
          phase_id: number
          resolved_at?: string | null
          resolved_attacker_rider_id?: string | null
          resolved_target_rider_id?: string | null
          stage_slug: string
          tactic_type: string
          team_id: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          nemesis_target_role?: string | null
          nemesis_target_team_id?: string | null
          outcome?: string | null
          phase_id?: number
          resolved_at?: string | null
          resolved_attacker_rider_id?: string | null
          resolved_target_rider_id?: string | null
          stage_slug?: string
          tactic_type?: string
          team_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "gt_tactic_activations_nemesis_target_team_id_fkey"
            columns: ["nemesis_target_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gt_tactic_activations_resolved_attacker_rider_id_fkey"
            columns: ["resolved_attacker_rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gt_tactic_activations_resolved_target_rider_id_fkey"
            columns: ["resolved_target_rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gt_tactic_activations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      league_members: {
        Row: {
          id: string
          joined_at: string
          league_id: string
          team_id: string | null
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          league_id: string
          team_id?: string | null
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          league_id?: string
          team_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_members_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          commissioner_id: string
          created_at: string
          id: string
          invite_code: string
          max_players: number
          name: string
          season_year: number
          starting_level: number
          status: string
          updated_at: string
        }
        Insert: {
          commissioner_id: string
          created_at?: string
          id?: string
          invite_code: string
          max_players?: number
          name: string
          season_year?: number
          starting_level?: number
          status?: string
          updated_at?: string
        }
        Update: {
          commissioner_id?: string
          created_at?: string
          id?: string
          invite_code?: string
          max_players?: number
          name?: string
          season_year?: number
          starting_level?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leagues_commissioner_id_fkey"
            columns: ["commissioner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      race_results: {
        Row: {
          created_at: string
          id: string
          is_itt: boolean
          pcs_points: number
          race_class: string | null
          race_date: string
          race_name: string
          race_slug: string
          rank: number | null
          rider_id: string
          stage: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_itt?: boolean
          pcs_points?: number
          race_class?: string | null
          race_date: string
          race_name: string
          race_slug: string
          rank?: number | null
          rider_id: string
          stage?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_itt?: boolean
          pcs_points?: number
          race_class?: string | null
          race_date?: string
          race_name?: string
          race_slug?: string
          rank?: number | null
          rider_id?: string
          stage?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "race_results_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      race_startlists: {
        Row: {
          created_at: string
          race_date: string
          race_name: string
          race_slug: string
          rider_id: string
        }
        Insert: {
          created_at?: string
          race_date: string
          race_name: string
          race_slug: string
          rider_id: string
        }
        Update: {
          created_at?: string
          race_date?: string
          race_name?: string
          race_slug?: string
          rider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "race_startlists_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      remontada_boost_triggers: {
        Row: {
          created_at: string
          gt_identifier: string
          league_id: string
          overtaken_team_id: string
          overtaker_team_id: string
          triggered_at_stage: number
        }
        Insert: {
          created_at?: string
          gt_identifier: string
          league_id: string
          overtaken_team_id: string
          overtaker_team_id: string
          triggered_at_stage: number
        }
        Update: {
          created_at?: string
          gt_identifier?: string
          league_id?: string
          overtaken_team_id?: string
          overtaker_team_id?: string
          triggered_at_stage?: number
        }
        Relationships: [
          {
            foreignKeyName: "remontada_boost_triggers_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remontada_boost_triggers_overtaken_team_id_fkey"
            columns: ["overtaken_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remontada_boost_triggers_overtaker_team_id_fkey"
            columns: ["overtaker_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      remontada_boosts: {
        Row: {
          created_at: string
          expires_after_stage: number
          gt_identifier: string
          id: string
          league_id: string
          multiplier: number
          overtaken_team_id: string | null
          team_id: string
          triggered_at_stage: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_after_stage: number
          gt_identifier: string
          id?: string
          league_id: string
          multiplier?: number
          overtaken_team_id?: string | null
          team_id: string
          triggered_at_stage: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_after_stage?: number
          gt_identifier?: string
          id?: string
          league_id?: string
          multiplier?: number
          overtaken_team_id?: string | null
          team_id?: string
          triggered_at_stage?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "remontada_boosts_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remontada_boosts_overtaken_team_id_fkey"
            columns: ["overtaken_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remontada_boosts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      rider_pcs_history: {
        Row: {
          created_at: string
          date: string
          id: string
          pcs_points: number
          points_delta: number
          rider_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          pcs_points?: number
          points_delta?: number
          rider_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          pcs_points?: number
          points_delta?: number
          rider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rider_pcs_history_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      rider_season_rankings: {
        Row: {
          created_at: string
          points: number
          rank: number | null
          rider_id: string
          season: number
        }
        Insert: {
          created_at?: string
          points?: number
          rank?: number | null
          rider_id: string
          season: number
        }
        Update: {
          created_at?: string
          points?: number
          rank?: number | null
          rider_id?: string
          season?: number
        }
        Relationships: [
          {
            foreignKeyName: "rider_season_rankings_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      rider_teams: {
        Row: {
          created_at: string
          id: string
          rider_id: string
          season: number
          team_name: string
          team_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          rider_id: string
          season: number
          team_name: string
          team_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          rider_id?: string
          season?: number
          team_name?: string
          team_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rider_teams_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      rider_xp_daily: {
        Row: {
          contract_id: string
          created_at: string
          date: string
          gt_classif_bonus: number
          gt_role_mult: number
          id: string
          nemesis_modifier: number
          race_slug: string | null
          raw_pcs_points: number
          remontada_mult: number
          rider_id: string
          strategy_bonus: number
          tactic_applied: string | null
          team_id: string
          xp_gained: number
        }
        Insert: {
          contract_id: string
          created_at?: string
          date: string
          gt_classif_bonus?: number
          gt_role_mult?: number
          id?: string
          nemesis_modifier?: number
          race_slug?: string | null
          raw_pcs_points?: number
          remontada_mult?: number
          rider_id: string
          strategy_bonus?: number
          tactic_applied?: string | null
          team_id: string
          xp_gained?: number
        }
        Update: {
          contract_id?: string
          created_at?: string
          date?: string
          gt_classif_bonus?: number
          gt_role_mult?: number
          id?: string
          nemesis_modifier?: number
          race_slug?: string | null
          raw_pcs_points?: number
          remontada_mult?: number
          rider_id?: string
          strategy_bonus?: number
          tactic_applied?: string | null
          team_id?: string
          xp_gained?: number
        }
        Relationships: [
          {
            foreignKeyName: "rider_xp_daily_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rider_xp_daily_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rider_xp_daily_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      riders: {
        Row: {
          age: number | null
          birth_place: string | null
          birthdate: string | null
          created_at: string
          ever_in_pool: boolean
          full_name: string
          height_cm: number | null
          id: string
          is_active_in_game: boolean
          last_synced_at: string | null
          monthly_salary: number
          nationality: string | null
          pcs_points_1yr: number
          pcs_rank: number | null
          pcs_rank_prev: number | null
          pcs_slug: string
          photo_url: string | null
          real_team: string | null
          specialty: string | null
          team_type: string | null
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          age?: number | null
          birth_place?: string | null
          birthdate?: string | null
          created_at?: string
          ever_in_pool?: boolean
          full_name: string
          height_cm?: number | null
          id?: string
          is_active_in_game?: boolean
          last_synced_at?: string | null
          monthly_salary?: number
          nationality?: string | null
          pcs_points_1yr?: number
          pcs_rank?: number | null
          pcs_rank_prev?: number | null
          pcs_slug: string
          photo_url?: string | null
          real_team?: string | null
          specialty?: string | null
          team_type?: string | null
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          age?: number | null
          birth_place?: string | null
          birthdate?: string | null
          created_at?: string
          ever_in_pool?: boolean
          full_name?: string
          height_cm?: number | null
          id?: string
          is_active_in_game?: boolean
          last_synced_at?: string | null
          monthly_salary?: number
          nationality?: string | null
          pcs_points_1yr?: number
          pcs_rank?: number | null
          pcs_rank_prev?: number | null
          pcs_slug?: string
          photo_url?: string | null
          real_team?: string | null
          specialty?: string | null
          team_type?: string | null
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      sponsor_bonuses: {
        Row: {
          base_bonus: number
          created_at: string
          final_bonus: number
          id: string
          multiplier: number
          race_date: string
          race_slug: string
          result_type: string
          rider_id: string
          rider_rank: number
          sponsor_id: string
          team_id: string
        }
        Insert: {
          base_bonus: number
          created_at?: string
          final_bonus: number
          id?: string
          multiplier?: number
          race_date: string
          race_slug: string
          result_type: string
          rider_id: string
          rider_rank: number
          sponsor_id: string
          team_id: string
        }
        Update: {
          base_bonus?: number
          created_at?: string
          final_bonus?: number
          id?: string
          multiplier?: number
          race_date?: string
          race_slug?: string
          result_type?: string
          rider_id?: string
          rider_rank?: number
          sponsor_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_bonuses_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsor_bonuses_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsor_bonuses_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsors: {
        Row: {
          bonus_gc: number
          bonus_grand_tour: number | null
          bonus_monument: number | null
          bonus_one_day: number
          bonus_stage: number
          created_at: string
          gc_threshold: number
          grand_tour_threshold: number | null
          has_explicit_prestige: boolean
          id: string
          monthly_budget: number
          monument_threshold: number | null
          name: string
          nationality: string | null
          one_day_threshold: number
          orientation: string
          slug: string
          sort_order: number
          stage_threshold: number
          tier: number
          unlock_level: number
        }
        Insert: {
          bonus_gc?: number
          bonus_grand_tour?: number | null
          bonus_monument?: number | null
          bonus_one_day?: number
          bonus_stage?: number
          created_at?: string
          gc_threshold?: number
          grand_tour_threshold?: number | null
          has_explicit_prestige?: boolean
          id?: string
          monthly_budget: number
          monument_threshold?: number | null
          name: string
          nationality?: string | null
          one_day_threshold?: number
          orientation: string
          slug: string
          sort_order?: number
          stage_threshold?: number
          tier: number
          unlock_level: number
        }
        Update: {
          bonus_gc?: number
          bonus_grand_tour?: number | null
          bonus_monument?: number | null
          bonus_one_day?: number
          bonus_stage?: number
          created_at?: string
          gc_threshold?: number
          grand_tour_threshold?: number | null
          has_explicit_prestige?: boolean
          id?: string
          monthly_budget?: number
          monument_threshold?: number | null
          name?: string
          nationality?: string | null
          one_day_threshold?: number
          orientation?: string
          slug?: string
          sort_order?: number
          stage_threshold?: number
          tier?: number
          unlock_level?: number
        }
        Relationships: []
      }
      strategies: {
        Row: {
          created_at: string
          description: string
          id: string
          is_parameterized: boolean
          name: string
          slug: string
          xp_bonus: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          is_parameterized?: boolean
          name: string
          slug: string
          xp_bonus?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_parameterized?: boolean
          name?: string
          slug?: string
          xp_bonus?: number
        }
        Relationships: []
      }
      team_ranking_daily: {
        Row: {
          cumulative_xp: number
          date: string
          id: string
          rank: number
          team_id: string
        }
        Insert: {
          cumulative_xp: number
          date?: string
          id?: string
          rank: number
          team_id: string
        }
        Update: {
          cumulative_xp?: number
          date?: string
          id?: string
          rank?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_ranking_daily_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_sponsors: {
        Row: {
          activated_at: string
          created_at: string
          id: string
          sponsor_id: string
          team_id: string
        }
        Insert: {
          activated_at?: string
          created_at?: string
          id?: string
          sponsor_id: string
          team_id: string
        }
        Update: {
          activated_at?: string
          created_at?: string
          id?: string
          sponsor_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_sponsors_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_sponsors_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_strategies: {
        Row: {
          activated_at: string | null
          config: Json | null
          created_at: string
          id: string
          is_active: boolean
          pending_config: Json | null
          pending_is_active: boolean | null
          strategy_id: string
          team_id: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          config?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          pending_config?: Json | null
          pending_is_active?: boolean | null
          strategy_id: string
          team_id: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          config?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          pending_config?: Json | null
          pending_is_active?: boolean | null
          strategy_id?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_policies_policy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "strategies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_policies_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          cumulative_xp: number
          id: string
          is_bankrupt: boolean
          league_id: string
          level: number
          name: string
          pending_sponsor_id: string | null
          phase_confirmed_at: string | null
          phase_confirmed_id: number | null
          treasury: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          cumulative_xp?: number
          id?: string
          is_bankrupt?: boolean
          league_id: string
          level?: number
          name: string
          pending_sponsor_id?: string | null
          phase_confirmed_at?: string | null
          phase_confirmed_id?: number | null
          treasury?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          cumulative_xp?: number
          id?: string
          is_bankrupt?: boolean
          league_id?: string
          level?: number
          name?: string
          pending_sponsor_id?: string | null
          phase_confirmed_at?: string | null
          phase_confirmed_id?: number | null
          treasury?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_pending_sponsor_id_fkey"
            columns: ["pending_sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      treasury_log: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          rider_id: string | null
          team_id: string
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          rider_id?: string | null
          team_id: string
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          rider_id?: string | null
          team_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "treasury_log_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasury_log_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          has_onboarded: boolean
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          has_onboarded?: boolean
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          has_onboarded?: boolean
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      compute_level: { Args: { xp: number }; Returns: number }
      confirm_phase_setup: {
        Args: {
          p_current_phase_id: number
          p_current_phase_label: string
          p_team_id: string
        }
        Returns: Json
      }
      is_league_member: { Args: { p_league_id: string }; Returns: boolean }
      join_league_by_code: { Args: { p_code: string }; Returns: Json }
      leave_league: { Args: { p_league_id: string }; Returns: Json }
      place_bid: {
        Args: {
          p_amount: number
          p_auction_id: string
          p_rider_id: string
          p_round: number
        }
        Returns: Json
      }
      place_tactic: {
        Args: {
          p_nemesis_target_role?: string
          p_nemesis_target_team_id?: string
          p_phase_id: number
          p_stage_slug: string
          p_tactic_type: string
          p_team_id: string
          p_year: number
        }
        Returns: string
      }
      release_rider: {
        Args: { p_contract_id: string; p_current_phase_id: number }
        Returns: Json
      }
      validate_round: {
        Args: { p_current_phase_id: number; p_league_id: string }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

