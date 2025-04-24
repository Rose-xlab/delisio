export type Json = string | number | boolean | null | {
    [key: string]: Json | undefined;
} | Json[];
export type Database = {
    public: {
        Tables: {
            admin_users: {
                Row: {
                    created_at: string;
                    created_by: string | null;
                    id: string;
                    role: string;
                    updated_at: string;
                    user_id: string;
                };
                Insert: {
                    created_at?: string;
                    created_by?: string | null;
                    id: string;
                    role: string;
                    updated_at?: string;
                    user_id: string;
                };
                Update: {
                    created_at?: string;
                    created_by?: string | null;
                    id?: string;
                    role?: string;
                    updated_at?: string;
                    user_id?: string;
                };
                Relationships: [];
            };
            conversations: {
                Row: {
                    created_at: string;
                    id: string;
                    title: string | null;
                    updated_at: string;
                    user_id: string;
                };
                Insert: {
                    created_at?: string;
                    id?: string;
                    title?: string | null;
                    updated_at?: string;
                    user_id: string;
                };
                Update: {
                    created_at?: string;
                    id?: string;
                    title?: string | null;
                    updated_at?: string;
                    user_id?: string;
                };
                Relationships: [];
            };
            favorites: {
                Row: {
                    created_at: string | null;
                    id: string;
                    recipe_id: string | null;
                    user_id: string | null;
                };
                Insert: {
                    created_at?: string | null;
                    id?: string;
                    recipe_id?: string | null;
                    user_id?: string | null;
                };
                Update: {
                    created_at?: string | null;
                    id?: string;
                    recipe_id?: string | null;
                    user_id?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "favorites_recipe_id_fkey";
                        columns: ["recipe_id"];
                        isOneToOne: false;
                        referencedRelation: "recipes";
                        referencedColumns: ["id"];
                    }
                ];
            };
            messages: {
                Row: {
                    content: string;
                    conversation_id: string;
                    created_at: string;
                    id: string;
                    metadata: Json | null;
                    role: string;
                    user_id: string | null;
                };
                Insert: {
                    content: string;
                    conversation_id: string;
                    created_at?: string;
                    id?: string;
                    metadata?: Json | null;
                    role: string;
                    user_id?: string | null;
                };
                Update: {
                    content?: string;
                    conversation_id?: string;
                    created_at?: string;
                    id?: string;
                    metadata?: Json | null;
                    role?: string;
                    user_id?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "messages_conversation_id_fkey";
                        columns: ["conversation_id"];
                        isOneToOne: false;
                        referencedRelation: "conversations";
                        referencedColumns: ["id"];
                    }
                ];
            };
            payment_methods: {
                Row: {
                    card_brand: string | null;
                    card_exp_month: number | null;
                    card_exp_year: number | null;
                    card_last4: string | null;
                    created_at: string;
                    id: string;
                    is_default: boolean;
                    stripe_payment_method_id: string;
                    updated_at: string;
                    user_id: string;
                };
                Insert: {
                    card_brand?: string | null;
                    card_exp_month?: number | null;
                    card_exp_year?: number | null;
                    card_last4?: string | null;
                    created_at?: string;
                    id?: string;
                    is_default?: boolean;
                    stripe_payment_method_id: string;
                    updated_at?: string;
                    user_id: string;
                };
                Update: {
                    card_brand?: string | null;
                    card_exp_month?: number | null;
                    card_exp_year?: number | null;
                    card_last4?: string | null;
                    created_at?: string;
                    id?: string;
                    is_default?: boolean;
                    stripe_payment_method_id?: string;
                    updated_at?: string;
                    user_id?: string;
                };
                Relationships: [];
            };
            recipe_usage: {
                Row: {
                    count: number;
                    created_at: string;
                    id: string;
                    period_end: string;
                    period_start: string;
                    updated_at: string;
                    user_id: string;
                };
                Insert: {
                    count?: number;
                    created_at?: string;
                    id?: string;
                    period_end: string;
                    period_start: string;
                    updated_at?: string;
                    user_id: string;
                };
                Update: {
                    count?: number;
                    created_at?: string;
                    id?: string;
                    period_end?: string;
                    period_start?: string;
                    updated_at?: string;
                    user_id?: string;
                };
                Relationships: [];
            };
            recipes: {
                Row: {
                    category: string | null;
                    cook_time_minutes: number | null;
                    created_at: string | null;
                    id: string;
                    ingredients: string[];
                    nutrition: Json;
                    prep_time_minutes: number | null;
                    quality_score: number | null;
                    query: string | null;
                    servings: number | null;
                    similarity_hash: string | null;
                    steps: Json;
                    tags: string[] | null;
                    title: string;
                    total_time_minutes: number | null;
                    updated_at: string | null;
                    user_id: string | null;
                    views: number | null;
                };
                Insert: {
                    category?: string | null;
                    cook_time_minutes?: number | null;
                    created_at?: string | null;
                    id?: string;
                    ingredients: string[];
                    nutrition: Json;
                    prep_time_minutes?: number | null;
                    quality_score?: number | null;
                    query?: string | null;
                    servings?: number | null;
                    similarity_hash?: string | null;
                    steps: Json;
                    tags?: string[] | null;
                    title: string;
                    total_time_minutes?: number | null;
                    updated_at?: string | null;
                    user_id?: string | null;
                    views?: number | null;
                };
                Update: {
                    category?: string | null;
                    cook_time_minutes?: number | null;
                    created_at?: string | null;
                    id?: string;
                    ingredients?: string[];
                    nutrition?: Json;
                    prep_time_minutes?: number | null;
                    quality_score?: number | null;
                    query?: string | null;
                    servings?: number | null;
                    similarity_hash?: string | null;
                    steps?: Json;
                    tags?: string[] | null;
                    title?: string;
                    total_time_minutes?: number | null;
                    updated_at?: string | null;
                    user_id?: string | null;
                    views?: number | null;
                };
                Relationships: [];
            };
            search_history: {
                Row: {
                    created_at: string | null;
                    id: string;
                    query: string;
                    user_id: string | null;
                };
                Insert: {
                    created_at?: string | null;
                    id?: string;
                    query: string;
                    user_id?: string | null;
                };
                Update: {
                    created_at?: string | null;
                    id?: string;
                    query?: string;
                    user_id?: string | null;
                };
                Relationships: [];
            };
            subscription_history: {
                Row: {
                    created_at: string;
                    id: string;
                    status: string;
                    tier: string;
                    user_id: string;
                };
                Insert: {
                    created_at?: string;
                    id?: string;
                    status: string;
                    tier: string;
                    user_id: string;
                };
                Update: {
                    created_at?: string;
                    id?: string;
                    status?: string;
                    tier?: string;
                    user_id?: string;
                };
                Relationships: [];
            };
            subscriptions: {
                Row: {
                    cancel_at_period_end: boolean;
                    created_at: string;
                    current_period_end: string;
                    current_period_start: string;
                    id: string;
                    status: string;
                    stripe_customer_id: string | null;
                    stripe_subscription_id: string | null;
                    tier: string;
                    updated_at: string;
                    user_id: string;
                };
                Insert: {
                    cancel_at_period_end?: boolean;
                    created_at?: string;
                    current_period_end: string;
                    current_period_start: string;
                    id?: string;
                    status: string;
                    stripe_customer_id?: string | null;
                    stripe_subscription_id?: string | null;
                    tier: string;
                    updated_at?: string;
                    user_id: string;
                };
                Update: {
                    cancel_at_period_end?: boolean;
                    created_at?: string;
                    current_period_end?: string;
                    current_period_start?: string;
                    id?: string;
                    status?: string;
                    stripe_customer_id?: string | null;
                    stripe_subscription_id?: string | null;
                    tier?: string;
                    updated_at?: string;
                    user_id?: string;
                };
                Relationships: [];
            };
            system_settings: {
                Row: {
                    created_at: string;
                    id: number;
                    settings: Json;
                    updated_at: string;
                };
                Insert: {
                    created_at?: string;
                    id?: number;
                    settings?: Json;
                    updated_at?: string;
                };
                Update: {
                    created_at?: string;
                    id?: number;
                    settings?: Json;
                    updated_at?: string;
                };
                Relationships: [];
            };
            user_activity: {
                Row: {
                    action_type: string;
                    created_at: string;
                    id: string;
                    last_active: string;
                    metadata: Json | null;
                    resource_id: string | null;
                    resource_type: string | null;
                    user_id: string;
                };
                Insert: {
                    action_type: string;
                    created_at?: string;
                    id?: string;
                    last_active?: string;
                    metadata?: Json | null;
                    resource_id?: string | null;
                    resource_type?: string | null;
                    user_id: string;
                };
                Update: {
                    action_type?: string;
                    created_at?: string;
                    id?: string;
                    last_active?: string;
                    metadata?: Json | null;
                    resource_id?: string | null;
                    resource_type?: string | null;
                    user_id?: string;
                };
                Relationships: [];
            };
            user_preferences: {
                Row: {
                    allergies: string[] | null;
                    cooking_skill: string | null;
                    created_at: string | null;
                    dietary_restrictions: string[] | null;
                    favorite_cuisines: string[] | null;
                    id: string;
                    updated_at: string | null;
                    user_id: string | null;
                };
                Insert: {
                    allergies?: string[] | null;
                    cooking_skill?: string | null;
                    created_at?: string | null;
                    dietary_restrictions?: string[] | null;
                    favorite_cuisines?: string[] | null;
                    id?: string;
                    updated_at?: string | null;
                    user_id?: string | null;
                };
                Update: {
                    allergies?: string[] | null;
                    cooking_skill?: string | null;
                    created_at?: string | null;
                    dietary_restrictions?: string[] | null;
                    favorite_cuisines?: string[] | null;
                    id?: string;
                    updated_at?: string | null;
                    user_id?: string | null;
                };
                Relationships: [];
            };
        };
        Views: {
            [_ in never]: never;
        };
        Functions: {
            get_category_counts: {
                Args: Record<PropertyKey, never>;
                Returns: {
                    category: string;
                    recipe_count: number;
                }[];
            };
            get_recipe_generation_trend: {
                Args: {
                    p_start_date: string;
                    p_interval?: string;
                };
                Returns: {
                    period: string;
                    recipe_count: number;
                }[];
            };
            get_subscription_conversions: {
                Args: Record<PropertyKey, never>;
                Returns: {
                    from_tier: string;
                    to_tier: string;
                    count: number;
                }[];
            };
            get_subscription_status: {
                Args: {
                    p_user_id: string;
                };
                Returns: Json;
            };
            get_subscription_tier_counts: {
                Args: Record<PropertyKey, never>;
                Returns: {
                    tier: string;
                    count: number;
                }[];
            };
            get_user_growth_trend: {
                Args: {
                    p_start_date: string;
                    p_interval?: string;
                };
                Returns: {
                    period: string;
                    new_users: number;
                    cumulative_users: number;
                }[];
            };
            has_reached_recipe_limit: {
                Args: {
                    p_user_id: string;
                    p_tier: string;
                };
                Returns: boolean;
            };
            increment_recipe_usage: {
                Args: {
                    p_user_id: string;
                    p_period_start: string;
                    p_period_end: string;
                };
                Returns: undefined;
            };
            reset_expired_usage_periods: {
                Args: Record<PropertyKey, never>;
                Returns: undefined;
            };
            reset_recipe_usage: {
                Args: {
                    p_user_id: string;
                    p_period_start: string;
                    p_period_end: string;
                };
                Returns: undefined;
            };
        };
        Enums: {
            [_ in never]: never;
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
};
type DefaultSchema = Database[Extract<keyof Database, "public">];
export type Tables<DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | {
    schema: keyof Database;
}, TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
} ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"]) : never = never> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
} ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
    Row: infer R;
} ? R : never : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
    Row: infer R;
} ? R : never : never;
export type TablesInsert<DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | {
    schema: keyof Database;
}, TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
} ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] : never = never> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
} ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Insert: infer I;
} ? I : never : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Insert: infer I;
} ? I : never : never;
export type TablesUpdate<DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | {
    schema: keyof Database;
}, TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
} ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] : never = never> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
} ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Update: infer U;
} ? U : never : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Update: infer U;
} ? U : never : never;
export type Enums<DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | {
    schema: keyof Database;
}, EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database;
} ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"] : never = never> = DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database;
} ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName] : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions] : never;
export type CompositeTypes<PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"] | {
    schema: keyof Database;
}, CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database;
} ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"] : never = never> = PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database;
} ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName] : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"] ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions] : never;
export declare const Constants: {
    readonly public: {
        readonly Enums: {};
    };
};
export {};
