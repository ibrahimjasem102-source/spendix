import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { AIModel, ChatMessage } from "./aiTypes";

const DEFAULT_MODEL: AIModel = "claude-haiku-4-5-20251001";

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

export interface LLMCallOptions {
  model?: AIModel;
  maxTokens?: number;
  system?: string;
  messages: ChatMessage[];
  jsonMode?: boolean;
}

export interface LLMCallResult {
  text: string;
  model: AIModel;
  inputTokens: number;
  outputTokens: number;
}

export async function callLLM(options: LLMCallOptions): Promise<LLMCallResult> {
  const { model = DEFAULT_MODEL, maxTokens = 1024, system, messages } = options;

  if (model === "mock") {
    return mockResponse(options.jsonMode);
  }

  const client = getClient();

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages,
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  return {
    text,
    model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

function mockResponse(jsonMode?: boolean): LLMCallResult {
  const text = jsonMode
    ? JSON.stringify([
        {
          category: "savings",
          severity: "info",
          title: "Mock Insight",
          body: "This is a mock insight for testing.",
          confidence: 0.9,
        },
      ])
    : "This is a mock AI response for testing.";

  return { text, model: "mock", inputTokens: 0, outputTokens: 0 };
}
