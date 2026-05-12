# Civara API — `POST /analyze`

This document describes the `POST /analyze` endpoint in a frontend-friendly format (request, response envelope, and full response shape).

Base URL (prod): `https://civara.mahros.dev/api/v1`  
Base URL (local): `http://localhost:3030/api/v1`

---

## Request

### URL

`POST /analyze`

### Content-Type

`multipart/form-data`

### Form fields

| Field | Type | Required | Notes |
|---|---|---:|---|
| `file` | File | Yes | CSV file |
| `scoreType` | string | No | Defaults to `average` |

`scoreType` allowed values:
- `average`
- `math`
- `reading`
- `writing`

### Required CSV columns

The uploaded CSV must include these columns (case-insensitive match after trimming):
- `gender`
- `math score`
- `reading score`
- `writing score`

---

## Standard Response Envelope

All responses follow the same envelope:

### Success envelope

```json
{
  "success": true,
  "message": "Request completed successfully",
  "data": {},
  "meta": null
}
```

### Error envelope

```json
{
  "success": false,
  "message": "Validation failed",
  "data": null,
  "meta": null,
  "error": {
    "code": "INVALID_DATA",
    "message": "The dataset contains invalid or non-numeric values."
  }
}
```

---

## Success Response (`200 OK`)

### Response body (example)

```json
{
  "success": true,
  "message": "Request completed successfully",
  "data": {
    "project": "Civara",
    "dataset": {
      "fileName": "students.csv",
      "totalRows": 1000,
      "validRows": 1000,
      "removedRows": 0,
      "columns": ["gender", "math score", "reading score", "writing score"],
      "numericColumns": ["math score", "reading score", "writing score", "average score"]
    },
    "analysis": {
      "scoreType": "average",
      "groupVariable": "gender",
      "groups": {
        "male": {
          "sampleSize": 482,
          "mean": 65.84,
          "standardDeviation": 14.1,
          "minimum": 9,
          "maximum": 100
        },
        "female": {
          "sampleSize": 518,
          "mean": 69.57,
          "standardDeviation": 14.54,
          "minimum": 23,
          "maximum": 100
        }
      },
      "comparison": {
        "meanDifference": -3.73,
        "standardError": 0.91,
        "degreesOfFreedom": 996.12,
        "confidenceLevel": 0.95,
        "confidenceInterval": { "lower": -5.52, "upper": -1.94 },
        "tStatistic": -4.09,
        "pValue": 0.00005,
        "isSignificant": true
      },
      "interpretation": "The 95% confidence interval does not contain zero. Therefore, there is a statistically significant difference between the mean scores of male and female students at the 5% significance level."
    },
    "visualization": {
      "boxplot": {
        "male": {
          "minimum": 23,
          "q1": 56.33,
          "median": 66.67,
          "q3": 76.33,
          "maximum": 100,
          "mean": 65.84,
          "outliers": [23, 25, 28]
        },
        "female": {
          "minimum": 9,
          "q1": 60,
          "median": 70,
          "q3": 80.33,
          "maximum": 100,
          "mean": 69.57,
          "outliers": [9, 17, 22]
        }
      },
      "histogram": {
        "bins": ["0-10", "10-20", "20-30", "30-40", "40-50", "50-60", "60-70", "70-80", "80-90", "90-100"],
        "groups": {
          "male": [0, 0, 5, 12, 34, 92, 128, 111, 73, 27],
          "female": [1, 2, 6, 10, 28, 81, 124, 142, 91, 33]
        }
      },
      "barChart": {
        "meanScores": [
          { "group": "male", "value": 65.84 },
          { "group": "female", "value": 69.57 }
        ],
        "standardDeviation": [
          { "group": "male", "value": 14.1 },
          { "group": "female", "value": 14.54 }
        ]
      },
      "confidenceIntervalPlot": {
        "estimate": -3.73,
        "lower": -5.52,
        "upper": -1.94,
        "nullValue": 0,
        "label": "Male - Female"
      }
    }
  },
  "meta": null
}
```

---

## Error Responses

All error responses use the error envelope with one of these `error.code` values:
- `NO_FILE` (HTTP 400)
- `INVALID_FILE_TYPE` (HTTP 400)
- `MISSING_COLUMNS` (HTTP 400)
- `INVALID_DATA` (HTTP 400)
- `INSUFFICIENT_GROUPS` (HTTP 400)
- `ANALYSIS_FAILED` (HTTP 500)

---

## TypeScript types (frontend-ready)

```ts
export type ScoreType = "average" | "math" | "reading" | "writing";

export type ApiSuccess<TData> = {
  success: true;
  message: string;
  data: TData;
  meta: null | { pagination?: unknown };
};

export type ApiError = {
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

export type GroupStats = {
  sampleSize: number;
  mean: number;
  standardDeviation: number;
  minimum: number;
  maximum: number;
};

export type BoxplotStats = {
  minimum: number;
  q1: number;
  median: number;
  q3: number;
  maximum: number;
  mean: number;
  outliers: number[];
};

export type HistogramData = {
  bins: string[];
  groups: Record<string, number[]>;
};

export type BarChartData = {
  meanScores: Array<{ group: string; value: number }>;
  standardDeviation: Array<{ group: string; value: number }>;
};

export type ConfidenceIntervalPlot = {
  estimate: number;
  lower: number;
  upper: number;
  nullValue: number;
  label: string;
};

export type AnalyzeData = {
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
    boxplot: Record<string, BoxplotStats>;
    histogram: HistogramData;
    barChart: BarChartData;
    confidenceIntervalPlot: ConfidenceIntervalPlot;
  };
};

export type AnalyzeSuccessResponse = ApiSuccess<AnalyzeData>;
export type AnalyzeErrorResponse = ApiError;
export type AnalyzeResponse = AnalyzeSuccessResponse | AnalyzeErrorResponse;
```

