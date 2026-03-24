#!/usr/bin/env node
/**
 * Dealish seed script — populates restaurants + deals for Toronto
 * Usage: SUPABASE_URL=https://hpsoqjpzebkkxdqapegl.supabase.co SUPABASE_SERVICE_KEY=<key> node scripts/seed-deals.js
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hpsoqjpzebkkxdqapegl.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_KEY) {
  console.error('❌ SUPABASE_SERVICE_KEY env var required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const RESTAURANTS = [
  {
    name: 'Gusto 501',
    address: '501 King St E, Toronto, ON',
    lat: 43.6528, lng: -79.3577,
    type: 'Italian',
    partner: true,
    rating: 4.6, num_ratings: 312,
    hero_image_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800',
    display_image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400',
  },
  {
    name: 'Bar Raval',
    address: '505 College St, Toronto, ON',
    lat: 43.6578, lng: -79.4097,
    type: 'Spanish',
    partner: true,
    rating: 4.8, num_ratings: 489,
    hero_image_url: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800',
    display_image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400',
  },
  {
    name: 'Pai Northern Thai',
    address: '18 Duncan St, Toronto, ON',
    lat: 43.6481, lng: -79.3911,
    type: 'Thai',
    partner: true,
    rating: 4.7, num_ratings: 621,
    hero_image_url: 'https://images.unsplash.com/photo-1562565652-a0d8f0c59eb4?w=800',
    display_image: 'https://images.unsplash.com/photo-1562565652-a0d8f0c59eb4?w=400',
  },
  {
    name: 'Canoe Restaurant',
    address: '66 Wellington St W, Toronto, ON',
    lat: 43.6479, lng: -79.3816,
    type: 'Canadian',
    partner: false,
    rating: 4.5, num_ratings: 278,
    hero_image_url: 'https://images.unsplash.com/photo-1600891964599-f61ba0e24092?w=800',
    display_image: 'https://images.unsplash.com/photo-1600891964599-f61ba0e24092?w=400',
  },
  {
    name: 'DaiLo',
    address: '503 College St, Toronto, ON',
    lat: 43.6577, lng: -79.4094,
    type: 'Asian Fusion',
    partner: true,
    rating: 4.6, num_ratings: 344,
    hero_image_url: 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=800',
    display_image: 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=400',
  },
  {
    name: 'Alo Restaurant',
    address: '163 Spadina Ave, Toronto, ON',
    lat: 43.6487, lng: -79.3966,
    type: 'French',
    partner: true,
    rating: 4.9, num_ratings: 203,
    hero_image_url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800',
    display_image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400',
  },
  {
    name: 'Parts & Labour',
    address: '1566 Queen St W, Toronto, ON',
    lat: 43.6414, lng: -79.4341,
    type: 'Burgers',
    partner: false,
    rating: 4.3, num_ratings: 187,
    hero_image_url: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=800',
    display_image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=400',
  },
  {
    name: 'Sushi Masaki Saito',
    address: '88 Avenue Rd, Toronto, ON',
    lat: 43.6711, lng: -79.3932,
    type: 'Japanese',
    partner: true,
    rating: 4.9, num_ratings: 156,
    hero_image_url: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800',
    display_image: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=400',
  },
  {
    name: 'Richmond Station',
    address: '1 Richmond St W, Toronto, ON',
    lat: 43.6513, lng: -79.3783,
    type: 'Canadian',
    partner: true,
    rating: 4.5, num_ratings: 392,
    hero_image_url: 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=800',
    display_image: 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=400',
  },
  {
    name: 'Forno Cultura',
    address: '609 King St W, Toronto, ON',
    lat: 43.6446, lng: -79.4016,
    type: 'Bakery',
    partner: false,
    rating: 4.7, num_ratings: 511,
    hero_image_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800',
    display_image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400',
  },
  {
    name: 'El Catrin',
    address: '18 Tank House Ln, Toronto, ON',
    lat: 43.6502, lng: -79.3598,
    type: 'Mexican',
    partner: true,
    rating: 4.4, num_ratings: 443,
    hero_image_url: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800',
    display_image: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400',
  },
  {
    name: 'Terroni',
    address: '57 Adelaide St E, Toronto, ON',
    lat: 43.6498, lng: -79.3766,
    type: 'Italian',
    partner: false,
    rating: 4.4, num_ratings: 367,
    hero_image_url: 'https://images.unsplash.com/photo-1498579150354-977475b7ea0b?w=800',
    display_image: 'https://images.unsplash.com/photo-1498579150354-977475b7ea0b?w=400',
  },
];

// Deals — one per partner restaurant, active recurring Mon–Sun all day
function buildDeals(restaurantMap) {
  const now = new Date();
  const allDays = [0, 1, 2, 3, 4, 5, 6];

  return [
    {
      restaurant_id: restaurantMap['Gusto 501'],
      title: '20% Off Pasta Mains',
      description: 'Get 20% off all pasta mains when you dine in.',
      discount_type: 'percent', discount_value: 20,
      is_active: true, is_recurring: true,
      recurrence_days: allDays,
      recurrence_start_time: '11:00:00', recurrence_end_time: '22:00:00',
    },
    {
      restaurant_id: restaurantMap['Bar Raval'],
      title: 'Happy Hour — $5 Pintxos',
      description: '$5 pintxos plates every day from 5–7 PM.',
      discount_type: 'fixed', discount_value: 5,
      is_active: true, is_recurring: true,
      recurrence_days: allDays,
      recurrence_start_time: '17:00:00', recurrence_end_time: '19:00:00',
    },
    {
      restaurant_id: restaurantMap['Pai Northern Thai'],
      title: 'Lunch Special — 15% Off',
      description: '15% off the entire bill for lunch service.',
      discount_type: 'percent', discount_value: 15,
      is_active: true, is_recurring: true,
      recurrence_days: [1, 2, 3, 4, 5],
      recurrence_start_time: '11:30:00', recurrence_end_time: '14:30:00',
    },
    {
      restaurant_id: restaurantMap['DaiLo'],
      title: 'BOGO Cocktails',
      description: 'Buy one cocktail, get one free at the bar.',
      discount_type: 'bogo', discount_value: 0,
      is_active: true, is_recurring: true,
      recurrence_days: [4, 5, 6],
      recurrence_start_time: '17:00:00', recurrence_end_time: '20:00:00',
    },
    {
      restaurant_id: restaurantMap['Alo Restaurant'],
      title: '10% Off Set Menu',
      description: '10% off the full set tasting menu for Dealish members.',
      discount_type: 'percent', discount_value: 10,
      is_active: true, is_recurring: true,
      recurrence_days: allDays,
      recurrence_start_time: '17:00:00', recurrence_end_time: '22:00:00',
    },
    {
      restaurant_id: restaurantMap['Sushi Masaki Saito'],
      title: 'Omakase Discount — $20 Off',
      description: '$20 off the omakase experience for 2+ guests.',
      discount_type: 'fixed', discount_value: 20,
      is_active: true, is_recurring: true,
      recurrence_days: [2, 3, 4],
      recurrence_start_time: '18:00:00', recurrence_end_time: '21:00:00',
    },
    {
      restaurant_id: restaurantMap['Richmond Station'],
      title: 'Sunday Brunch — 15% Off',
      description: '15% off the full brunch menu on Sundays.',
      discount_type: 'percent', discount_value: 15,
      is_active: true, is_recurring: true,
      recurrence_days: [0],
      recurrence_start_time: '10:00:00', recurrence_end_time: '15:00:00',
    },
    {
      restaurant_id: restaurantMap['El Catrin'],
      title: 'Taco Tuesday — $3 Tacos',
      description: '$3 street tacos every Tuesday all night.',
      discount_type: 'fixed', discount_value: 3,
      is_active: true, is_recurring: true,
      recurrence_days: [2],
      recurrence_start_time: '11:00:00', recurrence_end_time: '22:00:00',
    },
  ].filter(d => d.restaurant_id); // skip any that didn't match
}

async function seed() {
  console.log('🌱 Seeding Dealish database...\n');

  // Upsert restaurants
  console.log(`📍 Inserting ${RESTAURANTS.length} restaurants...`);
  const { data: insertedRestaurants, error: restError } = await supabase
    .from('restaurants')
    .upsert(RESTAURANTS, { onConflict: 'name' })
    .select('id, name');

  if (restError) {
    console.error('❌ Error inserting restaurants:', restError.message);
    process.exit(1);
  }

  console.log(`✅ ${insertedRestaurants.length} restaurants upserted`);

  // Build name → id map
  const restaurantMap = {};
  insertedRestaurants.forEach(r => { restaurantMap[r.name] = r.id; });

  // Build and insert deals
  const deals = buildDeals(restaurantMap);
  console.log(`\n🏷️  Inserting ${deals.length} deals...`);

  const { data: insertedDeals, error: dealError } = await supabase
    .from('deals')
    .insert(deals)
    .select('id, title');

  if (dealError) {
    console.error('❌ Error inserting deals:', dealError.message);
    process.exit(1);
  }

  console.log(`✅ ${insertedDeals.length} deals inserted`);
  console.log('\n🎉 Seed complete!\n');
  insertedDeals.forEach(d => console.log(`  • ${d.title}`));
}

seed().catch(console.error);
