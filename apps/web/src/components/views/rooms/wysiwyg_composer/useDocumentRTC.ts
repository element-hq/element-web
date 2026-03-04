/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * useDocumentRTC — real-time Automerge delta transport via LiveKit data channel.
 *
 * Joins a MatrixRTC session (intent: "document") in the room, exchanges the
 * user's OpenID token with the LiveKit SFU service for a JWT, connects to the
 * LiveKit room in data-only mode, and exposes:
 *   - `publishDelta(bytes)` — send an Automerge incremental delta to all peers
 *   - `onDeltaRef`          — callback ref invoked on every received delta
 *   - `isConnected`         — whether the LiveKit room is currently connected
 *
 * Falls back gracefully: if the homeserver has no LiveKit transport configured,
 * `isConnected` stays false and the caller should fall back to Matrix events.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { type Room as MatrixRoom, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { isLivekitTransportConfig } from "matrix-js-sdk/src/matrixrtc";
import { logger } from "matrix-js-sdk/src/logger";
import { Room as LivekitRoom, RoomEvent, ConnectionState } from "livekit-client";

const LIVEKIT_DATA_TOPIC = "org.element.doc.delta";

export interface UseDocumentRTCResult {
    /** Send an Automerge incremental delta to all connected peers. */
    publishDelta: (bytes: Uint8Array) => void;
    /** Set this to receive deltas from peers. Updated value is used without re-registering listeners. */
    onDeltaRef: React.MutableRefObject<((bytes: Uint8Array) => void) | null>;
    /** True when connected to the LiveKit room. */
    isConnected: boolean;
}

/**
 * Exchange a Matrix OpenID token for a LiveKit JWT from the SFU service.
 * The SFU service follows MSC4143: POST {sfu_url}/sfu/get with the openid token.
 */
async function getLivekitJwt(
    sfuServiceUrl: string,
    roomId: string,
    openidToken: {
        access_token: string;
        token_type: string;
        matrix_server_name: string;
        expires_in: number;
    },
    deviceId: string,
): Promise<{ url: string; jwt: string }> {
    const response = await fetch(`${sfuServiceUrl}/sfu/get`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            room: roomId,
            openid_token: openidToken,
            device_id: deviceId,
        }),
    });
    if (!response.ok) {
        throw new Error(`SFU JWT exchange failed: ${response.status} ${response.statusText}`);
    }
    const body = await response.json();
    if (!body.jwt || !body.url) {
        throw new Error("SFU response missing jwt or url fields");
    }
    return { url: body.url, jwt: body.jwt };
}

export function useDocumentRTC(
    matrixRoom: MatrixRoom,
    client: MatrixClient,
): UseDocumentRTCResult {
    const [isConnected, setIsConnected] = useState(false);
    const livekitRoomRef = useRef<LivekitRoom | null>(null);
    const onDeltaRef = useRef<((bytes: Uint8Array) => void) | null>(null);

    useEffect(() => {
        let cancelled = false;
        let livekitRoom: LivekitRoom | null = null;

        const connect = async (): Promise<void> => {
            // 1. Get available transports from the homeserver.
            let transports;
            try {
                transports = await client._unstable_getRTCTransports();
            } catch (e) {
                logger.info("[DocumentRTC] Homeserver does not support /rtc/transports, falling back to Matrix events", e);
                return;
            }

            const livekitTransport = transports.find(isLivekitTransportConfig);
            if (!livekitTransport) {
                logger.info("[DocumentRTC] No LiveKit transport in /rtc/transports, falling back to Matrix events");
                return;
            }

            const sfuServiceUrl = livekitTransport.livekit_service_url;

            // 2. Get an OpenID token and exchange it for a LiveKit JWT.
            let livekitCreds: { url: string; jwt: string };
            try {
                const openidToken = await client.getOpenIdToken();
                livekitCreds = await getLivekitJwt(
                    sfuServiceUrl,
                    matrixRoom.roomId,
                    openidToken as Parameters<typeof getLivekitJwt>[2],
                    client.getDeviceId() ?? "unknown",
                );
            } catch (e) {
                logger.warn("[DocumentRTC] Failed to get LiveKit credentials", e);
                return;
            }

            if (cancelled) return;

            // 3. Connect to LiveKit room (data-only: no camera/mic).
            livekitRoom = new LivekitRoom();
            livekitRoomRef.current = livekitRoom;

            livekitRoom.on(RoomEvent.Connected, () => {
                if (!cancelled) {
                    logger.info("[DocumentRTC] Connected to LiveKit room");
                    setIsConnected(true);
                }
            });

            livekitRoom.on(RoomEvent.Disconnected, () => {
                logger.info("[DocumentRTC] Disconnected from LiveKit room");
                setIsConnected(false);
            });

            livekitRoom.on(RoomEvent.Reconnecting, () => {
                logger.info("[DocumentRTC] Reconnecting to LiveKit room…");
                setIsConnected(false);
            });

            livekitRoom.on(RoomEvent.Reconnected, () => {
                if (!cancelled) {
                    logger.info("[DocumentRTC] Reconnected to LiveKit room");
                    setIsConnected(true);
                }
            });

            // 4. Receive Automerge deltas from peers.
            livekitRoom.on(
                RoomEvent.DataReceived,
                (payload: Uint8Array, _participant: unknown, _kind: unknown, topic?: string) => {
                    if (topic !== LIVEKIT_DATA_TOPIC) return;
                    onDeltaRef.current?.(payload);
                },
            );

            try {
                await livekitRoom.connect(livekitCreds.url, livekitCreds.jwt, {
                    // Data-only: don't auto-subscribe to audio/video tracks.
                    autoSubscribe: false,
                });
                logger.info("[DocumentRTC] LiveKit connect() resolved");
            } catch (e) {
                logger.warn("[DocumentRTC] Failed to connect to LiveKit room", e);
                setIsConnected(false);
            }
        };

        connect().catch((e) => logger.error("[DocumentRTC] Unexpected error in connect()", e));

        return () => {
            cancelled = true;
            if (livekitRoomRef.current) {
                logger.info("[DocumentRTC] Disconnecting from LiveKit room (unmount)");
                livekitRoomRef.current.disconnect().catch(() => {});
                livekitRoomRef.current = null;
            }
            setIsConnected(false);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [matrixRoom.roomId]); // reconnect only if room changes

    const publishDelta = useCallback((bytes: Uint8Array): void => {
        const room = livekitRoomRef.current;
        if (!room || room.state !== ConnectionState.Connected) return;
        room.localParticipant
            .publishData(bytes, { reliable: true, topic: LIVEKIT_DATA_TOPIC })
            .catch((e: unknown) => logger.warn("[DocumentRTC] Failed to publish delta", e));
    }, []);

    return { publishDelta, onDeltaRef, isConnected };
}
