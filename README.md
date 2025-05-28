# 📞 Twilio AI Calling Comparison (Deno)

This project compares **two different approaches to building AI-powered calling agents** using Twilio Voice as the communication layer and WebSockets to interact with OpenAI.

---

## 🧠 What This Compares

We explore two methods to connect a phone call to an LLM:

### 1. `basic_prompt_server.ts` — Prompt-Driven Agent

- Uses **Twilio Conversation Relay** for STT (speech-to-text) and TTS (text-to-speech)
- Transcribes user speech and sends it as a prompt to **OpenAI's GPT-4o-mini**
- Sends the assistant's response back to Twilio as text, which is converted to audio
- Simple and effective with very low latency due to Twilio-managed media

### 2. `realtime_audio_server.ts` — Realtime Audio Streaming Agent

- Streams raw audio directly from Twilio to **OpenAI's Realtime API**
- Bypasses Twilio's STT/TTS and uses OpenAI's built-in speech capabilities (bidirectional)
- Allows near-instant spoken responses and tool-calling using WebSocket streaming

---

## 🏗️ Architecture Overview

Both servers:

- Use **Deno** with native WebSockets
- Accept incoming WebSocket connections initiated via TwiML
- Use a tool called `get_secret_number` to demonstrate function calling
  (which always returns `The secret number is 42`)
- Have a web server that exposes a **TwiML endpoint** to handle inbound calls and link them to the correct WebSocket server.

---

## 🚀 Getting Started

### 1. Prerequisites

- [Deno](https://deno.land) installed
- A Twilio account (with a voice-enabled phone number)
- An OpenAI API Key with access to:
  - `gpt-4o-mini` (for prompt-based mode)
  - `gpt-4o-realtime-preview-2024-12-17` (for realtime streaming)

### 2. Environment Setup

Set the environment variable in the `.env` file

```bash
OPENAI_API_KEY=your-openai-api-key
```

### 3. Run Either Server
#### Prompt-based (Conversations Relay):

```bash
deno run --allow-net --allow-env --watch basic_prompt_server.ts
```
#### Realtime Streaming:

```bash
deno run --allow-net --allow-env --watch realtime_audio_server.ts
```


### 4. Expose Your Server
To connect Twilio with your local WebSocket server, expose port 8000 to the internet using ngrok:

```bash
ngrok http 8000
```
### 5. Connect Twilio to Your Server
Once ngrok is running, configure your Twilio phone number to use the root route / of your server as the Voice Webhook (HTTP GET or POST). This endpoint will serve TwiML that starts a Conversation Relay WebSocket.

📖 Resources:

[Voice Webhooks – Twilio Docs](https://www.twilio.com/docs/usage/webhooks/voice-webhooks)

[How to Configure a Twilio Number for Voice](https://help.twilio.com/articles/223135027-Configure-a-Twilio-Phone-Number-to-Receive-and-Respond-to-Voice-Calls)