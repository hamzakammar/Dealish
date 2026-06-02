import { UserActivity } from "./activity";
import { UserSettings } from "./settings";

export type Profile = {
    id: string;
    display_name?: string;
    role: 'user' | 'owner' | 'admin';
    is_operator?: boolean; // Platform operator: may review the scraped-deal queue
    restaurant_ids?: string[]; // For 'owner' role
    avatar_url?: string;
    location?: string;
    recents?: UserActivity[];
    settings?: UserSettings;
    push_token?: string;
    push_token_updated_at?: string;
    created_at?: string;
    updated_at?: string;
};