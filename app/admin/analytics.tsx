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
      // Calculate date range based on timeRange
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

      // First get all deals for this restaurant
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

      // Fetch QR code scans for these deals
      const { data: scans, error: scansError } = await supabase
        .from('qr_code_scans')
        .select('id, scanned_at, deal_id')
        .in('deal_id', dealIds)
        .gte('scanned_at', startDate.toISOString())
        .order('scanned_at', { ascending: false });

      if (scansError) throw scansError;

      // Create a map of deal IDs to titles
      const dealMap: Record<string, string> = {};
      (deals || []).forEach((deal: any) => {
        dealMap[deal.id] = deal.title;
      });

      // Count scans per deal
      const dealScanMap: Record<string, { title: string; count: number }> = {};
      (scans || []).forEach((scan: any) => {
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

      // Generate chart data based on time range (customers over time)
      let chartData: number[] = [];
      let chartLabels: string[] = [];
      
      switch (timeRange) {
        case '1D': {
          // Hourly data for last 24 hours
          chartData = new Array(24).fill(0);
          chartLabels = Array.from({ length: 24 }, (_, i) => {
            const hour = (now.getHours() - (23 - i) + 24) % 24;
            return `${hour}:00`;
          });
          (scans || []).forEach((scan: any) => {
            const scanDate = new Date(scan.scanned_at);
            const hoursAgo = Math.floor((now.getTime() - scanDate.getTime()) / (1000 * 60 * 60));
            if (hoursAgo >= 0 && hoursAgo < 24) {
              chartData[23 - hoursAgo]++;
            }
          });
          break;
        }
        case '1W': {
          // Daily data for last 7 days
          chartData = new Array(7).fill(0);
          chartLabels = Array.from({ length: 7 }, (_, i) => {
            const date = new Date(now);
            date.setDate(date.getDate() - (6 - i));
            return date.toLocaleDateString('en-US', { weekday: 'short' });
          });
          (scans || []).forEach((scan: any) => {
            const scanDate = new Date(scan.scanned_at);
            const daysAgo = Math.floor((now.getTime() - scanDate.getTime()) / (1000 * 60 * 60 * 24));
            if (daysAgo >= 0 && daysAgo < 7) {
              chartData[6 - daysAgo]++;
            }
          });
          break;
        }
        case '1M': {
          // Daily data for last 30 days
          chartData = new Array(30).fill(0);
          chartLabels = Array.from({ length: 30 }, (_, i) => {
            const date = new Date(now);
            date.setDate(date.getDate() - (29 - i));
            return `${date.getMonth() + 1}/${date.getDate()}`;
          });
          (scans || []).forEach((scan: any) => {
            const scanDate = new Date(scan.scanned_at);
            const daysAgo = Math.floor((now.getTime() - scanDate.getTime()) / (1000 * 60 * 60 * 24));
            if (daysAgo >= 0 && daysAgo < 30) {
              chartData[29 - daysAgo]++;
            }
          });
          break;
        }
        case '3M': {
          // Weekly data for last 12 weeks
          chartData = new Array(12).fill(0);
          chartLabels = Array.from({ length: 12 }, (_, i) => {
            const date = new Date(now);
            date.setDate(date.getDate() - (11 - i) * 7);
            return `W${i + 1}`;
          });
          (scans || []).forEach((scan: any) => {
            const scanDate = new Date(scan.scanned_at);
            const weeksAgo = Math.floor((now.getTime() - scanDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
            if (weeksAgo >= 0 && weeksAgo < 12) {
              chartData[11 - weeksAgo]++;
            }
          });
          break;
        }
        case '6M': {
          // Monthly data for last 6 months
          chartData = new Array(6).fill(0);
          chartLabels = Array.from({ length: 6 }, (_, i) => {
            const date = new Date(now);
            date.setMonth(date.getMonth() - (5 - i));
            return date.toLocaleDateString('en-US', { month: 'short' });
          });
          (scans || []).forEach((scan: any) => {
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
      // Get restaurant name for filename
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('name')
        .eq('id', restaurantId)
        .single();

      const restaurantName = restaurant?.name || 'Restaurant';
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `${restaurantName}_Analytics_${dateStr}.csv`;

      // Build CSV content
      let csvContent = 'Performance Analytics Report\n';
      csvContent += `Restaurant: ${restaurantName}\n`;
      csvContent += `Generated: ${new Date().toLocaleString()}\n`;
      csvContent += `Time Range: ${timeRange}\n\n`;

      // Summary section
      csvContent += 'Summary\n';
      csvContent += `Total Scans,${analytics.totalScans}\n\n`;

      // Chart data section
      csvContent += 'Customer Activity Over Time\n';
      csvContent += 'Time Period,Customers\n';
      analytics.chartLabels.forEach((label, index) => {
        csvContent += `${label},${analytics.chartData[index]}\n`;
      });
      csvContent += '\n';

      // Deal performance section
      csvContent += 'Deal Performance\n';
      csvContent += 'Deal Title,Scans,Percentage\n';
      analytics.dealStats.forEach((stat) => {
        csvContent += `"${stat.deal_title}",${stat.scan_count},${stat.percentage}%\n`;
      });

      // Share the CSV
      if (Platform.OS === 'web') {
        // For web, create a download link
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
          // Fallback: copy to clipboard or show content
          Alert.alert('CSV Content', csvContent.substring(0, 500) + '...');
        }
      } else {
        // For mobile, use Share API
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
      {/* Header */}
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
          <Ionicons name="arrow-back" size={24} color="#FE902A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Performance Analytics</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content}>
        {/* Customers Graph Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customers</Text>
          
          {/* Bar Chart */}
          <View style={styles.chartContainer}>
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

          {/* Time Range Buttons */}
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

        {/* Deal Performance Section */}
        {analytics.dealStats.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Customers</Text>
            {analytics.dealStats.map((stat) => (
              <View key={stat.deal_id} style={styles.dealPerformanceCard}>
                <View style={styles.dealPerformanceHeader}>
                  <Text style={styles.dealPerformanceTitle}>{stat.deal_title}</Text>
                  <Text style={styles.dealPerformancePercentage}>{stat.percentage}%</Text>
                </View>
                <View style={styles.progressBarContainer}>
                  <View style={[styles.progressBar, { width: `${stat.percentage}%` }]} />
                </View>
                <Text style={styles.dealPerformanceSubtitle}>
                  {stat.scan_count} scans
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Empty State */}
        {analytics.totalScans === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="stats-chart-outline" size={64} color="#C7C7CC" />
            <Text style={styles.emptyStateTitle}>No Data Yet</Text>
            <Text style={styles.emptyStateMessage}>
              Analytics will appear once customers start using your deals
            </Text>
          </View>
        )}

        {/* Export Report Button */}
        <View style={styles.exportSection}>
          <TouchableOpacity style={styles.exportButton} onPress={handleExportReport}>
            <Text style={styles.exportButtonText}>Export Report</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  chartContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 150,
    marginBottom: 8,
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginHorizontal: 4,
  },
  bar: {
    width: '80%',
    backgroundColor: '#FE902A',
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 10,
    color: '#8E8E93',
    marginTop: 4,
    fontWeight: '600',
  },
  barDateLabel: {
    fontSize: 8,
    color: '#8E8E93',
    marginTop: 2,
  },
  timeRangeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
  },
  timeRangeButtonActive: {
    backgroundColor: '#FE902A',
  },
  timeRangeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
  },
  timeRangeButtonTextActive: {
    color: '#FFFFFF',
  },
  dealPerformanceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  dealPerformanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dealPerformanceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
  },
  dealPerformancePercentage: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FE902A',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#F2F2F7',
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
    fontSize: 14,
    color: '#8E8E93',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
  },
  emptyStateMessage: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  exportSection: {
    paddingHorizontal: 20,
    marginTop: 8,
  },
  exportButton: {
    backgroundColor: '#FE902A',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
