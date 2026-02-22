import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Radio,
  Eye,
} from "lucide-react-native";
import { supabase } from "@/lib/supabase";

// ═══════════ TİPLER ═══════════

interface HourlyData {
  hour: number;
  count: number;
}

type DateRange = 7 | 30;

// ═══════════ SABİTLER ═══════════

const SCREEN_WIDTH = Dimensions.get("window").width;
const CHART_WIDTH = SCREEN_WIDTH - 48;

// Chart X-axis: 3-hour intervals from 06:00 to 00:00
const CHART_HOURS = [6, 9, 12, 15, 18, 21, 0];
const CHART_LABELS = ["06:00", "09:00", "12:00", "15:00", "18:00", "21:00", "00:00"];

// 3 main time periods for intensity analysis
const TIME_PERIODS = [
  { key: "sabah", label: "Sabah", startHour: 6, endHour: 11 },
  { key: "oglen", label: "Öğlen", startHour: 12, endHour: 17 },
  { key: "aksam", label: "Akşam", startHour: 18, endHour: 23 },
];

// ═══════════ BİLEŞEN ═══════════

export default function ActivityChart() {
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>(7);
  const [collapsed, setCollapsed] = useState(false);

  // ─── Veri Çekme ───
  const fetchActivityData = useCallback(async () => {
    setLoading(true);
    setError(false);

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - dateRange);

      const { data, error: fetchError } = await supabase
        .from("gym_logs")
        .select("entry_time")
        .gte("entry_time", startDate.toISOString())
        .order("entry_time", { ascending: true });

      if (fetchError) throw fetchError;

      if (!data || data.length === 0) {
        setHourlyData([]);
        setLoading(false);
        return;
      }

      const hourCounts: Record<number, number> = {};
      for (let h = 0; h < 24; h++) hourCounts[h] = 0;

      data.forEach((log) => {
        const hour = new Date(log.entry_time).getHours();
        hourCounts[hour]++;
      });

      const result: HourlyData[] = Object.entries(hourCounts).map(
        ([hour, count]) => ({
          hour: parseInt(hour),
          count: Math.round((count / dateRange) * 10) / 10,
        })
      );

      setHourlyData(result);
    } catch {
      setError(true);
      setHourlyData([]);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchActivityData();
  }, [fetchActivityData]);

  // ─── Hesaplanmış Değerler ───
  const analysis = useMemo(() => {
    if (hourlyData.length === 0)
      return {
        peakHour: 0,
        peakCount: 0,
        trend: "stable" as const,
        totalActivity: 0,
      };

    const activeHours = hourlyData.filter((d) => d.hour >= 6);
    let peakHour = 0;
    let peakCount = 0;
    let totalActivity = 0;

    activeHours.forEach((d) => {
      totalActivity += d.count;
      if (d.count > peakCount) {
        peakCount = d.count;
        peakHour = d.hour;
      }
    });

    const morningActivity = activeHours
      .filter((d) => d.hour >= 6 && d.hour <= 11)
      .reduce((sum, d) => sum + d.count, 0);
    const eveningActivity = activeHours
      .filter((d) => d.hour >= 18 && d.hour <= 23)
      .reduce((sum, d) => sum + d.count, 0);

    const trend =
      eveningActivity > morningActivity * 1.2
        ? ("increasing" as const)
        : morningActivity > eveningActivity * 1.2
        ? ("decreasing" as const)
        : ("stable" as const);

    return { peakHour, peakCount, trend, totalActivity };
  }, [hourlyData]);

  const hasData = analysis.totalActivity > 0;

  // ─── Chart data: 3-hour intervals on X-axis ───
  const chartData = useMemo(() => {
    // Aggregate hourly data into 3-hour buckets for the chart
    const bucketValues = CHART_HOURS.map((bucketStart) => {
      // Each bucket covers 3 hours: bucketStart to bucketStart+2
      let sum = 0;
      for (let offset = 0; offset < 3; offset++) {
        const h = (bucketStart + offset) % 24;
        const entry = hourlyData.find((d) => d.hour === h);
        if (entry) sum += entry.count;
      }
      return sum;
    });

    return {
      labels: CHART_LABELS,
      datasets: [
        {
          data: bucketValues.some((v) => v > 0) ? bucketValues : bucketValues.map(() => 0),
          strokeWidth: 3,
        },
      ],
    };
  }, [hourlyData]);

  const getIntensityLabel = (
    count: number
  ): { text: string; color: string } => {
    if (count === 0) return { text: "İNAKTİF", color: "#444" };
    const max = analysis.peakCount || 1;
    const ratio = count / max;
    if (ratio >= 0.75) return { text: "YÜKSEK", color: "#8B0000" };
    if (ratio >= 0.4) return { text: "ORTA", color: "#B8860B" };
    return { text: "DÜŞÜK", color: "#4B5320" };
  };

  // ═══════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════

  return (
    <View style={s.card}>
      {/* HUD Köşe Braketleri */}
      <View style={s.hudBracketTL} />
      <View style={s.hudBracketTR} />
      <View style={s.hudBracketBL} />
      <View style={s.hudBracketBR} />

      {/* ═══ BAŞLIK — Her zaman görünür ═══ */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setCollapsed((c) => !c)}
        style={s.titleRow}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <BarChart3 size={14} color="#4B5320" />
          <Text style={s.titleText}>YOĞUNLUK ANALİZİ</Text>
        </View>
        <Text style={s.collapseHint}>{collapsed ? "▼" : "▲"}</Text>
      </TouchableOpacity>

      {/* ═══ TARİH SEÇİCİ — Her zaman görünür ═══ */}
      <View style={s.rangeRow}>
        <TouchableOpacity
          onPress={() => setDateRange(7)}
          style={[s.rangeBtn, dateRange === 7 && s.rangeBtnActive]}
        >
          <Text
            style={[s.rangeBtnText, dateRange === 7 && s.rangeBtnTextActive]}
          >
            SON 7 GÜN
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setDateRange(30)}
          style={[s.rangeBtn, dateRange === 30 && s.rangeBtnActive]}
        >
          <Text
            style={[
              s.rangeBtnText,
              dateRange === 30 && s.rangeBtnTextActive,
            ]}
          >
            SON 30 GÜN
          </Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
      </View>

      {/* ═══ İÇERİK ═══ */}
      {!collapsed && (
        <>
          {/* YÜKLEME DURUMU */}
          {loading && (
            <View style={s.loadingWrap}>
              <ActivityIndicator size="small" color="#4B5320" />
              <Text style={s.loadingText}>VERİ YÜKLENİYOR...</Text>
            </View>
          )}

          {/* HATA DURUMU */}
          {!loading && error && (
            <View style={s.stateWrap}>
              <Radio size={24} color="#8B0000" />
              <Text style={s.errorText}>BAĞLANTI HATASI</Text>
              <Text style={s.stateSubText}>
                Yoğunluk verisi alınamadı
              </Text>
              <TouchableOpacity
                onPress={fetchActivityData}
                style={s.retryButton}
              >
                <Text style={s.retryText}>TEKRAR DENE</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* VERİ YOK DURUMU */}
          {!loading && !error && !hasData && (
            <View style={s.stateWrap}>
              <Eye size={28} color="#444" />
              <Text style={s.noDataText}>VERİ BULUNAMADI</Text>
              <Text style={s.stateSubText}>
                Son {dateRange} günde aktivite kaydı tespit edilemedi
              </Text>
              <View style={s.noSignalBar}>
                <View style={s.noSignalDot} />
                <Text style={s.noSignalText}>KAYIT YOK</Text>
              </View>
            </View>
          )}

          {/* GRAFİK + ANALİZ — Sadece veri varsa */}
          {!loading && !error && hasData && (
            <>
              {/* Grafik — saat etiketleri X ekseninde */}
              <View style={s.chartContainer}>
                <View style={s.scanlineOverlay} pointerEvents="none">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <View
                      key={i}
                      style={[s.scanline, { top: i * 16 }]}
                    />
                  ))}
                </View>

                <LineChart
                  data={chartData}
                  width={CHART_WIDTH}
                  height={200}
                  withInnerLines={true}
                  withOuterLines={false}
                  withVerticalLabels={true}
                  withHorizontalLabels={true}
                  withDots={true}
                  withShadow={false}
                  fromZero={true}
                  segments={4}
                  yAxisSuffix=""
                  yAxisInterval={1}
                  chartConfig={{
                    backgroundColor: "transparent",
                    backgroundGradientFrom: "#1A1A1A",
                    backgroundGradientTo: "#1A1A1A",
                    decimalPlaces: 0,
                    color: (opacity = 1) =>
                      `rgba(75, 83, 32, ${opacity})`,
                    labelColor: () => "#888",
                    propsForDots: {
                      r: "4",
                      strokeWidth: "2",
                      stroke: "#4B5320",
                      fill: "#6B7530",
                    },
                    propsForBackgroundLines: {
                      strokeDasharray: "4 4",
                      stroke: "rgba(255,255,255,0.05)",
                      strokeWidth: 1,
                    },
                    propsForLabels: {
                      fontSize: 10,
                      fontWeight: "600",
                    },
                    fillShadowGradientFrom: "#4B5320",
                    fillShadowGradientTo: "transparent",
                    fillShadowGradientFromOpacity: 0.3,
                    fillShadowGradientToOpacity: 0,
                    useShadowColorFromDataset: false,
                  }}
                  bezier
                  style={s.chart}
                />
              </View>

              {/* Yoğunluk Analizi — Sabah / Öğlen / Akşam */}
              <View style={s.intelSection}>
                <View style={s.intelDivider}>
                  <View style={s.intelDividerLine} />
                  <Text style={s.intelDividerLabel}>DÖNEM ANALİZİ</Text>
                  <View style={s.intelDividerLine} />
                </View>

                {/* Zirve Saat */}
                <View style={s.intelRow}>
                  <View style={s.intelIconWrap}>
                    <BarChart3 size={12} color="#B8860B" />
                  </View>
                  <View>
                    <Text style={s.intelTitle}>ZİRVE YOĞUNLUK</Text>
                    <Text style={s.intelValue}>
                      {analysis.peakHour.toString().padStart(2, "0")}:00
                      <Text style={s.intelDetail}>
                        {" "}— Ort. {analysis.peakCount.toFixed(1)} giriş/gün
                      </Text>
                    </Text>
                  </View>
                </View>

                {/* Eğilim */}
                <View style={s.intelRow}>
                  <View style={s.intelIconWrap}>
                    {analysis.trend === "increasing" ? (
                      <TrendingUp size={12} color="#4B5320" />
                    ) : analysis.trend === "decreasing" ? (
                      <TrendingDown size={12} color="#8B0000" />
                    ) : (
                      <Radio size={12} color="#666" />
                    )}
                  </View>
                  <View>
                    <Text style={s.intelTitle}>EĞİLİM</Text>
                    <Text
                      style={[
                        s.intelValue,
                        {
                          color:
                            analysis.trend === "increasing"
                              ? "#4B5320"
                              : analysis.trend === "decreasing"
                              ? "#8B0000"
                              : "#666",
                        },
                      ]}
                    >
                      {analysis.trend === "increasing"
                        ? "↑ AKŞAM YOĞUNLUĞU ARTIYOR"
                        : analysis.trend === "decreasing"
                        ? "↓ SABAH YOĞUNLUĞU AZALIYOR"
                        : "— STABİL AKTİVİTE"}
                    </Text>
                  </View>
                </View>

                {/* Dönem Yoğunlukları — Sabah / Öğlen / Akşam */}
                <View style={s.intensityRow}>
                  {TIME_PERIODS.map((period) => {
                    const total = hourlyData
                      .filter(
                        (d) =>
                          d.hour >= period.startHour &&
                          d.hour <= period.endHour
                      )
                      .reduce((sum, d) => sum + d.count, 0);
                    const intensity = getIntensityLabel(total);

                    return (
                      <View key={period.key} style={s.intensityBlock}>
                        <Text style={s.intensityPeriod}>
                          {period.label.toUpperCase()}
                        </Text>
                        <View
                          style={[
                            s.intensityDot,
                            { backgroundColor: intensity.color },
                          ]}
                        />
                        <Text
                          style={[
                            s.intensityLabel,
                            { color: intensity.color },
                          ]}
                        >
                          {intensity.text}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {/* Tahmin */}
                <View style={s.predictionBox}>
                  <Text style={s.predictionText}>
                    ⟐ TAHMİN: En yoğun saat{" "}
                    <Text style={{ color: "#B8860B", fontWeight: "700" }}>
                      {analysis.peakHour.toString().padStart(2, "0")}:00
                    </Text>
                    {" "}civarında beklenmektedir.
                  </Text>
                </View>
              </View>
            </>
          )}
        </>
      )}
    </View>
  );
}

// ═══════════ STİLLER ═══════════

const s = StyleSheet.create({
  card: {
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "rgba(75,83,32,0.3)",
    borderRadius: 3,
    padding: 16,
    overflow: "hidden",
  },

  // HUD Braketleri
  hudBracketTL: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 16,
    height: 16,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: "rgba(75,83,32,0.5)",
  },
  hudBracketTR: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 16,
    height: 16,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: "rgba(75,83,32,0.5)",
  },
  hudBracketBL: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: 16,
    height: 16,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderColor: "rgba(75,83,32,0.5)",
  },
  hudBracketBR: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: "rgba(75,83,32,0.5)",
  },

  // Başlık
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  titleText: {
    color: "#4B5320",
    fontSize: 11,
    letterSpacing: 4,
    fontWeight: "800",
    marginLeft: 8,
    textTransform: "uppercase",
  },
  collapseHint: {
    color: "#555",
    fontSize: 10,
  },

  // Tarih Seçici
  rangeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  rangeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 2,
    marginRight: 8,
  },
  rangeBtnActive: {
    borderColor: "#4B5320",
    backgroundColor: "rgba(75,83,32,0.15)",
  },
  rangeBtnText: {
    color: "#555",
    fontSize: 9,
    letterSpacing: 2,
    fontWeight: "600",
  },
  rangeBtnTextActive: {
    color: "#4B5320",
  },

  // Grafik
  chartContainer: {
    marginHorizontal: -8,
    borderRadius: 2,
    overflow: "hidden",
  },
  scanlineOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  scanline: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(75,83,32,0.04)",
  },
  chart: {
    borderRadius: 2,
  },

  // Yoğunluk Analizi
  intelSection: {
    marginTop: 12,
  },
  intelDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  intelDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(75,83,32,0.2)",
  },
  intelDividerLabel: {
    color: "#555",
    fontSize: 8,
    letterSpacing: 3,
    marginHorizontal: 10,
  },

  intelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  intelIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(75,83,32,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  intelTitle: {
    color: "#666",
    fontSize: 8,
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 1,
  },
  intelValue: {
    color: "#E0E0E0",
    fontSize: 12,
    fontWeight: "600",
  },
  intelDetail: {
    color: "#666",
    fontSize: 10,
    fontWeight: "400",
  },

  // Yoğunluk
  intensityRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  intensityBlock: {
    alignItems: "center",
    flex: 1,
  },
  intensityPeriod: {
    color: "#888",
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "600",
    marginBottom: 6,
  },
  intensityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 4,
  },
  intensityLabel: {
    fontSize: 8,
    letterSpacing: 1,
    fontWeight: "700",
  },

  // Tahmin
  predictionBox: {
    backgroundColor: "rgba(184,134,11,0.08)",
    borderWidth: 1,
    borderColor: "rgba(184,134,11,0.2)",
    borderRadius: 2,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  predictionText: {
    color: "#888",
    fontSize: 10,
    textAlign: "center",
    lineHeight: 16,
  },

  // Ortak Durumlar
  loadingWrap: {
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    color: "#4B5320",
    fontSize: 10,
    letterSpacing: 3,
    marginTop: 12,
  },
  stateWrap: {
    alignItems: "center",
    paddingVertical: 32,
  },
  errorText: {
    color: "#8B0000",
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: "700",
    marginTop: 12,
  },
  stateSubText: {
    color: "#555",
    fontSize: 10,
    marginTop: 4,
  },
  retryButton: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#8B0000",
    borderRadius: 2,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  retryText: {
    color: "#8B0000",
    fontSize: 9,
    letterSpacing: 2,
    fontWeight: "700",
  },
  noDataText: {
    color: "#555",
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: "700",
    marginTop: 12,
  },
  noSignalBar: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    backgroundColor: "rgba(68,68,68,0.15)",
    borderWidth: 1,
    borderColor: "rgba(68,68,68,0.3)",
    borderRadius: 2,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  noSignalDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#555",
    marginRight: 8,
  },
  noSignalText: {
    color: "#555",
    fontSize: 8,
    letterSpacing: 3,
    fontWeight: "700",
  },
});
