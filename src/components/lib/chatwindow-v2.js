"use client";
import { useState, useRef, useEffect } from "react";

const STAGES = ["New Lead", "Ongoing Pipeline", "Booked Vehicle", "Post-Purchase / Service"];
const ACCENT = "#E0622B";

export default function ChatWindow() {
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! I'm your ABC Motors assistant. Looking for pricing, a test drive, or checking on an existing order?" },
  ]);
  const [stage, setStage] = useState(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const startNewChat = () => {
    setMessages([{ role: "assistant", content: "Hi! I'm your ABC Motors assistant. Looking for pricing, a test drive, or checking on an existing order?" }]);
    setStage(null);
    setSessionId(crypto.randomUUID());
  };

  const sendMessage = async () => {
    const trimmed = draft.trim();
    if (!trimmed || loading) return;

    const updatedMessages = [...messages, { role: "user", content: trimmed }];
    setMessages(updatedMessages);
    setDraft("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages, sessionId }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.content }]);
      if (data.stage) setStage(data.stage);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") sendMessage();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", fontFamily: "system-ui, sans-serif", background: "#F6F5F2" }}>
      {/* Header */}
      <div style={{ flex: "0 0 64px", background: "#1B1E24", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px" }}>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
          <span style={{ fontWeight: 700, fontSize: 18, color: "#FFFFFF" }}>ABC MOTORS</span>
          <span style={{ fontSize: 11, color: "#9B968C" }}>AI Assistant</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#262A32", borderRadius: 999, padding: "6px 12px" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4CAF6D" }} />
            <span style={{ fontSize: 12, color: "#D8D3C8" }}>Zoho CRM</span>
          </div>
          <button onClick={startNewChat} style={{ background: "transparent", border: "1px solid #3A3E45", color: "#D8D3C8", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>
            New Chat
          </button>
        </div>
      </div>

      {/* Stage stepper */}
      <div style={{ flex: "0 0 52px", background: "#FFFFFF", borderBottom: "1px solid #E5E1DA", display: "flex", alignItems: "center", gap: 8, padding: "0 24px", overflowX: "auto" }}>
        {STAGES.map((label) => {
          const active = stage === label;
          return (
            <div key={label} style={{ padding: "6px 12px", borderRadius: 999, background: active ? ACCENT : "#EFEDE7", whiteSpace: "nowrap" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: active ? "#FFFFFF" : "#6B6459" }}>{label}</span>
            </div>
          );
        })}
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: "1 1 auto", overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: 480,
              background: m.role === "user" ? "#1B1E24" : "#FFFFFF",
              color: m.role === "user" ? "#FFFFFF" : "#22221F",
              border: m.role === "user" ? "none" : "1px solid #E5E1DA",
              borderRadius: 14,
              padding: "10px 14px",
              fontSize: 14,
              lineHeight: 1.5,
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ background: "#FCEFE7", border: "1px solid #F0D3BE", borderRadius: 999, padding: "6px 14px" }}>
              <span style={{ fontSize: 12, color: "#B4501E" }}>⚙ Thinking…</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ flex: "0 0 68px", background: "#FFFFFF", borderTop: "1px solid #E5E1DA", display: "flex", alignItems: "center", gap: 10, padding: "0 24px" }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message…"
          style={{ flex: "1 1 auto", height: 42, borderRadius: 10, border: "1px solid #E5E1DA", padding: "0 14px", fontSize: 14, outline: "none", color: "#000000", background: "#FFFFFF" }}
        />
        <button onClick={sendMessage} disabled={loading} style={{ height: 42, padding: "0 20px", borderRadius: 10, border: "none", background: ACCENT, color: "#FFFFFF", fontWeight: 600, fontSize: 14, cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1 }}>
          Send
        </button>
      </div>
    </div>
  );
}