/**
 * Get list of users with pagination and filters
 */
export declare const getUsersList: (filters: {
    page: number;
    limit: number;
    search: string;
    tier: string;
    sortBy: string;
    sortDir: "asc" | "desc";
}) => Promise<{
    users: (import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"column 'email' does not exist on 'recipes'."> | import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"column 'email' does not exist on 'conversations'."> | import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"column 'email' does not exist on 'admin_users'."> | import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"column 'email' does not exist on 'favorites'."> | import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"column 'email' does not exist on 'messages'."> | import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"column 'email' does not exist on 'payment_methods'."> | import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"column 'email' does not exist on 'recipe_usage'."> | import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"column 'email' does not exist on 'search_history'."> | import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"column 'email' does not exist on 'subscription_history'."> | import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"column 'email' does not exist on 'subscriptions'."> | import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"column 'email' does not exist on 'system_settings'."> | import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"column 'email' does not exist on 'user_activity'."> | import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"column 'email' does not exist on 'user_preferences'.">)[];
    pagination: {
        total: any;
        page: number;
        limit: number;
        pages: number;
    };
}>;
/**
 * Get detailed information about a user
 */
export declare const getUserDetails: (userId: string) => Promise<{
    user: {
        created_at: string;
        created_by: string | null;
        id: string;
        role: string;
        updated_at: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipes and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipes and user_preferences">;
    } | {
        created_at: string;
        id: string;
        title: string | null;
        updated_at: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipes and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipes and user_preferences">;
    } | {
        created_at: string | null;
        id: string;
        recipe_id: string | null;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipes and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipes and user_preferences">;
    } | {
        content: string;
        conversation_id: string;
        created_at: string;
        id: string;
        metadata: import("../../types/supabase").Json | null;
        role: string;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipes and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipes and user_preferences">;
    } | {
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
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipes and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipes and user_preferences">;
    } | {
        count: number;
        created_at: string;
        id: string;
        period_end: string;
        period_start: string;
        updated_at: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipes and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipes and user_preferences">;
    } | {
        category: string | null;
        cook_time_minutes: number | null;
        created_at: string | null;
        id: string;
        ingredients: string[];
        nutrition: import("../../types/supabase").Json;
        prep_time_minutes: number | null;
        quality_score: number | null;
        query: string | null;
        servings: number | null;
        similarity_hash: string | null;
        steps: import("../../types/supabase").Json;
        tags: string[] | null;
        title: string;
        total_time_minutes: number | null;
        updated_at: string | null;
        user_id: string | null;
        views: number | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipes and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipes and user_preferences">;
    } | {
        created_at: string | null;
        id: string;
        query: string;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipes and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipes and user_preferences">;
    } | {
        created_at: string;
        id: string;
        status: string;
        tier: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipes and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipes and user_preferences">;
    } | {
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
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipes and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipes and user_preferences">;
    } | {
        created_at: string;
        id: number;
        settings: import("../../types/supabase").Json;
        updated_at: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipes and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipes and user_preferences">;
    } | {
        action_type: string;
        created_at: string;
        id: string;
        last_active: string;
        metadata: import("../../types/supabase").Json | null;
        resource_id: string | null;
        resource_type: string | null;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipes and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipes and user_preferences">;
    } | {
        allergies: string[] | null;
        cooking_skill: string | null;
        created_at: string | null;
        dietary_restrictions: string[] | null;
        favorite_cuisines: string[] | null;
        id: string;
        updated_at: string | null;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipes and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipes and user_preferences">;
    } | {
        created_at: string;
        created_by: string | null;
        id: string;
        role: string;
        updated_at: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between conversations and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between conversations and user_preferences">;
    } | {
        created_at: string;
        id: string;
        title: string | null;
        updated_at: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between conversations and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between conversations and user_preferences">;
    } | {
        created_at: string | null;
        id: string;
        recipe_id: string | null;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between conversations and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between conversations and user_preferences">;
    } | {
        content: string;
        conversation_id: string;
        created_at: string;
        id: string;
        metadata: import("../../types/supabase").Json | null;
        role: string;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between conversations and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between conversations and user_preferences">;
    } | {
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
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between conversations and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between conversations and user_preferences">;
    } | {
        count: number;
        created_at: string;
        id: string;
        period_end: string;
        period_start: string;
        updated_at: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between conversations and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between conversations and user_preferences">;
    } | {
        category: string | null;
        cook_time_minutes: number | null;
        created_at: string | null;
        id: string;
        ingredients: string[];
        nutrition: import("../../types/supabase").Json;
        prep_time_minutes: number | null;
        quality_score: number | null;
        query: string | null;
        servings: number | null;
        similarity_hash: string | null;
        steps: import("../../types/supabase").Json;
        tags: string[] | null;
        title: string;
        total_time_minutes: number | null;
        updated_at: string | null;
        user_id: string | null;
        views: number | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between conversations and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between conversations and user_preferences">;
    } | {
        created_at: string | null;
        id: string;
        query: string;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between conversations and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between conversations and user_preferences">;
    } | {
        created_at: string;
        id: string;
        status: string;
        tier: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between conversations and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between conversations and user_preferences">;
    } | {
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
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between conversations and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between conversations and user_preferences">;
    } | {
        created_at: string;
        id: number;
        settings: import("../../types/supabase").Json;
        updated_at: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between conversations and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between conversations and user_preferences">;
    } | {
        action_type: string;
        created_at: string;
        id: string;
        last_active: string;
        metadata: import("../../types/supabase").Json | null;
        resource_id: string | null;
        resource_type: string | null;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between conversations and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between conversations and user_preferences">;
    } | {
        allergies: string[] | null;
        cooking_skill: string | null;
        created_at: string | null;
        dietary_restrictions: string[] | null;
        favorite_cuisines: string[] | null;
        id: string;
        updated_at: string | null;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between conversations and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between conversations and user_preferences">;
    } | {
        created_at: string;
        created_by: string | null;
        id: string;
        role: string;
        updated_at: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between admin_users and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between admin_users and user_preferences">;
    } | {
        created_at: string;
        id: string;
        title: string | null;
        updated_at: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between admin_users and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between admin_users and user_preferences">;
    } | {
        created_at: string | null;
        id: string;
        recipe_id: string | null;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between admin_users and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between admin_users and user_preferences">;
    } | {
        content: string;
        conversation_id: string;
        created_at: string;
        id: string;
        metadata: import("../../types/supabase").Json | null;
        role: string;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between admin_users and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between admin_users and user_preferences">;
    } | {
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
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between admin_users and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between admin_users and user_preferences">;
    } | {
        count: number;
        created_at: string;
        id: string;
        period_end: string;
        period_start: string;
        updated_at: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between admin_users and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between admin_users and user_preferences">;
    } | {
        category: string | null;
        cook_time_minutes: number | null;
        created_at: string | null;
        id: string;
        ingredients: string[];
        nutrition: import("../../types/supabase").Json;
        prep_time_minutes: number | null;
        quality_score: number | null;
        query: string | null;
        servings: number | null;
        similarity_hash: string | null;
        steps: import("../../types/supabase").Json;
        tags: string[] | null;
        title: string;
        total_time_minutes: number | null;
        updated_at: string | null;
        user_id: string | null;
        views: number | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between admin_users and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between admin_users and user_preferences">;
    } | {
        created_at: string | null;
        id: string;
        query: string;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between admin_users and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between admin_users and user_preferences">;
    } | {
        created_at: string;
        id: string;
        status: string;
        tier: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between admin_users and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between admin_users and user_preferences">;
    } | {
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
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between admin_users and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between admin_users and user_preferences">;
    } | {
        created_at: string;
        id: number;
        settings: import("../../types/supabase").Json;
        updated_at: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between admin_users and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between admin_users and user_preferences">;
    } | {
        action_type: string;
        created_at: string;
        id: string;
        last_active: string;
        metadata: import("../../types/supabase").Json | null;
        resource_id: string | null;
        resource_type: string | null;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between admin_users and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between admin_users and user_preferences">;
    } | {
        allergies: string[] | null;
        cooking_skill: string | null;
        created_at: string | null;
        dietary_restrictions: string[] | null;
        favorite_cuisines: string[] | null;
        id: string;
        updated_at: string | null;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between admin_users and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between admin_users and user_preferences">;
    } | {
        created_at: string;
        created_by: string | null;
        id: string;
        role: string;
        updated_at: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between favorites and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between favorites and user_preferences">;
    } | {
        created_at: string;
        id: string;
        title: string | null;
        updated_at: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between favorites and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between favorites and user_preferences">;
    } | {
        created_at: string | null;
        id: string;
        recipe_id: string | null;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between favorites and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between favorites and user_preferences">;
    } | {
        content: string;
        conversation_id: string;
        created_at: string;
        id: string;
        metadata: import("../../types/supabase").Json | null;
        role: string;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between favorites and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between favorites and user_preferences">;
    } | {
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
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between favorites and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between favorites and user_preferences">;
    } | {
        count: number;
        created_at: string;
        id: string;
        period_end: string;
        period_start: string;
        updated_at: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between favorites and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between favorites and user_preferences">;
    } | {
        category: string | null;
        cook_time_minutes: number | null;
        created_at: string | null;
        id: string;
        ingredients: string[];
        nutrition: import("../../types/supabase").Json;
        prep_time_minutes: number | null;
        quality_score: number | null;
        query: string | null;
        servings: number | null;
        similarity_hash: string | null;
        steps: import("../../types/supabase").Json;
        tags: string[] | null;
        title: string;
        total_time_minutes: number | null;
        updated_at: string | null;
        user_id: string | null;
        views: number | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between favorites and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between favorites and user_preferences">;
    } | {
        created_at: string | null;
        id: string;
        query: string;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between favorites and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between favorites and user_preferences">;
    } | {
        created_at: string;
        id: string;
        status: string;
        tier: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between favorites and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between favorites and user_preferences">;
    } | {
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
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between favorites and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between favorites and user_preferences">;
    } | {
        created_at: string;
        id: number;
        settings: import("../../types/supabase").Json;
        updated_at: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between favorites and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between favorites and user_preferences">;
    } | {
        action_type: string;
        created_at: string;
        id: string;
        last_active: string;
        metadata: import("../../types/supabase").Json | null;
        resource_id: string | null;
        resource_type: string | null;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between favorites and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between favorites and user_preferences">;
    } | {
        allergies: string[] | null;
        cooking_skill: string | null;
        created_at: string | null;
        dietary_restrictions: string[] | null;
        favorite_cuisines: string[] | null;
        id: string;
        updated_at: string | null;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between favorites and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between favorites and user_preferences">;
    } | {
        created_at: string;
        created_by: string | null;
        id: string;
        role: string;
        updated_at: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between messages and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between messages and user_preferences">;
    } | {
        created_at: string;
        id: string;
        title: string | null;
        updated_at: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between messages and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between messages and user_preferences">;
    } | {
        created_at: string | null;
        id: string;
        recipe_id: string | null;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between messages and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between messages and user_preferences">;
    } | {
        content: string;
        conversation_id: string;
        created_at: string;
        id: string;
        metadata: import("../../types/supabase").Json | null;
        role: string;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between messages and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between messages and user_preferences">;
    } | {
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
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between messages and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between messages and user_preferences">;
    } | {
        count: number;
        created_at: string;
        id: string;
        period_end: string;
        period_start: string;
        updated_at: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between messages and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between messages and user_preferences">;
    } | {
        category: string | null;
        cook_time_minutes: number | null;
        created_at: string | null;
        id: string;
        ingredients: string[];
        nutrition: import("../../types/supabase").Json;
        prep_time_minutes: number | null;
        quality_score: number | null;
        query: string | null;
        servings: number | null;
        similarity_hash: string | null;
        steps: import("../../types/supabase").Json;
        tags: string[] | null;
        title: string;
        total_time_minutes: number | null;
        updated_at: string | null;
        user_id: string | null;
        views: number | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between messages and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between messages and user_preferences">;
    } | {
        created_at: string | null;
        id: string;
        query: string;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between messages and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between messages and user_preferences">;
    } | {
        created_at: string;
        id: string;
        status: string;
        tier: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between messages and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between messages and user_preferences">;
    } | {
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
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between messages and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between messages and user_preferences">;
    } | {
        created_at: string;
        id: number;
        settings: import("../../types/supabase").Json;
        updated_at: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between messages and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between messages and user_preferences">;
    } | {
        action_type: string;
        created_at: string;
        id: string;
        last_active: string;
        metadata: import("../../types/supabase").Json | null;
        resource_id: string | null;
        resource_type: string | null;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between messages and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between messages and user_preferences">;
    } | {
        allergies: string[] | null;
        cooking_skill: string | null;
        created_at: string | null;
        dietary_restrictions: string[] | null;
        favorite_cuisines: string[] | null;
        id: string;
        updated_at: string | null;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between messages and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between messages and user_preferences">;
    } | {
        created_at: string;
        created_by: string | null;
        id: string;
        role: string;
        updated_at: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between payment_methods and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between payment_methods and user_preferences">;
    } | {
        created_at: string;
        id: string;
        title: string | null;
        updated_at: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between payment_methods and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between payment_methods and user_preferences">;
    } | {
        created_at: string | null;
        id: string;
        recipe_id: string | null;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between payment_methods and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between payment_methods and user_preferences">;
    } | {
        content: string;
        conversation_id: string;
        created_at: string;
        id: string;
        metadata: import("../../types/supabase").Json | null;
        role: string;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between payment_methods and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between payment_methods and user_preferences">;
    } | {
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
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between payment_methods and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between payment_methods and user_preferences">;
    } | {
        count: number;
        created_at: string;
        id: string;
        period_end: string;
        period_start: string;
        updated_at: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between payment_methods and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between payment_methods and user_preferences">;
    } | {
        category: string | null;
        cook_time_minutes: number | null;
        created_at: string | null;
        id: string;
        ingredients: string[];
        nutrition: import("../../types/supabase").Json;
        prep_time_minutes: number | null;
        quality_score: number | null;
        query: string | null;
        servings: number | null;
        similarity_hash: string | null;
        steps: import("../../types/supabase").Json;
        tags: string[] | null;
        title: string;
        total_time_minutes: number | null;
        updated_at: string | null;
        user_id: string | null;
        views: number | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between payment_methods and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between payment_methods and user_preferences">;
    } | {
        created_at: string | null;
        id: string;
        query: string;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between payment_methods and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between payment_methods and user_preferences">;
    } | {
        created_at: string;
        id: string;
        status: string;
        tier: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between payment_methods and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between payment_methods and user_preferences">;
    } | {
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
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between payment_methods and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between payment_methods and user_preferences">;
    } | {
        created_at: string;
        id: number;
        settings: import("../../types/supabase").Json;
        updated_at: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between payment_methods and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between payment_methods and user_preferences">;
    } | {
        action_type: string;
        created_at: string;
        id: string;
        last_active: string;
        metadata: import("../../types/supabase").Json | null;
        resource_id: string | null;
        resource_type: string | null;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between payment_methods and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between payment_methods and user_preferences">;
    } | {
        allergies: string[] | null;
        cooking_skill: string | null;
        created_at: string | null;
        dietary_restrictions: string[] | null;
        favorite_cuisines: string[] | null;
        id: string;
        updated_at: string | null;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between payment_methods and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between payment_methods and user_preferences">;
    } | {
        created_at: string;
        created_by: string | null;
        id: string;
        role: string;
        updated_at: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipe_usage and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipe_usage and user_preferences">;
    } | {
        created_at: string;
        id: string;
        title: string | null;
        updated_at: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipe_usage and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipe_usage and user_preferences">;
    } | {
        created_at: string | null;
        id: string;
        recipe_id: string | null;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipe_usage and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipe_usage and user_preferences">;
    } | {
        content: string;
        conversation_id: string;
        created_at: string;
        id: string;
        metadata: import("../../types/supabase").Json | null;
        role: string;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipe_usage and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipe_usage and user_preferences">;
    } | {
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
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipe_usage and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipe_usage and user_preferences">;
    } | {
        count: number;
        created_at: string;
        id: string;
        period_end: string;
        period_start: string;
        updated_at: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipe_usage and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipe_usage and user_preferences">;
    } | {
        category: string | null;
        cook_time_minutes: number | null;
        created_at: string | null;
        id: string;
        ingredients: string[];
        nutrition: import("../../types/supabase").Json;
        prep_time_minutes: number | null;
        quality_score: number | null;
        query: string | null;
        servings: number | null;
        similarity_hash: string | null;
        steps: import("../../types/supabase").Json;
        tags: string[] | null;
        title: string;
        total_time_minutes: number | null;
        updated_at: string | null;
        user_id: string | null;
        views: number | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipe_usage and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipe_usage and user_preferences">;
    } | {
        created_at: string | null;
        id: string;
        query: string;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipe_usage and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipe_usage and user_preferences">;
    } | {
        created_at: string;
        id: string;
        status: string;
        tier: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipe_usage and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipe_usage and user_preferences">;
    } | {
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
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipe_usage and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipe_usage and user_preferences">;
    } | {
        created_at: string;
        id: number;
        settings: import("../../types/supabase").Json;
        updated_at: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipe_usage and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipe_usage and user_preferences">;
    } | {
        action_type: string;
        created_at: string;
        id: string;
        last_active: string;
        metadata: import("../../types/supabase").Json | null;
        resource_id: string | null;
        resource_type: string | null;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipe_usage and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipe_usage and user_preferences">;
    } | {
        allergies: string[] | null;
        cooking_skill: string | null;
        created_at: string | null;
        dietary_restrictions: string[] | null;
        favorite_cuisines: string[] | null;
        id: string;
        updated_at: string | null;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipe_usage and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between recipe_usage and user_preferences">;
    } | {
        created_at: string;
        created_by: string | null;
        id: string;
        role: string;
        updated_at: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between search_history and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between search_history and user_preferences">;
    } | {
        created_at: string;
        id: string;
        title: string | null;
        updated_at: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between search_history and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between search_history and user_preferences">;
    } | {
        created_at: string | null;
        id: string;
        recipe_id: string | null;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between search_history and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between search_history and user_preferences">;
    } | {
        content: string;
        conversation_id: string;
        created_at: string;
        id: string;
        metadata: import("../../types/supabase").Json | null;
        role: string;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between search_history and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between search_history and user_preferences">;
    } | {
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
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between search_history and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between search_history and user_preferences">;
    } | {
        count: number;
        created_at: string;
        id: string;
        period_end: string;
        period_start: string;
        updated_at: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between search_history and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between search_history and user_preferences">;
    } | {
        category: string | null;
        cook_time_minutes: number | null;
        created_at: string | null;
        id: string;
        ingredients: string[];
        nutrition: import("../../types/supabase").Json;
        prep_time_minutes: number | null;
        quality_score: number | null;
        query: string | null;
        servings: number | null;
        similarity_hash: string | null;
        steps: import("../../types/supabase").Json;
        tags: string[] | null;
        title: string;
        total_time_minutes: number | null;
        updated_at: string | null;
        user_id: string | null;
        views: number | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between search_history and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between search_history and user_preferences">;
    } | {
        created_at: string | null;
        id: string;
        query: string;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between search_history and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between search_history and user_preferences">;
    } | {
        created_at: string;
        id: string;
        status: string;
        tier: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between search_history and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between search_history and user_preferences">;
    } | {
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
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between search_history and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between search_history and user_preferences">;
    } | {
        created_at: string;
        id: number;
        settings: import("../../types/supabase").Json;
        updated_at: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between search_history and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between search_history and user_preferences">;
    } | {
        action_type: string;
        created_at: string;
        id: string;
        last_active: string;
        metadata: import("../../types/supabase").Json | null;
        resource_id: string | null;
        resource_type: string | null;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between search_history and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between search_history and user_preferences">;
    } | {
        allergies: string[] | null;
        cooking_skill: string | null;
        created_at: string | null;
        dietary_restrictions: string[] | null;
        favorite_cuisines: string[] | null;
        id: string;
        updated_at: string | null;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between search_history and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between search_history and user_preferences">;
    } | {
        created_at: string;
        created_by: string | null;
        id: string;
        role: string;
        updated_at: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscription_history and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscription_history and user_preferences">;
    } | {
        created_at: string;
        id: string;
        title: string | null;
        updated_at: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscription_history and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscription_history and user_preferences">;
    } | {
        created_at: string | null;
        id: string;
        recipe_id: string | null;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscription_history and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscription_history and user_preferences">;
    } | {
        content: string;
        conversation_id: string;
        created_at: string;
        id: string;
        metadata: import("../../types/supabase").Json | null;
        role: string;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscription_history and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscription_history and user_preferences">;
    } | {
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
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscription_history and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscription_history and user_preferences">;
    } | {
        count: number;
        created_at: string;
        id: string;
        period_end: string;
        period_start: string;
        updated_at: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscription_history and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscription_history and user_preferences">;
    } | {
        category: string | null;
        cook_time_minutes: number | null;
        created_at: string | null;
        id: string;
        ingredients: string[];
        nutrition: import("../../types/supabase").Json;
        prep_time_minutes: number | null;
        quality_score: number | null;
        query: string | null;
        servings: number | null;
        similarity_hash: string | null;
        steps: import("../../types/supabase").Json;
        tags: string[] | null;
        title: string;
        total_time_minutes: number | null;
        updated_at: string | null;
        user_id: string | null;
        views: number | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscription_history and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscription_history and user_preferences">;
    } | {
        created_at: string | null;
        id: string;
        query: string;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscription_history and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscription_history and user_preferences">;
    } | {
        created_at: string;
        id: string;
        status: string;
        tier: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscription_history and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscription_history and user_preferences">;
    } | {
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
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscription_history and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscription_history and user_preferences">;
    } | {
        created_at: string;
        id: number;
        settings: import("../../types/supabase").Json;
        updated_at: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscription_history and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscription_history and user_preferences">;
    } | {
        action_type: string;
        created_at: string;
        id: string;
        last_active: string;
        metadata: import("../../types/supabase").Json | null;
        resource_id: string | null;
        resource_type: string | null;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscription_history and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscription_history and user_preferences">;
    } | {
        allergies: string[] | null;
        cooking_skill: string | null;
        created_at: string | null;
        dietary_restrictions: string[] | null;
        favorite_cuisines: string[] | null;
        id: string;
        updated_at: string | null;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscription_history and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscription_history and user_preferences">;
    } | {
        created_at: string;
        created_by: string | null;
        id: string;
        role: string;
        updated_at: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscriptions and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscriptions and user_preferences">;
    } | {
        created_at: string;
        id: string;
        title: string | null;
        updated_at: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscriptions and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscriptions and user_preferences">;
    } | {
        created_at: string | null;
        id: string;
        recipe_id: string | null;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscriptions and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscriptions and user_preferences">;
    } | {
        content: string;
        conversation_id: string;
        created_at: string;
        id: string;
        metadata: import("../../types/supabase").Json | null;
        role: string;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscriptions and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscriptions and user_preferences">;
    } | {
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
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscriptions and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscriptions and user_preferences">;
    } | {
        count: number;
        created_at: string;
        id: string;
        period_end: string;
        period_start: string;
        updated_at: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscriptions and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscriptions and user_preferences">;
    } | {
        category: string | null;
        cook_time_minutes: number | null;
        created_at: string | null;
        id: string;
        ingredients: string[];
        nutrition: import("../../types/supabase").Json;
        prep_time_minutes: number | null;
        quality_score: number | null;
        query: string | null;
        servings: number | null;
        similarity_hash: string | null;
        steps: import("../../types/supabase").Json;
        tags: string[] | null;
        title: string;
        total_time_minutes: number | null;
        updated_at: string | null;
        user_id: string | null;
        views: number | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscriptions and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscriptions and user_preferences">;
    } | {
        created_at: string | null;
        id: string;
        query: string;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscriptions and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscriptions and user_preferences">;
    } | {
        created_at: string;
        id: string;
        status: string;
        tier: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscriptions and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscriptions and user_preferences">;
    } | {
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
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscriptions and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscriptions and user_preferences">;
    } | {
        created_at: string;
        id: number;
        settings: import("../../types/supabase").Json;
        updated_at: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscriptions and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscriptions and user_preferences">;
    } | {
        action_type: string;
        created_at: string;
        id: string;
        last_active: string;
        metadata: import("../../types/supabase").Json | null;
        resource_id: string | null;
        resource_type: string | null;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscriptions and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscriptions and user_preferences">;
    } | {
        allergies: string[] | null;
        cooking_skill: string | null;
        created_at: string | null;
        dietary_restrictions: string[] | null;
        favorite_cuisines: string[] | null;
        id: string;
        updated_at: string | null;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscriptions and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between subscriptions and user_preferences">;
    } | {
        created_at: string;
        created_by: string | null;
        id: string;
        role: string;
        updated_at: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between system_settings and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between system_settings and user_preferences">;
    } | {
        created_at: string;
        id: string;
        title: string | null;
        updated_at: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between system_settings and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between system_settings and user_preferences">;
    } | {
        created_at: string | null;
        id: string;
        recipe_id: string | null;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between system_settings and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between system_settings and user_preferences">;
    } | {
        content: string;
        conversation_id: string;
        created_at: string;
        id: string;
        metadata: import("../../types/supabase").Json | null;
        role: string;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between system_settings and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between system_settings and user_preferences">;
    } | {
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
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between system_settings and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between system_settings and user_preferences">;
    } | {
        count: number;
        created_at: string;
        id: string;
        period_end: string;
        period_start: string;
        updated_at: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between system_settings and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between system_settings and user_preferences">;
    } | {
        category: string | null;
        cook_time_minutes: number | null;
        created_at: string | null;
        id: string;
        ingredients: string[];
        nutrition: import("../../types/supabase").Json;
        prep_time_minutes: number | null;
        quality_score: number | null;
        query: string | null;
        servings: number | null;
        similarity_hash: string | null;
        steps: import("../../types/supabase").Json;
        tags: string[] | null;
        title: string;
        total_time_minutes: number | null;
        updated_at: string | null;
        user_id: string | null;
        views: number | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between system_settings and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between system_settings and user_preferences">;
    } | {
        created_at: string | null;
        id: string;
        query: string;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between system_settings and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between system_settings and user_preferences">;
    } | {
        created_at: string;
        id: string;
        status: string;
        tier: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between system_settings and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between system_settings and user_preferences">;
    } | {
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
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between system_settings and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between system_settings and user_preferences">;
    } | {
        created_at: string;
        id: number;
        settings: import("../../types/supabase").Json;
        updated_at: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between system_settings and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between system_settings and user_preferences">;
    } | {
        action_type: string;
        created_at: string;
        id: string;
        last_active: string;
        metadata: import("../../types/supabase").Json | null;
        resource_id: string | null;
        resource_type: string | null;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between system_settings and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between system_settings and user_preferences">;
    } | {
        allergies: string[] | null;
        cooking_skill: string | null;
        created_at: string | null;
        dietary_restrictions: string[] | null;
        favorite_cuisines: string[] | null;
        id: string;
        updated_at: string | null;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between system_settings and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between system_settings and user_preferences">;
    } | {
        created_at: string;
        created_by: string | null;
        id: string;
        role: string;
        updated_at: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_activity and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_activity and user_preferences">;
    } | {
        created_at: string;
        id: string;
        title: string | null;
        updated_at: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_activity and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_activity and user_preferences">;
    } | {
        created_at: string | null;
        id: string;
        recipe_id: string | null;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_activity and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_activity and user_preferences">;
    } | {
        content: string;
        conversation_id: string;
        created_at: string;
        id: string;
        metadata: import("../../types/supabase").Json | null;
        role: string;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_activity and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_activity and user_preferences">;
    } | {
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
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_activity and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_activity and user_preferences">;
    } | {
        count: number;
        created_at: string;
        id: string;
        period_end: string;
        period_start: string;
        updated_at: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_activity and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_activity and user_preferences">;
    } | {
        category: string | null;
        cook_time_minutes: number | null;
        created_at: string | null;
        id: string;
        ingredients: string[];
        nutrition: import("../../types/supabase").Json;
        prep_time_minutes: number | null;
        quality_score: number | null;
        query: string | null;
        servings: number | null;
        similarity_hash: string | null;
        steps: import("../../types/supabase").Json;
        tags: string[] | null;
        title: string;
        total_time_minutes: number | null;
        updated_at: string | null;
        user_id: string | null;
        views: number | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_activity and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_activity and user_preferences">;
    } | {
        created_at: string | null;
        id: string;
        query: string;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_activity and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_activity and user_preferences">;
    } | {
        created_at: string;
        id: string;
        status: string;
        tier: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_activity and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_activity and user_preferences">;
    } | {
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
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_activity and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_activity and user_preferences">;
    } | {
        created_at: string;
        id: number;
        settings: import("../../types/supabase").Json;
        updated_at: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_activity and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_activity and user_preferences">;
    } | {
        action_type: string;
        created_at: string;
        id: string;
        last_active: string;
        metadata: import("../../types/supabase").Json | null;
        resource_id: string | null;
        resource_type: string | null;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_activity and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_activity and user_preferences">;
    } | {
        allergies: string[] | null;
        cooking_skill: string | null;
        created_at: string | null;
        dietary_restrictions: string[] | null;
        favorite_cuisines: string[] | null;
        id: string;
        updated_at: string | null;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_activity and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_activity and user_preferences">;
    } | {
        created_at: string;
        created_by: string | null;
        id: string;
        role: string;
        updated_at: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_preferences and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_preferences and user_preferences">;
    } | {
        created_at: string;
        id: string;
        title: string | null;
        updated_at: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_preferences and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_preferences and user_preferences">;
    } | {
        created_at: string | null;
        id: string;
        recipe_id: string | null;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_preferences and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_preferences and user_preferences">;
    } | {
        content: string;
        conversation_id: string;
        created_at: string;
        id: string;
        metadata: import("../../types/supabase").Json | null;
        role: string;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_preferences and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_preferences and user_preferences">;
    } | {
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
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_preferences and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_preferences and user_preferences">;
    } | {
        count: number;
        created_at: string;
        id: string;
        period_end: string;
        period_start: string;
        updated_at: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_preferences and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_preferences and user_preferences">;
    } | {
        category: string | null;
        cook_time_minutes: number | null;
        created_at: string | null;
        id: string;
        ingredients: string[];
        nutrition: import("../../types/supabase").Json;
        prep_time_minutes: number | null;
        quality_score: number | null;
        query: string | null;
        servings: number | null;
        similarity_hash: string | null;
        steps: import("../../types/supabase").Json;
        tags: string[] | null;
        title: string;
        total_time_minutes: number | null;
        updated_at: string | null;
        user_id: string | null;
        views: number | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_preferences and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_preferences and user_preferences">;
    } | {
        created_at: string | null;
        id: string;
        query: string;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_preferences and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_preferences and user_preferences">;
    } | {
        created_at: string;
        id: string;
        status: string;
        tier: string;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_preferences and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_preferences and user_preferences">;
    } | {
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
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_preferences and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_preferences and user_preferences">;
    } | {
        created_at: string;
        id: number;
        settings: import("../../types/supabase").Json;
        updated_at: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_preferences and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_preferences and user_preferences">;
    } | {
        action_type: string;
        created_at: string;
        id: string;
        last_active: string;
        metadata: import("../../types/supabase").Json | null;
        resource_id: string | null;
        resource_type: string | null;
        user_id: string;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_preferences and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_preferences and user_preferences">;
    } | {
        allergies: string[] | null;
        cooking_skill: string | null;
        created_at: string | null;
        dietary_restrictions: string[] | null;
        favorite_cuisines: string[] | null;
        id: string;
        updated_at: string | null;
        user_id: string | null;
        subscriptions: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_preferences and subscriptions">;
        user_preferences: import("@supabase/postgrest-js/dist/cjs/select-query-parser/utils").SelectQueryError<"could not find the relation between user_preferences and user_preferences">;
    };
    activity: {
        action_type: string;
        created_at: string;
        id: string;
        last_active: string;
        metadata: import("../../types/supabase").Json | null;
        resource_id: string | null;
        resource_type: string | null;
        user_id: string;
    }[];
    stats: {
        recipeCount: number;
        favoriteCount: number;
    };
    usage: {
        count: number;
        created_at: string;
        id: string;
        period_end: string;
        period_start: string;
        updated_at: string;
        user_id: string;
    }[];
} | null>;
/**
 * Update a user's subscription
 */
export declare const updateSubscription: (userId: string, tier: string) => Promise<boolean>;
/**
 * Reset a user's usage limits
 */
export declare const resetUsageLimits: (userId: string) => Promise<boolean>;
