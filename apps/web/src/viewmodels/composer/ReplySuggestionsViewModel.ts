/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    EventType,
    type IRoomTimelineData,
    type MatrixClient,
    type MatrixEvent,
    RelationType,
    type Room,
    RoomEvent,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import {
    BaseViewModel,
    type ReplySuggestionsViewModel as ReplySuggestionsViewModelInterface,
    type ReplySuggestionsViewSnapshot,
} from "@element-hq/web-shared-components";
import type { AgentSuggestionMessage } from "shared-types";

import type { AgentApi } from "../../agent/AgentApi";
import { AgentRoomStore } from "../../agent/AgentRoomStore";
import DMRoomMap from "../../utils/DMRoomMap";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";
import { type ComposerInsertPayload } from "../../dispatcher/payloads/ComposerInsertPayload";
import { TimelineRenderingType } from "../../contexts/RoomContext";

/** How long to wait after a new message, so that several messages in a row get one set of suggestions */
export const SUGGESTION_DELAY_MS = 1000;

/** How many of the latest messages the agent sees */
export const HISTORY_LENGTH = 30;

export interface ReplySuggestionsViewModelProps {
    client: MatrixClient;
    room: Room;
    /** The agent of the platform; without one, nothing is suggested */
    agent?: AgentApi;
}

/** The suggestions for the latest message of each room, so that they are not written again on coming back */
const suggestionsCache = new Map<string, { eventId: string; suggestions: string[] }>();

/**
 * Suggests replies to the latest message of a room, written by the agent of the platform.
 *
 * Suggestions are only written when a provider is connected, they are turned on in the agent settings, the latest
 * message is from someone else, and the agent
 * doesn't already reply in the room by itself. Picking one puts it into the composer, so it can be edited before
 * sending.
 */
export class ReplySuggestionsViewModel
    extends BaseViewModel<ReplySuggestionsViewSnapshot, ReplySuggestionsViewModelProps>
    implements ReplySuggestionsViewModelInterface
{
    /** Whether a provider is connected and suggestions are turned on; until known, nothing is requested */
    private enabled = false;
    private timer?: ReturnType<typeof setTimeout>;
    /** The message the suggestions being written are for; a later message makes them out of date */
    private pendingEventId?: string;

    public constructor(props: ReplySuggestionsViewModelProps) {
        const cached = suggestionsCache.get(props.room.roomId);
        const lastMessage = ReplySuggestionsViewModel.getLastMessage(props.room);
        const isCurrent = Boolean(cached && lastMessage && cached.eventId === lastMessage.getId());
        super(props, { suggestions: isCurrent ? cached!.suggestions : [], loading: false });
        if (!props.agent) return;

        // Registered by hand: trackListener only takes listeners without typed arguments
        props.room.on(RoomEvent.Timeline, this.onTimeline);
        this.disposables.track(() => props.room.off(RoomEvent.Timeline, this.onTimeline));
        this.disposables.track(() => clearTimeout(this.timer));
        void this.checkEnabled(props.agent);
    }

    /**
     * Put a suggestion into the composer.
     */
    public onSuggestionClick = (suggestion: string): void => {
        defaultDispatcher.dispatch<ComposerInsertPayload>({
            action: Action.ComposerInsert,
            text: suggestion,
            timelineRenderingType: TimelineRenderingType.Room,
        });
        defaultDispatcher.dispatch({ action: Action.FocusSendMessageComposer });
    };

    private async checkEnabled(agent: AgentApi): Promise<void> {
        try {
            const status = await agent.getStatus();
            this.enabled = status.replySuggestions && status.connected[status.provider];
        } catch (e) {
            logger.warn("Could not read the status of the agent", e);
        }
        if (!this.disposables.isDisposed) this.update();
    }

    private readonly onTimeline = (
        event: MatrixEvent,
        _room: Room | undefined,
        toStartOfTimeline: boolean | undefined,
        removed: boolean,
        data: IRoomTimelineData,
    ): void => {
        if (toStartOfTimeline || removed || !data.liveEvent) return;
        void this.onLiveEvent(event);
    };

    private async onLiveEvent(event: MatrixEvent): Promise<void> {
        // The type and content of an encrypted message are only known once it is decrypted
        await this.props.client.decryptEventIfNeeded(event);
        if (event.getType() !== EventType.RoomMessage || this.disposables.isDisposed) return;

        // Wait for more messages in a row, so that they get one set of suggestions
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.update(), SUGGESTION_DELAY_MS);
    }

    /**
     * Show the suggestions for the latest message, writing them if needed.
     */
    private update(): void {
        const { room, agent } = this.props;
        const lastMessage = ReplySuggestionsViewModel.getLastMessage(room);
        const eventId = lastMessage?.getId();
        const myUserId = this.props.client.getSafeUserId();

        // Nothing to answer: the user wrote last, or the agent answers by itself
        if (
            !agent ||
            !this.enabled ||
            !lastMessage ||
            !eventId ||
            lastMessage.getSender() === myUserId ||
            AgentRoomStore.instance.isAgentRoom(room.roomId)
        ) {
            this.pendingEventId = undefined;
            this.snapshot.merge({ suggestions: [], loading: false });
            return;
        }

        const cached = suggestionsCache.get(room.roomId);
        if (cached?.eventId === eventId) {
            this.snapshot.merge({ suggestions: cached.suggestions, loading: false });
            return;
        }
        if (this.pendingEventId === eventId) return;

        this.pendingEventId = eventId;
        this.snapshot.merge({ suggestions: [], loading: true });
        void this.requestSuggestions(agent, eventId);
    }

    private async requestSuggestions(agent: AgentApi, eventId: string): Promise<void> {
        const { room, client } = this.props;
        const myUserId = client.getSafeUserId();
        const result = await agent
            .generateSuggestions({
                ownName: room.getMember(myUserId)?.name ?? myUserId,
                chatName: room.name,
                isDirect: Boolean(DMRoomMap.shared()?.getUserIdForRoomId(room.roomId)),
                messages: this.getMessages(),
            })
            .catch((e) => {
                logger.warn(`Could not get reply suggestions in ${room.roomId}`, e);
                return undefined;
            });
        // A newer message came in, or the room was left, while the suggestions were written
        if (this.pendingEventId !== eventId || this.disposables.isDisposed) return;
        this.pendingEventId = undefined;

        if (!result?.ok) {
            if (result)
                logger.warn(`Could not get reply suggestions in ${room.roomId}: ${result.error}`, result.message);
            if (result?.error === "not_connected" || result?.error === "disabled") this.enabled = false;
            this.snapshot.merge({ suggestions: [], loading: false });
            return;
        }
        suggestionsCache.set(room.roomId, { eventId, suggestions: result.data });
        this.snapshot.merge({ suggestions: result.data, loading: false });
    }

    /** The latest message of the room, by anyone */
    private static getLastMessage(room: Room): MatrixEvent | undefined {
        const events = room.getLiveTimeline().getEvents();
        for (let i = events.length - 1; i >= 0; i--) {
            const event = events[i];
            if (event.getType() !== EventType.RoomMessage || event.isRedacted()) continue;
            if (event.isRelation(RelationType.Replace)) continue;
            return event;
        }
        return undefined;
    }

    /** The latest messages of the room with text, oldest first */
    private getMessages(): AgentSuggestionMessage[] {
        const myUserId = this.props.client.getSafeUserId();
        const messages: AgentSuggestionMessage[] = [];
        for (const event of this.props.room.getLiveTimeline().getEvents()) {
            if (event.getType() !== EventType.RoomMessage || event.isRedacted()) continue;
            if (event.isRelation(RelationType.Replace)) continue;
            const { body } = event.getContent();
            if (typeof body !== "string" || !body.trim()) continue;
            messages.push({
                sender: event.sender?.name ?? event.getSender() ?? "",
                own: event.getSender() === myUserId,
                text: body,
            });
        }
        return messages.slice(-HISTORY_LENGTH);
    }
}
