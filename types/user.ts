export type Profile = {
    id: string;
    email?: string;
    full_name?: string;
    avatar_url?: string;
    location?: string;
    recents?: any[]; // Array of recent activities
    created_at?: string;
    updated_at?: string;
};