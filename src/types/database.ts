// Database types - These should be generated from Supabase
// For now, we define minimal types to make TypeScript happy

export type Database = {
    public: {
        Tables: {
            projects: {
                Row: {
                    id: number;
                    created_at: string;
                    name: string;
                    organization_id: string | null;
                    slug: string;
                    type: string;
                    organization_slug: string | null;
                    project_id: string;
                    logo_url: string | null;
                    created_by: string | null;
                    updated_at: string;
                    deleted_at: string | null;
                    open_for_new_helpers: boolean;
                    sandbox: boolean;
                };
                Insert: Partial<{
                    id: number;
                    created_at: string;
                    name: string;
                    organization_id: string | null;
                    slug: string;
                    type: string;
                    organization_slug: string | null;
                    project_id: string;
                    logo_url: string | null;
                    created_by: string | null;
                    updated_at: string;
                    deleted_at: string | null;
                    open_for_new_helpers: boolean;
                    sandbox: boolean;
                }>;
                Update: Partial<{
                    id: number;
                    created_at: string;
                    name: string;
                    organization_id: string | null;
                    slug: string;
                    type: string;
                    organization_slug: string | null;
                    project_id: string;
                    logo_url: string | null;
                    created_by: string | null;
                    updated_at: string;
                    deleted_at: string | null;
                    open_for_new_helpers: boolean;
                    sandbox: boolean;
                }>;
            };
            projects_invites: {
                Row: {
                    id: string;
                    created_at: string;
                    project_id: string;
                    created_by: string;
                    token: string;
                    expires_at: string | null;
                    max_uses: number | null;
                    uses_count: number;
                    is_active: boolean;
                    updated_at: string;
                    invite_type: "member" | "helper";
                    category: "core" | "extended" | "community" | null;
                    email: string | null;
                    github_username: string | null;
                    invitee_identifier: string | null;
                };
                Insert: Partial<{
                    id: string;
                    created_at: string;
                    project_id: string;
                    created_by: string;
                    token: string;
                    expires_at: string | null;
                    max_uses: number | null;
                    uses_count: number;
                    is_active: boolean;
                    updated_at: string;
                    invite_type: "member" | "helper";
                    category: "core" | "extended" | "community" | null;
                    email: string | null;
                    github_username: string | null;
                    invitee_identifier: string | null;
                }>;
                Update: Partial<{
                    id: string;
                    created_at: string;
                    project_id: string;
                    created_by: string;
                    token: string;
                    expires_at: string | null;
                    max_uses: number | null;
                    uses_count: number;
                    is_active: boolean;
                    updated_at: string;
                    invite_type: "member" | "helper";
                    category: "core" | "extended" | "community" | null;
                    email: string | null;
                    github_username: string | null;
                    invitee_identifier: string | null;
                }>;
            };
            tickets: {
                Row: {
                    id: string;
                    created_at: string;
                    updated_at: string;
                    deleted_at: string | null;
                    completed_at: string | null;
                    cancelled_at: string | null;
                    project_id: string;
                    created_by: string | null;
                    title: string;
                    description: string;
                    status:
                        | "available"
                        | "claimed"
                        | "in-progress"
                        | "completed"
                        | "cancelled";
                    priority: "low" | "medium" | "high";
                    sla_id: string | null;
                    success: boolean;
                };
                Insert: Partial<{
                    id: string;
                    created_at: string;
                    updated_at: string;
                    deleted_at: string | null;
                    completed_at: string | null;
                    cancelled_at: string | null;
                    project_id: string;
                    created_by: string | null;
                    title: string;
                    description: string;
                    status:
                        | "available"
                        | "claimed"
                        | "in-progress"
                        | "completed"
                        | "cancelled";
                    priority: "low" | "medium" | "high";
                    sla_id: string | null;
                    success: boolean;
                }>;
                Update: Partial<{
                    id: string;
                    created_at: string;
                    updated_at: string;
                    deleted_at: string | null;
                    completed_at: string | null;
                    cancelled_at: string | null;
                    project_id: string;
                    created_by: string | null;
                    title: string;
                    description: string;
                    status:
                        | "available"
                        | "claimed"
                        | "in-progress"
                        | "completed"
                        | "cancelled";
                    priority: "low" | "medium" | "high";
                    sla_id: string | null;
                    success: boolean;
                }>;
            };
            projects_helpers: {
                Row: {
                    id: number;
                    created_at: string;
                    user_id: string | null;
                    external_user_id: number | null;
                    project_id: string | null;
                    category: "core" | "community" | "extended" | null;
                    updated_at: string;
                    helper_id: string;
                };
                Insert: Partial<{
                    id: number;
                    created_at: string;
                    user_id: string | null;
                    external_user_id: number | null;
                    project_id: string | null;
                    category: "core" | "community" | "extended" | null;
                    updated_at: string;
                    helper_id: string;
                }>;
                Update: Partial<{
                    id: number;
                    created_at: string;
                    user_id: string | null;
                    external_user_id: number | null;
                    project_id: string | null;
                    category: "core" | "community" | "extended" | null;
                    updated_at: string;
                    helper_id: string;
                }>;
            };
            slas: {
                Row: {
                    id: string;
                    created_at: string;
                    project_id: string;
                    organization_id: string | null;
                    name: string | null;
                    contact_name: string | null;
                    contact_email: string | null;
                    space_id: string | null;
                    support_limit_smallest_unit: number;
                    time_period: "monthly" | "yearly" | null;
                    minutes_included: number;
                    minutes_rollover: boolean;
                    subscription_amount_smallest_unit: number;
                    currency: string;
                    payment_frequency: "monthly" | "yearly";
                    ticket_start_price: number;
                    ticket_price_minute_first_60: number;
                    ticket_price_minute_after_60: number;
                    max_response_time_minutes: number | null;
                    max_downtime: number | null;
                    status: "active" | "deactivated" | "archived";
                    start_date: string | null;
                    end_date: string | null;
                    updated_at: string;
                    deleted_at: string | null;
                };
                Insert: Partial<{
                    id: string;
                    created_at: string;
                    project_id: string;
                    organization_id: string | null;
                    name: string | null;
                    contact_name: string | null;
                    contact_email: string | null;
                    space_id: string | null;
                    support_limit_smallest_unit: number;
                    time_period: "monthly" | "yearly" | null;
                    minutes_included: number;
                    minutes_rollover: boolean;
                    subscription_amount_smallest_unit: number;
                    currency: string;
                    payment_frequency: "monthly" | "yearly";
                    ticket_start_price: number;
                    ticket_price_minute_first_60: number;
                    ticket_price_minute_after_60: number;
                    max_response_time_minutes: number | null;
                    max_downtime: number | null;
                    status: "active" | "deactivated" | "archived";
                    start_date: string | null;
                    end_date: string | null;
                    updated_at: string;
                    deleted_at: string | null;
                }>;
                Update: Partial<{
                    id: string;
                    created_at: string;
                    project_id: string;
                    organization_id: string | null;
                    name: string | null;
                    contact_name: string | null;
                    contact_email: string | null;
                    space_id: string | null;
                    support_limit_smallest_unit: number;
                    time_period: "monthly" | "yearly" | null;
                    minutes_included: number;
                    minutes_rollover: boolean;
                    subscription_amount_smallest_unit: number;
                    currency: string;
                    payment_frequency: "monthly" | "yearly";
                    ticket_start_price: number;
                    ticket_price_minute_first_60: number;
                    ticket_price_minute_after_60: number;
                    max_response_time_minutes: number | null;
                    max_downtime: number | null;
                    status: "active" | "deactivated" | "archived";
                    start_date: string | null;
                    end_date: string | null;
                    updated_at: string;
                    deleted_at: string | null;
                }>;
            };
            tickets_messages: {
                Row: {
                    id: string;
                    created_at: string;
                    ticket_id: string;
                    sender_id: string;
                    sender_type: "user" | "helper" | "system";
                    content: string;
                    deleted_at: string | null;
                    updated_at: string;
                    metadata: Record<string, unknown> | null;
                };
                Insert: Partial<{
                    id: string;
                    created_at: string;
                    ticket_id: string;
                    sender_id: string;
                    sender_type: "user" | "helper" | "system";
                    content: string;
                    deleted_at: string | null;
                    updated_at: string;
                    metadata: Record<string, unknown> | null;
                }>;
                Update: Partial<{
                    id: string;
                    created_at: string;
                    ticket_id: string;
                    sender_id: string;
                    sender_type: "user" | "helper" | "system";
                    content: string;
                    deleted_at: string | null;
                    updated_at: string;
                    metadata: Record<string, unknown> | null;
                }>;
            };
            users: {
                Row: {
                    id: string;
                    onboarding_completed: boolean;
                    onboarding_completed_at: string | null;
                };
                Insert: Partial<{
                    id: string;
                    onboarding_completed: boolean;
                    onboarding_completed_at: string | null;
                }>;
                Update: Partial<{
                    id: string;
                    onboarding_completed: boolean;
                    onboarding_completed_at: string | null;
                }>;
            };
            users_public: {
                Row: {
                    id: string;
                    created_at: string;
                    name: string;
                    username: string | null;
                    email: string | null;
                    avatar_url: string | null;
                };
                Insert: Partial<{
                    id: string;
                    created_at: string;
                    name: string;
                    username: string | null;
                    email: string | null;
                    avatar_url: string | null;
                }>;
                Update: Partial<{
                    id: string;
                    created_at: string;
                    name: string;
                    username: string | null;
                    email: string | null;
                    avatar_url: string | null;
                }>;
            };
            projects_resources: {
                Row: {
                    id: number;
                    project_id: number;
                    created_at: string;
                    name: string;
                    url: string;
                };
                Insert: Partial<{
                    id: number;
                    project_id: number;
                    created_at: string;
                    name: string;
                    url: string;
                }>;
                Update: Partial<{
                    id: number;
                    project_id: number;
                    created_at: string;
                    name: string;
                    url: string;
                }>;
            };
            projects_branding: {
                Row: {
                    project_id: string;
                    created_at: string;
                    primary_color: string | null;
                    logo_url: string | null;
                };
                Insert: Partial<{
                    project_id: string;
                    created_at: string;
                    primary_color: string | null;
                    logo_url: string | null;
                }>;
                Update: Partial<{
                    project_id: string;
                    created_at: string;
                    primary_color: string | null;
                    logo_url: string | null;
                }>;
            };
            projects_payment_settings: {
                Row: {
                    project_id: string;
                    created_at: string;
                    core_helper_percentage: number;
                    community_helper_percentage: number;
                    consultant_helper_percentage: number;
                    updated_at: string;
                    extended_contract_type: "ticket" | "outside" | null;
                    ticket_start_price: number;
                    ticket_price_minute_first_60: number;
                    ticket_price_minute_after_60: number;
                    tickets_enabled: boolean | null;
                    sla_enabled: boolean | null;
                };
                Insert: Partial<{
                    project_id: string;
                    created_at: string;
                    core_helper_percentage: number;
                    community_helper_percentage: number;
                    consultant_helper_percentage: number;
                    updated_at: string;
                    extended_contract_type: "ticket" | "outside" | null;
                    ticket_start_price: number;
                    ticket_price_minute_first_60: number;
                    ticket_price_minute_after_60: number;
                    tickets_enabled: boolean | null;
                    sla_enabled: boolean | null;
                }>;
                Update: Partial<{
                    project_id: string;
                    created_at: string;
                    core_helper_percentage: number;
                    community_helper_percentage: number;
                    consultant_helper_percentage: number;
                    updated_at: string;
                    extended_contract_type: "ticket" | "outside" | null;
                    ticket_start_price: number;
                    ticket_price_minute_first_60: number;
                    ticket_price_minute_after_60: number;
                    tickets_enabled: boolean | null;
                    sla_enabled: boolean | null;
                }>;
            };
            tickets_participants: {
                Row: {
                    id: string;
                    created_at: string;
                    ticket_id: string;
                    participant_id: string;
                    claimed: boolean;
                    last_read_message_id: string | null;
                };
                Insert: Partial<{
                    id: string;
                    created_at: string;
                    ticket_id: string;
                    participant_id: string;
                    claimed: boolean;
                    last_read_message_id: string | null;
                }>;
                Update: Partial<{
                    id: string;
                    created_at: string;
                    ticket_id: string;
                    participant_id: string;
                    claimed: boolean;
                    last_read_message_id: string | null;
                }>;
            };
        };
    };
};
