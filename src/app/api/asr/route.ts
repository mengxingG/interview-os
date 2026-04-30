export async function POST(req: Request) {
  try {
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "Missing DASHSCOPE_API_KEY." }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof Blob)) {
      return Response.json({ error: "Missing audio file in formData key: file." }, { status: 400 });
    }

    const mime = "type" in file && typeof file.type === "string" ? file.type : "";
    const inferredFormat = mime.includes("webm")
      ? "webm"
      : mime.includes("wav")
        ? "wav"
        : mime.includes("mp3")
          ? "mp3"
          : "webm";
    const buffer = await file.arrayBuffer();
    const audioBase64 = Buffer.from(buffer).toString("base64");
    const dataUri = `data:audio/${inferredFormat};base64,${audioBase64}`;

    const requestPayload = {
      model: "qwen3-asr-flash",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "input_audio",
              input_audio: {
                data: dataUri,
              },
            },
          ],
        },
      ],
    };

    const upstream = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
    });

    const payload = (await upstream.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
      error?: {
        code?: string;
        message?: string;
      };
      message?: string;
    };

    if (!upstream.ok) {
      console.error("[ASR][DashScope] Upstream error:", JSON.stringify(payload));
      return Response.json(
        { error: payload?.error?.message || payload?.message || "DashScope transcription failed." },
        { status: upstream.status },
      );
    }

    const text = payload?.choices?.[0]?.message?.content || "";
    if (!text.trim()) {
      console.error("[ASR][DashScope] Empty text response:", JSON.stringify(payload));
      return Response.json({ error: "DashScope returned empty transcription." }, { status: 502 });
    }

    return Response.json({ text });
  } catch (error) {
    console.error("[ASR][DashScope] Route error:", error);
    return Response.json(
      { error: "Failed to transcribe audio.", detail: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}

