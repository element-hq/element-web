/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

/**
 * Incoming message scanner for steganographic content.
 *
 * Listens to Matrix room timeline events and checks message content
 * for hidden steganographic payloads (emoji sequences, stego images).
 * When detected, notifies the UI to render the StegoMessageView.
 */

import type { MatrixClient } from "matrix-js-sdk/src/client";
import type { MatrixEvent } from "matrix-js-sdk/src/models/event";
import type { Room } from "matrix-js-sdk/src/models/room";

import { hasStegoMarker, looksLikeStegoEmoji } from "./EmojiStego";
import { StegoCodec } from "./StegoCodec";
import { getEphemeralManager } from "./ephemeral/EphemeralManager";
import { STEGO_MARKER } from "./types";

/** Detection result for a single event. */
export interface StegoDetection {
    /** The Matrix event that contains stego content. */
    event: MatrixEvent;
    /** The carrier string extracted from the event. */
    carrier: string;
    /** Whether this is an emoji-based or image-based stego message. */
    type: "emoji" | "image";
    /** The event ID. */
    eventId: string;
    /** The room ID. */
    roomId: string;
}

/** Callback for when stego content is detected. */
export type StegoDetectionCallback = (detection: StegoDetection) => void;

/**
 * Scans incoming Matrix events for steganographic content.
 *
 * Attaches to the Matrix client's timeline event listener and performs
 * lightweight checks on each incoming message. When stego content is
 * found, it fires a callback so the UI can render the appropriate view.
 */
export class StegoDetector {
    private client: MatrixClient | null = null;
    private callbacks: Set<StegoDetectionCallback> = new Set();
    private codec: StegoCodec;
    private boundOnEvent: ((event: MatrixEvent, room: Room | undefined) => void) | null = null;
    private detectedEvents: Set<string> = new Set();

    public constructor() {
        this.codec = new StegoCodec();
    }

    /**
     * Start listening for incoming Matrix events.
     */
    public start(client: MatrixClient): void {
        this.client = client;
        this.boundOnEvent = this.onTimelineEvent.bind(this);
        client.on("Room.timeline" as any, this.boundOnEvent);
    }

    /**
     * Stop listening and clean up.
     */
    public stop(): void {
        if (this.client && this.boundOnEvent) {
            this.client.off("Room.timeline" as any, this.boundOnEvent);
        }
        this.client = null;
        this.boundOnEvent = null;
        this.detectedEvents.clear();
    }

    /**
     * Register a callback for stego detections.
     */
    public onDetection(callback: StegoDetectionCallback): () => void {
        this.callbacks.add(callback);
        return () => this.callbacks.delete(callback);
    }

    /**
     * Manually scan a single message body for stego content.
     * Useful for scanning clipboard pastes or external messages.
     */
    public scanText(text: string): boolean {
        return this.codec.looksLikeStego(text);
    }

    /**
     * Scan a Matrix event for steganographic content.
     * Returns a detection result or null.
     */
    public scanEvent(event: MatrixEvent): StegoDetection | null {
        const eventId = event.getId();
        if (!eventId) return null;

        // Skip already-detected events
        if (this.detectedEvents.has(eventId)) return null;

        const content = event.getContent();
        if (!content) return null;

        const roomId = event.getRoomId();
        if (!roomId) return null;

        // Check text body for emoji stego
        const body = content.body as string | undefined;
        if (body && this.isEmojiStego(body)) {
            this.detectedEvents.add(eventId);
            return {
                event,
                carrier: body,
                type: "emoji",
                eventId,
                roomId,
            };
        }

        // Check for stego in formatted body
        const formattedBody = content.formatted_body as string | undefined;
        if (formattedBody && this.isEmojiStego(formattedBody)) {
            this.detectedEvents.add(eventId);
            return {
                event,
                carrier: formattedBody,
                type: "emoji",
                eventId,
                roomId,
            };
        }

        // Check for image stego (m.image events with PNG)
        if (content.msgtype === "m.image") {
            const info = content.info as { mimetype?: string } | undefined;
            if (info?.mimetype === "image/png") {
                // Image stego needs to be checked after downloading
                // Mark it as potentially stego for later verification
                const url = content.url as string | undefined;
                if (url) {
                    this.detectedEvents.add(eventId);
                    return {
                        event,
                        carrier: url,
                        type: "image",
                        eventId,
                        roomId,
                    };
                }
            }
        }

        // Check custom stego event content
        const stegoContent = content["io.element.stego"] as { carrier?: string } | undefined;
        if (stegoContent?.carrier) {
            this.detectedEvents.add(eventId);
            return {
                event,
                carrier: stegoContent.carrier,
                type: stegoContent.carrier.startsWith("data:image/png") ? "image" : "emoji",
                eventId,
                roomId,
            };
        }

        return null;
    }

    /**
     * Batch scan all events in a room timeline.
     */
    public scanRoom(room: Room): StegoDetection[] {
        const timeline = room.getLiveTimeline();
        const events = timeline.getEvents();
        const detections: StegoDetection[] = [];

        for (const event of events) {
            const detection = this.scanEvent(event);
            if (detection) {
                detections.push(detection);
            }
        }

        return detections;
    }

    /**
     * Handle an incoming timeline event.
     */
    private onTimelineEvent(event: MatrixEvent, room: Room | undefined): void {
        if (!room) return;

        const detection = this.scanEvent(event);
        if (detection) {
            // Track with ephemeral manager
            const ephemeral = getEphemeralManager();
            const expiryContent = event.getContent()?.["io.element.stego"] as
                | { expires_at?: number }
                | undefined;
            if (expiryContent?.expires_at) {
                ephemeral.track(detection.eventId, detection.roomId, expiryContent.expires_at);
            }

            // Notify all callbacks
            for (const callback of this.callbacks) {
                try {
                    callback(detection);
                } catch {
                    // Don't let callback errors break the detector
                }
            }
        }
    }

    /**
     * Quick check if text looks like emoji steganography.
     */
    private isEmojiStego(text: string): boolean {
        return hasStegoMarker(text) || looksLikeStegoEmoji(text);
    }

    /**
     * Get count of detected stego events.
     */
    public get detectionCount(): number {
        return this.detectedEvents.size;
    }

    /**
     * Clear the detection cache (useful for testing).
     */
    public clearCache(): void {
        this.detectedEvents.clear();
    }
}

/** Singleton instance. */
let instance: StegoDetector | undefined;

/** Get the global StegoDetector instance. */
export function getStegoDetector(): StegoDetector {
    if (!instance) {
        instance = new StegoDetector();
    }
    return instance;
}
