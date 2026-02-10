/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

/**
 * Ephemeral message lifecycle manager.
 *
 * Tracks steganographic messages and automatically deletes them after their
 * expiry time (default: 72 hours). Works both server-side (via Matrix event
 * redaction) and client-side (local storage cleanup).
 *
 * Integrates with the Matrix client to:
 *   - Set `expiry_ts` on outgoing stego events
 *   - Periodically scan for and redact expired events
 *   - Clean up local IndexedDB/localStorage entries
 */

import type { MatrixClient } from "matrix-js-sdk/src/client";
import type { MatrixEvent } from "matrix-js-sdk/src/models/event";
import type { Room } from "matrix-js-sdk/src/models/room";

import { DEFAULT_STEGO_CONFIG } from "../types";

/** Storage key prefix for tracked ephemeral messages. */
const STORAGE_PREFIX = "mx_stego_ephemeral_";

/** Metadata stored for each tracked ephemeral message. */
export interface EphemeralMessageRecord {
    /** Matrix event ID. */
    eventId: string;
    /** Room ID the event belongs to. */
    roomId: string;
    /** Unix timestamp (ms) when the message expires. */
    expiresAt: number;
    /** Whether the message has been read. */
    read: boolean;
    /** Whether this message should self-destruct on read. */
    selfDestruct: boolean;
    /** Timestamp when the message was first displayed. */
    displayedAt?: number;
}

/** Options for the ephemeral manager. */
export interface EphemeralManagerOptions {
    /** How often to check for expired messages, in ms. Default: 60000 (1 min). */
    checkIntervalMs?: number;
    /** Default message lifetime in ms. Default: 72 hours. */
    defaultExpiryMs?: number;
    /** Whether to redact events server-side on expiry. Default: true. */
    serverSideRedaction?: boolean;
}

/**
 * Manages the lifecycle of ephemeral steganographic messages.
 */
export class EphemeralManager {
    private records: Map<string, EphemeralMessageRecord> = new Map();
    private checkInterval: ReturnType<typeof setInterval> | null = null;
    private client: MatrixClient | null = null;
    private options: Required<EphemeralManagerOptions>;

    public constructor(options: EphemeralManagerOptions = {}) {
        this.options = {
            checkIntervalMs: options.checkIntervalMs ?? 60_000,
            defaultExpiryMs: options.defaultExpiryMs ?? DEFAULT_STEGO_CONFIG.defaultExpiryMs,
            serverSideRedaction: options.serverSideRedaction ?? true,
        };
    }

    /**
     * Initialize the manager with a Matrix client and start the expiry checker.
     */
    public start(client: MatrixClient): void {
        this.client = client;
        this.loadFromStorage();

        // Start periodic check
        this.checkInterval = setInterval(() => {
            void this.checkExpired();
        }, this.options.checkIntervalMs);

        // Do an immediate check
        void this.checkExpired();
    }

    /**
     * Stop the manager and clean up timers.
     */
    public stop(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        this.saveToStorage();
        this.client = null;
    }

    /**
     * Track a new ephemeral message.
     *
     * @param eventId - Matrix event ID.
     * @param roomId - Room the event belongs to.
     * @param expiresAt - When the message expires (Unix ms).
     * @param selfDestruct - Whether to delete immediately after reading.
     */
    public track(eventId: string, roomId: string, expiresAt: number, selfDestruct = false): void {
        const record: EphemeralMessageRecord = {
            eventId,
            roomId,
            expiresAt,
            read: false,
            selfDestruct,
        };
        this.records.set(eventId, record);
        this.saveToStorage();
    }

    /**
     * Mark a message as read. If it's a self-destruct message, schedule
     * immediate deletion.
     */
    public markRead(eventId: string): void {
        const record = this.records.get(eventId);
        if (!record) return;

        record.read = true;
        record.displayedAt = Date.now();

        if (record.selfDestruct) {
            // Self-destruct: expire immediately
            record.expiresAt = Date.now();
            void this.deleteMessage(record);
        }

        this.saveToStorage();
    }

    /**
     * Get the remaining time until a message expires.
     * @returns Remaining ms, or 0 if expired, or -1 if not tracked.
     */
    public getRemainingTime(eventId: string): number {
        const record = this.records.get(eventId);
        if (!record) return -1;
        return Math.max(0, record.expiresAt - Date.now());
    }

    /**
     * Check if a message has expired.
     */
    public isExpired(eventId: string): boolean {
        const record = this.records.get(eventId);
        if (!record) return false;
        return Date.now() >= record.expiresAt;
    }

    /**
     * Get all tracked records for a room.
     */
    public getRecordsForRoom(roomId: string): EphemeralMessageRecord[] {
        const result: EphemeralMessageRecord[] = [];
        for (const record of this.records.values()) {
            if (record.roomId === roomId) {
                result.push(record);
            }
        }
        return result;
    }

    /**
     * Get all tracked records.
     */
    public getAllRecords(): EphemeralMessageRecord[] {
        return [...this.records.values()];
    }

    /**
     * Check all tracked messages and delete any that have expired.
     */
    private async checkExpired(): Promise<void> {
        const now = Date.now();
        const expired: EphemeralMessageRecord[] = [];

        for (const record of this.records.values()) {
            if (now >= record.expiresAt) {
                expired.push(record);
            }
        }

        for (const record of expired) {
            await this.deleteMessage(record);
        }
    }

    /**
     * Delete an expired message both server-side and client-side.
     */
    private async deleteMessage(record: EphemeralMessageRecord): Promise<void> {
        // Server-side: redact the Matrix event
        if (this.options.serverSideRedaction && this.client) {
            try {
                await this.client.redactEvent(record.roomId, record.eventId, undefined, {
                    reason: "Ephemeral message expired",
                });
            } catch {
                // Redaction may fail if we don't have permission or event is already redacted.
                // This is expected for messages from other users.
            }
        }

        // Client-side: remove from local tracking
        this.records.delete(record.eventId);
        this.saveToStorage();
    }

    /**
     * Persist tracked records to localStorage.
     */
    private saveToStorage(): void {
        try {
            const data = JSON.stringify([...this.records.entries()]);
            localStorage.setItem(STORAGE_PREFIX + "records", data);
        } catch {
            // Storage might be unavailable (e.g., incognito mode)
        }
    }

    /**
     * Load tracked records from localStorage.
     */
    private loadFromStorage(): void {
        try {
            const data = localStorage.getItem(STORAGE_PREFIX + "records");
            if (data) {
                const entries: [string, EphemeralMessageRecord][] = JSON.parse(data);
                this.records = new Map(entries);
            }
        } catch {
            // Corrupted data, start fresh
            this.records = new Map();
        }
    }

    /**
     * Calculate the expiry timestamp for a new message.
     *
     * @param customExpiryMs - Optional custom lifetime in ms.
     * @returns Unix timestamp (ms) when the message should expire.
     */
    public calculateExpiry(customExpiryMs?: number): number {
        return Date.now() + (customExpiryMs ?? this.options.defaultExpiryMs);
    }

    /**
     * Create Matrix event content with expiry metadata.
     * This should be merged into the event content when sending.
     */
    public createExpiryContent(expiresAt: number): Record<string, unknown> {
        return {
            "io.element.stego": {
                ephemeral: true,
                expires_at: expiresAt,
            },
        };
    }

    /**
     * Extract expiry information from a Matrix event, if present.
     */
    public static extractExpiry(event: MatrixEvent): number | null {
        const content = event.getContent();
        const stegoContent = content?.["io.element.stego"] as { ephemeral?: boolean; expires_at?: number } | undefined;
        if (stegoContent?.ephemeral && typeof stegoContent.expires_at === "number") {
            return stegoContent.expires_at;
        }
        return null;
    }

    /**
     * Scan a room for stego messages and start tracking any we're not already
     * tracking.
     */
    public scanRoom(room: Room): void {
        const timeline = room.getLiveTimeline();
        const events = timeline.getEvents();

        for (const event of events) {
            if (this.records.has(event.getId()!)) continue;

            const expiresAt = EphemeralManager.extractExpiry(event);
            if (expiresAt !== null) {
                this.track(event.getId()!, room.roomId, expiresAt);
            }
        }
    }

    /**
     * Get the count of active (non-expired) stego messages.
     */
    public get activeCount(): number {
        const now = Date.now();
        let count = 0;
        for (const record of this.records.values()) {
            if (now < record.expiresAt) count++;
        }
        return count;
    }
}

/** Singleton instance. */
let instance: EphemeralManager | undefined;

/** Get the global EphemeralManager instance. */
export function getEphemeralManager(): EphemeralManager {
    if (!instance) {
        instance = new EphemeralManager();
    }
    return instance;
}
