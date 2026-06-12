import { useCallback, useEffect, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { supabase } from '@/app/lib/supabase';
import { useAuthContext } from '@/app/providers/auth';

export type ScrapedCandidate = {
  id: string;
  restaurant_id: string;
  title: string;
  description?: string | null;
  deal_category?: string | null;
  discount_type?: 'percent' | 'fixed' | 'bogo' | null;
  discount_value?: number | null;
  is_recurring?: boolean | null;
  recurrence_days?: number[] | null;
  recurrence_start_time?: string | null;
  recurrence_end_time?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  source_url?: string | null;
  evidence_quote?: string | null;
  confidence?: number | null;
  status: string;
  last_seen_at?: string;
  restaurants?: { name: string } | null;
};

/**
 * Operator-facing review queue for the deal-scraping agent.
 * Reads pending `scraped_deal_candidates`; approving publishes a row into `deals`
 * with source='scraped'. Gated by `profiles.is_operator` (enforced by RLS too).
 */
export function useScrapedDealCandidates() {
  const { profile } = useAuthContext();
  const [candidates, setCandidates] = useState<ScrapedCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('scraped_deal_candidates')
      .select('*, restaurants:restaurant_id ( name )')
      .eq('status', 'pending')
      .order('confidence', { ascending: false, nullsFirst: false });
    if (!error) setCandidates((data as unknown as ScrapedCandidate[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  const reject = useCallback(
    async (id: string) => {
      setWorking(id);
      try {
        const { error } = await supabase
          .from('scraped_deal_candidates')
          .update({ status: 'rejected', reviewed_by: profile?.id, reviewed_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
        setCandidates((prev) => prev.filter((c) => c.id !== id));
      } finally {
        setWorking(null);
      }
    },
    [profile?.id],
  );

  const approve = useCallback(
    async (c: ScrapedCandidate) => {
      setWorking(c.id);
      try {
        const dealId = Crypto.randomUUID();
        const dealData: Record<string, unknown> = {
          id: dealId,
          restaurant_id: c.restaurant_id,
          title: c.title,
          description: c.description || undefined,
          tags: [],
          is_active: true,
          is_recurring: !!c.is_recurring,
          discount_type: c.discount_type || undefined,
          discount_value: c.discount_value ?? undefined,
          source: 'scraped',
          source_url: c.source_url || undefined,
          confidence: c.confidence ?? undefined,
          last_verified_at: new Date().toISOString(),
        };
        if (c.is_recurring) {
          dealData.recurrence_days = c.recurrence_days || [];
          dealData.recurrence_start_time = c.recurrence_start_time || undefined;
          dealData.recurrence_end_time = c.recurrence_end_time || undefined;
        } else {
          dealData.start_at = c.start_at || undefined;
          dealData.end_at = c.end_at || undefined;
        }

        const { error: insertErr } = await supabase.from('deals').insert([dealData]);
        // PGRST204 = "no rows returned" from an insert without a select; harmless.
        if (insertErr && insertErr.code !== 'PGRST204') throw insertErr;

        const { error: updateErr } = await supabase
          .from('scraped_deal_candidates')
          .update({
            status: 'published',
            published_deal_id: dealId,
            reviewed_by: profile?.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', c.id);
        if (updateErr) throw updateErr;

        setCandidates((prev) => prev.filter((x) => x.id !== c.id));
      } finally {
        setWorking(null);
      }
    },
    [profile?.id],
  );

  const updateCandidate = useCallback(
    async (id: string, fields: Partial<ScrapedCandidate>) => {
      setWorking(id);
      try {
        const { error } = await supabase
          .from('scraped_deal_candidates')
          .update(fields)
          .eq('id', id);
        if (error) throw error;
        setCandidates((prev) =>
          prev.map((c) => (c.id === id ? { ...c, ...fields } : c)),
        );
      } finally {
        setWorking(null);
      }
    },
    [],
  );

  return {
    candidates,
    loading,
    working,
    isOperator: !!profile?.is_operator,
    fetchCandidates,
    approve,
    reject,
    updateCandidate,
  };
}
