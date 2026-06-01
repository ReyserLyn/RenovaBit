import { Elysia } from "elysia";
import type { Redis } from "ioredis";
import { auth } from "@/utils/auth/auth";
import { logger } from "@/utils/logger";
import { getRedis } from "@/utils/redis";

// ── Tipos ─────────────────────────────────────────

interface WsHandle {
	send(data: string): void;
	close(code?: number, reason?: string): void;
}

// ── Constantes ────────────────────────────────────

const BROADCAST_CHANNEL = "admin:broadcast";
const HEARTBEAT_INTERVAL = 30_000;
const SUBSCRIBER_RECONNECT_DELAY_MS = 5000;

// ── Estado local de conexiones ────────────────────

const connections = new Map<string, Set<string>>(); // userId → Set<wsId>
const wsMap = new Map<string, WsHandle>(); // wsId → WsHandle
const aliveMap = new Map<string, boolean>();
const pingTimers = new Map<string, ReturnType<typeof setInterval>>();

// ── Subscriber gestionado por el plugin ───────────
// Referencia mutable para que onStart/onStop puedan accederla.
let subscriber: Redis | null = null;
let subscriberReconnectTimer: ReturnType<typeof setTimeout> | null = null;

function handleSubscriberMessage(channel: string, message: string): void {
	if (channel !== BROADCAST_CHANNEL) return;

	for (const [, socketIds] of connections) {
		for (const socketId of socketIds) {
			const ws = wsMap.get(socketId);
			if (!ws) continue;
			try {
				ws.send(message);
			} catch (error) {
				logger.withError(error).warn("[WS] Error reenviando mensaje pub/sub a cliente");
			}
		}
	}
}

async function subscribeWithRetry(client: Redis): Promise<void> {
	try {
		await client.subscribe(BROADCAST_CHANNEL);
		logger.info("[WS] Subscriber Redis conectado al canal admin:broadcast");
	} catch (err) {
		logger.withError(err).error("[WS] No se pudo suscribir al canal Redis — reintentando...");
		subscriberReconnectTimer = setTimeout(() => {
			if (client.status === "ready" || client.status === "connect") {
				subscribeWithRetry(client);
			}
		}, SUBSCRIBER_RECONNECT_DELAY_MS);
	}
}

function startSubscriber(): void {
	if (subscriber) return;

	try {
		subscriber = getRedis().duplicate();

		subscriber.on("error", (err) => {
			logger.withError(err).error("[WS] Error en subscriber Redis");
		});

		// Reconectar suscripción cuando el cliente se recupera
		subscriber.on("ready", () => {
			logger.info("[WS] Subscriber Redis reconectado");
			if (subscriber) {
				subscribeWithRetry(subscriber);
			}
		});

		subscriber.on("message", handleSubscriberMessage);

		subscribeWithRetry(subscriber);
	} catch (error) {
		logger
			.withError(error)
			.error("[WS] No se pudo inicializar subscriber Redis — reintentando en 5s...");
		subscriber = null;
		// Reintentar inicialización si Redis no estaba disponible al arrancar
		subscriberReconnectTimer = setTimeout(startSubscriber, SUBSCRIBER_RECONNECT_DELAY_MS);
	}
}

async function stopSubscriber(): Promise<void> {
	if (subscriberReconnectTimer) {
		clearTimeout(subscriberReconnectTimer);
		subscriberReconnectTimer = null;
	}

	if (!subscriber) return;

	const client = subscriber;
	subscriber = null;

	try {
		await client.unsubscribe();
	} catch (err) {
		logger.withError(err).warn("[WS] Error al desuscribir");
	}

	try {
		await client.quit();
	} catch (err) {
		logger.withError(err).warn("[WS] Error al cerrar subscriber");
	}
}

// ── Broadcast API ─────────────────────────────────
// Fire-and-forget: publica en Redis sin bloquear al caller.
// Si Redis no está disponible, solo loguea el error.

export function broadcastToAdmins(data: unknown): void {
	const payload = typeof data === "string" ? data : JSON.stringify(data);

	getRedis()
		.publish(BROADCAST_CHANNEL, payload)
		.catch((error) => {
			logger.withError(error).error("[WS] Error publicando broadcast en Redis Pub/Sub");
		});
}

// ── Plugin ────────────────────────────────────────

export const WebSocketPlugin = new Elysia({ name: "ws" })
	.macro({
		wsAuth: {
			async resolve({ request }) {
				try {
					const session = await auth.api.getSession({
						headers: request.headers,
					});
					return { wsSession: session };
				} catch (error) {
					logger.withError(error).warn("[WS] Error al obtener sesión para WebSocket");
					return { wsSession: null };
				}
			},
		},
	})
	// Inicializar subscriber Redis cuando arranca el servidor
	.onStart(() => {
		startSubscriber();
	})
	// Limpiar subscriber al detener el servidor
	.onStop(() => {
		return stopSubscriber();
	})
	.ws("/ws", {
		wsAuth: true,
		open(ws) {
			const session = ws.data.wsSession;
			if (!session || session.user.role !== "admin") {
				ws.close(1008, "No autorizado");
				return;
			}

			const key = session.user.id;
			const userSockets = connections.get(key) ?? new Set();
			userSockets.add(ws.id);
			connections.set(key, userSockets);
			wsMap.set(ws.id, ws);

			// Heartbeat: detecta conexiones muertas
			aliveMap.set(ws.id, true);
			pingTimers.set(
				ws.id,
				setInterval(() => {
					if (!aliveMap.get(ws.id)) {
						try {
							ws.close(1001, "Heartbeat timeout");
						} catch {
							// ignore
						}
						return;
					}
					aliveMap.set(ws.id, false);
					try {
						ws.send("ping");
					} catch {
						try {
							ws.close(1001, "Heartbeat send failed");
						} catch {
							// ignore
						}
					}
				}, HEARTBEAT_INTERVAL),
			);
		},
		message(ws, message) {
			if (typeof message === "string" && message === "pong") {
				aliveMap.set(ws.id, true);
			}
		},
		close(ws) {
			const timer = pingTimers.get(ws.id);
			if (timer) {
				clearInterval(timer);
				pingTimers.delete(ws.id);
			}
			aliveMap.delete(ws.id);
			wsMap.delete(ws.id);

			for (const [key, sockets] of connections) {
				if (sockets.delete(ws.id)) {
					if (sockets.size === 0) connections.delete(key);
					break;
				}
			}
		},
		error(error) {
			logger.withError(error).warn("[WS] Error en conexión WebSocket");
		},
	});
