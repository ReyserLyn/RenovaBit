import { Elysia } from "elysia";
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

// ── Estado local de conexiones ────────────────────

const connections = new Map<string, Set<string>>(); // userId → Set<wsId>
const wsMap = new Map<string, WsHandle>(); // wsId → WsHandle
const aliveMap = new Map<string, boolean>();
const pingTimers = new Map<string, ReturnType<typeof setInterval>>();

// ── Redis Pub/Sub: subscriber ─────────────────────
// Usa un cliente duplicado porque un cliente en modo subscriber
// no puede ejecutar otros comandos (como publish).

function initSubscriber(): void {
	try {
		const subscriber = getRedis().duplicate();

		subscriber.on("error", (err) => {
			logger.withError(err).error("[WS] Error en subscriber Redis");
		});

		subscriber
			.subscribe(BROADCAST_CHANNEL)
			.then(() => {
				logger.info("[WS] Subscriber Redis conectado al canal admin:broadcast");
			})
			.catch((err) => {
				logger.withError(err).error("[WS] No se pudo suscribir al canal Redis");
			});

		subscriber.on("message", (channel, message) => {
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
		});

		// Cleanup en shutdown
		const cleanup = () => {
			subscriber
				.unsubscribe()
				.catch((err) => logger.withError(err).warn("[WS] Error al desuscribir"));
			subscriber
				.quit()
				.catch((err) => logger.withError(err).warn("[WS] Error al cerrar subscriber"));
		};

		process.on("SIGTERM", cleanup);
		process.on("SIGINT", cleanup);
	} catch (error) {
		logger.withError(error).error("[WS] No se pudo inicializar subscriber Redis");
	}
}

// Inicializar al cargar el módulo
initSubscriber();

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
