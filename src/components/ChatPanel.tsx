"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Send } from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ALL_MODEL_OPTIONS, formatModelOptionLabel, getModelLabel } from "@/lib/model-options";
import type { ModelType } from "@/lib/llm";
import { readModelSelection, writeModelSelection } from "@/lib/model-selection";
import VoiceInputButton from "@/components/VoiceInputButton";
type VoiceState = "idle" | "recording" | "processing";

export type ChatMessageView = {
  id: string;
  role: string;
  content: string;
};

type ChatPanelProps = {
  systemPrompt: string;
  modelType?: ModelType;
  /** 下拉框中标记推荐的模型档位 */
  recommendedModel?: ModelType;
  emptyStateText?: string;
  inputPlaceholder?: string;
  initialAssistantMessage?: string;
  assistantName?: string;
  onMessagesChange?: (messages: ChatMessageView[]) => void;
  initialUserMessage?: string;
  programmaticUserMessage?: string;
  programmaticMessageNonce?: number;
  hideProgrammaticUserBubble?: boolean;
  // When true, hide the auto-sent `initialUserMessage` bubble from the chat transcript UI.
  // Useful when we need to include story context for the model, but don't want to repeat it visually.
  hideInitialUserBubble?: boolean;
  // When true, use a more immersive layout for the message area:
  // - less outer padding
  // - wider bubbles
  immersiveLayout?: boolean;
  maxWidthClassName?: string;
  proLoadingHint?: string;
  modelStorageKey?: string;
  inputTopContent?: ReactNode;
  enableVoiceInput?: boolean;
  voiceAutoSend?: boolean;
  renderInterviewerJson?: boolean;
  heightClassName?: string;
  apiEndpoint?: string;
  requestBody?: Record<string, unknown>;
  autoPlayTts?: boolean;
  ttsMuted?: boolean;
  ttsVoice?: string;
  onLoadingChange?: (loading: boolean) => void;
  disableTextInput?: boolean;
  stageCompleteToken?: string;
  onStageComplete?: (payload: { notice: string; currentStage?: string; nextStage?: string }) => void;
};

export default function ChatPanel({
  systemPrompt,
  modelType = "fast",
  recommendedModel,
  emptyStateText = "InterviewOS 初始化完成，发送第一条消息开始模拟面试...",
  inputPlaceholder = "输入消息，或使用教练指令...",
  initialAssistantMessage,
  assistantName = "面试教练",
  onMessagesChange,
  initialUserMessage,
  programmaticUserMessage,
  programmaticMessageNonce,
  hideProgrammaticUserBubble = false,
  hideInitialUserBubble = false,
  immersiveLayout = false,
  maxWidthClassName = "max-w-3xl",
  proLoadingHint = "当前为 Gemini 3.5 Flash，响应通常需要 10-30 秒，请耐心等待。",
  modelStorageKey,
  inputTopContent,
  enableVoiceInput = true,
  voiceAutoSend = false,
  renderInterviewerJson = false,
  heightClassName = "h-[600px]",
  apiEndpoint = "/api/chat",
  requestBody,
  autoPlayTts = false,
  ttsMuted = false,
  ttsVoice = "Cherry",
  onLoadingChange,
  disableTextInput = false,
  stageCompleteToken,
  onStageComplete,
}: ChatPanelProps) {
  const syncModelRef = useRef(false);
  const resolvedRecommended = recommendedModel ?? modelType;
  const resolvedStorageKey = useMemo(() => {
    if (modelStorageKey) return modelStorageKey;
    if (typeof window === "undefined") return "";
    return `chat:${window.location.pathname}`;
  }, [modelStorageKey]);
  const [selectedModel, setSelectedModel] = useState<ModelType>(() =>
    resolvedStorageKey ? readModelSelection(resolvedStorageKey, modelType) : modelType,
  );
  useEffect(() => {
    if (syncModelRef.current) {
      setSelectedModel(modelType);
      return;
    }
    syncModelRef.current = true;
  }, [modelType]);
  useEffect(() => {
    if (!resolvedStorageKey) return;
    writeModelSelection(resolvedStorageKey, selectedModel);
  }, [resolvedStorageKey, selectedModel]);

  const selectedModelRef = useRef(selectedModel);
  const systemPromptRef = useRef(systemPrompt);
  const requestBodyRef = useRef(requestBody);
  selectedModelRef.current = selectedModel;
  systemPromptRef.current = systemPrompt;
  requestBodyRef.current = requestBody;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: apiEndpoint,
        body: () => ({
          systemPrompt: systemPromptRef.current,
          modelType: selectedModelRef.current,
          ...(requestBodyRef.current ?? {}),
        }),
      }),
    [apiEndpoint],
  );

  // useChat 自动对接 /api/chat，并处理流式输出拼接
  const { messages, sendMessage, status, stop } = useChat({
    transport,
  });
  const [input, setInput] = useState("");
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [justTranscribedUntil, setJustTranscribedUntil] = useState(0);
  const hasAutoSentRef = useRef(false);
  const lastProgrammaticNonceRef = useRef<number | undefined>(undefined);
  const [lastSentText, setLastSentText] = useState("");
  const [showTimeoutHint, setShowTimeoutHint] = useState(false);
  const [showTimeoutDialog, setShowTimeoutDialog] = useState(false);
  const [autoFallbackNote, setAutoFallbackNote] = useState("");
  const [hiddenAssistantMessageIds, setHiddenAssistantMessageIds] = useState<string[]>([]);
  const hiddenProgrammaticCountsRef = useRef<Record<string, number>>({});
  const [stageNotices, setStageNotices] = useState<Array<{ id: string; notice: string }>>([]);
  const handledStageMessageIdsRef = useRef<string[]>([]);
  const loadingTimerRef = useRef<number | null>(null);
  const timeoutDismissUntilRef = useRef(0);
  const onMessagesChangeRef = useRef<typeof onMessagesChange>(onMessagesChange);
  const lastNotifiedMessagesSignatureRef = useRef("");
  const retryTurnUserCountRef = useRef<number | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesBottomRef = useRef<HTMLDivElement | null>(null);
  const isLoading = status === "streaming" || status === "submitted";
  const isVoiceRecording = voiceState === "recording";
  const isVoiceProcessing = voiceState === "processing";
  const resolvedInputPlaceholder = isVoiceRecording
    ? "🎤 正在聆听...请讲话 (Listening...)"
    : isVoiceProcessing
      ? "🎤 正在识别语音...请稍候"
      : inputPlaceholder;
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastTtsSignatureRef = useRef("");
  const ttsAbortRef = useRef<AbortController | null>(null);
  const ttsCacheRef = useRef<Map<string, { audioBase64: string; mimeType: string }>>(new Map());
  const recentSendSignaturesRef = useRef<Array<{ text: string; ts: number }>>([]);
  // Local lock to avoid race conditions between rapid clicks and `isLoading` state propagation.
  const localSendLockRef = useRef(false);

  useEffect(() => {
    onMessagesChangeRef.current = onMessagesChange;
  }, [onMessagesChange]);

  useEffect(() => {
    // Keep lock in sync with the actual streaming status.
    localSendLockRef.current = isLoading;
  }, [isLoading]);

  const normalizedMessages = useMemo(() => {
    const mapped = messages.map((m) => ({
      id: m.id,
      role: m.role,
      content:
        "content" in m && typeof m.content === "string"
          ? m.content
          : m.parts
              .filter((part) => part.type === "text")
              .map((part) => part.text)
              .join("\n"),
    }));
    const compacted: ChatMessageView[] = [];
    for (const msg of mapped) {
      const prev = compacted[compacted.length - 1];
      if (prev && prev.role === msg.role && prev.content === msg.content) {
        continue;
      }
      compacted.push(msg);
    }
    // Keep only recent messages to avoid oversized payloads in long chats.
    return compacted.slice(-60);
  }, [messages]);
  useEffect(() => {
    if (!stageCompleteToken) return;
    const handled = handledStageMessageIdsRef.current;
    for (const message of normalizedMessages) {
      if (message.role !== "assistant" || handled.includes(message.id)) continue;
      const payload = parseStageCompletePayload(message.content, stageCompleteToken);
      if (!payload) continue;
      handled.push(message.id);
      setHiddenAssistantMessageIds((prev) => (prev.includes(message.id) ? prev : [...prev, message.id]));
      const notice = payload.notice || "阶段切换中...";
      setStageNotices((prev) => [...prev, { id: message.id, notice }]);
      onStageComplete?.(payload);
    }
    handledStageMessageIdsRef.current = handled.slice(-50);
  }, [normalizedMessages, onStageComplete, stageCompleteToken]);
  useEffect(() => {
    onLoadingChange?.(isLoading);
  }, [isLoading, onLoadingChange]);
  const visibleMessages = useMemo(
    () => {
      const hiddenCounts = { ...hiddenProgrammaticCountsRef.current };
      const shouldHideUserBubbles = hideProgrammaticUserBubble || hideInitialUserBubble;
      const baseVisible = normalizedMessages.filter((m) => {
        if (hiddenAssistantMessageIds.includes(m.id)) return false;
        if (!shouldHideUserBubbles || m.role !== "user") return true;
        const key = m.content.trim();
        const remaining = hiddenCounts[key] ?? 0;
        if (remaining > 0) {
          hiddenCounts[key] = remaining - 1;
          return false;
        }
        return true;
      });
      const retryTurnUserCount = retryTurnUserCountRef.current;
      if (!retryTurnUserCount) return baseVisible;

      let seenUsers = 0;
      let retryTurnStartIdx = -1;
      for (let i = 0; i < baseVisible.length; i += 1) {
        if (baseVisible[i].role === "user") {
          seenUsers += 1;
          if (seenUsers === retryTurnUserCount) {
            retryTurnStartIdx = i;
            break;
          }
        }
      }
      if (retryTurnStartIdx < 0) return baseVisible;

      const assistantIdsAfterTurn = baseVisible
        .slice(retryTurnStartIdx + 1)
        .filter((m) => m.role === "assistant")
        .map((m) => m.id);
      if (assistantIdsAfterTurn.length <= 1) return baseVisible;
      const keepId = assistantIdsAfterTurn[assistantIdsAfterTurn.length - 1];

      return baseVisible.filter((m, idx) => {
        if (idx <= retryTurnStartIdx) return true;
        if (m.role !== "assistant") return true;
        return m.id === keepId;
      });
    },
    [normalizedMessages, hiddenAssistantMessageIds],
  );
  const renderedMessages = useMemo(() => {
    // 1) avoid visible duplicated assistant chunks
    const collapsed = visibleMessages.filter((msg, idx, arr) => {
      if (idx === 0) return true;
      const prev = arr[idx - 1];
      return !(msg.role === "assistant" && prev.role === "assistant" && msg.content === prev.content);
    });
    // 2) enforce unique render keys even when upstream message ids collide
    const idCount = new Map<string, number>();
    return collapsed.map((msg, idx) => {
      const count = idCount.get(msg.id) ?? 0;
      idCount.set(msg.id, count + 1);
      return {
        ...msg,
        renderKey: count === 0 ? msg.id : `${msg.id}-${count}-${idx}`,
      };
    });
  }, [visibleMessages]);

  const getDisplayContent = (msg: ChatMessageView) => {
    const content = msg.content ?? "";
    if (msg.role !== "user") return content;

    const looksLikeStar =
      /Situation\s*[:：]|Task\s*[:：]|Action\s*[:：]|Result\s*[:：]|Earned Secret\s*[:：]/i.test(content) ||
      /Situation\n|Task\n|Action\n|Result\n|Earned Secret\n/.test(content);

    // If the UI ever receives "dirty" historical user payloads containing the whole STAR,
    // collapse it to keep the transcript clean.
    if (looksLikeStar && content.length > 80) {
      return `${content.slice(0, 50)}...[内容已折叠]`;
    }
    if (content.length > 600) {
      return `${content.slice(0, 50)}...[内容已折叠]`;
    }
    return content;
  };

  useEffect(() => {
    if (!messagesBottomRef.current) return;
    messagesBottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [visibleMessages, isLoading]);

  useEffect(() => {
    if (!autoPlayTts || ttsMuted || isLoading) return;
    const latestAssistant = [...renderedMessages]
      .reverse()
      .find((msg) => msg.role === "assistant");
    if (!latestAssistant) return;
    const parsed = tryParseInterviewerJson(latestAssistant.content);
    if (!parsed?.spoken_text) return;
    const signature = `${latestAssistant.id}:${ttsVoice}:${parsed.spoken_text}`;
    if (signature === lastTtsSignatureRef.current) return;
    lastTtsSignatureRef.current = signature;
    let cancelled = false;
    (async () => {
      try {
        if (ttsAbortRef.current) {
          ttsAbortRef.current.abort();
        }
        const controller = new AbortController();
        ttsAbortRef.current = controller;
        let payload = ttsCacheRef.current.get(signature);
        if (!payload) {
          const response = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: parsed.spoken_text, voice: ttsVoice }),
            signal: controller.signal,
          });
          const parsedPayload = (await response.json()) as { audioBase64?: string; mimeType?: string };
          if (!response.ok || !parsedPayload.audioBase64 || cancelled) return;
          payload = { audioBase64: parsedPayload.audioBase64, mimeType: parsedPayload.mimeType || "audio/mpeg" };
          ttsCacheRef.current.set(signature, payload);
          if (ttsCacheRef.current.size > 20) {
            const firstKey = ttsCacheRef.current.keys().next().value;
            if (firstKey) ttsCacheRef.current.delete(firstKey);
          }
        }
        if (!payload || cancelled) return;
        if (ttsAudioRef.current) {
          ttsAudioRef.current.pause();
        }
        const audio = new Audio(`data:${payload.mimeType};base64,${payload.audioBase64}`);
        ttsAudioRef.current = audio;
        await audio.play().catch(() => undefined);
      } catch {
        // ignore TTS failures to avoid interrupting chat flow
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [autoPlayTts, isLoading, renderedMessages, ttsMuted, ttsVoice]);

  useEffect(() => {
    if (!ttsMuted) return;
    if (ttsAbortRef.current) {
      ttsAbortRef.current.abort();
      ttsAbortRef.current = null;
    }
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
    }
  }, [ttsMuted]);

  const sendAndTrack = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (isLoading || localSendLockRef.current) return;
    localSendLockRef.current = true;
    const now = Date.now();
    recentSendSignaturesRef.current = recentSendSignaturesRef.current
      .filter((row) => now - row.ts < 4000)
      .slice(-6);
    const duplicated = recentSendSignaturesRef.current.some((row) => row.text === trimmed);
    if (duplicated) {
      return;
    }
    recentSendSignaturesRef.current.push({ text: trimmed, ts: now });
    retryTurnUserCountRef.current = null;
    setAutoFallbackNote("");
    setLastSentText(trimmed);
    setShowTimeoutHint(false);
    setShowTimeoutDialog(false);
    sendMessage({ text: trimmed });
  };

  useEffect(() => {
    if (isLoading) {
      return;
    }
    const signature = JSON.stringify(
      visibleMessages.map((msg) => ({ role: msg.role, content: msg.content })),
    );
    if (signature === lastNotifiedMessagesSignatureRef.current) {
      return;
    }
    lastNotifiedMessagesSignatureRef.current = signature;
    onMessagesChangeRef.current?.(visibleMessages);
  }, [visibleMessages, isLoading]);

  useEffect(() => {
    if (hasAutoSentRef.current) {
      return;
    }
    if (!initialUserMessage?.trim()) {
      return;
    }
    if (normalizedMessages.length > 0) {
      return;
    }
    hasAutoSentRef.current = true;
    if (hideInitialUserBubble) {
      const key = initialUserMessage.trim();
      hiddenProgrammaticCountsRef.current[key] = (hiddenProgrammaticCountsRef.current[key] ?? 0) + 1;
    }
    sendAndTrack(initialUserMessage);
  }, [initialUserMessage, normalizedMessages.length, sendMessage]);

  useEffect(() => {
    if (typeof programmaticMessageNonce !== "number") {
      return;
    }
    if (lastProgrammaticNonceRef.current === programmaticMessageNonce) {
      return;
    }
    lastProgrammaticNonceRef.current = programmaticMessageNonce;
    if (!programmaticUserMessage?.trim()) {
      return;
    }
    if (isLoading) return;
    if (hideProgrammaticUserBubble) {
      const key = programmaticUserMessage.trim();
      hiddenProgrammaticCountsRef.current[key] = (hiddenProgrammaticCountsRef.current[key] ?? 0) + 1;
    }
    sendAndTrack(programmaticUserMessage);
  }, [hideProgrammaticUserBubble, isLoading, programmaticMessageNonce, programmaticUserMessage, sendMessage]);

  useEffect(() => {
    if (!isLoading) {
      setShowTimeoutHint(false);
      setShowTimeoutDialog(false);
      if (loadingTimerRef.current !== null) {
        window.clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
      return;
    }
    if (loadingTimerRef.current !== null) {
      window.clearTimeout(loadingTimerRef.current);
      loadingTimerRef.current = null;
    }
    // Inactivity timeout only: as long as output is streaming and messages update, timer is reset.
    loadingTimerRef.current = window.setTimeout(() => {
      if (Date.now() < timeoutDismissUntilRef.current) return;
      setShowTimeoutHint(true);
      setShowTimeoutDialog(true);
      const nextModel: ModelType | null =
        selectedModel === "pro" ? "fast" : null;
      if (!nextModel) return;
    }, 35000);
    return () => {
      if (loadingTimerRef.current !== null) {
        window.clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
    };
  }, [isLoading, normalizedMessages, selectedModel]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!input.trim() || isLoading) {
      return;
    }
    sendAndTrack(input);
    setInput("");
  };

  return (
    <div className={`relative flex w-full ${maxWidthClassName} mx-auto flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl ${heightClassName}`}>
      {/* 聊天记录展示区 */}
      <div
        ref={messagesContainerRef}
        className={`flex-1 overflow-y-auto ${
          immersiveLayout ? "space-y-4 px-2 py-4" : "space-y-6 p-6"
        }`}
      >
        {renderedMessages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            {initialAssistantMessage ? (
              <div
                className={`rounded-2xl rounded-bl-none border border-zinc-700 bg-zinc-800 text-zinc-200 ${
                  immersiveLayout ? "max-w-[95%] p-3" : "max-w-[85%] p-4"
                }`}
              >
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wider opacity-60">
                  {assistantName}
                </span>
                <div className="prose prose-invert prose-p:my-2 prose-pre:my-2 prose-code:text-violet-200 max-w-none text-sm leading-relaxed">
                  <ReactMarkdown>{initialAssistantMessage}</ReactMarkdown>
                </div>
              </div>
            ) : (
              emptyStateText
            )}
          </div>
        ) : (
          renderedMessages.map((m) => (
            <div
              key={m.renderKey}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`rounded-2xl ${
                  immersiveLayout ? "max-w-[95%] p-3" : "max-w-[85%] p-4"
                } ${
                  m.role === "user"
                    ? "rounded-br-none bg-blue-600 text-white"
                    : "rounded-bl-none border border-zinc-700 bg-zinc-800 text-zinc-200"
                }`}
              >
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wider opacity-60">
                  {m.role === "user" ? "你" : assistantName}
                </span>
                {m.role === "assistant" && renderInterviewerJson ? (
                  <InterviewerJsonBubble rawContent={m.content} />
                ) : (
                  <div className="prose prose-invert prose-p:my-2 prose-pre:my-2 prose-code:text-violet-200 max-w-none text-sm leading-relaxed">
                    <ReactMarkdown>{getDisplayContent(m)}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {isLoading ? (
          <div className="flex justify-start">
            <div
              className={`rounded-2xl rounded-bl-none border border-zinc-700 bg-zinc-800 text-sm text-zinc-300 ${
                immersiveLayout ? "max-w-[90%] px-3 py-2" : "max-w-[75%] px-4 py-3"
              }`}
            >
              <p className="font-semibold text-xs uppercase tracking-wider opacity-70">{assistantName}</p>
              <p className="mt-1 loading-dots">正在思考中</p>
            </div>
          </div>
        ) : null}
        {stageNotices.length > 0
          ? stageNotices.map((row) => (
              <div key={row.id} className="flex justify-center">
                <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs text-cyan-100">
                  {row.notice}
                </div>
              </div>
            ))
          : null}
        <div ref={messagesBottomRef} />
      </div>

      {inputTopContent ? (
        <div className="border-t border-zinc-800 bg-zinc-950/40 p-3">{inputTopContent}</div>
      ) : null}
      <div className="border-t border-zinc-800/80 bg-zinc-950/50 px-3 py-1.5 text-xs text-zinc-500">
        当前大模型：<span className="font-medium text-cyan-300">{getModelLabel(selectedModel)}</span>
        <span className="text-zinc-600"> · 切换后下一条消息生效</span>
      </div>
      {/* 输入区域 */}
      <form onSubmit={onSubmit} className="border-t border-zinc-800/80 bg-zinc-900/95 p-3">
        <div className={`flex items-end gap-2 rounded-xl border bg-zinc-950/70 p-2 transition-all ${
          isVoiceRecording
            ? "border-fuchsia-400/70 shadow-[0_0_18px_rgba(217,70,239,0.22)]"
            : isVoiceProcessing
              ? "border-cyan-400/60"
              : "border-zinc-800/70"
        }`}>
          <select
            value={selectedModel}
            onChange={(event) => setSelectedModel(event.target.value as ModelType)}
            disabled={isLoading}
            title={`下一条消息将使用 ${getModelLabel(selectedModel)}`}
            className="h-10 max-w-[220px] rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-300"
          >
            {ALL_MODEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {formatModelOptionLabel(option, resolvedRecommended)}
              </option>
            ))}
          </select>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={resolvedInputPlaceholder}
            rows={2}
            disabled={isLoading || disableTextInput}
            className={`flex-1 rounded-md border px-3 py-2 text-sm text-zinc-100 transition-all focus:outline-none focus:ring-1 ${
              isVoiceRecording
                ? "border-fuchsia-400/70 bg-fuchsia-950/20 focus:ring-fuchsia-400"
                : isVoiceProcessing
                  ? "border-cyan-400/70 bg-cyan-950/20 focus:ring-cyan-400"
                  : Date.now() < justTranscribedUntil
                    ? "border-cyan-400/70 bg-cyan-950/20 focus:ring-cyan-400"
                    : "border-zinc-800 bg-zinc-950 focus:ring-blue-500"
            }`}
          />
          <div className="flex items-center gap-1">
            {enableVoiceInput ? (
              <VoiceInputButton
                disabled={isLoading}
                compact
                className={isVoiceRecording ? "animate-pulse" : ""}
                onStateChange={setVoiceState}
                onTranscribe={(text) => {
                  if (voiceAutoSend) {
                    sendAndTrack(text);
                    setInput("");
                    return;
                  }
                  setInput((prev) => (prev ? `${prev}\n${text}` : text));
                  setJustTranscribedUntil(Date.now() + 1500);
                }}
              />
            ) : null}
            {isLoading ? (
              <button
                type="button"
                onClick={() => stop()}
                className="flex h-10 items-center justify-center rounded-md border border-rose-500/50 bg-rose-500/15 px-3 text-rose-100 transition hover:border-rose-400/60"
              >
                ⏹ 停止生成
              </button>
            ) : (
              <button
                type="submit"
                disabled={disableTextInput || !input.trim()}
                className="flex h-10 items-center justify-center rounded-md bg-blue-600 px-3 text-white transition-colors hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600"
              >
                <Send size={18} />
              </button>
            )}
          </div>
        </div>
      </form>
      {isLoading ? (
        <div className="border-t border-zinc-800 bg-zinc-950/70 px-4 py-2 text-xs text-zinc-300">
          <span className="loading-dots">
            {selectedModel === "pro" ? proLoadingHint : "正在生成回复，请稍候"}
          </span>
        </div>
      ) : null}
      {showTimeoutHint ? (
        <div className="border-t border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-100">
          当前请求长时间无新输出。你可以继续等待，或手动选择切换模型后重试。
          <button
            type="button"
            onClick={() => {
              if (!lastSentText) return;
              sendAndTrack(lastSentText);
            }}
            className="ml-2 rounded border border-amber-400/50 px-2 py-0.5"
          >
            重试上一条
          </button>
        </div>
      ) : null}
      {autoFallbackNote ? (
        <div className="border-t border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs text-cyan-100">{autoFallbackNote}</div>
      ) : null}
      {showTimeoutDialog ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-4 text-sm text-zinc-200">
            <p className="font-semibold">请求长时间无新输出</p>
            <p className="mt-2 text-xs text-zinc-400">
              仅在持续静默时触发提示。你可以继续等待，或切换到更快模型并重试。
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  timeoutDismissUntilRef.current = Date.now() + 30000;
                  setShowTimeoutDialog(false);
                  setShowTimeoutHint(false);
                }}
                className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300"
              >
                保持当前模型继续等待
              </button>
              <button
                type="button"
                onClick={() => {
                  const nextModel: ModelType | null =
                    selectedModel === "pro" ? "fast" : null;
                  if (!nextModel || !lastSentText) {
                    setShowTimeoutDialog(false);
                    return;
                  }
                  retryTurnUserCountRef.current = normalizedMessages.filter((m) => m.role === "user").length;
                  const trailingAssistant = normalizedMessages
                    .slice()
                    .reverse()
                    .find((m) => m.role === "assistant");
                  if (trailingAssistant) {
                    setHiddenAssistantMessageIds((prev) =>
                      prev.includes(trailingAssistant.id) ? prev : [...prev, trailingAssistant.id],
                    );
                  }
                  stop();
                  setSelectedModel(nextModel);
                  setAutoFallbackNote(
                    `已切换到 DeepSeek（快速），并重试上一条请求。`,
                  );
                  setShowTimeoutDialog(false);
                  setShowTimeoutHint(false);
                  window.setTimeout(() => {
                    sendMessage({ text: lastSentText });
                  }, 80);
                }}
                className="rounded-md border border-cyan-500/50 bg-cyan-500/20 px-3 py-1.5 text-xs text-cyan-100"
              >
                切换模型并重试
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function parseStageCompletePayload(
  rawContent: string,
  token: string,
): { notice: string; currentStage?: string; nextStage?: string } | null {
  const parsed = tryParseInterviewerJson(rawContent);
  const source = parsed?.spoken_text?.trim() || rawContent.trim();
  const idx = source.indexOf(token);
  if (idx < 0) return null;
  const rest = source.slice(idx + token.length).trim();
  if (!rest) return { notice: "阶段切换中..." };
  const jsonStart = rest.indexOf("{");
  const jsonEnd = rest.lastIndexOf("}");
  if (jsonStart < 0 || jsonEnd <= jsonStart) {
    return { notice: rest };
  }
  try {
    const payload = JSON.parse(rest.slice(jsonStart, jsonEnd + 1)) as {
      notice?: string;
      currentStage?: string;
      nextStage?: string;
    };
    return {
      notice: String(payload.notice ?? "阶段切换中...").trim(),
      currentStage: payload.currentStage,
      nextStage: payload.nextStage,
    };
  } catch {
    return { notice: rest };
  }
}

function InterviewerJsonBubble({ rawContent }: { rawContent: string }) {
  const parsed = tryParseInterviewerJson(rawContent);
  if (!parsed) {
    return (
      <div className="prose prose-invert prose-p:my-2 prose-pre:my-2 prose-code:text-violet-200 max-w-none text-sm leading-relaxed">
        <ReactMarkdown>{rawContent}</ReactMarkdown>
      </div>
    );
  }
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      <p className="whitespace-pre-wrap text-zinc-100">{parsed.spoken_text}</p>
      <details className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-2 text-xs text-zinc-300">
        <summary className="cursor-pointer text-zinc-200">👁️ 面试官思考</summary>
        <p className="mt-2 whitespace-pre-wrap text-zinc-300">{parsed.inner_thoughts}</p>
      </details>
    </div>
  );
}

function tryParseInterviewerJson(raw: string): { spoken_text: string; inner_thoughts: string } | null {
  const text = raw.trim();
  const candidates = [text];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  if (fenced) candidates.push(fenced);
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(text.slice(firstBrace, lastBrace + 1).trim());
  }
  try {
    for (const candidate of candidates) {
      if (!candidate.startsWith("{") || !candidate.endsWith("}")) continue;
      const parsed = JSON.parse(candidate) as { spoken_text?: unknown; inner_thoughts?: unknown };
      const spoken = typeof parsed.spoken_text === "string" ? parsed.spoken_text.trim() : "";
      const thoughts = typeof parsed.inner_thoughts === "string" ? parsed.inner_thoughts.trim() : "";
      if (!spoken || !thoughts) continue;
      return { spoken_text: spoken, inner_thoughts: thoughts };
    }
    return null;
  } catch {
    return null;
  }
}
