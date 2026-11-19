/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    ClientEvent,
    type MatrixClient,
    type ReceivedToDeviceMessage,
    type SendToDeviceContentMap,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import {
    type IncomingToDeviceMessage,
    type OutgoingToDeviceMessage,
    type ToDeviceApi as IToDeviceApi,
} from "@element-hq/element-web-module-api";

type MatrixSessionIdentity = { readonly userId: string; readonly deviceId: string };
type Subscription = {
    readonly type: string;
    readonly listener: (message: IncomingToDeviceMessage) => void;
};

/** Sends to-device messages and keeps module subscriptions across Matrix sessions. */
export class ToDeviceApi implements IToDeviceApi {
    private readonly subscriptions = new Set<Subscription>();
    private client: MatrixClient | null;
    private session: MatrixSessionIdentity | null = null;
    private receivedListener: ((payload: ReceivedToDeviceMessage) => void) | null = null;

    /** Create the transport with its current client, or null when no session is active. */
    public constructor(client: MatrixClient | null) {
        this.client = client;
    }

    /** Send one message without waiting for a response. */
    public sendMessage = async (message: OutgoingToDeviceMessage): Promise<void> => {
        const client = this.client;
        const session = this.getSession();
        if (!client || !session || !this.isCurrentSession(client, session)) {
            throw new Error("No active Matrix session");
        }

        const contentMap: SendToDeviceContentMap = new Map([
            [message.recipientUserId, new Map([[message.recipientDeviceId, message.content]])],
        ]);
        try {
            await client.sendToDevice(message.type, contentMap);
        } catch {
            throw new Error("Failed to send to-device message");
        }
    };

    /** Register a listener that follows the active Matrix session until unsubscribed. */
    public onMessage = (type: string, listener: (message: IncomingToDeviceMessage) => void): (() => void) => {
        if (typeof type !== "string") {
            throw new Error("Invalid to-device event type");
        }
        if (typeof listener !== "function") {
            throw new TypeError("Invalid to-device listener");
        }

        const subscription: Subscription = { type, listener };
        this.subscriptions.add(subscription);
        try {
            this.attach();
        } catch (error) {
            this.subscriptions.delete(subscription);
            throw error;
        }

        return (): void => {
            if (!this.subscriptions.delete(subscription)) return;
            if (this.subscriptions.size === 0) this.detach();
        };
    };

    /** Set the current session client, or suspend delivery during logout. */
    public setClient(client: MatrixClient | null): void {
        this.detach();
        this.client = client;
        this.session = null;
        this.attach();
    }

    private onReceived(payload: ReceivedToDeviceMessage, client: MatrixClient, session: MatrixSessionIdentity): void {
        if (this.client !== client || this.session !== session) return;
        if (!this.isCurrentSession(client, session)) {
            this.setClient(null);
            return;
        }

        const message = payload?.message;
        if (!message || typeof message.type !== "string" || typeof message.sender !== "string") return;

        // A listener registered during delivery should start with the next message.
        for (const subscription of Array.from(this.subscriptions)) {
            if (this.client !== client || this.session !== session || !this.isCurrentSession(client, session)) break;
            if (!this.subscriptions.has(subscription) || subscription.type !== message.type) continue;
            try {
                subscription.listener({ type: message.type, sender: message.sender, content: message.content });
            } catch {
                // A module listener must not interrupt delivery to other subscribers.
                logger.error("To-device module listener failed");
            }
        }
    }

    private attach(): void {
        if (this.receivedListener || this.subscriptions.size === 0 || !this.client) return;
        const client = this.client;
        const session = this.getSession();
        if (!session || !this.isCurrentSession(client, session)) return;
        const listener = (payload: ReceivedToDeviceMessage): void => this.onReceived(payload, client, session);
        client.on(ClientEvent.ReceivedToDeviceMessage, listener);
        this.receivedListener = listener;
    }

    private detach(): void {
        if (!this.receivedListener || !this.client) return;
        this.client.off(ClientEvent.ReceivedToDeviceMessage, this.receivedListener);
        this.receivedListener = null;
    }

    private getSessionIdentity(client: MatrixClient): MatrixSessionIdentity | null {
        const userId = client.getUserId();
        const deviceId = client.getDeviceId();
        if (!userId || !deviceId) return null;
        return { userId, deviceId };
    }

    private getSession(): MatrixSessionIdentity | null {
        if (this.client && !this.session) this.session = this.getSessionIdentity(this.client);
        return this.session;
    }

    private isCurrentSession(client: MatrixClient, session: MatrixSessionIdentity): boolean {
        if (this.client !== client) return false;
        const current = this.getSessionIdentity(client);
        return current?.userId === session.userId && current.deviceId === session.deviceId;
    }
}
