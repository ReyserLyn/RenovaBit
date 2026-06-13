import { useCallback, useEffect, useRef, useState } from "react";
import { getWsUrl } from "@/shared/lib/env";
import type {
	OrderAutoCancelledEvent,
	OrderCreatedEvent,
	SyncCompletedEvent,
	SyncProgress,
	SyncStats,
} from "../model";

type WsMessage =
	| ({ type: "sync:progress" } & SyncProgress)
	| { type: "sync:completed"; reportId: string; stats: SyncStats; trigger: string }
	| ({ type: "order:created" } & OrderCreatedEvent)
	| ({ type: "order:auto-cancelled" } & OrderAutoCancelledEvent);

type WsCallbacks = {
	onProgress?: (data: SyncProgress) => void;
	onCompleted?: (data: SyncCompletedEvent) => void;
	onOrderCreated?: (data: OrderCreatedEvent) => void;
	onOrderAutoCancelled?: (data: OrderAutoCancelledEvent) => void;
};

const WS_URL = getWsUrl();
const RECONNECT_DELAY = 3000;

/**
 * Hook de WebSocket con heartbeat y reconexión automática.
 *
 * Los callbacks se mantienen estables vía ref pattern (React 19).
 * `connect` usa `[]` como deps para no reconectar cuando cambian los callbacks.
 */
export function useWebSocket(callbacks: WsCallbacks) {
	const [isConnected, setIsConnected] = useState(false);
	const wsRef = useRef<WebSocket | null>(null);
	const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	// Ref para que el handler de mensajes siempre lea los callbacks más recientes
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
				const { onProgress, onCompleted, onOrderCreated, onOrderAutoCancelled } =
					callbacksRef.current;

				if (data.type === "sync:progress" && onProgress) {
					onProgress(data);
				} else if (data.type === "sync:completed" && onCompleted) {
					onCompleted(data);
				} else if (data.type === "order:created" && onOrderCreated) {
					onOrderCreated(data);
				} else if (data.type === "order:auto-cancelled" && onOrderAutoCancelled) {
					onOrderAutoCancelled(data);
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
