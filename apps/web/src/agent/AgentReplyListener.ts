/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    EventType,
    type IRoomTimelineData,
    type MatrixClient,
    type MatrixEvent,
    MsgType,
    type Room,
    RelationType,
    RoomEvent,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import type { RoomMessageEventContent } from "matrix-js-sdk/src/types";
import type { AgentTurn } from "shared-types";

import type { AgentApi } from "./AgentApi";
import DMRoomMap from "../utils/DMRoomMap";
import { AgentRoomStore } from "./AgentRoomStore";

/** How long to wait after the partner's last message, so that several messages in a row get one reply */
export const REPLY_DELAY_MS = 5000;

/** How many of the latest messages the agent sees */
export const HISTORY_LENGTH = 30;

/** The kinds of message the agent answers. A notice is an automated message, which bots never answer */
const ANSWERED_MSGTYPES: ReadonlySet<string | undefined> = new Set<string | undefined>([MsgType.Text, MsgType.Emote]);

/**
 * A key in the content of a reply sent as a normal message with the `marker` marking. Clients don't show it, but
 * it lets agents recognise the reply as automated and not answer it.
 */
export const AGENT_REPLY_MARKER = "io.element.pilot.agent";

/**
 * Replies to the direct messages the user marked for the agent, through the agent of the platform.
 *
 * The marks are kept on this computer (see {@link AgentRoomStore}). When the partner writes in a marked room,
 * the conversation goes to the agent and its reply is sent marked as chosen for the room:
 * - `notice`: as a notice, which clients show as automated and other agents and bots never answer
 * - `marker`: as a normal message with the hidden {@link AGENT_REPLY_MARKER}, which keeps other agents of
 *   Element Pilot from answering it
 * - `none`: as a normal message, indistinguishable from one the user wrote
 *
 * Only new messages are answered: those sent before the client started are left alone.
 */
export class AgentReplyListener {
    private static instance?: AgentReplyListener;

    private client?: MatrixClient;
    private agent?: AgentApi;
    private startedAt = 0;
    /** Rooms waiting for the partner to finish writing, with the timer that starts the reply */
    private readonly scheduled = new Map<string, ReturnType<typeof setTimeout>>();
    /** Rooms for which a reply is being written */
    private readonly replying = new Set<string>();

    public static sharedInstance(): AgentReplyListener {
        AgentReplyListener.instance ??= new AgentReplyListener();
        return AgentReplyListener.instance;
    }

    /**
     * Start answering the direct messages in agent mode.
     * @param client - The client of the user the agent writes for
     * @param agent - The agent of the platform; without one, nothing is answered
     */
    public start(client: MatrixClient, agent: AgentApi | undefined): void {
        this.stop();
        if (!agent) return;
        this.client = client;
        this.agent = agent;
        this.startedAt = Date.now();
        client.on(RoomEvent.Timeline, this.onTimeline);
    }

    public stop(): void {
        this.client?.off(RoomEvent.Timeline, this.onTimeline);
        for (const timer of this.scheduled.values()) clearTimeout(timer);
        this.scheduled.clear();
        this.replying.clear();
        this.client = undefined;
        this.agent = undefined;
    }

    private readonly onTimeline = (
        event: MatrixEvent,
        room: Room | undefined,
        toStartOfTimeline: boolean | undefined,
        removed: boolean,
        data: IRoomTimelineData,
    ): void => {
        if (!room || toStartOfTimeline || removed || !data.liveEvent) return;
        void this.onLiveEvent(event, room);
    };

    private async onLiveEvent(event: MatrixEvent, room: Room): Promise<void> {
        const client = this.client;
        if (!client || event.getTs() < this.startedAt) return;
        // The type and content of an encrypted message are only known once it is decrypted
        await client.decryptEventIfNeeded(event);
        if (!this.isPartnerMessage(event, room) || !this.isAgentRoom(room)) return;

        // Wait for the partner to finish writing, so that several messages in a row get a single reply
        clearTimeout(this.scheduled.get(room.roomId));
        this.scheduled.set(
            room.roomId,
            setTimeout(() => {
                this.scheduled.delete(room.roomId);
                void this.reply(room);
            }, REPLY_DELAY_MS),
        );
    }

    /** Whether the room is a direct message marked for the agent */
    private isAgentRoom(room: Room): boolean {
        if (!DMRoomMap.shared()?.getUserIdForRoomId(room.roomId)) return false;
        return AgentRoomStore.instance.isAgentRoom(room.roomId);
    }

    /** Whether the event is a message of the chat partner that the agent answers */
    private isPartnerMessage(event: MatrixEvent, room: Room): boolean {
        if (event.getType() !== EventType.RoomMessage || event.isRedacted() || event.isRelation(RelationType.Replace)) {
            return false;
        }
        const partnerId = DMRoomMap.shared()?.getUserIdForRoomId(room.roomId);
        const content = event.getContent();
        return (
            event.getSender() === partnerId && ANSWERED_MSGTYPES.has(content.msgtype) && !content[AGENT_REPLY_MARKER]
        );
    }

    private async reply(room: Room): Promise<void> {
        const client = this.client;
        const agent = this.agent;
        // One reply at a time per room; a message arriving meanwhile is part of the history of the next one
        if (!client || !agent || this.replying.has(room.roomId) || !this.isAgentRoom(room)) return;

        const turns = this.getTurns(room);
        const lastEvent = this.getLastMessage(room);
        // Nothing to answer, for example because the user already answered themselves
        if (turns.at(-1)?.role !== "user" || !lastEvent) return;

        const myUserId = client.getSafeUserId();
        const partnerId = DMRoomMap.shared()?.getUserIdForRoomId(room.roomId) ?? "";
        this.replying.add(room.roomId);
        try {
            await client.sendTyping(room.roomId, true, 30000).catch(() => {});
            const result = await agent.generateReply({
                ownName: room.getMember(myUserId)?.name ?? myUserId,
                partnerName: room.getMember(partnerId)?.name ?? partnerId,
                partnerId,
                turns,
            });
            if (!result.ok) {
                logger.warn(`Agent could not reply in ${room.roomId}: ${result.error}`, result.message);
                return;
            }
            // Don't send a reply that is out of date: the user or the partner wrote in the meantime
            if (this.client !== client || this.getLastMessage(room) !== lastEvent) return;
            await client.sendMessage(room.roomId, this.getReplyContent(room.roomId, result.data));
        } catch (e) {
            logger.warn(`Agent could not reply in ${room.roomId}`, e);
        } finally {
            this.replying.delete(room.roomId);
            await client.sendTyping(room.roomId, false, 0).catch(() => {});
        }
    }

    /** The content of a reply, marked as automated as chosen for the room */
    private getReplyContent(roomId: string, body: string): RoomMessageEventContent {
        switch (AgentRoomStore.instance.getReplyMarking(roomId)) {
            case "marker":
                return { msgtype: MsgType.Text, body, [AGENT_REPLY_MARKER]: true } as RoomMessageEventContent;
            case "none":
                return { msgtype: MsgType.Text, body };
            default:
                return { msgtype: MsgType.Notice, body };
        }
    }

    /** The latest message of the room, by either side */
    private getLastMessage(room: Room): MatrixEvent | undefined {
        const events = room.getLiveTimeline().getEvents();
        for (let i = events.length - 1; i >= 0; i--) {
            if (events[i].getType() === EventType.RoomMessage && !events[i].isRedacted()) return events[i];
        }
        return undefined;
    }

    /**
     * The latest messages of the conversation, oldest first. Messages of the user, including earlier replies
     * of the agent, are the `assistant` side; messages of the partner the `user` side.
     */
    private getTurns(room: Room): AgentTurn[] {
        const myUserId = this.client?.getSafeUserId();
        const turns: AgentTurn[] = [];
        for (const event of room.getLiveTimeline().getEvents()) {
            if (event.getType() !== EventType.RoomMessage || event.isRedacted()) continue;
            if (event.isRelation(RelationType.Replace)) continue;
            const { body, msgtype } = event.getContent();
            if (typeof body !== "string" || !body.trim()) continue;

            if (event.getSender() === myUserId) {
                turns.push({ role: "assistant", text: body });
            } else if (ANSWERED_MSGTYPES.has(msgtype)) {
                turns.push({ role: "user", text: body });
            }
        }
        return turns.slice(-HISTORY_LENGTH);
    }
}
