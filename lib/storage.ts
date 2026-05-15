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
const STORAGE_KEY_SAVE_HISTORY = "prompt_optimizer_save_history";

function getSavedData(key: string): string | null {
  if (typeof window === 'undefined') return null;
  // Використовуємо надійне збереження через electronAPI
  if ((window as any).electronAPI) {
    try {
      const val = (window as any).electronAPI.getStoredData(key);
      if (val !== null) return val;
    } catch (e) {
      console.error("Помилка читання файлу:", e);
    }
  }
  return localStorage.getItem(key);
}

function saveData(key: string, value: string) {
  if (typeof window !== 'undefined') {
    if ((window as any).electronAPI) {
      try {
        (window as any).electronAPI.saveStoredData(key, value);
      } catch (e) {
        console.error("Помилка запису файлу:", e);
      }
    }
    localStorage.setItem(key, value);
  }
}

export function getStoredModels(): CustomModel[] {
  if (typeof window === "undefined") return [];
  const stored = getSavedData(STORAGE_KEY_MODELS);
  if (!stored) {
    // Default mock local model config
    return [{
      id: "default-local",
      name: "Local LM Studio / Ollama",
      endpointUrl: "http://localhost:1234/v1/chat/completions",
      modelId: "local-model"
    }];
  }
  try {
    return JSON.parse(stored);
  } catch (e) {
    return [{
      id: "default-local",
      name: "Local LM Studio / Ollama",
      endpointUrl: "http://localhost:1234/v1/chat/completions",
      modelId: "local-model"
    }];
  }
}

export function saveModels(models: CustomModel[]) {
  saveData(STORAGE_KEY_MODELS, JSON.stringify(models));
}

export function getStoredHistory(): HistoryItem[] {
  const stored = getSavedData(STORAGE_KEY_HISTORY);
  return stored ? JSON.parse(stored) : [];
}

export function saveHistory(history: HistoryItem[]) {
  saveData(STORAGE_KEY_HISTORY, JSON.stringify(history));
}

export function getSelectedModelId(): string | null {
  return getSavedData(STORAGE_KEY_SELECTED_MODEL);
}

export function saveSelectedModelId(id: string) {
  saveData(STORAGE_KEY_SELECTED_MODEL, id);
}

export function getUserContext(): string {
  return getSavedData(STORAGE_KEY_USER_CONTEXT) || "";
}

export function saveUserContext(context: string) {
  saveData(STORAGE_KEY_USER_CONTEXT, context);
}

export function getSaveHistoryEnabled(): boolean {
  const stored = getSavedData(STORAGE_KEY_SAVE_HISTORY);
  return stored !== "false"; // default is true
}

export function setSaveHistoryEnabled(enabled: boolean) {
  saveData(STORAGE_KEY_SAVE_HISTORY, enabled ? "true" : "false");
}
