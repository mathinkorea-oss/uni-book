import { GoogleGenerativeAI } from "@google/generative-ai";

const DEFAULT_MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-3-flash-preview",
  "gemini-flash-latest",
  "gemini-2.5-flash-lite",
].filter((m): m is string => Boolean(m));

export async function generateTextWithFallback(
  apiKey: string,
  prompt: string,
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const tried: string[] = [];
  let lastError: unknown;

  for (const modelName of DEFAULT_MODELS) {
    tried.push(modelName);
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (err) {
      lastError = err;
      const status = getErrorStatus(err);
      if (status === 429) {
        throw new QuotaExceededError();
      }
      if (status === 401 || status === 403) {
        throw new InvalidApiKeyError();
      }
      continue;
    }
  }

  throw lastError ?? new Error(`No model available (tried: ${tried.join(", ")})`);
}

export async function generateJsonWithFallback(
  apiKey: string,
  prompt: string,
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const tried: string[] = [];
  let lastError: unknown;

  for (const modelName of DEFAULT_MODELS) {
    tried.push(modelName);
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
        },
      });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      lastError = err;
      const status = getErrorStatus(err);
      if (status === 429) {
        throw new QuotaExceededError();
      }
      if (status === 401 || status === 403) {
        throw new InvalidApiKeyError();
      }
      continue;
    }
  }

  throw lastError ?? new Error(`No model available (tried: ${tried.join(", ")})`);
}

function getErrorStatus(err: unknown): number | undefined {
  if (err && typeof err === "object" && "status" in err) {
    const s = (err as { status?: number }).status;
    return typeof s === "number" ? s : undefined;
  }
  return undefined;
}

export class QuotaExceededError extends Error {
  constructor() {
    super("quota");
  }
}

export class InvalidApiKeyError extends Error {
  constructor() {
    super("invalid_key");
  }
}

export function mapGeminiError(err: unknown): string {
  if (err instanceof QuotaExceededError) {
    return "Gemini API 사용 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (err instanceof InvalidApiKeyError) {
    return "Gemini API 키가 올바르지 않습니다. Google AI Studio에서 API 키를 다시 발급해 주세요.";
  }
  const status = getErrorStatus(err);
  if (status === 503) {
    return "AI 모델이 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (err instanceof Error && err.message.includes("API key")) {
    return "Gemini API 키가 올바르지 않습니다. 설정을 확인해 주세요.";
  }
  return "AI 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}
