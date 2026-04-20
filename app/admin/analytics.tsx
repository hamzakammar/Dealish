import { supabase } from '@/app/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type AnalyticsData = {
  totalScans: number;
  dealStats: {
    deal_id: string;
    deal_title: string;
    scan_count: number;
    percentage: number;
  }[];
  chartData: number[];
  chartLabels: string[];
};

export default function Analytics() {
  const router = useRouter();
  const { restaurantId } = useLocalSearchParams<{ restaurantId: string }>();
  
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'1D' | '1W' | '1M' | '3M' | '6M'>('1W');
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalScans: 0,
    dealStats: [],
    chartData: [],
    chartLabels: [],
  });

  useEffect(() => {
    if (restaurantId) {
      fetchAnalytics();
    }
  }, [restaurantId, timeRange]);

  const fetchAnalytics = async () => {
    try {
      setIsLoading(true);

      const now = new Date();
      const startDate = new Date();
      switch (timeRange) {
        case '1D':
          startDate.setDate(now.getDate() - 1);
          break;
        case '1W':
          startDate.setDate(now.getDate() - 7);
          break;
        case '1M':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case '3M':
          startDate.setMonth(now.getMonth() - 3);
          break;
        case '6M':
          startDate.setMonth(now.getMonth() - 6);
          break;
      }

      const { data: deals, error: dealsError } = await supabase
        .from('deals')
        .select('id, title')
        .eq('restaurant_id', restaurantId);

      if (dealsError) throw dealsError;

      const dealIds = (deals || []).map(d => d.id);
      if (dealIds.length === 0) {
        setAnalytics({
          totalScans: 0,
          dealStats: [],
          chartData: [],
          chartLabels: [],
        });
        return;
      }

      const { data: scans, error: scansError } = await supabase
        .from('qr_code_scans')
        .select('id, scanned_at, deal_id')
        .in('deal_id', dealIds)
        .gte('scanned_at', startDate.toISOString())
        .order('scanned_at', { ascending: false });

      if (scansError) throw scansError;

      const dealMap: Record<string, string> = {};
      (deals || []).forEach((deal) => {
        dealMap[deal.id] = deal.title;
      });

      const dealScanMap: Record<string, { title: string; count: number }> = {};
      (scans || []).forEach((scan) => {
        const dealId = scan.deal_id;
        const dealTitle = dealMap[dealId] || 'Unknown Deal';
        if (dealId) {
          if (!dealScanMap[dealId]) {
            dealScanMap[dealId] = { title: dealTitle, count: 0 };
          }
          dealScanMap[dealId].count++;
        }
      });

      const totalScans = scans?.length || 0;
      const maxScans = Math.max(...Object.values(dealScanMap).map(d => d.count), 1);

      const dealStats = Object.entries(dealScanMap)
        .map(([deal_id, data]) => ({
          deal_id,
          deal_title: data.title,
          scan_count: data.count,
          percentage: Math.round((data.count / maxScans) * 100),
        }))
        .sort((a, b) => b.scan_count - a.scan_count);

      let chartData: number[] = [];
      let chartLabels: string[] = [];
      
      switch (timeRange) {
        case '1D': {
          chartData = new Array(24).fill(0);
          chartLabels = Array.from({ length: 24 }, (_, i) => {
            const hour = (now.getHours() - (23 - i) + 24) % 24;
            return `${hour}:00`;
          });
          (scans || []).forEach((scan) => {
            const scanDate = new Date(scan.scanned_at);
            const hoursAgo = Math.floor((now.getTime() - scanDate.getTime()) / (1000 * 60 * 60));
            if (hoursAgo >= 0 && hoursAgo < 24) {
              chartData[23 - hoursAgo]++;
            }
          });
          break;
        }
        case '1W': {
          chartData = new Array(7).fill(0);
          chartLabels = Array.from({ length: 7 }, (_, i) => {
            const date = new Date(now);
            date.setDate(date.getDate() - (6 - i));
            return date.toLocaleDateString('en-US', { weekday: 'short' });
          });
          (scans || []).forEach((scan) => {
            const scanDate = new Date(scan.scanned_at);
            const daysAgo = Math.floor((now.getTime() - scanDate.getTime()) / (1000 * 60 * 60 * 24));
            if (daysAgo >= 0 && daysAgo < 7) {
              chartData[6 - daysAgo]++;
            }
          });
          break;
        }
        case '1M': {
          chartData = new Array(30).fill(0);
          chartLabels = Array.from({ length: 30 }, (_, i) => {
            const date = new Date(now);
            date.setDate(date.getDate() - (29 - i));
            return `${date.getMonth() + 1}/${date.getDate()}`;
          });
          (scans || []).forEach((scan) => {
            const scanDate = new Date(scan.scanned_at);
            const daysAgo = Math.floor((now.getTime() - scanDate.getTime()) / (1000 * 60 * 60 * 24));
            if (daysAgo >= 0 && daysAgo < 30) {
              chartData[29 - daysAgo]++;
            }
          });
          break;
        }
        case '3M': {
          chartData = new Array(12).fill(0);
          chartLabels = Array.from({ length: 12 }, (_, i) => {
            const date = new Date(now);
            date.setDate(date.getDate() - (11 - i) * 7);
            return `W${i + 1}`;
          });
          (scans || []).forEach((scan) => {
            const scanDate = new Date(scan.scanned_at);
            const weeksAgo = Math.floor((now.getTime() - scanDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
            if (weeksAgo >= 0 && weeksAgo < 12) {
              chartData[11 - weeksAgo]++;
            }
          });
          break;
        }
        case '6M': {
          chartData = new Array(6).fill(0);
          chartLabels = Array.from({ length: 6 }, (_, i) => {
            const date = new Date(now);
            date.setMonth(date.getMonth() - (5 - i));
            return date.toLocaleDateString('en-US', { month: 'short' });
          });
          (scans || []).forEach((scan) => {
            const scanDate = new Date(scan.scanned_at);
            const monthsAgo = (now.getFullYear() - scanDate.getFullYear()) * 12 + (now.getMonth() - scanDate.getMonth());
            if (monthsAgo >= 0 && monthsAgo < 6) {
              chartData[5 - monthsAgo]++;
            }
          });
          break;
        }
      }

      setAnalytics({
        totalScans,
        dealStats,
        chartData,
        chartLabels,
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
      Alert.alert('Error', 'Failed to load analytics data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportReport = async () => {
    try {
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('name')
        .eq('id', restaurantId)
        .single();

      const restaurantName = restaurant?.name || 'Restaurant';
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `${restaurantName}_Analytics_${dateStr}.csv`;

      let csvContent = 'Performance Analytics Report\n';
      csvContent += `Restaurant: ${restaurantName}\n`;
      csvContent += `Generated: ${new Date().toLocaleString()}\n`;
      csvContent += `Time Range: ${timeRange}\n\n`;

      csvContent += 'Summary\n';
      csvContent += `Total Scans,${analytics.totalScans}\n\n`;

      csvContent += 'Customer Activity Over Time\n';
      csvContent += 'Time Period,Customers\n';
      analytics.chartLabels.forEach((label, index) => {
        csvContent += `${label},${analytics.chartData[index]}\n`;
      });
      csvContent += '\n';

      csvContent += 'Deal Performance\n';
      csvContent += 'Deal Title,Scans,Percentage\n';
      analytics.dealStats.forEach((stat) => {
        csvContent += `"${stat.deal_title}",${stat.scan_count},${stat.percentage}%\n`;
      });

      if (Platform.OS === 'web') {
        if (typeof document !== 'undefined') {
          const blob = new Blob([csvContent], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          Alert.alert('Success', 'Report downloaded successfully!');
        } else {
          Alert.alert('CSV Content', csvContent.substring(0, 500) + '...');
        }
      } else {
        const result = await Share.share({
          message: csvContent,
          title: filename,
        });

        if (result.action === Share.sharedAction) {
          Alert.alert('Success', 'Report shared successfully!');
        }
      }
    } catch (error) {
      console.error('Error exporting report:', error);
      Alert.alert('Error', 'Failed to export report. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FE902A" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => {
            try {
              router.back();
            } catch (error) {
              console.error('Navigation error:', error);
              router.replace('/admin');
            }
          }} 
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Analytics</Text>
          <Text style={styles.headerSubtitle}>{analytics.totalScans} total scans</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {analytics.totalScans === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="stats-chart-outline" size={48} color="#CBD5E1" />
            </View>
            <Text style={styles.emptyStateTitle}>No Data Yet</Text>
            <Text style={styles.emptyStateMessage}>
              Analytics will appear once customers start using your deals
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Customer Activity</Text>
              
              <View style={styles.chartCard}>
                <View style={styles.chart}>
                  {analytics.chartData.map((value, index) => {
                    const maxValue = Math.max(...analytics.chartData, 1);
                    const height = (value / maxValue) * 100;
                    return (
                      <View key={index} style={styles.barContainer}>
                        <View style={[styles.bar, { height: `${height}%` }]} />
                        <Text style={styles.barLabel} numberOfLines={1}>
                          {value > 0 ? value : ''}
                        </Text>
                        <Text style={styles.barDateLabel} numberOfLines={1}>
                          {analytics.chartLabels[index] || ''}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              <View style={styles.timeRangeContainer}>
                {(['1D', '1W', '1M', '3M', '6M'] as const).map((range) => (
                  <TouchableOpacity
                    key={range}
                    style={[
                      styles.timeRangeButton,
                      timeRange === range && styles.timeRangeButtonActive
                    ]}
                    onPress={() => setTimeRange(range)}
                  >
                    <Text style={[
                      styles.timeRangeButtonText,
                      timeRange === range && styles.timeRangeButtonTextActive
                    ]}>
                      {range}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {analytics.dealStats.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Deal Performance</Text>
                {analytics.dealStats.map((stat) => (
                  <View key={stat.deal_id} style={styles.dealPerformanceCard}>
                    <View style={styles.dealPerformanceHeader}>
                      <Text style={styles.dealPerformanceTitle}>{stat.deal_title}</Text>
                      <View style={styles.percentageBadge}>
                        <Text style={styles.dealPerformancePercentage}>{stat.percentage}%</Text>
                      </View>
                    </View>
                    <View style={styles.progressBarContainer}>
                      <View style={[styles.progressBar, { width: `${stat.percentage}%` }]} />
                    </View>
                    <Text style={styles.dealPerformanceSubtitle}>
                      {stat.scan_count} scan{stat.scan_count !== 1 ? 's' : ''}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.exportSection}>
              <TouchableOpacity style={styles.exportButton} onPress={handleExportReport}>
                <Ionicons name="download-outline" size={20} color="#FFFFFF" />
                <Text style={styles.exportButtonText}>Export Report</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 16,
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 160,
    marginBottom: 8,
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginHorizontal: 2,
  },
  bar: {
    width: '85%',
    backgroundColor: '#FE902A',
    borderRadius: 6,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 6,
    fontWeight: '600',
  },
  barDateLabel: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 4,
  },
  timeRangeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  timeRangeButtonActive: {
    backgroundColor: '#FE902A',
  },
  timeRangeButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },
  timeRangeButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  dealPerformanceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  dealPerformanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dealPerformanceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
  },
  percentageBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#FEF3E2',
  },
  dealPerformancePercentage: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FE902A',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FE902A',
    borderRadius: 4,
  },
  dealPerformanceSubtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 8,
  },
  emptyStateMessage: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  exportSection: {
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 40,
  },
  exportButton: {
    backgroundColor: '#FE902A',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
