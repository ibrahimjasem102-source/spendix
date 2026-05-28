"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Trash2, Loader2 } from "lucide-react";
import { safeFetch } from "@/lib/fetch-safe";
import { useTranslation, LOCALES } from "@/lib/i18n";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function AIAssistantPage() {
  const { t, locale } = useTranslation();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const bottomRef               = useRef<HTMLDivElement>(null);
  const inputRef                = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const langLabel = LOCALES.find((l) => l.code === locale)?.label ?? locale;

  const examples = [
    t("ai_assistant.example_1"),
    t("ai_assistant.example_2"),
    t("ai_assistant.example_3"),
  ];

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    inputRef.current?.focus();

    try {
      const res = await safeFetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          language: locale,
        }),
      });

      const data = await res.json();
      setMessages((p) => [
        ...p,
        { id: crypto.randomUUID(), role: "assistant", content: data.reply ?? t("ai_assistant.empty_reply") },
      ]);
    } catch {
      setMessages((p) => [
        ...p,
        { id: crypto.randomUUID(), role: "assistant", content: t("ai_assistant.connection_error") },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 10rem)" }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-xl font-bold t1">{t("ai_assistant.title")}</h1>
          <p className="text-sm t2 mt-0.5">{t("ai_assistant.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs t3">{t("ai_assistant.language_notice")}</span>
          <span className="text-xs font-semibold text-cyan-400 bg-cyan-400/10 px-2.5 py-1 rounded-lg border border-cyan-400/20">
            {langLabel}
          </span>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              title={t("ai_assistant.clear")}
              className="p-2 rounded-xl t3 hover:t2 hover:bg-[hsl(var(--bg-input))] transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">
        {messages.length === 0 ? (
          /* Welcome screen */
          <div className="flex flex-col items-center justify-center h-full gap-6 py-8">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-400/10 to-purple-500/10 border border-cyan-400/20">
              <Bot className="w-8 h-8 text-cyan-400" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-bold t1">{t("ai_assistant.welcome_title")}</h2>
              <p className="text-sm t2 mt-1 max-w-sm">{t("ai_assistant.welcome_subtitle")}</p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-md">
              {examples.map((ex) => (
                <button
                  key={ex}
                  onClick={() => send(ex)}
                  className="text-left px-4 py-3 card text-sm t2 hover:t1 hover:border-cyan-400/20 transition-all"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                {/* Avatar */}
                <div className={`p-2 rounded-xl shrink-0 self-start ${
                  msg.role === "user" ? "bg-cyan-400/10" : "bg-purple-400/10"
                }`}>
                  {msg.role === "user"
                    ? <User className="w-4 h-4 text-cyan-400" />
                    : <Bot className="w-4 h-4 text-purple-400" />}
                </div>

                {/* Bubble */}
                <div className={`max-w-[78%] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-cyan-400/8 border border-cyan-400/20 t1 rounded-2xl rounded-tr-sm"
                    : "card t1 rounded-2xl rounded-tl-sm"
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex gap-3">
                <div className="p-2 rounded-xl bg-purple-400/10 self-start">
                  <Bot className="w-4 h-4 text-purple-400" />
                </div>
                <div className="card px-4 py-3.5 rounded-2xl rounded-tl-sm flex items-center gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 160}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <div className="mt-4 shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={t("ai_assistant.placeholder")}
            rows={1}
            disabled={loading}
            className="field flex-1 resize-none min-h-[46px] max-h-36 py-3 leading-relaxed"
            style={{ overflowY: "auto" }}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            aria-label={t("ai_assistant.send")}
            className="p-3 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 disabled:opacity-40 text-[#0B0F17] transition-all shrink-0 self-end"
          >
            {loading
              ? <Loader2 className="w-5 h-5 animate-spin" />
              : <Send className="w-5 h-5" />}
          </button>
        </div>

        <p className="text-center text-xs t3 mt-2">
          {t("ai_assistant.powered_by")} ·{" "}
          {t("ai_assistant.language_notice")} <span className="text-cyan-400">{langLabel}</span>
        </p>
      </div>
    </div>
  );
}
