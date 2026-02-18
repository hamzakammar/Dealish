import { UserSettings } from "./settings";

export type Profile = {
    id: string;
    display_name?: string;
    role: 'user' | 'owner' | 'admin';
    restaurant_ids?: string[]; // For 'owner' role
    avatar_url?: string;
    location?: string;
    recents?: any[]; // Array of recent activities
    settings?: UserSettings;
    push_token?: string;
    push_token_updated_at?: string;
    created_at?: string;
    updated_at?: string;
};