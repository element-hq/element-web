/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { TypedEventEmitter } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import type { AgentReplyMarking } from "shared-types";

import type { AgentApi } from "./AgentApi";

export enum AgentRoomStoreEvent {
    /** The marked rooms or how replies are marked in them changed, or the store started or stopped */
    Update = "update",
}

type EventHandlerMap = {
    [AgentRoomStoreEvent.Update]: () => void;
};

/**
 * The direct messages the user marked for the agent to reply in, and how its replies are marked in each of them.
 *
 * Both are kept by the platform's agent on this computer only, never on the homeserver. This store holds a
 * copy of them so that the room list and {@link AgentReplyListener} can read them synchronously.
 */
export class AgentRoomStore extends TypedEventEmitter<AgentRoomStoreEvent, EventHandlerMap> {
    private static internalInstance?: AgentRoomStore;

    private agent?: AgentApi;
    private userId?: string;
    private rooms = new Set<string>();
    /** How the agent's replies are marked, for the rooms that don't use the default */
    private replyMarkings = new Map<string, AgentReplyMarking>();

    public static get instance(): AgentRoomStore {
        AgentRoomStore.internalInstance ??= new AgentRoomStore();
        return AgentRoomStore.internalInstance;
    }

    /** Whether rooms can be marked: only on a platform with an agent */
    public get isAvailable(): boolean {
        return Boolean(this.agent);
    }

    /**
     * Read the marked rooms of a user, and how the agent's replies are marked in them.
     * @param agent - The agent of the platform; without one, no room can be marked
     * @param userId - The Matrix user whose rooms to read
     */
    public async start(agent: AgentApi | undefined, userId: string): Promise<void> {
        this.agent = agent;
        this.userId = userId;
        this.rooms = new Set();
        this.replyMarkings = new Map();
        this.emit(AgentRoomStoreEvent.Update);
        if (!agent) return;

        const [rooms, replyMarkings] = await Promise.all([agent.getRooms(userId), agent.getReplyMarkings(userId)]);
        // Another user may have logged in meanwhile
        if (this.agent !== agent || this.userId !== userId) return;
        if (rooms.ok) {
            this.rooms = new Set(rooms.data);
        } else {
            logger.warn(`Could not read the rooms of the agent: ${rooms.error}`, rooms.message);
        }
        if (replyMarkings.ok) {
            this.replyMarkings = new Map(Object.entries(replyMarkings.data));
        } else {
            logger.warn(
                `Could not read how the agent's replies are marked: ${replyMarkings.error}`,
                replyMarkings.message,
            );
        }
        this.emit(AgentRoomStoreEvent.Update);
    }

    public stop(): void {
        this.agent = undefined;
        this.userId = undefined;
        this.rooms = new Set();
        this.replyMarkings = new Map();
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

    /** How the agent's replies in a room show that they are automated; `notice` unless the user changed it */
    public getReplyMarking(roomId: string): AgentReplyMarking {
        return this.replyMarkings.get(roomId) ?? "notice";
    }

    /**
     * Set how the agent's replies in a room show that they are automated. The change shows straight away, and is
     * undone if the platform can't save it.
     */
    public async setReplyMarking(roomId: string, marking: AgentReplyMarking): Promise<void> {
        const { agent, userId } = this;
        const previous = this.getReplyMarking(roomId);
        if (!agent || !userId || previous === marking) return;

        this.updateReplyMarking(roomId, marking);
        const result = await agent.setReplyMarking(userId, roomId, marking);
        if (!result.ok) {
            logger.warn(`Could not change how the agent's replies are marked in ${roomId}: ${result.error}`);
            if (this.agent === agent) this.updateReplyMarking(roomId, previous);
        }
    }

    private updateReplyMarking(roomId: string, marking: AgentReplyMarking): void {
        if (marking === "notice") this.replyMarkings.delete(roomId);
        else this.replyMarkings.set(roomId, marking);
        this.emit(AgentRoomStoreEvent.Update);
    }
}
