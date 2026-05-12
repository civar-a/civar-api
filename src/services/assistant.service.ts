/**
 * @file assistant.service.ts
 * @description Assistant service (markdown explanations)
 * @author Mahros AL-Qabasy <mahros.dev>
 */

import axios from "axios";
import { config } from "../config";

type ApiSuccess<TData> = {
  success: true;
  message: string;
  data: TData;
  meta: null;
};

type ApiError = {
  success: false;
  message: string;
  data: null;
  meta: null;
  error: {
    code: "INVALID_DATA" | "ASSISTANT_FAILED";
    message: string;
  };
};

type AskAssistantRequestBody = {
  question?: string;
  data?: unknown;
};

export class AssistantService {
  async ask(body: AskAssistantRequestBody): Promise<{ status: number; body: ApiSuccess<{ markdown: string }> | ApiError }> {
    try {
      const question = String(body?.question ?? "").trim();
      const data = body?.data;

      if (!question) {
        return { status: 400, body: this.error("INVALID_DATA", "question is required.") };
      }

      const md = await this.generateMarkdown({ question, data });

      return {
        status: 200,
        body: {
          success: true,
          message: "Request completed successfully",
          data: { markdown: md },
          meta: null,
        },
      };
    } catch {
      return { status: 500, body: this.error("ASSISTANT_FAILED", "Failed to generate explanation.") };
    }
  }

  private error(code: ApiError["error"]["code"], message: string): ApiError {
    return {
      success: false,
      message: code === "ASSISTANT_FAILED" ? "Assistant failed" : "Validation failed",
      data: null,
      meta: null,
      error: { code, message },
    };
  }

  private async generateMarkdown(input: { question: string; data: unknown }): Promise<string> {
    const apiKey = config.GEMINI_API_KEY;
    if (!apiKey) {
      return this.fallbackMarkdown(input);
    }

    try {
      const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
        apiKey,
      )}`;

      const prompt = [
        `You are a helpful assistant for a statistics learning app.`,
        `Return output strictly in Markdown.`,
        `Be concise, beginner-friendly, and use simple words.`,
        ``,
        `User question:`,
        input.question,
        ``,
        `Context JSON (may be any shape):`,
        safeJson(input.data),
      ].join("\n");

      const resp = await axios.post(
        url,
        {
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
        },
        { timeout: 15000 },
      );

      const text = extractGeminiText(resp.data);
      if (!text) return this.fallbackMarkdown(input);
      return text;
    } catch {
      return this.fallbackMarkdown(input);
    }
  }

  private fallbackMarkdown(input: { question: string; data: unknown }): string {
    const extracted = extractConfidenceIntervalContext(input.data);
    const label = extracted.label ?? "Group A - Group B";
    const groupVariable = extracted.groupVariable ?? "group";

    return renderConfidenceIntervalMarkdown({
      question: input.question,
      label,
      groupVariable,
      estimate: extracted.estimate,
      lower: extracted.lower,
      upper: extracted.upper,
      pValue: extracted.pValue,
      isSignificant: extracted.isSignificant,
    });
  }
}

function renderConfidenceIntervalMarkdown(input: {
  question: string;
  label: string;
  groupVariable: string;
  estimate: number | null;
  lower: number | null;
  upper: number | null;
  pValue: number | null;
  isSignificant: boolean | null;
}): string {
  const intervalKnown = input.lower !== null && input.upper !== null;
  const crossesZero = intervalKnown ? input.lower! <= 0 && input.upper! >= 0 : null;

  const lines: string[] = [];
  lines.push(`# Explanation`);
  lines.push(``);
  lines.push(`**Question:** ${escapeMd(input.question)}`);
  lines.push(``);

  if (!intervalKnown) {
    lines.push(`I can explain confidence intervals, but the request did not include a valid \`confidenceInterval.lower\` and \`confidenceInterval.upper\`.`);
    lines.push(``);
    lines.push(`A confidence interval is a range of values that likely contains the true difference between the two groups.`);
    return lines.join("\n");
  }

  lines.push(`## What the confidence interval means (simple words)`);
  lines.push(``);
  lines.push(
    `A **confidence interval** is a **range of plausible values** for the true difference between the two groups (${escapeMd(
      input.label,
    )}).`,
  );
  lines.push(``);
  lines.push(
    `In this analysis, the estimated difference is **${fmt(input.estimate)}**, and the confidence interval is **[${fmt(
      input.lower,
    )}, ${fmt(input.upper)}]**.`,
  );
  lines.push(``);
  lines.push(`## How to interpret it visually`);
  lines.push(``);
  lines.push(`- Draw a horizontal line from **lower** to **upper**`);
  lines.push(`- Mark the **estimate** on that line`);
  lines.push(`- Mark **0** (the “no difference” value)`);
  lines.push(``);

  if (crossesZero === false) {
    lines.push(`Because the interval **does not include 0**, it suggests a **real difference** between the two groups.`);
  } else if (crossesZero === true) {
    lines.push(`Because the interval **includes 0**, it suggests the true difference **could be 0**, so the result is not clearly different.`);
  }

  if (input.pValue !== null) {
    lines.push(``);
    lines.push(`## Supporting evidence (p-value)`);
    lines.push(``);
    lines.push(`The p-value is **${fmt(input.pValue)}**.`);
    if (input.isSignificant === true) {
      lines.push(`This is considered **statistically significant** (commonly using a 0.05 threshold).`);
    } else if (input.isSignificant === false) {
      lines.push(`This is **not statistically significant** (commonly using a 0.05 threshold).`);
    }
  }

  lines.push(``);
  lines.push(`## Plain-language takeaway`);
  lines.push(``);
  lines.push(
    `We are reasonably confident the true difference in average scores (${escapeMd(input.label)}) lies somewhere between **${fmt(
      input.lower,
    )}** and **${fmt(input.upper)}** points.`,
  );

  return lines.join("\n");
}

function asNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(String(value ?? "").trim());
  return Number.isFinite(n) ? n : null;
}

function fmt(value: number | null): string {
  if (value === null) return "N/A";
  const rounded = Math.round(value * 100000) / 100000;
  return String(rounded);
}

function capitalize(value: string): string {
  const v = String(value ?? "").trim();
  if (!v) return v;
  return v[0]!.toUpperCase() + v.slice(1);
}

function escapeMd(value: string): string {
  return value.replace(/[\\`*_{}[\]()#+\-.!|]/g, "\\$&");
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function extractGeminiText(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  const candidates = payload["candidates"];
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const first = candidates[0];
  if (!isRecord(first)) return null;
  const content = first["content"];
  if (!isRecord(content)) return null;
  const parts = content["parts"];
  if (!Array.isArray(parts) || parts.length === 0) return null;
  const part0 = parts[0];
  if (!isRecord(part0)) return null;
  const text = part0["text"];
  return typeof text === "string" ? text : null;
}

function extractConfidenceIntervalContext(data: unknown): {
  label: string | null;
  groupVariable: string | null;
  estimate: number | null;
  lower: number | null;
  upper: number | null;
  pValue: number | null;
  isSignificant: boolean | null;
} {
  // Supports flexible payloads; if the frontend passes a Civara analysis object,
  // we try to extract CI context. Otherwise, we return nulls and the markdown
  // renderer falls back to a generic explanation.
  const analysis = getPath(data, ["analysis"]);
  const comparison = getPath(analysis, ["comparison"]);
  const confidenceInterval = getPath(comparison, ["confidenceInterval"]);

  const lower = asNumber(getPath(confidenceInterval, ["lower"]));
  const upper = asNumber(getPath(confidenceInterval, ["upper"]));
  const estimate = asNumber(getPath(comparison, ["meanDifference"]));
  const pValue = asNumber(getPath(comparison, ["pValue"]));

  const isSignificantValue = getPath(comparison, ["isSignificant"]);
  const isSignificant = typeof isSignificantValue === "boolean" ? isSignificantValue : null;

  const groupVariableRaw = getPath(analysis, ["groupVariable"]);
  const groupVariable =
    typeof groupVariableRaw === "string" && groupVariableRaw.trim() ? groupVariableRaw.trim() : null;

  const groups = getPath(analysis, ["groups"]);
  const groupKeys = isRecord(groups) ? Object.keys(groups) : [];
  const label =
    groupKeys.length >= 2
      ? `${capitalize(groupKeys[0]!) ?? "Group A"} - ${capitalize(groupKeys[1]!) ?? "Group B"}`
      : null;

  return { label, groupVariable, estimate, lower, upper, pValue, isSignificant };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getPath(value: unknown, path: string[]): unknown {
  let cur: unknown = value;
  for (const key of path) {
    if (!isRecord(cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}
