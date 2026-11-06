/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { TypedEventEmitter } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import type { AgentApi } from "./AgentApi";

export enum AgentRoomStoreEvent {
    /** The marked rooms changed, or the store started or stopped */
    Update = "update",
}

type EventHandlerMap = {
    [AgentRoomStoreEvent.Update]: () => void;
};

/**
 * The direct messages the user marked for the agent to reply in.
 *
 * The marks are kept by the platform's agent on this computer only, never on the homeserver. This store holds a
 * copy of them so that the room list and {@link AgentReplyListener} can read them synchronously.
 */
export class AgentRoomStore extends TypedEventEmitter<AgentRoomStoreEvent, EventHandlerMap> {
    private static internalInstance?: AgentRoomStore;

    private agent?: AgentApi;
    private userId?: string;
    private rooms = new Set<string>();

    public static get instance(): AgentRoomStore {
        AgentRoomStore.internalInstance ??= new AgentRoomStore();
        return AgentRoomStore.internalInstance;
    }

    /** Whether rooms can be marked: only on a platform with an agent */
    public get isAvailable(): boolean {
        return Boolean(this.agent);
    }

    /**
     * Read the marked rooms of a user.
     * @param agent - The agent of the platform; without one, no room can be marked
     * @param userId - The Matrix user whose rooms to read
     */
    public async start(agent: AgentApi | undefined, userId: string): Promise<void> {
        this.agent = agent;
        this.userId = userId;
        this.rooms = new Set();
        this.emit(AgentRoomStoreEvent.Update);
        if (!agent) return;

        const result = await agent.getRooms(userId);
        // Another user may have logged in meanwhile
        if (this.agent !== agent || this.userId !== userId) return;
        if (result.ok) {
            this.rooms = new Set(result.data);
            this.emit(AgentRoomStoreEvent.Update);
        } else {
            logger.warn(`Could not read the rooms of the agent: ${result.error}`, result.message);
        }
    }

    public stop(): void {
        this.agent = undefined;
        this.userId = undefined;
        this.rooms = new Set();
        this.emit(AgentRoomStoreEvent.Update);
    }

    /** Whether the agent replies in a room */
    public isAgentRoom(roomId: string): boolean {
        return this.rooms.has(roomId);
    }

    /**
     * Mark a room for the agent to reply in, or unmark it. The change shows straight away, and is undone if the
     * platform can't save it.
     */
    public async setAgentRoom(roomId: string, enabled: boolean): Promise<void> {
        const { agent, userId } = this;
        if (!agent || !userId || this.isAgentRoom(roomId) === enabled) return;

        this.updateRoom(roomId, enabled);
        const result = await agent.setRoom(userId, roomId, enabled);
        if (!result.ok) {
            logger.warn(`Could not change the agent mark of ${roomId}: ${result.error}`, result.message);
            if (this.agent === agent) this.updateRoom(roomId, !enabled);
        }
    }

    private updateRoom(roomId: string, enabled: boolean): void {
        if (enabled) this.rooms.add(roomId);
        else this.rooms.delete(roomId);
        this.emit(AgentRoomStoreEvent.Update);
    }
}
