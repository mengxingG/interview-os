export async function POST(req: Request) {
  try {
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "Missing DASHSCOPE_API_KEY." }, { status: 500 });
    }
    const { text, voice = "Cherry" } = (await req.json()) as { text?: string; voice?: string };
    if (!text?.trim()) {
      return Response.json({ error: "Missing text." }, { status: 400 });
    }

    const payload = {
      model: "qwen3-tts-flash",
      input: {
        text: text.slice(0, 1200),
        voice,
        language_type: "Chinese",
      },
    };

    const upstream = await fetch("https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = (await upstream.json()) as Record<string, unknown>;
    if (!upstream.ok) {
      console.error("[TTS][DashScope] Upstream error:", JSON.stringify(data));
      return Response.json(
        {
          error: "DashScope TTS failed.",
          detail:
            typeof data.message === "string"
              ? data.message
              : typeof (data.error as { message?: unknown } | undefined)?.message === "string"
                ? String((data.error as { message?: unknown }).message)
                : undefined,
        },
        { status: upstream.status },
      );
    }

    const output = (data.output ?? {}) as Record<string, unknown>;
    const audioObj = (output.audio ?? {}) as Record<string, unknown>;
    const audioUrl = typeof audioObj.url === "string" ? audioObj.url : "";
    const audioBase64Inline =
      (typeof audioObj.data === "string" ? audioObj.data : "") ||
      (typeof audioObj.audio_data === "string" ? audioObj.audio_data : "");
    let audioBase64 = audioBase64Inline;

    if (!audioBase64 && audioUrl) {
      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) {
        return Response.json({ error: "Failed to download TTS audio file." }, { status: 502 });
      }
      const audioBuffer = await audioResponse.arrayBuffer();
      audioBase64 = Buffer.from(audioBuffer).toString("base64");
    }

    if (!audioBase64) {
      console.error("[TTS][DashScope] Empty audio payload:", JSON.stringify(data));
      return Response.json({ error: "Empty TTS audio response." }, { status: 502 });
    }
    return Response.json({ audioBase64, mimeType: "audio/mpeg" });
  } catch (error) {
    console.error("[TTS][DashScope] Route error:", error);
    return Response.json(
      { error: "Failed to synthesize speech.", detail: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}

