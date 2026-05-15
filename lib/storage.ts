export interface CustomModel {
  id: string;
  name: string;
  endpointUrl: string; // e.g., http://localhost:1234/v1/chat/completions
  apiKey?: string;
  modelId: string; // e.g., gpt-3.5-turbo, local-model
}

export interface HistoryItem {
  id: string;
  originalPrompt: string;
  optimizedPrompt: string;
  response?: string;
  timestamp: number;
}

const STORAGE_KEY_MODELS = "prompt_optimizer_models";
const STORAGE_KEY_HISTORY = "prompt_optimizer_history";
const STORAGE_KEY_SELECTED_MODEL = "prompt_optimizer_selected_model";
const STORAGE_KEY_USER_CONTEXT = "prompt_optimizer_user_context";

export function getStoredModels(): CustomModel[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(STORAGE_KEY_MODELS);
  if (!stored) {
    // Default mock local model config
    return [{
      id: "default-local",
      name: "Local LM Studio / Ollama",
      endpointUrl: "http://localhost:1234/v1/chat/completions",
      modelId: "local-model"
    }];
  }
  return JSON.parse(stored);
}

export function saveModels(models: CustomModel[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_MODELS, JSON.stringify(models));
  }
}

export function getStoredHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(STORAGE_KEY_HISTORY);
  return stored ? JSON.parse(stored) : [];
}

export function saveHistory(history: HistoryItem[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
  }
}

export function getSelectedModelId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY_SELECTED_MODEL);
}

export function saveSelectedModelId(id: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_SELECTED_MODEL, id);
  }
}

export function getUserContext(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE_KEY_USER_CONTEXT) || "";
}

export function saveUserContext(context: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_USER_CONTEXT, context);
  }
}
