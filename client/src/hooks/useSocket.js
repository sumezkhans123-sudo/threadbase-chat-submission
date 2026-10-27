
import { useCallback, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../auth/AuthContext.jsx";

export function useSocket(roomId) {
  const { token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!token || !roomId) {
      setSocket(null);
      return;
    }

    const s = io(
      import.meta.env.VITE_SOCKET_URL || "http://localhost:3001",
      { auth: { token } }
    );

    setSocket(s);

    const onMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
    };

    s.on("chat:message", onMessage);

    // Join after connecting so the room is joined on the server.
    s.on("connect", () => {
      s.emit("room:join", roomId);
    });

    return () => {
      s.off("chat:message", onMessage);
      s.disconnect();
    };
  }, [token, roomId]);

  const sendMessage = useCallback(
    (text) => {
      if (text?.trim()) {
        socket?.emit("chat:message", {
          roomId,
          text: text.trim(),
        });
      }
    },
    [socket, roomId]
  );

  return { messages, sendMessage };
}
