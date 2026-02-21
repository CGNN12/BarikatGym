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
  Crosshair,
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
const DISPLAY_HOURS = [6, 9, 12, 15, 18, 21, 24];

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

      // Group into 3-hour intervals for chart display
      const intervalCounts: Record<number, number> = {};
      const intervals = [6, 9, 12, 15, 18, 21, 0]; // 0 represents 24:00 (midnight)
      intervals.forEach((start) => {
        const end = start === 0 ? 6 : start + 3; // 0 = midnight bucket covers 0-5
        let total = 0;
        if (start === 0) {
          // 00:00 - 05:59
          for (let h = 0; h < 6; h++) total += hourCounts[h];
        } else {
          for (let h = start; h < Math.min(start + 3, 24); h++) total += hourCounts[h];
        }
        intervalCounts[start] = total;
      });

      const result: HourlyData[] = Object.entries(hourCounts).map(
        ([hour, count]) => ({
          hour: parseInt(hour),
          count: Math.round((count / dateRange) * 10) / 10,
        })
      );

      // Also store interval data for chart
      const intervalResult: HourlyData[] = Object.entries(intervalCounts).map(
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
      .filter((d) => d.hour >= 6 && d.hour <= 12)
      .reduce((sum, d) => sum + d.count, 0);
    const eveningActivity = activeHours
      .filter((d) => d.hour >= 17 && d.hour <= 22)
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

  const chartData = useMemo(() => {
    const labels = DISPLAY_HOURS.map((h) => {
      const displayH = h === 24 ? 0 : h;
      return displayH < 10 ? `0${displayH}:00` : `${displayH}:00`;
    });

    // Group hourly data into 3-hour intervals
    const values = DISPLAY_HOURS.map((h) => {
      if (h === 24) {
        // Midnight bucket: 0-5
        return hourlyData
          .filter((d) => d.hour >= 0 && d.hour < 6)
          .reduce((sum, d) => sum + d.count, 0);
      }
      // e.g. h=6 covers 6, 7, 8
      return hourlyData
        .filter((d) => d.hour >= h && d.hour < h + 3)
        .reduce((sum, d) => sum + d.count, 0);
    });

    return {
      labels,
      datasets: [
        {
          data: values.some((v) => v > 0) ? values : values.map(() => 0),
          strokeWidth: 2,
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
          <Crosshair size={14} color="#4B5320" />
          <Text style={s.titleText}>SAHA İSTİHBARATI</Text>
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
        <Text style={s.classifiedWatermark}>GİZLİ</Text>
      </View>

      {/* ═══ İÇERİK ═══ */}
      {!collapsed && (
        <>
          {/* YÜKLEME DURUMU */}
          {loading && (
            <View style={s.loadingWrap}>
              <ActivityIndicator size="small" color="#4B5320" />
              <Text style={s.loadingText}>İSTİHBARAT ALINIYOR...</Text>
            </View>
          )}

          {/* HATA DURUMU */}
          {!loading && error && (
            <View style={s.stateWrap}>
              <Radio size={24} color="#8B0000" />
              <Text style={s.errorText}>SİNYAL KESİLDİ</Text>
              <Text style={s.stateSubText}>
                İstihbarat verisi alınamadı
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
                <Text style={s.noSignalText}>SİNYAL YOK</Text>
              </View>
            </View>
          )}

          {/* GRAFİK + ANALİZ — Sadece veri varsa */}
          {!loading && !error && hasData && (
            <>
              {/* Grafik */}
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
                    labelColor: () => "#666",
                    propsForDots: {
                      r: "3",
                      strokeWidth: "1",
                      stroke: "#4B5320",
                      fill: "#6B7530",
                    },
                    propsForBackgroundLines: {
                      strokeDasharray: "4 4",
                      stroke: "rgba(255,255,255,0.05)",
                      strokeWidth: 1,
                    },
                    propsForLabels: {
                      fontSize: 9,
                      fontFamily: "monospace",
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

              {/* İstihbarat Analizi */}
              <View style={s.intelSection}>
                <View style={s.intelDivider}>
                  <View style={s.intelDividerLine} />
                  <Text style={s.intelDividerLabel}>SİNYAL ANALİZİ</Text>
                  <View style={s.intelDividerLine} />
                </View>

                {/* Zirve Saat */}
                <View style={s.intelRow}>
                  <View style={s.intelIconWrap}>
                    <Crosshair size={12} color="#B8860B" />
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

                {/* Dönem Yoğunlukları */}
                <View style={s.intensityRow}>
                  {[
                    { h: "06-08", label: "SABAH" },
                    { h: "09-11", label: "ÖĞLEN" },
                    { h: "12-14", label: "İKİNDİ" },
                    { h: "15-17", label: "ÖĞLEDEN S." },
                    { h: "18-20", label: "AKŞAM" },
                    { h: "21-23", label: "GECE" },
                  ].map((period) => {
                    const [startH, endH] = period.h.split("-").map(Number);
                    const total = hourlyData
                      .filter((d) => d.hour >= startH && d.hour <= endH)
                      .reduce((sum, d) => sum + d.count, 0);
                    const intensity = getIntensityLabel(total);

                    return (
                      <View key={period.h} style={s.intensityBlock}>
                        <Text style={s.intensityPeriod}>
                          {period.label}
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
  classifiedWatermark: {
    color: "rgba(75,83,32,0.15)",
    fontSize: 8,
    letterSpacing: 4,
    fontWeight: "900",
    textTransform: "uppercase",
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

  // İstihbarat Analizi
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
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  intensityBlock: {
    alignItems: "center",
    flex: 1,
  },
  intensityPeriod: {
    color: "#555",
    fontSize: 8,
    letterSpacing: 1,
    marginBottom: 4,
  },
  intensityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 3,
  },
  intensityLabel: {
    fontSize: 7,
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
