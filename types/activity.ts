export type UserActivity = {
    id: string;
    user_id: string;
    restaurant_id: string;
    activity_type: 'visit' | 'redemption';
    deal_id?: string; // Optional: track which deal was involved
    deal_description?: string;
    amount_saved?: number;
    created_at: string;
};

export type ActivityWithRestaurant = UserActivity & {
    restaurants: {
        name: string;
        logo_url?: string;
        rating?: number;
        rating_count?: number;
    };
};