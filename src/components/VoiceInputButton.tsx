"use client";

import { useEffect, useRef, useState } from "react";

type VoiceInputButtonProps = {
  onTranscribe: (text: string, actualDuration?: number) => void;
  onStateChange?: (state: VoiceState) => void;
  disabled?: boolean;
  className?: string;
  maxDuration?: number;
  compact?: boolean;
};

type VoiceState = "idle" | "recording" | "processing";

export default function VoiceInputButton({
  onTranscribe,
  onStateChange,
  disabled = false,
  className = "",
  maxDuration = 120,
  compact = false,
}: VoiceInputButtonProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [error, setError] = useState("");
  const [hint, setHint] = useState("点击开始录音，或按住说话。");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const pressToTalkRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);

  useEffect(() => {
    onStateChange?.(voiceState);
  }, [onStateChange, voiceState]);

  useEffect(() => {
    return () => {
      cleanupMedia();
      clearTimer();
    };
  }, []);

  function cleanupMedia() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }

  function clearTimer() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function resetTimer() {
    clearTimer();
    elapsedRef.current = 0;
    setElapsedSeconds(0);
  }

  async function requestRecorder() {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      throw new Error("当前浏览器不支持录音功能。");
    }
    if (typeof MediaRecorder === "undefined") {
      throw new Error("当前浏览器不支持 MediaRecorder。");
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
      },
    });
    streamRef.current = stream;
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    } catch {
      recorder = new MediaRecorder(stream);
    }
    mediaRecorderRef.current = recorder;
    return recorder;
  }

  async function startRecording() {
    if (disabled || voiceState !== "idle") return;
    setError("");
    setHint("麦克风初始化中...");
    try {
      const recorder = await requestRecorder();
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.start();
      elapsedRef.current = 0;
      setElapsedSeconds(0);
      clearTimer();
      timerRef.current = window.setInterval(() => {
        elapsedRef.current += 1;
        setElapsedSeconds(elapsedRef.current);
      }, 1000);
      setVoiceState("recording");
      setHint("录音中... 再次点击即可停止并识别。");
    } catch (e) {
      const message = e instanceof Error ? e.message : "无法访问麦克风。";
      setError(message);
      setHint("请检查麦克风权限后重试。");
      cleanupMedia();
      resetTimer();
      setVoiceState("idle");
    }
  }

  async function stopRecordingAndTranscribe() {
    if (voiceState !== "recording" || !mediaRecorderRef.current) return;
    setVoiceState("processing");
    clearTimer();
    setHint("正在识别语音，请稍候...");
    setError("");
    const recorder = mediaRecorderRef.current;

    const blob = await new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        try {
          const merged = new Blob(chunksRef.current, { type: "audio/webm" });
          resolve(merged);
        } catch (error) {
          reject(error);
        }
      };
      recorder.onerror = () => reject(new Error("录音失败，请重试。"));
      recorder.stop();
    });

    try {
      const formData = new FormData();
      formData.append("file", blob, "voice-input.webm");
      const response = await fetch("/api/asr", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as { text?: string; error?: string; detail?: string };
      if (!response.ok) {
        throw new Error(payload.error || payload.detail || "语音识别失败。");
      }
      const text = String(payload.text ?? "").trim();
      if (!text) {
        throw new Error("未识别到语音内容，请再说一遍。");
      }
      onTranscribe(text, elapsedRef.current);
      setHint("识别完成，已回填文本。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "识别失败，请稍后重试。");
      setHint("识别失败。");
    } finally {
      cleanupMedia();
      resetTimer();
      setVoiceState("idle");
      pressToTalkRef.current = false;
    }
  }

  function onMainButtonClick() {
    if (voiceState === "idle") {
      void startRecording();
      return;
    }
    if (voiceState === "recording") {
      void stopRecordingAndTranscribe();
    }
  }

  function onPressStart() {
    if (voiceState !== "idle" || disabled) return;
    pressToTalkRef.current = true;
    void startRecording();
  }

  function onPressEnd() {
    if (!pressToTalkRef.current) return;
    if (voiceState === "recording") {
      void stopRecordingAndTranscribe();
    }
    pressToTalkRef.current = false;
  }

  const isRecording = voiceState === "recording";
  const isProcessing = voiceState === "processing";
  const remainingSeconds = maxDuration - elapsedSeconds;
  const timerClassName =
    remainingSeconds < 0
      ? "text-red-500 animate-pulse"
      : remainingSeconds <= 30
        ? "text-orange-400"
        : "text-cyan-200";

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {(isRecording || isProcessing) ? (
          <div className="flex items-center gap-2">
            <div className="flex h-4 items-end gap-1">
              {[0, 1, 2, 3, 4].map((bar) => (
                <span
                  key={bar}
                  className={`w-1 rounded-sm ${isRecording ? "animate-pulse bg-fuchsia-300/90" : "animate-pulse bg-cyan-300/80"}`}
                  style={{
                    height: isRecording ? `${8 + (bar % 3) * 4}px` : `${6 + (bar % 2) * 5}px`,
                    animationDelay: `${bar * 90}ms`,
                  }}
                />
              ))}
            </div>
            <span className={`font-mono text-xs ${timerClassName}`}>
              {formatDuration(elapsedSeconds)} / {formatDuration(maxDuration)}
            </span>
          </div>
        ) : null}
        <button
          type="button"
          onClick={onMainButtonClick}
          onMouseDown={onPressStart}
          onMouseUp={onPressEnd}
          onMouseLeave={onPressEnd}
          onTouchStart={onPressStart}
          onTouchEnd={onPressEnd}
          disabled={disabled || isProcessing}
          title={
            error
              ? error
              : isRecording
                ? "录音中，点击停止"
                : isProcessing
                  ? "语音识别中..."
                  : "语音输入"
          }
          className={`relative inline-flex h-10 items-center justify-center rounded-lg border px-3 text-sm font-medium transition ${
            isRecording
              ? "border-fuchsia-400/70 bg-fuchsia-500/20 text-fuchsia-100 shadow-[0_0_14px_rgba(217,70,239,0.35)]"
              : "border-cyan-400/50 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25"
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {isRecording ? "停止" : isProcessing ? "识别中" : "🎙"}
          {isRecording ? <span className="absolute -right-1 -top-1 h-2 w-2 animate-ping rounded-full bg-fuchsia-300" /> : null}
        </button>
      </div>
    );
  }

  return (
    <div className={`neon-card rounded-2xl border border-cyan-500/20 bg-zinc-950/80 p-3 ${className}`}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMainButtonClick}
          onMouseDown={onPressStart}
          onMouseUp={onPressEnd}
          onMouseLeave={onPressEnd}
          onTouchStart={onPressStart}
          onTouchEnd={onPressEnd}
          disabled={disabled || isProcessing}
          className={`relative inline-flex h-11 items-center justify-center rounded-xl border px-4 text-sm font-medium transition ${
            isRecording
              ? "border-fuchsia-400/70 bg-fuchsia-500/20 text-fuchsia-100 shadow-[0_0_18px_rgba(217,70,239,0.45)]"
              : "border-cyan-400/50 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25"
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {isRecording ? "停止录音" : isProcessing ? "识别中..." : "语音输入"}
          {isRecording ? <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-ping rounded-full bg-fuchsia-300" /> : null}
        </button>

        <div className="min-h-8 flex-1 text-xs text-zinc-300">
          <p className={`mb-1 font-mono text-xs ${timerClassName}`}>
            {formatDuration(elapsedSeconds)} / {formatDuration(maxDuration)}
          </p>
          <p>{hint}</p>
          {error ? <p className="mt-1 text-rose-300">{error}</p> : null}
        </div>
      </div>

      <div className="mt-3 flex h-5 items-end gap-1">
        {[0, 1, 2, 3, 4].map((bar) => (
          <span
            key={bar}
            className={`w-1.5 rounded-sm transition-all ${
              isRecording ? "animate-pulse bg-fuchsia-300/90" : isProcessing ? "animate-pulse bg-cyan-300/80" : "bg-zinc-700"
            }`}
            style={{
              height: isRecording ? `${10 + (bar % 3) * 4}px` : isProcessing ? `${8 + (bar % 2) * 5}px` : "6px",
              animationDelay: `${bar * 100}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function formatDuration(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

