"use client";

import React, { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  X,
  Send,
  Mic,
  MicOff,
  Volume2,
  Square,
  Sparkles,
  Paperclip,
  Check,
  AlertTriangle,
  History,
  Trash2,
  Plus,
  Copy,
  ChevronDown,
  ChevronUp,
  Cpu,
  BookOpen,
  RefreshCw,
  Maximize2,
  Minimize2
} from "lucide-react";
import { api, API, fileToBase64 } from "@/lib/api";
import { useApp } from "@/lib/AppContext";
import { t } from "@/lib/i18n";
import { toast } from "sonner";
import {
  speakText,
  stopAllPlayback,
  startSpeechRecognition,
  isSpeechRecognitionSupported,
} from "@/lib/voice";

interface ToolCall {
  tool: string;
  result?: any;
  status?: string;
  details?: any;
}

interface Citation {
  title: string;
  source: string;
}

interface ActionConfirmation {
  action_token: string;
  description: string;
  risk_level: string;
  expires_in_seconds?: number;
  prompt_for_user?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  time: string;
  toolCalls?: ToolCall[];
  citations?: Citation[];
  confirmationRequired?: ActionConfirmation | null;
  confirmedStatus?: "confirmed" | "cancelled" | null;
  attachmentPreview?: string;
}

interface ConversationItem {
  id: string;
  title: string;
  updated_at?: string;
}

export default function AIAssistantWidget() {
  const { lang, activeFarm, farms } = useApp();
  const pathname = usePathname();
  const currentFarm = farms?.find((f) => f.id === activeFarm);

  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "history">("chat");

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "initial-welcome",
      role: "assistant",
      content:
        lang === "hi"
          ? "नमस्ते! मैं आपकी एग्रीनेक्स AI कृषि सहायक हूँ। मैं आपके खेत, मौसम, सिंचाई, मंडी भाव और फसलों की देखभाल में मदद कर सकती हूँ। आज मैं आपकी क्या सहायता करूँ?"
          : lang === "kn"
          ? "ನಮಸ್ಕಾರ! ನಾನು ನಿಮ್ಮ ಅಗ್ರಿನೆಕ್ಸ್ AI ಕೃಷಿ ಸಂಗಾತಿ. ನಿಮ್ಮ ಜಮೀನು, ಹವಾಮಾನ, ನೀರಾವರಿ ಅಥವಾ ಮಾರುಕಟ್ಟೆ ಬೆಲೆಗಳ ಬಗ್ಗೆ ಯಾವುದೇ ಪ್ರಶ್ನೆ ಕೇಳಿ."
          : "Hello! I am AGRiNEX, your AI Agricultural Companion. I can inspect your live farm telemetry, weather, APMC mandi rates, and precision irrigation. How can I assist your farm today?",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Attachment state
  const [attachment, setAttachment] = useState<{ base64: string; mime: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice state
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const recognitionRef = useRef<{ stop: () => void; abort: () => void } | null>(null);

  // Confirming action state
  const [confirmingToken, setConfirmingToken] = useState<string | null>(null);

  // Details accordion state
  const [expandedToolMsgId, setExpandedToolMsgId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, isLoading, statusMessage]);

  // Audio cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllPlayback();
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  // Fetch conversations history
  const loadConversations = async () => {
    try {
      const res = await api.get(`/ai/conversations`, {
        params: { farm_id: activeFarm || undefined },
      });
      if (Array.isArray(res.data)) {
        setConversations(res.data);
      }
    } catch (e) {
      // Non-critical background fetch
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === "history") {
      loadConversations();
    }
  }, [isOpen, activeTab]);

  // Switch to a previous conversation
  const selectConversation = async (convId: string) => {
    try {
      setIsLoading(true);
      const res = await api.get(`/ai/conversations/${convId}`);
      if (res.data) {
        setConversationId(res.data.id);
        const mapped: Message[] = (res.data.messages || []).map((m: any) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          time: new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          toolCalls: m.tool_calls || undefined,
          citations: m.metadata_json?.citations || undefined,
          confirmationRequired: m.metadata_json?.confirmation_required || undefined,
        }));
        if (mapped.length > 0) {
          setMessages(mapped);
        }
        setActiveTab("chat");
      }
    } catch (e) {
      toast.error("Failed to load conversation history");
    } finally {
      setIsLoading(false);
    }
  };

  // Start new chat thread
  const startNewChat = () => {
    setConversationId(null);
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: "assistant",
        content:
          lang === "hi"
            ? "नमस्ते! नया सत्र शुरू हो गया है। आज आपके खेत में क्या काम है?"
            : lang === "kn"
            ? "ನಮಸ್ಕಾರ! ಹೊಸ ಸಂವಾದ ಪ್ರಾರಂಭವಾಗಿದೆ. ಇಂದು ನಿಮ್ಮ ಜಮೀನಿಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?"
            : "Hello! Started a fresh conversation. Ask me anything about your crops, live soil moisture, or weather.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    setActiveTab("chat");
  };

  // Delete a conversation thread
  const deleteConv = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await api.delete(`/ai/conversations/${id}`);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (conversationId === id) {
        startNewChat();
      }
      toast.success("Conversation deleted");
    } catch (e) {
      toast.error("Could not delete conversation");
    }
  };

  // Handle file attachment
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/") && !file.name.endsWith(".pdf") && !file.name.endsWith(".txt")) {
      toast.error("Please upload an image specimen (JPEG/PNG) or document");
      return;
    }

    try {
      const b64Data = await fileToBase64(file);
      setAttachment({
        base64: b64Data.base64,
        mime: b64Data.mime,
        name: file.name,
      });
      toast.success(`Attached "${file.name}"`);
    } catch (err) {
      toast.error("Failed to process file");
    }
  };

  // Voice Speech-To-Text toggle
  const toggleVoiceInput = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      toast.error("Voice input is not supported in this browser");
      return;
    }

    setIsListening(true);
    const recognition = startSpeechRecognition({
      lang: lang || "en",
      onInterim: (transcript: string) => {
        setInput(transcript);
      },
      onFinal: (finalText: string) => {
        setInput(finalText);
        setIsListening(false);
        if (finalText.trim()) {
          handleSend(finalText.trim());
        }
      },
      onError: (err: any) => {
        setIsListening(false);
        const errMsg = "message" in err ? err.message : String(err);
        if (errMsg && !errMsg.includes("no-speech")) {
          toast.error(`Voice error: ${errMsg}`);
        }
      },
      onEnd: () => {
        setIsListening(false);
      },
    });

    recognitionRef.current = recognition;
  };

  // Voice playback toggle for a message
  const handleSpeak = (text: string) => {
    if (isSpeaking) {
      stopAllPlayback();
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    speakText({
      text,
      language: lang,
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  // Action Confirmation handler
  const handleConfirmAction = async (msgId: string, actionToken: string, confirmed: boolean) => {
    setConfirmingToken(actionToken);
    try {
      const res = await api.post(`/ai/action/confirm`, {
        action_token: actionToken,
        confirmed,
      });

      const resultMsg = res.data?.message || (confirmed ? "Action completed" : "Action cancelled");

      // Update message in place
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                confirmedStatus: confirmed ? "confirmed" : "cancelled",
                content: `${m.content}\n\n**${confirmed ? "✅ Confirmed & Executed" : "❌ Cancelled by User"}:** ${resultMsg}`,
              }
            : m
        )
      );

      if (confirmed) {
        toast.success(resultMsg);
      } else {
        toast.info(resultMsg);
      }
    } catch (e: any) {
      toast.error(e.response?.data?.detail || "Action confirmation failed or expired");
    } finally {
      setConfirmingToken(null);
    }
  };

  // Copy message text
  const copyText = (txt: string) => {
    navigator.clipboard.writeText(txt);
    toast.success("Copied to clipboard");
  };

  // Send message using SSE Streaming or REST
  const handleSend = async (customText?: string) => {
    const textToSend = customText || input;
    if (!textToSend.trim() || isLoading) return;

    stopAllPlayback();
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    const userMsg = textToSend.trim();
    setInput("");
    const userTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const currentAttachment = attachment;
    setAttachment(null);

    const userMessageObj: Message = {
      id: `usr-${Date.now()}`,
      role: "user",
      content: userMsg,
      time: userTime,
      attachmentPreview: currentAttachment ? currentAttachment.name : undefined,
    };

    setMessages((prev) => [...prev, userMessageObj]);
    setIsLoading(true);
    setStatusMessage("Connecting to AGRiNEX AI...");

    // Create a placeholder assistant message for streaming
    const assistantMsgId = `asst-${Date.now()}`;
    const assistantPlaceholder: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      toolCalls: [],
      citations: [],
    };

    setMessages((prev) => [...prev, assistantPlaceholder]);

    try {
      const pageContext = {
        page_name: pathname || "/app",
        active_farm_name: currentFarm?.name || "Namfarm",
      };

      // Try Streaming Endpoint via fetch
      const token = typeof window !== "undefined" ? localStorage.getItem("agrinex_token") : null;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${API}/ai/chat/stream`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: userMsg,
          conversation_id: conversationId,
          farm_id: activeFarm || "demo-farm",
          language: lang,
          page_context: pageContext,
          attachment: currentAttachment ? { base64: currentAttachment.base64, mime_type: currentAttachment.mime } : undefined,
          voice_mode: false,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Streaming connection failed, falling back to standard endpoint");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let streamBuffer = "";
      let accumulatedText = "";
      let accumulatedTools: ToolCall[] = [];
      let accumulatedCitations: Citation[] = [];
      let pendingConfirmation: ActionConfirmation | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        streamBuffer += decoder.decode(value, { stream: true });
        const events = streamBuffer.split("\n\n");
        streamBuffer = events.pop() || "";

        for (const rawEvent of events) {
          if (!rawEvent.trim()) continue;
          const lines = rawEvent.split("\n");
          let eventType = "message";
          let dataStr = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.replace("event: ", "").trim();
            } else if (line.startsWith("data: ")) {
              dataStr = line.replace("data: ", "").trim();
            }
          }

          if (!dataStr) continue;

          try {
            const dataObj = JSON.parse(dataStr);

            if (eventType === "init" && dataObj.conversation_id) {
              setConversationId(dataObj.conversation_id);
            } else if (eventType === "status" && dataObj.label) {
              setStatusMessage(dataObj.label);
            } else if (eventType === "tool_call") {
              accumulatedTools.push({ tool: dataObj.tool, status: "executing" });
            } else if (eventType === "tool_result") {
              accumulatedTools = accumulatedTools.map((t) =>
                t.tool === dataObj.tool ? { ...t, status: "completed", result: dataObj.result } : t
              );
            } else if (eventType === "confirmation_required") {
              pendingConfirmation = {
                action_token: dataObj.action_token,
                description: dataObj.description,
                risk_level: dataObj.risk_level,
                expires_in_seconds: dataObj.expires_in_seconds,
                prompt_for_user: dataObj.prompt_for_user,
              };
            } else if (eventType === "delta" && dataObj.chunk) {
              accumulatedText += dataObj.chunk;
              setStatusMessage(null);

              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        content: accumulatedText,
                        toolCalls: accumulatedTools.length > 0 ? accumulatedTools : undefined,
                        confirmationRequired: pendingConfirmation,
                      }
                    : m
                )
              );
            } else if (eventType === "done") {
              if (dataObj.citations) {
                accumulatedCitations = dataObj.citations;
              }
              if (dataObj.tool_calls) {
                accumulatedTools = dataObj.tool_calls;
              }
            }
          } catch (jsonErr) {
            // Non-JSON SSE event ignored
          }
        }
      }

      // Finalize message object
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                content: accumulatedText || "Task complete.",
                toolCalls: accumulatedTools.length > 0 ? accumulatedTools : undefined,
                citations: accumulatedCitations.length > 0 ? accumulatedCitations : undefined,
                confirmationRequired: pendingConfirmation,
              }
            : m
        )
      );

      // Auto speech output if requested
      if (autoSpeak && accumulatedText) {
        setTimeout(() => handleSpeak(accumulatedText), 200);
      }
    } catch (streamErr) {
      console.warn("SSE streaming fallback:", streamErr);

      // Fallback: standard REST call
      try {
        const res = await api.post(`/ai/chat`, {
          message: userMsg,
          conversation_id: conversationId,
          farm_id: activeFarm || "demo-farm",
          language: lang,
          page_context: { page_name: pathname || "/app" },
          attachment: currentAttachment ? { base64: currentAttachment.base64, mime_type: currentAttachment.mime } : undefined,
        });

        if (res.data?.conversation_id) {
          setConversationId(res.data.conversation_id);
        }

        const reply = res.data?.reply || res.data?.answer || "No response received";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: reply,
                  toolCalls: res.data?.tool_calls || undefined,
                  citations: res.data?.citations || undefined,
                  confirmationRequired: res.data?.confirmation_required || undefined,
                }
              : m
          )
        );

        if (autoSpeak && reply) {
          setTimeout(() => handleSpeak(reply), 200);
        }
      } catch (restErr) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: "Sorry, I could not complete this request. Please check your connection and try again.",
                }
              : m
          )
        );
        toast.error("Failed to reach AGRiNEX AI Assistant");
      }
    } finally {
      setIsLoading(false);
      setStatusMessage(null);
    }
  };

  // Quick prompt suggestions
  const quickPrompts = [
    { label: "🌦️ Live Weather & Rain", text: "What is the live weather and rain forecast for my farm?" },
    { label: "🍅 Tomato Mandi Price", text: "What is the current APMC Mandi modal price for Tomato?" },
    { label: "💧 Zone 1 Moisture", text: "How is my farm and what is the moisture level in Zone 1?" },
    { label: "🌱 What Crop to Grow", text: "What crop should I grow next based on soil and season?" },
    { label: "⚠️ Simulate 3-Day Drought", text: "What if there is a 3-day dry spell with no rain?" },
  ];

  // Lightweight safe markdown renderer
  const renderMarkdown = (text: string) => {
    if (!text) return null;

    const lines = text.split("\n");
    return lines.map((line, idx) => {
      // Headers
      if (line.startsWith("### ")) {
        return (
          <h4 key={idx} className="font-bold text-emerald-900 mt-2 mb-1 text-sm">
            {line.replace("### ", "")}
          </h4>
        );
      }
      if (line.startsWith("## ")) {
        return (
          <h3 key={idx} className="font-bold text-emerald-950 mt-2 mb-1 text-base">
            {line.replace("## ", "")}
          </h3>
        );
      }
      if (line.startsWith("# ")) {
        return (
          <h2 key={idx} className="font-extrabold text-emerald-950 mt-2 mb-1 text-lg">
            {line.replace("# ", "")}
          </h2>
        );
      }

      // Bullet points
      if (line.trim().startsWith("• ") || line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
        const bulletText = line.replace(/^\s*[-•*]\s+/, "");
        return (
          <li key={idx} className="ml-4 list-disc text-stone-800 text-xs my-0.5 leading-relaxed">
            {parseInlineStyles(bulletText)}
          </li>
        );
      }

      // Numbered list
      if (/^\s*\d+\.\s+/.test(line)) {
        const numText = line.replace(/^\s*\d+\.\s+/, "");
        return (
          <li key={idx} className="ml-4 list-decimal text-stone-800 text-xs my-0.5 leading-relaxed">
            {parseInlineStyles(numText)}
          </li>
        );
      }

      // Regular paragraph
      return (
        <p key={idx} className="text-xs text-stone-800 my-1 leading-relaxed">
          {parseInlineStyles(line)}
        </p>
      );
    });
  };

  const parseInlineStyles = (txt: string) => {
    // Bold **text**
    const parts = txt.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="font-semibold text-stone-900">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code key={i} className="bg-stone-100 px-1 py-0.5 rounded text-[11px] font-mono text-emerald-800 border border-stone-200">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  return (
    <>
      {/* 1. Floating Action Button (Omnipresent Trigger) */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2">
          <button
            onClick={() => setIsOpen(true)}
            aria-label="Open AGRiNEX AI Assistant"
            className="group relative flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-emerald-700 via-emerald-800 to-teal-800 text-white rounded-full shadow-2xl hover:shadow-emerald-900/40 hover:scale-105 active:scale-95 transition-all duration-300 border border-emerald-500/30"
          >
            <div className="relative">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
            </div>
            <span className="font-semibold text-sm tracking-wide">
              {lang === "hi" ? "एग्रीनेक्स AI" : lang === "kn" ? "ಅಗ್ರಿನೆಕ್ಸ್ AI" : "Ask AGRiNEX AI"}
            </span>
          </button>
        </div>
      )}

      {/* 2. Floating Assistant Window */}
      {isOpen && (
        <div
          className={`fixed z-50 transition-all duration-300 ease-in-out flex flex-col bg-white/95 backdrop-blur-xl border border-stone-200/80 shadow-2xl rounded-2xl overflow-hidden ${
            isExpanded
              ? "inset-4 sm:inset-10 md:inset-16 w-auto h-auto"
              : "bottom-6 right-6 w-[94vw] sm:w-[440px] h-[640px] max-h-[90vh]"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-emerald-800 via-emerald-900 to-teal-900 text-white select-none">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
                <Sparkles className="w-4 h-4 text-amber-300" />
              </div>
              <div>
                <h3 className="font-bold text-sm tracking-wide flex items-center gap-1.5">
                  AGRiNEX AI Companion
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </h3>
                <p className="text-[10px] text-emerald-200/90 font-medium">
                  {currentFarm?.name || "Namfarm"} • {lang.toUpperCase()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={startNewChat}
                title="New Chat Thread"
                className="p-1.5 rounded-lg hover:bg-white/15 text-emerald-100 hover:text-white transition"
              >
                <Plus className="w-4 h-4" />
              </button>

              <button
                onClick={() => setActiveTab(activeTab === "chat" ? "history" : "chat")}
                title="Conversation History"
                className={`p-1.5 rounded-lg hover:bg-white/15 text-emerald-100 hover:text-white transition ${
                  activeTab === "history" ? "bg-white/20 text-white" : ""
                }`}
              >
                <History className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? "Collapse" : "Expand"}
                className="p-1.5 rounded-lg hover:bg-white/15 text-emerald-100 hover:text-white transition hidden sm:inline-flex"
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              <button
                onClick={() => setIsOpen(false)}
                title="Close"
                className="p-1.5 rounded-lg hover:bg-white/15 text-emerald-100 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body: Tabs */}
          {activeTab === "history" ? (
            /* Conversation History Tab */
            <div className="flex-1 overflow-y-auto p-4 bg-stone-50/50">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                  Past Conversations
                </h4>
                <button
                  onClick={startNewChat}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Start New
                </button>
              </div>

              {conversations.length === 0 ? (
                <div className="text-center py-12 text-stone-500 text-xs">
                  No conversation history yet. Start asking questions!
                </div>
              ) : (
                <div className="space-y-2">
                  {conversations.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => selectConversation(c.id)}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition flex items-center justify-between ${
                        conversationId === c.id
                          ? "bg-emerald-50 border-emerald-300 shadow-sm"
                          : "bg-white border-stone-200/70 hover:border-emerald-200 hover:bg-stone-50"
                      }`}
                    >
                      <div className="flex-1 pr-2 min-w-0">
                        <p className="text-xs font-semibold text-stone-800 truncate">
                          {c.title || "Agronomic inquiry"}
                        </p>
                        <p className="text-[10px] text-stone-400 mt-0.5">
                          {c.updated_at ? new Date(c.updated_at).toLocaleDateString() : "Recent"}
                        </p>
                      </div>
                      <button
                        onClick={(e) => deleteConv(e, c.id)}
                        title="Delete conversation"
                        className="p-1 text-stone-400 hover:text-red-600 transition rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Active Chat Tab */
            <div className="flex-1 flex flex-col min-h-0 bg-gradient-to-b from-stone-50/40 to-white">
              {/* Messages Scroll Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
                  >
                    {/* Role header & timestamp */}
                    <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-stone-400">
                      <span>{m.role === "user" ? "You" : "AGRiNEX AI"}</span>
                      <span>•</span>
                      <span>{m.time}</span>
                    </div>

                    {/* Message Bubble */}
                    <div
                      className={`relative max-w-[88%] rounded-2xl p-3.5 shadow-sm text-xs leading-relaxed ${
                        m.role === "user"
                          ? "bg-emerald-700 text-white rounded-br-none"
                          : "bg-white border border-stone-200/80 text-stone-800 rounded-bl-none shadow-stone-100"
                      }`}
                    >
                      {/* Optional Attachment indicator */}
                      {m.attachmentPreview && (
                        <div className="mb-2 px-2 py-1 rounded bg-black/10 text-[10px] flex items-center gap-1">
                          <Paperclip className="w-3 h-3" />
                          <span className="truncate">{m.attachmentPreview}</span>
                        </div>
                      )}

                      {/* Content */}
                      <div className={m.role === "user" ? "text-white" : "text-stone-800"}>
                        {m.role === "user" ? m.content : renderMarkdown(m.content)}
                      </div>

                      {/* Tool Calls Summary Pill */}
                      {m.toolCalls && m.toolCalls.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-stone-100">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold text-emerald-800 flex items-center gap-1">
                              <Cpu className="w-3 h-3 text-emerald-600" />
                              Executed {m.toolCalls.length} Controlled Tool{m.toolCalls.length > 1 ? "s" : ""}:
                            </span>
                            <button
                              onClick={() =>
                                setExpandedToolMsgId(expandedToolMsgId === m.id ? null : m.id)
                              }
                              className="text-[10px] text-stone-400 hover:text-stone-700 flex items-center gap-0.5"
                            >
                              {expandedToolMsgId === m.id ? (
                                <>
                                  Hide <ChevronUp className="w-3 h-3" />
                                </>
                              ) : (
                                <>
                                  Inspect <ChevronDown className="w-3 h-3" />
                                </>
                              )}
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-1 mt-1">
                            {m.toolCalls.map((tc, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200/60 rounded-full text-[10px] font-mono"
                              >
                                {tc.tool}
                              </span>
                            ))}
                          </div>

                          {expandedToolMsgId === m.id && (
                            <div className="mt-2 p-2 bg-stone-50 rounded-lg border border-stone-200 text-[10px] font-mono overflow-x-auto max-h-36">
                              <pre>{JSON.stringify(m.toolCalls, null, 2)}</pre>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Citations / Sources */}
                      {m.citations && m.citations.length > 0 && (
                        <div className="mt-2 pt-1.5 border-t border-stone-100 flex items-start gap-1 text-[10px] text-stone-500">
                          <BookOpen className="w-3 h-3 text-emerald-600 mt-0.5 shrink-0" />
                          <div className="space-y-0.5">
                            {m.citations.map((c, i) => (
                              <p key={i}>
                                <strong className="text-stone-700">{c.title}</strong> ({c.source})
                              </p>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* HIGH-RISK ACTION CONFIRMATION CARD */}
                      {m.confirmationRequired && !m.confirmedStatus && (
                        <div className="mt-3 p-3 bg-amber-50/90 border border-amber-200 rounded-xl space-y-2">
                          <div className="flex items-center gap-1.5 text-amber-900 font-bold text-[11px]">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            Action Confirmation Required
                          </div>
                          <p className="text-[11px] text-amber-800 leading-normal">
                            {m.confirmationRequired.description}
                          </p>
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() =>
                                handleConfirmAction(
                                  m.id,
                                  m.confirmationRequired!.action_token,
                                  true
                                )
                              }
                              disabled={confirmingToken === m.confirmationRequired.action_token}
                              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold text-xs transition flex items-center gap-1 shadow-sm"
                            >
                              <Check className="w-3.5 h-3.5" />
                              {confirmingToken === m.confirmationRequired.action_token
                                ? "Executing..."
                                : "Confirm Action"}
                            </button>
                            <button
                              onClick={() =>
                                handleConfirmAction(
                                  m.id,
                                  m.confirmationRequired!.action_token,
                                  false
                                )
                              }
                              disabled={confirmingToken === m.confirmationRequired.action_token}
                              className="px-3 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-lg font-semibold text-xs transition"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action buttons (copy, voice readout) */}
                    {m.role === "assistant" && (
                      <div className="flex items-center gap-1 mt-1 px-1">
                        <button
                          onClick={() => copyText(m.content)}
                          title="Copy message"
                          className="p-1 rounded text-stone-400 hover:text-stone-700 transition"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleSpeak(m.content)}
                          title="Read aloud"
                          className={`p-1 rounded transition ${
                            isSpeaking ? "text-emerald-700" : "text-stone-400 hover:text-stone-700"
                          }`}
                        >
                          <Volume2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {/* Status indicator when thinking / searching / executing tool */}
                {isLoading && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50/80 border border-emerald-200/50 rounded-xl text-emerald-800 text-[11px] animate-pulse max-w-fit">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                    <span>{statusMessage || "AGRiNEX is analyzing..."}</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick suggestions chips (when messages count is low) */}
              {messages.length <= 3 && (
                <div className="px-3 py-1.5 border-t border-stone-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {quickPrompts.map((qp, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(qp.text)}
                      className="whitespace-nowrap px-2.5 py-1 rounded-full bg-stone-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 text-stone-600 text-[11px] font-medium border border-stone-200 transition shrink-0"
                    >
                      {qp.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Attachment Preview Chip */}
              {attachment && (
                <div className="px-3 py-1.5 bg-emerald-50 border-t border-emerald-100 flex items-center justify-between text-xs text-emerald-900">
                  <div className="flex items-center gap-1.5 truncate">
                    <Paperclip className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="truncate">{attachment.name}</span>
                  </div>
                  <button
                    onClick={() => setAttachment(null)}
                    className="p-1 hover:bg-emerald-100 rounded text-emerald-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Input Bar */}
              <div className="p-3 border-t border-stone-200/70 bg-white">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="flex items-center gap-1.5"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/*,.pdf,.txt"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach specimen or document"
                    className="p-2 text-stone-400 hover:text-emerald-700 hover:bg-stone-100 rounded-lg transition"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={toggleVoiceInput}
                    title={isListening ? "Stop Listening" : "Speak to AGRiNEX"}
                    className={`p-2 rounded-lg transition ${
                      isListening
                        ? "bg-red-500 text-white animate-pulse"
                        : "text-stone-400 hover:text-emerald-700 hover:bg-stone-100"
                    }`}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>

                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={
                      isListening
                        ? "Listening to voice..."
                        : lang === "hi"
                        ? "खेती, मौसम या फसलों के बारे में पूछें..."
                        : lang === "kn"
                        ? "ಜಮೀನು, ಹವಾಮಾನ ಕುರಿತು ಕೇಳಿ..."
                        : "Ask about crops, soil, weather, or irrigation..."
                    }
                    className="flex-1 bg-stone-100/80 border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:bg-white transition"
                  />

                  <button
                    type="submit"
                    disabled={!input.trim() && !attachment}
                    className="p-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white rounded-xl transition shadow-sm"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
