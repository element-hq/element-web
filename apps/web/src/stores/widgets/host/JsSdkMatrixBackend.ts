/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import {
    ClientEvent,
    ConnectionError,
    Direction,
    EventType,
    type IContent,
    type MatrixClient,
    type MatrixEvent as SdkMatrixEvent,
    MatrixError,
    MatrixEventEvent,
    type ReceivedToDeviceMessage,
    type Room,
    RoomEvent,
    RoomStateEvent,
    type StateEvents,
    THREAD_RELATION_TYPE,
    type TimelineEvents,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import type {
    JsonValue,
    MatrixBackend,
    MatrixEvent,
    OpenIdToken,
    RelationDirection,
    RelationsChunk,
    RoomSink,
    RoomSubjects,
    StateKeySelector,
    Subscription,
    ToDeviceDelivery,
    ToDeviceMessage,
    ToDeviceSink,
} from "@matrix-widget-tools/widget-host-bindings";

import { type WidgetHostBindings } from "./bindings";
import { OwnProfileStore } from "../../OwnProfileStore";
import { readRoomTimeline } from "../readRoomTimeline";
import { CHAT_EFFECTS } from "../../../effects";
import { containsEmoji } from "../../../effects/utils";
import dis from "../../../dispatcher/dispatcher";

/**
 * The parts of the bindings the backend needs: error and event constructors, and the state key
 * selector tags. Passed in rather than imported so the backend never touches the wasm module and
 * tests can hand it plain fakes.
 */
export type MatrixBackendCodec = Pick<
    WidgetHostBindings,
    "BackendError" | "matrixEventFromJson" | "StateKeySelector_Tags" | "RelationDirection"
>;

/**
 * Forwards events of one room to the widget host driver while the widget holds the matching
 * `receive` capabilities. Created by {@link JsSdkMatrixBackend.subscribeRoom}.
 */
class RoomSubscription implements Subscription {
    private cancelled = false;
    private readonly pendingStateTypes = new Set<string>();
    private flushScheduled = false;

    public constructor(
        private readonly client: MatrixClient,
        private readonly room: Room,
        private readonly subjects: RoomSubjects,
        private readonly sink: RoomSink,
        private readonly toWidgetEvent: (ev: SdkMatrixEvent) => MatrixEvent | null,
    ) {
        room.on(RoomEvent.Timeline, this.onTimeline);
        room.on(RoomStateEvent.Events, this.onStateEvent);
        // The driver expects the current value of every requested state type right away.
        for (const eventType of subjects.stateEventTypes) {
            sink.onStateEvents(eventType, this.currentState(eventType));
        }
    }

    public cancel = (): void => {
        if (this.cancelled) return;
        this.cancelled = true;
        this.room.off(RoomEvent.Timeline, this.onTimeline);
        this.room.off(RoomStateEvent.Events, this.onStateEvent);
    };

    private currentState(eventType: string): MatrixEvent[] {
        return this.room.currentState
            .getStateEvents(eventType)
            .map(this.toWidgetEvent)
            .filter((ev): ev is MatrixEvent => ev !== null);
    }

    private onTimeline = (
        ev: SdkMatrixEvent,
        _room: Room | undefined,
        toStartOfTimeline: boolean | undefined,
        removed: boolean,
        data: { liveEvent?: boolean },
    ): void => {
        // Only new events: backfill and timeline resets are not something the widget asked for.
        if (removed || toStartOfTimeline || !data.liveEvent) return;
        void this.client.decryptEventIfNeeded(ev);
        if (ev.isBeingDecrypted()) {
            // The event type is only known once decrypted
            ev.once(MatrixEventEvent.Decrypted, () => this.feedTimelineEvent(ev));
        } else {
            this.feedTimelineEvent(ev);
        }
    };

    private feedTimelineEvent(ev: SdkMatrixEvent): void {
        if (this.cancelled || ev.isDecryptionFailure()) return;
        if (!this.subjects.timelineEventTypes.includes(ev.getType())) return;
        const converted = this.toWidgetEvent(ev);
        if (converted !== null) this.sink.onTimelineEvents([converted]);
    }

    private onStateEvent = (ev: SdkMatrixEvent): void => {
        const eventType = ev.getType();
        if (!this.subjects.stateEventTypes.includes(eventType)) return;
        // State often changes in bursts (initial sync, joins); deliver the full set per type once per tick.
        this.pendingStateTypes.add(eventType);
        if (!this.flushScheduled) {
            this.flushScheduled = true;
            queueMicrotask(this.flushState);
        }
    };

    private flushState = (): void => {
        this.flushScheduled = false;
        const types = [...this.pendingStateTypes];
        this.pendingStateTypes.clear();
        if (this.cancelled) return;
        for (const eventType of types) {
            this.sink.onStateEvents(eventType, this.currentState(eventType));
        }
    };
}

/**
 * Forwards received to-device messages of the requested types to the widget host driver. Created by
 * {@link JsSdkMatrixBackend.subscribeToDevice}.
 */
class ToDeviceSubscription implements Subscription {
    public constructor(
        private readonly client: MatrixClient,
        private readonly eventTypes: string[],
        private readonly sink: ToDeviceSink,
    ) {
        client.on(ClientEvent.ReceivedToDeviceMessage, this.onMessage);
    }

    public cancel = (): void => {
        this.client.off(ClientEvent.ReceivedToDeviceMessage, this.onMessage);
    };

    private onMessage = ({ message, encryptionInfo }: ReceivedToDeviceMessage): void => {
        if (!this.eventTypes.includes(message.type)) return;
        this.sink.onToDeviceMessage({
            eventType: message.type,
            sender: message.sender,
            content: message.content,
            encrypted: encryptionInfo != null,
        });
    };
}

/**
 * The `MatrixBackend` of the MSC4412 widget host driver, on matrix-js-sdk: identity for the
 * widget's `matrix_context`, sending and reading events in the widget's room, and the room
 * subscription that feeds events to the widget.
 */
export class JsSdkMatrixBackend implements MatrixBackend {
    private readonly subscriptions = new Set<Subscription>();

    public constructor(
        private readonly client: MatrixClient,
        private readonly room: Room,
        private readonly codec: MatrixBackendCodec,
    ) {}

    /** Cancels every subscription the driver still holds. */
    public dispose(): void {
        for (const subscription of this.subscriptions) subscription.cancel();
        this.subscriptions.clear();
    }

    public roomId(): string {
        return this.room.roomId;
    }

    public ownUserId(): string {
        return this.client.getSafeUserId();
    }

    public ownDeviceId(): string {
        return this.client.getDeviceId() ?? "";
    }

    public displayName(): string {
        return OwnProfileStore.instance.displayName ?? "";
    }

    public avatarUrl(): string {
        // Legacy widgets received the HTTP URL through `$matrix_avatar_url`; keep that for the wrapped ones.
        return OwnProfileStore.instance.getHttpAvatarUrl() ?? "";
    }

    public baseUrl(): string {
        return this.client.baseUrl;
    }

    public async sendRoomEvent(roomId: string, eventType: string, content: JsonValue): Promise<string> {
        return this.guard(async () => {
            const body = content as IContent;
            if (eventType === EventType.RoomRedaction) {
                // special case: extract the `redacts` property and call redact
                const r = await this.client.redactEvent(roomId, body["redacts"]);
                return r.event_id;
            }
            const r = await this.client.sendEvent(
                roomId,
                eventType as keyof TimelineEvents,
                body as TimelineEvents[keyof TimelineEvents],
            );
            if (eventType === EventType.RoomMessage) this.triggerChatEffects(body);
            return r.event_id;
        });
    }

    public async sendStateEvent(
        roomId: string,
        eventType: string,
        stateKey: string,
        content: JsonValue,
    ): Promise<string> {
        return this.guard(async () => {
            const r = await this.client.sendStateEvent(
                roomId,
                eventType as keyof StateEvents,
                content as StateEvents[keyof StateEvents],
                stateKey,
            );
            return r.event_id;
        });
    }

    public async sendStickyEvent(
        roomId: string,
        eventType: string,
        content: JsonValue,
        durationMs: bigint,
    ): Promise<string> {
        return this.guard(async () => {
            const r = await this.client._unstable_sendStickyEvent(
                roomId,
                Number(durationMs),
                null,
                eventType as keyof TimelineEvents,
                content as TimelineEvents[keyof TimelineEvents] & { msc4354_sticky_key: string },
            );
            return r.event_id;
        });
    }

    public async sendDelayedEvent(
        roomId: string,
        eventType: string,
        stateKey: string | undefined,
        content: JsonValue,
        delayMs: bigint,
    ): Promise<string> {
        return this.guard(async () => {
            if (stateKey !== undefined) {
                const r = await this.client._unstable_sendDelayedStateEvent(
                    roomId,
                    Number(delayMs),
                    eventType as keyof StateEvents,
                    content as StateEvents[keyof StateEvents],
                    stateKey,
                );
                return r.delay_id;
            }
            const r = await this.client._unstable_sendDelayedEvent(
                roomId,
                Number(delayMs),
                null,
                eventType as keyof TimelineEvents,
                content as TimelineEvents[keyof TimelineEvents],
            );
            return r.delay_id;
        });
    }

    public async sendDelayedStickyEvent(
        roomId: string,
        eventType: string,
        content: JsonValue,
        delayMs: bigint,
        durationMs: bigint,
    ): Promise<string> {
        return this.guard(async () => {
            const r = await this.client._unstable_sendStickyDelayedEvent(
                roomId,
                Number(durationMs),
                Number(delayMs),
                null,
                eventType as keyof TimelineEvents,
                content as TimelineEvents[keyof TimelineEvents] & { msc4354_sticky_key: string },
            );
            return r.delay_id;
        });
    }

    public async restartDelayedEvent(roomId: string, delayId: string): Promise<void> {
        await this.guard(() => this.client._unstable_restartScheduledDelayedEvent(delayId));
    }

    public async cancelDelayedEvent(roomId: string, delayId: string): Promise<void> {
        await this.guard(() => this.client._unstable_cancelScheduledDelayedEvent(delayId));
    }

    public async sendDelayedEventNow(roomId: string, delayId: string): Promise<void> {
        await this.guard(() => this.client._unstable_sendScheduledDelayedEvent(delayId));
    }

    public async readRoomEvents(
        roomId: string,
        eventType: string,
        msgtype: string | undefined,
        limit: number,
        since: string | undefined,
    ): Promise<MatrixEvent[]> {
        const room = this.getRoom(roomId);
        const events = [
            ...readRoomTimeline(room, {
                eventType,
                msgtype,
                limit: limit > 0 ? limit : Number.MAX_SAFE_INTEGER,
                since,
            }),
        ];
        // The timeline is walked newest first; the widget expects oldest first.
        return events
            .reverse()
            .map(this.toWidgetEvent)
            .filter((ev): ev is MatrixEvent => ev !== null);
    }

    public async readRoomState(roomId: string, eventType: string, stateKey: StateKeySelector): Promise<MatrixEvent[]> {
        const state = this.getRoom(roomId).currentState;
        let events: SdkMatrixEvent[];
        if (stateKey.tag === this.codec.StateKeySelector_Tags.Key) {
            const event = state.getStateEvents(eventType, stateKey.inner.key);
            events = event === null ? [] : [event];
        } else {
            events = state.getStateEvents(eventType);
        }
        return events.map(this.toWidgetEvent).filter((ev): ev is MatrixEvent => ev !== null);
    }

    public async relations(
        roomId: string,
        eventId: string,
        relType: string | undefined,
        eventType: string | undefined,
        from: string | undefined,
        to: string | undefined,
        limit: number | undefined,
        direction: RelationDirection | undefined,
    ): Promise<RelationsChunk> {
        return this.guard(async () => {
            let dir: Direction | undefined;
            if (direction !== undefined) {
                dir = direction === this.codec.RelationDirection.Backward ? Direction.Backward : Direction.Forward;
            }
            const { events, nextBatch, prevBatch } = await this.client.relations(
                roomId,
                eventId,
                relType ?? null,
                eventType ?? null,
                { from, to, limit, dir },
            );
            return {
                chunk: events.map(this.toWidgetEvent).filter((ev): ev is MatrixEvent => ev !== null),
                nextBatch: nextBatch ?? undefined,
                prevBatch: prevBatch ?? undefined,
            };
        });
    }

    public async sendToDeviceMessage(
        encrypted: boolean,
        eventType: string,
        messages: ToDeviceMessage[],
    ): Promise<ToDeviceDelivery[]> {
        return this.guard(async () => {
            if (encrypted) {
                const crypto = this.client.getCrypto();
                if (!crypto) throw new Error("E2EE not enabled");

                // Batch recipients of identical content into one encrypted send. "*" means every
                // device, which the server expands for plaintext sends but we have to for encrypted ones.
                const recipientsByContent = new Map<string, { userId: string; deviceId: string }[]>();
                for (const { userId, deviceId, content } of messages) {
                    const key = JSON.stringify(content);
                    let deviceIds = [deviceId];
                    if (deviceId === "*") {
                        const devices = await crypto.getUserDeviceInfo([userId], true);
                        deviceIds = [...(devices.get(userId)?.keys() ?? [])];
                    }
                    const recipients = recipientsByContent.get(key) ?? [];
                    recipientsByContent.set(key, recipients);
                    for (const id of deviceIds) recipients.push({ userId, deviceId: id });
                }

                await Promise.all(
                    [...recipientsByContent].map(async ([key, recipients]) => {
                        const batch = await crypto.encryptToDeviceMessages(eventType, recipients, JSON.parse(key));
                        await this.client.queueToDevice(batch);
                    }),
                );
            } else {
                await this.client.queueToDevice({
                    eventType,
                    batch: messages.map(({ userId, deviceId, content }) => ({
                        userId,
                        deviceId,
                        payload: content as object,
                    })),
                });
            }
            // Queued sends have no per-recipient outcome; everything was accepted
            return messages.map(({ userId, deviceId }) => ({ userId, deviceId }));
        });
    }

    public async openidToken(): Promise<OpenIdToken> {
        return this.guard(async () => {
            const token = await this.client.getOpenIdToken();
            return {
                accessToken: token.access_token,
                tokenType: token.token_type,
                matrixServerName: token.matrix_server_name,
                expiresIn: BigInt(token.expires_in),
            };
        });
    }

    public subscribeRoom(roomId: string, subjects: RoomSubjects, sink: RoomSink): Subscription {
        const room = this.getRoom(roomId);
        return this.track(new RoomSubscription(this.client, room, subjects, sink, this.toWidgetEvent));
    }

    public subscribeToDevice(eventTypes: string[], sink: ToDeviceSink): Subscription {
        return this.track(new ToDeviceSubscription(this.client, eventTypes, sink));
    }

    /** Remembers a subscription so that {@link dispose} can cancel it, and removes it once cancelled. */
    private track(subscription: Subscription): Subscription {
        const tracked: Subscription = {
            cancel: () => {
                subscription.cancel();
                this.subscriptions.delete(tracked);
            },
        };
        this.subscriptions.add(tracked);
        return tracked;
    }

    private getRoom(roomId: string): Room {
        const room = roomId === this.room.roomId ? this.room : this.client.getRoom(roomId);
        if (room === null) throw new this.codec.BackendError.Failed({ reason: `Unknown room ${roomId}` });
        return room;
    }

    /**
     * Converts a js-sdk event into the driver's record. Events that are not (yet) readable, such as
     * ones still being decrypted, are skipped.
     */
    private toWidgetEvent = (ev: SdkMatrixEvent): MatrixEvent | null => {
        if (ev.isBeingDecrypted() || ev.isDecryptionFailure()) return null;
        try {
            return this.codec.matrixEventFromJson(JSON.stringify(ev.getEffectiveEvent()));
        } catch (e) {
            logger.warn(`Could not convert event ${ev.getId()} for the widget host`, e);
            return null;
        }
    };

    /** Runs a client call and translates its failure into the driver's error type. */
    private async guard<T>(fn: () => Promise<T>): Promise<T> {
        try {
            return await fn();
        } catch (e) {
            throw this.toBackendError(e);
        }
    }

    private toBackendError(e: unknown): Error {
        const { Failed } = this.codec.BackendError;
        if (e instanceof MatrixError) {
            return new Failed({ errcode: e.errcode, status: e.httpStatus, reason: e.message });
        }
        if (e instanceof ConnectionError) {
            return new Failed({ reason: e.message });
        }
        return new Failed({ reason: e instanceof Error ? e.message : String(e) });
    }

    private triggerChatEffects(content: IContent): void {
        CHAT_EFFECTS.forEach((effect) => {
            if (containsEmoji(content, effect.emojis)) {
                // For initial threads launch, chat effects are disabled
                // see #19731
                const isNotThread = content["m.relates_to"]?.rel_type !== THREAD_RELATION_TYPE.name;
                if (isNotThread) {
                    dis.dispatch({ action: `effects.${effect.command}` });
                }
            }
        });
    }
}
