/**
 * @file analyze.service.ts
 * @description Analyze service
 * @author Mahros AL-Qabasy <mahros.dev>
 */

import type { Express, Request } from "express";

type ScoreType = "average" | "math" | "reading" | "writing";

type ApiSuccess<TData> = {
  success: true;
  message: string;
  data: TData;
  meta: null | { pagination?: unknown };
};

type ApiError = {
  success: false;
  message: string;
  data: null;
  meta: null;
  error: {
    code:
      | "NO_FILE"
      | "INVALID_FILE_TYPE"
      | "MISSING_COLUMNS"
      | "INVALID_DATA"
      | "INSUFFICIENT_GROUPS"
      | "ANALYSIS_FAILED";
    message: string;
  };
};

type GroupStats = {
  sampleSize: number;
  mean: number;
  standardDeviation: number;
  minimum: number;
  maximum: number;
};

type AnalysisResponse = ApiSuccess<{
  project: "Civara";
  dataset: {
    fileName: string;
    totalRows: number;
    validRows: number;
    removedRows: number;
    columns: string[];
    numericColumns: string[];
  };
  analysis: {
    scoreType: ScoreType;
    groupVariable: "gender";
    groups: Record<string, GroupStats>;
    comparison: {
      meanDifference: number;
      standardError: number;
      degreesOfFreedom: number;
      confidenceLevel: number;
      confidenceInterval: { lower: number; upper: number };
      tStatistic: number;
      pValue: number;
      isSignificant: boolean;
    };
    interpretation: string;
  };
  visualization: {
    boxplot: Record<
      string,
      {
        minimum: number;
        q1: number;
        median: number;
        q3: number;
        maximum: number;
        mean: number;
        outliers: number[];
      }
    >;
    histogram: {
      bins: string[];
      groups: Record<string, number[]>;
    };
    barChart: {
      meanScores: Array<{ group: string; value: number }>;
      standardDeviation: Array<{ group: string; value: number }>;
    };
    confidenceIntervalPlot: {
      estimate: number;
      lower: number;
      upper: number;
      nullValue: number;
      label: string;
    };
  };
}>;


export class AnalyzeService {

  async analyze(req: Request): Promise<{ status: number; body: AnalysisResponse | ApiError }> {
    try {
      const file = (req as Request & { file?: Express.Multer.File }).file;
      if (!file) {
        return {
          status: 400,
          body: this.error("NO_FILE", "No file was uploaded."),
        };
      }

      const originalName = (file.originalname || "").toLowerCase();
      if (!originalName.endsWith(".csv")) {
        return {
          status: 400,
          body: this.error("INVALID_FILE_TYPE", "The uploaded file is not a CSV file."),
        };
      }

      const csvText = file.buffer?.toString("utf8") ?? "";
      const rows = parseCsv(csvText);
      if (rows.length === 0) {
        return {
          status: 400,
          body: this.error("INVALID_DATA", "The dataset is empty."),
        };
      }

      const headerRow = rows[0];
      if (!headerRow) {
        return {
          status: 400,
          body: this.error("INVALID_DATA", "The dataset is empty."),
        };
      }
      const headers = headerRow.map((h) => normalizeHeader(h));
      const required = ["gender", "math score", "reading score", "writing score"];
      const missing = required.filter((r) => !headers.includes(r));
      if (missing.length > 0) {
        return {
          status: 400,
          body: this.error(
            "MISSING_COLUMNS",
            `The uploaded file is missing the required column: ${missing[0]}.`,
          ),
        };
      }

      const scoreType = normalizeScoreType(String(req.body?.scoreType ?? "average"));
      if (!scoreType) {
        return {
          status: 400,
          body: this.error("INVALID_DATA", "Invalid scoreType. Supported: average, math, reading, writing."),
        };
      }

      const idxGender = headers.indexOf("gender");
      const idxMath = headers.indexOf("math score");
      const idxReading = headers.indexOf("reading score");
      const idxWriting = headers.indexOf("writing score");

      const valuesByGroup: Record<string, number[]> = {};
      const totalRows = Math.max(0, rows.length - 1);
      let validRows = 0;

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        if (row.length === 1 && (row[0] ?? "").trim() === "") continue;

        const groupRaw = (row[idxGender] ?? "").trim();
        if (!groupRaw) continue;
        const groupKey = groupRaw.toLowerCase();

        const math = parseNumber(row[idxMath]);
        const reading = parseNumber(row[idxReading]);
        const writing = parseNumber(row[idxWriting]);
        if (math === null || reading === null || writing === null) {
          return {
            status: 400,
            body: this.error("INVALID_DATA", "The dataset contains invalid or non-numeric values."),
          };
        }

        const score = pickScore(scoreType, { math, reading, writing });
        if (!valuesByGroup[groupKey]) valuesByGroup[groupKey] = [];
        valuesByGroup[groupKey].push(score);
        validRows++;
      }

      const groupKeys = Object.keys(valuesByGroup).filter((k) => (valuesByGroup[k]?.length ?? 0) > 0);
      if (groupKeys.length < 2) {
        return {
          status: 400,
          body: this.error("INSUFFICIENT_GROUPS", "The dataset does not contain two valid groups."),
        };
      }

      const maleKey = groupKeys.includes("male") ? "male" : groupKeys[0]!;
      const femaleKey = groupKeys.includes("female")
        ? "female"
        : groupKeys.find((k) => k !== maleKey) ?? groupKeys[1]!;

      const maleValues = valuesByGroup[maleKey] ?? [];
      const femaleValues = valuesByGroup[femaleKey] ?? [];

      const maleStats = describe(maleValues);
      const femaleStats = describe(femaleValues);

      const comparison = welchTwoSample(maleStats, femaleStats, 0.95);

      const interpretation = buildInterpretation(comparison, maleKey, femaleKey);

      const maleBoxplot = computeBoxplot(maleValues, maleStats.mean);
      const femaleBoxplot = computeBoxplot(femaleValues, femaleStats.mean);

      const histogramBins = defaultHistogramBins();
      const maleHistogram = computeHistogramCounts(maleValues);
      const femaleHistogram = computeHistogramCounts(femaleValues);

      const body: AnalysisResponse = {
        success: true,
        message: "Request completed successfully",
        data: {
          project: "Civara",
          dataset: {
            fileName: file.originalname || "students.csv",
            totalRows,
            validRows,
            removedRows: Math.max(0, totalRows - validRows),
            columns: required,
            numericColumns: ["math score", "reading score", "writing score", "average score"],
          },
          analysis: {
            scoreType,
            groupVariable: "gender",
            groups: {
              [maleKey]: maleStats,
              [femaleKey]: femaleStats,
            },
            comparison,
            interpretation,
          },
          visualization: {
            boxplot: {
              [maleKey]: maleBoxplot,
              [femaleKey]: femaleBoxplot,
            },
            histogram: {
              bins: histogramBins,
              groups: {
                [maleKey]: maleHistogram,
                [femaleKey]: femaleHistogram,
              },
            },
            barChart: {
              meanScores: [
                { group: maleKey, value: maleStats.mean },
                { group: femaleKey, value: femaleStats.mean },
              ],
              standardDeviation: [
                { group: maleKey, value: maleStats.standardDeviation },
                { group: femaleKey, value: femaleStats.standardDeviation },
              ],
            },
            confidenceIntervalPlot: {
              estimate: comparison.meanDifference,
              lower: comparison.confidenceInterval.lower,
              upper: comparison.confidenceInterval.upper,
              nullValue: 0,
              label: `${capitalize(maleKey)} - ${capitalize(femaleKey)}`,
            },
          },
        },
        meta: null,
      };

      return { status: 200, body };
    } catch (e) {
      return {
        status: 500,
        body: this.error("ANALYSIS_FAILED", "The server failed to complete the analysis."),
      };
    }
  }

  private error(code: ApiError["error"]["code"], message: string): ApiError {
    return {
      success: false,
      message: code === "ANALYSIS_FAILED" ? "Analysis failed" : "Validation failed",
      data: null,
      meta: null,
      error: { code, message },
    };
  }
}

function normalizeHeader(value: string): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeScoreType(value: string): ScoreType | null {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "" || v === "average") return "average";
  if (v === "math" || v === "reading" || v === "writing") return v;
  return null;
}

function parseNumber(value: string | undefined): number | null {
  const v = String(value ?? "").trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickScore(
  scoreType: ScoreType,
  scores: { math: number; reading: number; writing: number },
): number {
  if (scoreType === "math") return scores.math;
  if (scoreType === "reading") return scores.reading;
  if (scoreType === "writing") return scores.writing;
  return (scores.math + scores.reading + scores.writing) / 3;
}

function describe(values: number[]): GroupStats {
  if (values.length === 0) {
    return { sampleSize: 0, mean: 0, standardDeviation: 0, minimum: 0, maximum: 0 };
  }
  let sum = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const x of values) {
    sum += x;
    if (x < min) min = x;
    if (x > max) max = x;
  }
  const n = values.length;
  const mean = sum / n;
  let ss = 0;
  for (const x of values) {
    const d = x - mean;
    ss += d * d;
  }
  const variance = n > 1 ? ss / (n - 1) : 0;
  const sd = Math.sqrt(variance);
  return {
    sampleSize: n,
    mean: round(mean),
    standardDeviation: round(sd),
    minimum: round(min),
    maximum: round(max),
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function welchTwoSample(m: GroupStats, f: GroupStats, confidenceLevel: number) {
  const n1 = m.sampleSize;
  const n2 = f.sampleSize;
  const s1 = m.standardDeviation;
  const s2 = f.standardDeviation;
  const meanDifference = m.mean - f.mean;
  const se = Math.sqrt((s1 * s1) / n1 + (s2 * s2) / n2);

  const v1 = (s1 * s1) / n1;
  const v2 = (s2 * s2) / n2;
  const dfNumerator = (v1 + v2) * (v1 + v2);
  const dfDenominator = (v1 * v1) / (n1 - 1) + (v2 * v2) / (n2 - 1);
  const df = dfDenominator === 0 ? 0 : dfNumerator / dfDenominator;

  const tStatistic = se === 0 ? 0 : meanDifference / se;
  const pValue = df > 0 ? twoTailedPValue(tStatistic, df) : 1;

  const alpha = 1 - confidenceLevel;
  const tCrit = df > 0 ? inverseTCdf(1 - alpha / 2, df) : 0;
  const lower = meanDifference - tCrit * se;
  const upper = meanDifference + tCrit * se;

  return {
    meanDifference: round(meanDifference),
    standardError: round(se),
    degreesOfFreedom: round(df),
    confidenceLevel: round(confidenceLevel),
    confidenceInterval: { lower: round(lower), upper: round(upper) },
    tStatistic: round(tStatistic),
    pValue: Math.round(pValue * 100000) / 100000,
    isSignificant: pValue < 0.05,
  };
}

function buildInterpretation(
  comparison: { confidenceInterval: { lower: number; upper: number }; isSignificant: boolean; confidenceLevel: number },
  groupA: string,
  groupB: string,
): string {
  const containsZero = comparison.confidenceInterval.lower <= 0 && comparison.confidenceInterval.upper >= 0;
  const pct = Math.round(comparison.confidenceLevel * 100);

  if (!containsZero && comparison.isSignificant) {
    return `The ${pct}% confidence interval does not contain zero. Therefore, there is a statistically significant difference between the mean scores of ${groupA} and ${groupB} students at the 5% significance level.`;
  }

  return `The ${pct}% confidence interval contains zero. Therefore, there is not enough evidence of a statistically significant difference between the mean scores of ${groupA} and ${groupB} students at the 5% significance level.`;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };

  const pushRow = () => {
    // Avoid pushing a trailing empty row caused by final newline
    if (row.length === 1 && row[0] === "" && rows.length === 0) return;
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = text[i + 1];
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      pushField();
      continue;
    }

    if (ch === "\n") {
      pushField();
      pushRow();
      continue;
    }

    if (ch === "\r") {
      // ignore, handled by \n
      continue;
    }

    field += ch;
  }

  pushField();
  if (row.length > 1 || (row[0] ?? "").trim() !== "") {
    pushRow();
  }

  // Trim trailing empty rows
  while (rows.length > 0) {
    const lastRow = rows[rows.length - 1];
    if (!lastRow) break;
    if (!lastRow.every((c) => c.trim() === "")) break;
    rows.pop();
  }

  return rows;
}

// ---- Student t distribution utilities (CDF + inverse CDF) ----

function twoTailedPValue(t: number, df: number): number {
  const cdf = tCdf(t, df);
  const p = 2 * Math.min(cdf, 1 - cdf);
  return Math.max(0, Math.min(1, p));
}

function tCdf(t: number, df: number): number {
  if (!Number.isFinite(t) || !Number.isFinite(df) || df <= 0) return 0.5;
  if (t === 0) return 0.5;

  const x = df / (df + t * t);
  const a = df / 2;
  const b = 0.5;

  const ib = regularizedIncompleteBeta(x, a, b);
  if (t > 0) return 1 - 0.5 * ib;
  return 0.5 * ib;
}

function inverseTCdf(p: number, df: number): number {
  // Binary search since we only need enough precision for reporting
  const target = Math.max(0, Math.min(1, p));
  if (target <= 0) return -Infinity;
  if (target >= 1) return Infinity;

  let lo = -100;
  let hi = 100;

  for (let i = 0; i < 120; i++) {
    const mid = (lo + hi) / 2;
    const c = tCdf(mid, df);
    if (c < target) lo = mid;
    else hi = mid;
  }

  return (lo + hi) / 2;
}

function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  // Use symmetry for better convergence
  const bt =
    Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x)) || 0;

  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betaContinuedFraction(x, a, b)) / a;
  }

  return 1 - (bt * betaContinuedFraction(1 - x, b, a)) / b;
}

function betaContinuedFraction(x: number, a: number, b: number): number {
  const maxIter = 200;
  const eps = 3e-7;
  const fpmin = 1e-30;

  let qab = a + b;
  let qap = a + 1;
  let qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < fpmin) d = fpmin;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= maxIter; m++) {
    const m2 = 2 * m;

    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < fpmin) d = fpmin;
    c = 1 + aa / c;
    if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    h *= d * c;

    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < fpmin) d = fpmin;
    c = 1 + aa / c;
    if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    const del = d * c;
    h *= del;

    if (Math.abs(del - 1) < eps) break;
  }

  return h;
}

function logGamma(z: number): number {
  // Lanczos approximation
  const p = [
    676.5203681218851,
    -1259.1392167224028,
    771.3234287776531,
    -176.6150291621406,
    12.507343278686905,
    -0.13857109526572012,
    9.984369578019572e-6,
    1.5056327351493116e-7,
  ];

  if (z < 0.5) {
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  }

  z -= 1;
  let x = 0.9999999999998099;
  for (let i = 0; i < p.length; i++) {
    const coeff = p[i];
    if (coeff === undefined) continue;
    x += coeff / (z + i + 1);
  }
  const t = z + p.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function computeBoxplot(values: number[], mean: number) {
  if (values.length === 0) {
    return {
      minimum: 0,
      q1: 0,
      median: 0,
      q3: 0,
      maximum: 0,
      mean: round(mean),
      outliers: [],
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const minimum = sorted[0] ?? 0;
  const maximum = sorted[sorted.length - 1] ?? 0;

  const q1 = quantile(sorted, 0.25);
  const median = quantile(sorted, 0.5);
  const q3 = quantile(sorted, 0.75);

  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;

  const outliersSet = new Set<number>();
  for (const x of sorted) {
    if (x < lowerFence || x > upperFence) outliersSet.add(round(x));
  }
  const outliers = Array.from(outliersSet).sort((a, b) => a - b);

  return {
    minimum: round(minimum),
    q1: round(q1),
    median: round(median),
    q3: round(q3),
    maximum: round(maximum),
    mean: round(mean),
    outliers,
  };
}

function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (p <= 0) return sorted[0] ?? 0;
  if (p >= 1) return sorted[sorted.length - 1] ?? 0;

  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const a = sorted[lo] ?? 0;
  const b = sorted[hi] ?? a;
  if (lo === hi) return a;
  return a + (b - a) * (idx - lo);
}

function defaultHistogramBins(): string[] {
  return [
    "0-10",
    "10-20",
    "20-30",
    "30-40",
    "40-50",
    "50-60",
    "60-70",
    "70-80",
    "80-90",
    "90-100",
  ];
}

function computeHistogramCounts(values: number[]): number[] {
  const counts = new Array<number>(10).fill(0);
  for (const raw of values) {
    const x = Number(raw);
    if (!Number.isFinite(x)) continue;
    if (x < 0) continue;
    const idx = x >= 100 ? 9 : Math.floor(x / 10);
    if (idx < 0 || idx > 9) continue;
    counts[idx] = (counts[idx] ?? 0) + 1;
  }
  return counts;
}

function capitalize(value: string): string {
  const v = String(value ?? "").trim();
  if (!v) return v;
  return v[0]!.toUpperCase() + v.slice(1);
}
