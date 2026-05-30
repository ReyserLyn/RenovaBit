import { useCallback, useEffect, useRef, useState } from "react";
import { getWsUrl } from "@/shared/lib/env";
import type { SyncCompletedEvent, SyncProgress, SyncStats } from "../model";

type WsMessage =
	| ({ type: "sync:progress" } & SyncProgress)
	| { type: "sync:completed"; reportId: string; stats: SyncStats; trigger: string };

type WsCallbacks = {
	onProgress?: (data: SyncProgress) => void;
	onCompleted?: (data: SyncCompletedEvent) => void;
};

const WS_URL = getWsUrl();
const RECONNECT_DELAY = 3000;

export function useWebSocket(callbacks: WsCallbacks) {
	const [isConnected, setIsConnected] = useState(false);
	const wsRef = useRef<WebSocket | null>(null);
	const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const callbacksRef = useRef(callbacks);

	callbacksRef.current = callbacks;

	const connect = useCallback(() => {
		if (wsRef.current?.readyState === WebSocket.OPEN) return;

		const ws = new WebSocket(WS_URL);
		wsRef.current = ws;

		ws.onopen = () => setIsConnected(true);

		ws.onclose = () => {
			setIsConnected(false);
			reconnectRef.current = setTimeout(connect, RECONNECT_DELAY);
		};

		ws.onerror = () => ws.close();

		ws.onmessage = (event) => {
			// Responder a heartbeat del servidor
			if (typeof event.data === "string" && event.data === "ping") {
				try {
					ws.send("pong");
				} catch {
					// ignore send errors on pong
				}
				return;
			}

			try {
				const data: WsMessage = JSON.parse(event.data);
				const { onProgress, onCompleted } = callbacksRef.current;

				if (data.type === "sync:progress" && onProgress) {
					onProgress(data);
				} else if (data.type === "sync:completed" && onCompleted) {
					onCompleted(data);
				}
			} catch {
				// ignore malformed messages
			}
		};
	}, []);

	useEffect(() => {
		connect();
		return () => {
			if (reconnectRef.current) {
				clearTimeout(reconnectRef.current);
				reconnectRef.current = null;
			}
			wsRef.current?.close();
		};
	}, [connect]);

	return isConnected;
}
