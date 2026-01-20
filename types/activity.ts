export type UserActivity = {
    id: string;
    user_id: string;
    restaurant_id: string;
    activity_type: 'visit' | 'redemption';
    deal_description?: string;
    amount_saved?: number;
    created_at: string;
};

export type ActivityWithRestaurant = UserActivity & {
    restaurants: {
        name: string;
        logo_url?: string;
    };
};