"use client";

import { useState, useEffect, useRef } from "react";
import {
  Settings,
  Copy,
  Check,
  Wand2,
  Trash2,
  Plus,
  Save,
  Loader2,
  ChevronDown,
  Minus,
  X,
  Maximize2
} from "lucide-react";
import {
  CustomModel,
  HistoryItem,
  getStoredModels,
  saveModels,
  getStoredHistory,
  saveHistory,
  getSelectedModelId,
  saveSelectedModelId,
  getUserContext,
  saveUserContext,
} from "@/lib/storage";

export default function PromptOptimizerTrayApp() {
  const [models, setModels] = useState<CustomModel[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<"models" | "memory">("models");

  // Widget state
  const [rawPrompt, setRawPrompt] = useState("");
  const [userContext, setUserContext] = useState("");

  const [optimizedPrompt, setOptimizedPrompt] = useState("");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Settings Draft State
  const [draftModels, setDraftModels] = useState<CustomModel[]>([]);
  const [draftUserContext, setDraftUserContext] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    Promise.resolve().then(() => {
      const m = getStoredModels();
      const h = getStoredHistory();
      const sid = getSelectedModelId();
      const ctx = getUserContext();
      setModels(m);
      setHistory(h);
      setUserContext(ctx);
      if (sid && m.find((mod) => mod.id === sid)) {
        setSelectedModelId(sid);
      } else if (m.length > 0) {
        setSelectedModelId(m[0].id);
      }
    });
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [rawPrompt]);

  const handleOptimizePrompt = async () => {
    if (!rawPrompt.trim() || models.length === 0) return;
    const modelToRun = models.find((m) => m.id === selectedModelId);
    if (!modelToRun) return;

    setIsOptimizing(true);
    setOptimizedPrompt("");

    const systemInstruction = `Ти експерт-інженер з промпт-дизайну. Твоя єдина мета — переписати запит користувача, перетворивши його на набагато зрозуміліший, чітко структурований і максимально детальний промпт, який ідеально зрозуміє інша велика мовна модель (LLM).
ПРАВИЛА:
1. НЕ відповідай на сам запит користувача! Твоя мета - ТІЛЬКИ переписати сам промпт.
2. Додай необхідний контекст, структуру (наприклад, задачі, очікуваний формат, обмеження), щоб фінальна модель дала найкращий результат.
3. Видай результат тією ж мовою, якою написаний оригінальний запит.${userContext ? `\n\nСПЕЦІАЛЬНИЙ КОНТЕКСТ КОРИСТУВАЧА:\nВраховуй наступні побажання, стиль або контекст при оптимізації:\n${userContext}` : ""}`;

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (modelToRun.apiKey) {
        headers["Authorization"] = `Bearer ${modelToRun.apiKey}`;
      }

      let requestBody = {
        model: modelToRun.modelId || "local",
        messages: [
          { role: "system", "content": systemInstruction },
          { role: "user", "content": `Оптимізуй наступний промпт:\n\n${rawPrompt}` }
        ],
        temperature: 0.7,
      };

      let res;
      try {
        // Try direct fetch first (best for Electron/Local)
        res = await fetch(modelToRun.endpointUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
        });
      } catch (directError) {
        // If CORS blocks it in browser, try proxy
        res = await fetch("/api/proxy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: modelToRun.endpointUrl,
            method: "POST",
            headers,
            body: requestBody,
          }),
        });
      }

      if (!res.ok) {
        let errorDetails = "";
        try {
          const errData = await res.json();
          errorDetails = JSON.stringify(errData);
        } catch {
          errorDetails = await res.text();
        }
        throw new Error(`Статус ${res.status}. Деталі: ${errorDetails}`);
      }

      const data = await res.json();
      let responseText = "";
      if (data.choices && data.choices[0] && data.choices[0].message) {
        responseText = data.choices[0].message.content;
      } else {
        responseText = JSON.stringify(data, null, 2);
      }

      setOptimizedPrompt(responseText);

      // Save to history
      const newHistoryItem: HistoryItem = {
        id: Date.now().toString(),
        originalPrompt: rawPrompt,
        optimizedPrompt: responseText,
        timestamp: Date.now(),
      };
      const newHistory = [newHistoryItem, ...history].slice(0, 50); // Keep last 50
      setHistory(newHistory);
      saveHistory(newHistory);
      
    } catch (err: any) {
      console.error(err);
      let errorMsg = err.message || "Невідома помилка";
      if (errorMsg.includes("404")) {
        errorMsg += "\n\n💡 Порада щодо 404: Переконайтесь, що ваш URL закінчується на /v1/chat/completions (не просто localhost:1234). Також перевірте, чи запущена модель і чи співпадає ID моделі.";
      }
      if (errorMsg.includes("Failed to fetch") || errorMsg.includes("ECONNREFUSED")) {
        errorMsg += "\n\n💡 Порада: Сервер моделі недоступний. Якщо ви на сайті AI Studio - він не може бачити ваш ПК. Запустіть програму локально (через Electron або npm run dev).";
      }
      
      setOptimizedPrompt("Помилка при зверненні до моделі:\n" + errorMsg);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleCopy = () => {
    if (!optimizedPrompt) return;
    navigator.clipboard.writeText(optimizedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleOptimizePrompt();
    }
  };

  const handleModelSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedModelId(val);
    saveSelectedModelId(val);
  };

  // Settings Handlers
  const openSettings = () => {
    setDraftModels([...models]);
    setDraftUserContext(userContext);
    setIsSettingsOpen(true);
  };

  const saveSettings = () => {
    setModels(draftModels);
    saveModels(draftModels);
    setUserContext(draftUserContext);
    saveUserContext(draftUserContext);
    if (!draftModels.find((m) => m.id === selectedModelId) && draftModels.length > 0) {
      const newSid = draftModels[0].id;
      setSelectedModelId(newSid);
      saveSelectedModelId(newSid);
    }
    setIsSettingsOpen(false);
  };

  const addDraftModel = () => {
    setDraftModels([
      ...draftModels,
      {
        id: Date.now().toString(),
        name: "New Local Model",
        endpointUrl: "http://localhost:1234/v1/chat/completions",
        modelId: "local-model",
      },
    ]);
  };

  const updateDraftModel = (id: string, field: keyof CustomModel, value: string) => {
    setDraftModels(
      draftModels.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const removeDraftModel = (id: string) => {
    setDraftModels(draftModels.filter((m) => m.id !== id));
  };

  return (
    <div className="h-screen w-full bg-[#fafafa] flex flex-col overflow-hidden">
      {/* Header bar */}
      <div 
        className="bg-slate-100 flex items-center justify-between px-3 py-2 border-b border-slate-200 select-none"
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-semibold text-slate-600">Prompt Optimizer Pro</span>
        </div>
        
        <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <select
            value={selectedModelId}
            onChange={handleModelSelect}
            className="appearance-none bg-transparent text-xs font-medium text-slate-600 hover:text-slate-900 focus:outline-none cursor-pointer pr-3 max-w-[120px] truncate"
            title="Обрати модель"
          >
            {models.length === 0 && <option value="">Немає моделей</option>}
            {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          
          {/* Header Toolbar */}
          <div className="flex items-center ml-1 space-x-1 border-l border-slate-300 pl-2">
            <button 
              onClick={openSettings}
              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              title="Налаштування"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button 
              onClick={() => window.close()}
              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              title="Згорнути в трей"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button 
              onClick={() => window.close()}
              className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-100 transition-colors"
              title="Закрити"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="p-3">
        <textarea
          ref={textareaRef}
          placeholder="Введіть свій короткий промпт (натисніть Enter для оптимізації)..."
          className="w-full bg-transparent text-slate-800 text-sm placeholder-slate-400 resize-none outline-none min-h-[40px] max-h-[120px] leading-relaxed"
          value={rawPrompt}
          onChange={(e) => setRawPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={handleOptimizePrompt}
            disabled={!rawPrompt.trim() || isOptimizing || models.length === 0}
            className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Оптимізувати промпт (Enter)"
          >
            {isOptimizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Result Area */}
      {(optimizedPrompt || isOptimizing) && (
        <div className="border-t border-slate-200 bg-white p-3 flex-1 flex flex-col justify-start">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Оптимізований Промпт</span>
            {optimizedPrompt && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Скопійовано" : "Скопіювати"}
              </button>
            )}
          </div>
          <div className="text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2 h-[80px] overflow-y-auto whitespace-pre-wrap font-sans selection:bg-indigo-100">
            {isOptimizing && !optimizedPrompt ? (
              <div className="flex items-center gap-2 text-slate-400 italic">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Зачекайте, модель працює...
              </div>
            ) : (
              optimizedPrompt
            )}
          </div>
        </div>
      )}

      {/* Settings Modal Overlay */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex gap-4">
                <button 
                  onClick={() => setActiveSettingsTab("models")}
                  className={`text-sm font-bold ${activeSettingsTab === "models" ? "text-indigo-600 border-b-2 border-indigo-600 pb-1" : "text-slate-500 hover:text-slate-700 pb-1"}`}
                >
                  Моделі
                </button>
                <button 
                  onClick={() => setActiveSettingsTab("memory")}
                  className={`text-sm font-bold ${activeSettingsTab === "memory" ? "text-indigo-600 border-b-2 border-indigo-600 pb-1" : "text-slate-500 hover:text-slate-700 pb-1"}`}
                >
                  Пам&apos;ять / Контекст
                </button>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-slate-600 mb-1">
                &times;
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-slate-50">
              {activeSettingsTab === "models" ? (
                <>
                  <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm mb-4 border border-blue-100">
                    <strong>Увага:</strong> Оптимізація та збереження історії виконуються за допомогою вибраної тут моделі (використовується OpenAI форматований API).
                  </div>

                  {draftModels.map((model, idx) => (
                    <div key={model.id} className="p-4 border border-slate-200 rounded-lg bg-white relative">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-slate-700 text-sm">Модель {idx + 1}</h4>
                        <button onClick={() => removeDraftModel(model.id)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">Назва</label>
                          <input
                            type="text"
                            value={model.name}
                            onChange={(e) => updateDraftModel(model.id, "name", e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm"
                            placeholder="My Local LLM"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">ID Моделі</label>
                          <input
                            type="text"
                            value={model.modelId}
                            onChange={(e) => updateDraftModel(model.id, "modelId", e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm"
                            placeholder="local-model"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs font-medium text-slate-500 mb-1">API Endpoint (v1/chat/completions)</label>
                          <input
                            type="text"
                            value={model.endpointUrl}
                            onChange={(e) => updateDraftModel(model.id, "endpointUrl", e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm font-mono text-xs"
                            placeholder="http://localhost:1234/v1/chat/completions"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs font-medium text-slate-500 mb-1">API Key (Опціонально)</label>
                          <input
                            type="password"
                            value={model.apiKey || ""}
                            onChange={(e) => updateDraftModel(model.id, "apiKey", e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm font-mono text-xs"
                            placeholder="sk-..."
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={addDraftModel}
                    className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors flex items-center justify-center gap-2 text-sm font-medium bg-white"
                  >
                    <Plus className="w-4 h-4" />
                    Додати Модель
                  </button>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="bg-emerald-50 text-emerald-800 p-3 rounded-lg text-sm mb-4 border border-emerald-100">
                    <strong>Глобальний Контекст:</strong> Тут ви можете вказати свою роль, інструменти, якими користуєтесь, або стиль (наприклад: &quot;Пиши коротко, я розробник на React&quot;). Цей контекст буде застосовуватись до <strong>кожного</strong> вашого промпта під час оптимізації.
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Ваш персональний контекст</label>
                    <textarea
                      value={draftUserContext}
                      onChange={(e) => setDraftUserContext(e.target.value)}
                      placeholder="Наприклад: &quot;Я працюю з Node.js та TypeScript. Промпти потрібні для генерації коду. Пиши стисло і технічно, без &quot;води&quot;.&quot;"
                      className="w-full h-40 px-3 py-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-white flex justify-end gap-3">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Скасувати
              </button>
              <button
                onClick={saveSettings}
                className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Зберегти Налаштування
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
