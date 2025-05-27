// realtime_pipe_server.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// Helper to generate TwiML with the right WebSocket URL
function generateTwiML(hostname: string) {
  const wsUrl = `wss://${hostname}/`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Please hold while we connect the media stream</Say>
  <Connect>
    <Stream url="${wsUrl}" />
  </Connect>
  <Pause length="20"/>
</Response>`;
}

// Start HTTP/WebSocket server
serve((req) => {
  // Root HTTP route returns dynamic TwiML
  if (req.method === "POST" && req.headers.get("upgrade") !== "websocket") {
    const host = req.headers.get("host") ?? "localhost";
    const twiml = generateTwiML(host);
    return new Response(twiml, {
      headers: { "Content-Type": "application/xml" },
    });
  }
  const { socket: twilioSocket, response } = Deno.upgradeWebSocket(req);

  console.log("WebSocket connection established");

  let streamSid: string | null = null;

  // Connect to OpenAI Realtime API WebSocket
  const openaiSocket = new WebSocket(
    `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`,
    [
      "realtime",
      `openai-insecure-api-key.${Deno.env.get("OPENAI_API_KEY")}`,
      "openai-beta.realtime-v1",
    ]
  );

  openaiSocket.addEventListener("open", () => {
    console.log("Connected to OpenAI WebSocket");

    openaiSocket.send(
      JSON.stringify({
        type: "session.update",
        session: {
          instructions:
            "You are a helpful phone assistant. Keep your answers short and speak slowly.",
          tools: [
            {
              type: "function",
              name: "get_secret_number",
              description: "Returns the secret number.",
              parameters: {},
            },
          ],
          tool_choice: "auto",
          turn_detection: { type: "server_vad" },
          input_audio_format: "g711_ulaw",
          output_audio_format: "g711_ulaw",
          voice: "ash",
          modalities: ["text", "audio"],
          temperature: 0.9,
        },
      })
    );

    // Optional: kick off with a test message
    openaiSocket.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "How are you doing?" }],
        },
      })
    );

    openaiSocket.send(
      JSON.stringify({
        type: "response.create",
      })
    );
  });

  openaiSocket.addEventListener("message", (event) => {
    try {
      const msg = JSON.parse(event.data);
      switch (msg.type) {
        case "conversation.item.created":
          if (msg.item.type === "function_call") {
            const { name, call_id } = msg.item;
            console.log(`Function call: ${name}, call_id: ${call_id}`);

            openaiSocket.send(
              JSON.stringify({
                type: "conversation.item.create",
                item: {
                  type: "function_call_output",
                  call_id,
                  output: "The secret number is 42.",
                },
              })
            );

            openaiSocket.send(
              JSON.stringify({
                type: "response.create",
              })
            );
          }
          break;

        case "response.audio.delta":
          if (msg.delta) {
            twilioSocket.send(
              JSON.stringify({
                event: "media",
                streamSid,
                media: { payload: msg.delta },
              })
            );
          }
          break;

        case "conversation.item.completed":
          console.log("OpenAI response completed");
          break;

        default:
          // console.log("Unhandled OpenAI message:", msg.type);
          break;
      }
    } catch (err) {
      console.error("Error handling OpenAI message:", err);
    }
  });

  openaiSocket.addEventListener("close", () => {
    console.log("OpenAI WebSocket closed");
  });

  twilioSocket.addEventListener("message", (event) => {
    try {
      const msg = JSON.parse(event.data);
      switch (msg.event) {
        case "start":
          streamSid = msg.start.streamSid;
          console.log("Twilio stream started:", streamSid);
          break;

        case "media":
          if (openaiSocket.readyState === WebSocket.OPEN) {
            openaiSocket.send(
              JSON.stringify({
                type: "input_audio_buffer.append",
                audio: msg.media.payload,
              })
            );
          }
          break;

        default:
          console.log("Unhandled Twilio event:", msg.event);
      }
    } catch (err) {
      console.error("Error handling Twilio message:", err);
    }
  });

  twilioSocket.addEventListener("close", () => {
    console.log("Twilio client disconnected");
    if (openaiSocket.readyState === WebSocket.OPEN) {
      openaiSocket.close();
    }
  });

  return response;
});
