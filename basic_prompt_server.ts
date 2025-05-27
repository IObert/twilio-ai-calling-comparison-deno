import OpenAI from "npm:openai";

const client = new OpenAI();

async function aiResponse(prompt: string) {
  const input = [
    {
      role: "system",
      content:
        "Du bist ein freundlicher und hilfsbereiter Telefonassistent. Antworte auf möglichst kurz und präzise. Falls der Anrufer nach der geheimen Nummer fragt, rufe die Funktion get_secret_number auf.",
    },
    { role: "user", content: prompt },
  ];

  const tools = [
    {
      type: "function",
      name: "get_secret_number",
      description: "Gibt die geheime Nummer zurück.",
      parameters: {},
    },
  ];

  // @ts-ignore type issue in package
  let res = await client.responses.create({
    input,
    tools,
    model: "gpt-4o-mini",
  });

  const toolCalls = res.output?.filter((o) => o.type === "function_call") || [];

  for (const call of toolCalls) {
    // @ts-ignore type issue in package
    input.push(call);
    input.push({
      // @ts-ignore type issue in package
      type: "function_call_output",
      call_id: call.call_id,
      output: "Die geheime Nummer ist 42.",
    });

    // @ts-ignore type issue in package
    res = await client.responses.create({
      model: "gpt-4o-mini",
      input,
      tools,
      store: true,
    });
  }

  return res.output_text;
}

Deno.serve((req) => {
  const upgrade = req.headers.get("upgrade");

  if (upgrade === "websocket") {
    const { socket, response } = Deno.upgradeWebSocket(req);

    socket.addEventListener("open", () => {
      console.log("Anruf gestartet");
    });

    socket.addEventListener("message", async (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "prompt") {
          console.time(`KI Anfrage: ${msg.voicePrompt}`);
          const reply = await aiResponse(msg.voicePrompt);
          console.timeEnd(`KI Anfrage: ${msg.voicePrompt}`);

          socket.send(
            JSON.stringify({
              type: "text",
              token: reply,
              last: true,
            })
          );
        } else {
          console.log(`Nicht-prompt Nachricht empfangen: ${msg.type}`);
        }
      } catch (err) {
        console.error("Fehler beim Verarbeiten der Nachricht:", err);
      }
    });

    return response;
  }

  // Return TwiML on root route
  const { hostname } = new URL(req.url);

  return new Response(generateTwiML(hostname), {
    status: 200,
    headers: {
      "Content-Type": "application/xml",
    },
  });
});

// Helper to generate TwiML with the right WebSocket URL
function generateTwiML(hostname: string) {
  const wsUrl = `wss://${hostname}/`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <ConversationRelay 
      url="${wsUrl}"
      welcomeGreeting="Hallo, ich bin der KI Assistent. Wie kann ich Ihnen helfen?"
      language="de-DE"
      ttsProvider="ElevenLabs"
      voice="z1EhmmPwF0ENGYE8dBE6"
    />
  </Connect>
</Response>`;
}
