import OpenAI from "npm:openai";

const client = new OpenAI();

async function aiResponse(prompt: string) {
  const input = [
    {
      role: "system",
      content:
        "You are a helpful phone assistant. Keep your answers short and precise. Users may ask for a secret number—provide it if asked. Do not return formatted text.",
    },
    { role: "user", content: prompt },
  ];

  const tools = [
    {
      type: "function",
      name: "get_secret_number",
      description: "Returns the secret number.",
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
      output: "The secret number is 42.",
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
      console.log("Call received via WebSocket");
    });

    socket.addEventListener("message", async (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "prompt") {
          console.time(`Request: ${msg.voicePrompt}`);
          const reply = await aiResponse(msg.voicePrompt);
          console.timeEnd(`Request: ${msg.voicePrompt}`);

          socket.send(
            JSON.stringify({
              type: "text",
              token: reply,
              last: true,
            })
          );
        } else {
          console.log(`Received non-prompt message of type: ${msg.type}`);
        }
      } catch (err) {
        console.error("Error parsing incoming message:", err);
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
      welcomeGreeting="Hi, how can I help you?" 
      language="en-US"
      ttsProvider="ElevenLabs"
      voice="z1EhmmPwF0ENGYE8dBE6"
    />
  </Connect>
</Response>`;
}
