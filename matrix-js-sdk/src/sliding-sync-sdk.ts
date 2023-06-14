/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import type { SyncCryptoCallbacks } from "./common-crypto/CryptoBackend";
import { NotificationCountType, Room, RoomEvent } from "./models/room";
import { logger } from "./logger";
import { promiseMapSeries } from "./utils";
import { EventTimeline } from "./models/event-timeline";
import { ClientEvent, IStoredClientOpts, MatrixClient } from "./client";
import {
    ISyncStateData,
    SyncState,
    _createAndReEmitRoom,
    SyncApiOptions,
    defaultClientOpts,
    defaultSyncApiOpts,
} from "./sync";
import { MatrixEvent } from "./models/event";
import { Crypto } from "./crypto";
import { IMinimalEvent, IRoomEvent, IStateEvent, IStrippedState, ISyncResponse } from "./sync-accumulator";
import { MatrixError } from "./http-api";
import {
    Extension,
    ExtensionState,
    MSC3575RoomData,
    MSC3575SlidingSyncResponse,
    SlidingSync,
    SlidingSyncEvent,
    SlidingSyncState,
} from "./sliding-sync";
import { EventType } from "./@types/event";
import { IPushRules } from "./@types/PushRules";
import { RoomStateEvent } from "./models/room-state";
import { RoomMemberEvent } from "./models/room-member";

// Number of consecutive failed syncs that will lead to a syncState of ERROR as opposed
// to RECONNECTING. This is needed to inform the client of server issues when the
// keepAlive is successful but the server /sync fails.
const FAILED_SYNC_ERROR_THRESHOLD = 3;

type ExtensionE2EERequest = {
    enabled: boolean;
};

type ExtensionE2EEResponse = Pick<
    ISyncResponse,
    | "device_lists"
    | "device_one_time_keys_count"
    | "device_unused_fallback_key_types"
    | "org.matrix.msc2732.device_unused_fallback_key_types"
>;

class ExtensionE2EE implements Extension<ExtensionE2EERequest, ExtensionE2EEResponse> {
    public constructor(private readonly crypto: Crypto) {}

    public name(): string {
        return "e2ee";
    }

    public when(): ExtensionState {
        return ExtensionState.PreProcess;
    }

    public onRequest(isInitial: boolean): ExtensionE2EERequest | undefined {
        if (!isInitial) {
            return undefined;
        }
        return {
            enabled: true, // this is sticky so only send it on the initial request
        };
    }

    public async onResponse(data: ExtensionE2EEResponse): Promise<void> {
        // Handle device list updates
        if (data.device_lists) {
            await this.crypto.processDeviceLists(data.device_lists);
        }

        // Handle one_time_keys_count and unused_fallback_key_types
        await this.crypto.processKeyCounts(
            data.device_one_time_keys_count,
            data["device_unused_fallback_key_types"] || data["org.matrix.msc2732.device_unused_fallback_key_types"],
        );

        this.crypto.onSyncCompleted({});
    }
}

type ExtensionToDeviceRequest = {
    since?: string;
    limit?: number;
    enabled?: boolean;
};

type ExtensionToDeviceResponse = {
    events: Required<ISyncResponse>["to_device"]["events"];
    next_batch: string | null;
};

class ExtensionToDevice implements Extension<ExtensionToDeviceRequest, ExtensionToDeviceResponse> {
    private nextBatch: string | null = null;

    public constructor(private readonly client: MatrixClient, private readonly cryptoCallbacks?: SyncCryptoCallbacks) {}

    public name(): string {
        return "to_device";
    }

    public when(): ExtensionState {
        return ExtensionState.PreProcess;
    }

    public onRequest(isInitial: boolean): ExtensionToDeviceRequest {
        const extReq: ExtensionToDeviceRequest = {
            since: this.nextBatch !== null ? this.nextBatch : undefined,
        };
        if (isInitial) {
            extReq["limit"] = 100;
            extReq["enabled"] = true;
        }
        return extReq;
    }

    public async onResponse(data: ExtensionToDeviceResponse): Promise<void> {
        const cancelledKeyVerificationTxns: string[] = [];
        let events = data["events"] || [];
        if (events.length > 0 && this.cryptoCallbacks) {
            events = await this.cryptoCallbacks.preprocessToDeviceMessages(events);
        }
        events
            .map(this.client.getEventMapper())
            .map((toDeviceEvent) => {
                // map is a cheap inline forEach
                // We want to flag m.key.verification.start events as cancelled
                // if there's an accompanying m.key.verification.cancel event, so
                // we pull out the transaction IDs from the cancellation events
                // so we can flag the verification events as cancelled in the loop
                // below.
                if (toDeviceEvent.getType() === "m.key.verification.cancel") {
                    const txnId: string | undefined = toDeviceEvent.getContent()["transaction_id"];
                    if (txnId) {
                        cancelledKeyVerificationTxns.push(txnId);
                    }
                }

                // as mentioned above, .map is a cheap inline forEach, so return
                // the unmodified event.
                return toDeviceEvent;
            })
            .forEach((toDeviceEvent) => {
                const content = toDeviceEvent.getContent();
                if (toDeviceEvent.getType() == "m.room.message" && content.msgtype == "m.bad.encrypted") {
                    // the mapper already logged a warning.
                    logger.log("Ignoring undecryptable to-device event from " + toDeviceEvent.getSender());
                    return;
                }

                if (
                    toDeviceEvent.getType() === "m.key.verification.start" ||
                    toDeviceEvent.getType() === "m.key.verification.request"
                ) {
                    const txnId = content["transaction_id"];
                    if (cancelledKeyVerificationTxns.includes(txnId)) {
                        toDeviceEvent.flagCancelled();
                    }
                }

                this.client.emit(ClientEvent.ToDeviceEvent, toDeviceEvent);
            });

        this.nextBatch = data.next_batch;
    }
}

type ExtensionAccountDataRequest = {
    enabled: boolean;
};

type ExtensionAccountDataResponse = {
    global: IMinimalEvent[];
    rooms: Record<string, IMinimalEvent[]>;
};

class ExtensionAccountData implements Extension<ExtensionAccountDataRequest, ExtensionAccountDataResponse> {
    public constructor(private readonly client: MatrixClient) {}

    public name(): string {
        return "account_data";
    }

    public when(): ExtensionState {
        return ExtensionState.PostProcess;
    }

    public onRequest(isInitial: boolean): ExtensionAccountDataRequest | undefined {
        if (!isInitial) {
            return undefined;
        }
        return {
            enabled: true,
        };
    }

    public onResponse(data: ExtensionAccountDataResponse): void {
        if (data.global && data.global.length > 0) {
            this.processGlobalAccountData(data.global);
        }

        for (const roomId in data.rooms) {
            const accountDataEvents = mapEvents(this.client, roomId, data.rooms[roomId]);
            const room = this.client.getRoom(roomId);
            if (!room) {
                logger.warn("got account data for room but room doesn't exist on client:", roomId);
                continue;
            }
            room.addAccountData(accountDataEvents);
            accountDataEvents.forEach((e) => {
                this.client.emit(ClientEvent.Event, e);
            });
        }
    }

    private processGlobalAccountData(globalAccountData: IMinimalEvent[]): void {
        const events = mapEvents(this.client, undefined, globalAccountData);
        const prevEventsMap = events.reduce<Record<string, MatrixEvent | undefined>>((m, c) => {
            m[c.getType()] = this.client.store.getAccountData(c.getType());
            return m;
        }, {});
        this.client.store.storeAccountDataEvents(events);
        events.forEach((accountDataEvent) => {
            // Honour push rules that come down the sync stream but also
            // honour push rules that were previously cached. Base rules
            // will be updated when we receive push rules via getPushRules
            // (see sync) before syncing over the network.
            if (accountDataEvent.getType() === EventType.PushRules) {
                const rules = accountDataEvent.getContent<IPushRules>();
                this.client.setPushRules(rules);
            }
            const prevEvent = prevEventsMap[accountDataEvent.getType()];
            this.client.emit(ClientEvent.AccountData, accountDataEvent, prevEvent);
            return accountDataEvent;
        });
    }
}

type ExtensionTypingRequest = {
    enabled: boolean;
};

type ExtensionTypingResponse = {
    rooms: Record<string, IMinimalEvent>;
};

class ExtensionTyping implements Extension<ExtensionTypingRequest, ExtensionTypingResponse> {
    public constructor(private readonly client: MatrixClient) {}

    public name(): string {
        return "typing";
    }

    public when(): ExtensionState {
        return ExtensionState.PostProcess;
    }

    public onRequest(isInitial: boolean): ExtensionTypingRequest | undefined {
        if (!isInitial) {
            return undefined; // don't send a JSON object for subsequent requests, we don't need to.
        }
        return {
            enabled: true,
        };
    }

    public onResponse(data: ExtensionTypingResponse): void {
        if (!data?.rooms) {
            return;
        }

        for (const roomId in data.rooms) {
            processEphemeralEvents(this.client, roomId, [data.rooms[roomId]]);
        }
    }
}

type ExtensionReceiptsRequest = {
    enabled: boolean;
};

type ExtensionReceiptsResponse = {
    rooms: Record<string, IMinimalEvent>;
};

class ExtensionReceipts implements Extension<ExtensionReceiptsRequest, ExtensionReceiptsResponse> {
    public constructor(private readonly client: MatrixClient) {}

    public name(): string {
        return "receipts";
    }

    public when(): ExtensionState {
        return ExtensionState.PostProcess;
    }

    public onRequest(isInitial: boolean): ExtensionReceiptsRequest | undefined {
        if (isInitial) {
            return {
                enabled: true,
            };
        }
        return undefined; // don't send a JSON object for subsequent requests, we don't need to.
    }

    public onResponse(data: ExtensionReceiptsResponse): void {
        if (!data?.rooms) {
            return;
        }

        for (const roomId in data.rooms) {
            processEphemeralEvents(this.client, roomId, [data.rooms[roomId]]);
        }
    }
}

/**
 * A copy of SyncApi such that it can be used as a drop-in replacement for sync v2. For the actual
 * sliding sync API, see sliding-sync.ts or the class SlidingSync.
 */
export class SlidingSyncSdk {
    private readonly opts: IStoredClientOpts;
    private readonly syncOpts: SyncApiOptions;
    private syncState: SyncState | null = null;
    private syncStateData?: ISyncStateData;
    private lastPos: string | null = null;
    private failCount = 0;
    private notifEvents: MatrixEvent[] = []; // accumulator of sync events in the current sync response

    public constructor(
        private readonly slidingSync: SlidingSync,
        private readonly client: MatrixClient,
        opts?: IStoredClientOpts,
        syncOpts?: SyncApiOptions,
    ) {
        this.opts = defaultClientOpts(opts);
        this.syncOpts = defaultSyncApiOpts(syncOpts);

        if (client.getNotifTimelineSet()) {
            client.reEmitter.reEmit(client.getNotifTimelineSet()!, [RoomEvent.Timeline, RoomEvent.TimelineReset]);
        }

        this.slidingSync.on(SlidingSyncEvent.Lifecycle, this.onLifecycle.bind(this));
        this.slidingSync.on(SlidingSyncEvent.RoomData, this.onRoomData.bind(this));
        const extensions: Extension<any, any>[] = [
            new ExtensionToDevice(this.client, this.syncOpts.cryptoCallbacks),
            new ExtensionAccountData(this.client),
            new ExtensionTyping(this.client),
            new ExtensionReceipts(this.client),
        ];
        if (this.syncOpts.crypto) {
            extensions.push(new ExtensionE2EE(this.syncOpts.crypto));
        }
        extensions.forEach((ext) => {
            this.slidingSync.registerExtension(ext);
        });
    }

    private async onRoomData(roomId: string, roomData: MSC3575RoomData): Promise<void> {
        let room = this.client.store.getRoom(roomId);
        if (!room) {
            if (!roomData.initial) {
                logger.debug("initial flag not set but no stored room exists for room ", roomId, roomData);
                return;
            }
            room = _createAndReEmitRoom(this.client, roomId, this.opts);
        }
        await this.processRoomData(this.client, room!, roomData);
    }

    private onLifecycle(state: SlidingSyncState, resp: MSC3575SlidingSyncResponse | null, err?: Error): void {
        if (err) {
            logger.debug("onLifecycle", state, err);
        }
        switch (state) {
            case SlidingSyncState.Complete:
                this.purgeNotifications();
                if (!resp) {
                    break;
                }
                // Element won't stop showing the initial loading spinner unless we fire SyncState.Prepared
                if (!this.lastPos) {
                    this.updateSyncState(SyncState.Prepared, {
                        oldSyncToken: undefined,
                        nextSyncToken: resp.pos,
                        catchingUp: false,
                        fromCache: false,
                    });
                }
                // Conversely, Element won't show the room list unless there is at least 1x SyncState.Syncing
                // so hence for the very first sync we will fire prepared then immediately syncing.
                this.updateSyncState(SyncState.Syncing, {
                    oldSyncToken: this.lastPos!,
                    nextSyncToken: resp.pos,
                    catchingUp: false,
                    fromCache: false,
                });
                this.lastPos = resp.pos;
                break;
            case SlidingSyncState.RequestFinished:
                if (err) {
                    this.failCount += 1;
                    this.updateSyncState(
                        this.failCount > FAILED_SYNC_ERROR_THRESHOLD ? SyncState.Error : SyncState.Reconnecting,
                        {
                            error: new MatrixError(err),
                        },
                    );
                    if (this.shouldAbortSync(new MatrixError(err))) {
                        return; // shouldAbortSync actually stops syncing too so we don't need to do anything.
                    }
                } else {
                    this.failCount = 0;
                }
                break;
        }
    }

    /**
     * Sync rooms the user has left.
     * @returns Resolved when they've been added to the store.
     */
    public async syncLeftRooms(): Promise<Room[]> {
        return []; // TODO
    }

    /**
     * Peek into a room. This will result in the room in question being synced so it
     * is accessible via getRooms(). Live updates for the room will be provided.
     * @param roomId - The room ID to peek into.
     * @returns A promise which resolves once the room has been added to the
     * store.
     */
    public async peek(_roomId: string): Promise<Room> {
        return null!; // TODO
    }

    /**
     * Stop polling for updates in the peeked room. NOPs if there is no room being
     * peeked.
     */
    public stopPeeking(): void {
        // TODO
    }

    /**
     * Returns the current state of this sync object
     * @see MatrixClient#event:"sync"
     */
    public getSyncState(): SyncState | null {
        return this.syncState;
    }

    /**
     * Returns the additional data object associated with
     * the current sync state, or null if there is no
     * such data.
     * Sync errors, if available, are put in the 'error' key of
     * this object.
     */
    public getSyncStateData(): ISyncStateData | null {
        return this.syncStateData ?? null;
    }

    // Helper functions which set up JS SDK structs are below and are identical to the sync v2 counterparts

    public createRoom(roomId: string): Room {
        // XXX cargoculted from sync.ts
        const { timelineSupport } = this.client;
        const room = new Room(roomId, this.client, this.client.getUserId()!, {
            lazyLoadMembers: this.opts.lazyLoadMembers,
            pendingEventOrdering: this.opts.pendingEventOrdering,
            timelineSupport,
        });
        this.client.reEmitter.reEmit(room, [
            RoomEvent.Name,
            RoomEvent.Redaction,
            RoomEvent.RedactionCancelled,
            RoomEvent.Receipt,
            RoomEvent.Tags,
            RoomEvent.LocalEchoUpdated,
            RoomEvent.AccountData,
            RoomEvent.MyMembership,
            RoomEvent.Timeline,
            RoomEvent.TimelineReset,
        ]);
        this.registerStateListeners(room);
        return room;
    }

    private registerStateListeners(room: Room): void {
        // XXX cargoculted from sync.ts
        // we need to also re-emit room state and room member events, so hook it up
        // to the client now. We need to add a listener for RoomState.members in
        // order to hook them correctly.
        this.client.reEmitter.reEmit(room.currentState, [
            RoomStateEvent.Events,
            RoomStateEvent.Members,
            RoomStateEvent.NewMember,
            RoomStateEvent.Update,
        ]);
        room.currentState.on(RoomStateEvent.NewMember, (event, state, member) => {
            member.user = this.client.getUser(member.userId) ?? undefined;
            this.client.reEmitter.reEmit(member, [
                RoomMemberEvent.Name,
                RoomMemberEvent.Typing,
                RoomMemberEvent.PowerLevel,
                RoomMemberEvent.Membership,
            ]);
        });
    }

    /*
    private deregisterStateListeners(room: Room): void { // XXX cargoculted from sync.ts
        // could do with a better way of achieving this.
        room.currentState.removeAllListeners(RoomStateEvent.Events);
        room.currentState.removeAllListeners(RoomStateEvent.Members);
        room.currentState.removeAllListeners(RoomStateEvent.NewMember);
    } */

    private shouldAbortSync(error: MatrixError): boolean {
        if (error.errcode === "M_UNKNOWN_TOKEN") {
            // The logout already happened, we just need to stop.
            logger.warn("Token no longer valid - assuming logout");
            this.stop();
            this.updateSyncState(SyncState.Error, { error });
            return true;
        }
        return false;
    }

    private async processRoomData(client: MatrixClient, room: Room, roomData: MSC3575RoomData): Promise<void> {
        roomData = ensureNameEvent(client, room.roomId, roomData);
        const stateEvents = mapEvents(this.client, room.roomId, roomData.required_state);
        // Prevent events from being decrypted ahead of time
        // this helps large account to speed up faster
        // room::decryptCriticalEvent is in charge of decrypting all the events
        // required for a client to function properly
        let timelineEvents = mapEvents(this.client, room.roomId, roomData.timeline, false);
        const ephemeralEvents: MatrixEvent[] = []; // TODO this.mapSyncEventsFormat(joinObj.ephemeral);

        // TODO: handle threaded / beacon events

        if (roomData.initial) {
            // we should not know about any of these timeline entries if this is a genuinely new room.
            // If we do, then we've effectively done scrollback (e.g requesting timeline_limit: 1 for
            // this room, then timeline_limit: 50).
            const knownEvents = new Set<string>();
            room.getLiveTimeline()
                .getEvents()
                .forEach((e) => {
                    knownEvents.add(e.getId()!);
                });
            // all unknown events BEFORE a known event must be scrollback e.g:
            //       D E   <-- what we know
            // A B C D E F <-- what we just received
            // means:
            // A B C       <-- scrollback
            //       D E   <-- dupes
            //           F <-- new event
            // We bucket events based on if we have seen a known event yet.
            const oldEvents: MatrixEvent[] = [];
            const newEvents: MatrixEvent[] = [];
            let seenKnownEvent = false;
            for (let i = timelineEvents.length - 1; i >= 0; i--) {
                const recvEvent = timelineEvents[i];
                if (knownEvents.has(recvEvent.getId()!)) {
                    seenKnownEvent = true;
                    continue; // don't include this event, it's a dupe
                }
                if (seenKnownEvent) {
                    // old -> new
                    oldEvents.push(recvEvent);
                } else {
                    // old -> new
                    newEvents.unshift(recvEvent);
                }
            }
            timelineEvents = newEvents;
            if (oldEvents.length > 0) {
                // old events are scrollback, insert them now
                room.addEventsToTimeline(oldEvents, true, room.getLiveTimeline(), roomData.prev_batch);
            }
        }

        const encrypted = this.client.isRoomEncrypted(room.roomId);
        // we do this first so it's correct when any of the events fire
        if (roomData.notification_count != null) {
            room.setUnreadNotificationCount(NotificationCountType.Total, roomData.notification_count);
        }

        if (roomData.highlight_count != null) {
            // We track unread notifications ourselves in encrypted rooms, so don't
            // bother setting it here. We trust our calculations better than the
            // server's for this case, and therefore will assume that our non-zero
            // count is accurate.
            if (!encrypted || (encrypted && room.getUnreadNotificationCount(NotificationCountType.Highlight) <= 0)) {
                room.setUnreadNotificationCount(NotificationCountType.Highlight, roomData.highlight_count);
            }
        }

        if (Number.isInteger(roomData.invited_count)) {
            room.currentState.setInvitedMemberCount(roomData.invited_count!);
        }
        if (Number.isInteger(roomData.joined_count)) {
            room.currentState.setJoinedMemberCount(roomData.joined_count!);
        }

        if (roomData.invite_state) {
            const inviteStateEvents = mapEvents(this.client, room.roomId, roomData.invite_state);
            await this.injectRoomEvents(room, inviteStateEvents);
            if (roomData.initial) {
                room.recalculate();
                this.client.store.storeRoom(room);
                this.client.emit(ClientEvent.Room, room);
            }
            inviteStateEvents.forEach((e) => {
                this.client.emit(ClientEvent.Event, e);
            });
            room.updateMyMembership("invite");
            return;
        }

        if (roomData.initial) {
            // set the back-pagination token. Do this *before* adding any
            // events so that clients can start back-paginating.
            room.getLiveTimeline().setPaginationToken(roomData.prev_batch ?? null, EventTimeline.BACKWARDS);
        }

        /* TODO
        else if (roomData.limited) {

            let limited = true;

            // we've got a limited sync, so we *probably* have a gap in the
            // timeline, so should reset. But we might have been peeking or
            // paginating and already have some of the events, in which
            // case we just want to append any subsequent events to the end
            // of the existing timeline.
            //
            // This is particularly important in the case that we already have
            // *all* of the events in the timeline - in that case, if we reset
            // the timeline, we'll end up with an entirely empty timeline,
            // which we'll try to paginate but not get any new events (which
            // will stop us linking the empty timeline into the chain).
            //
            for (let i = timelineEvents.length - 1; i >= 0; i--) {
                const eventId = timelineEvents[i].getId();
                if (room.getTimelineForEvent(eventId)) {
                    logger.debug("Already have event " + eventId + " in limited " +
                        "sync - not resetting");
                    limited = false;

                    // we might still be missing some of the events before i;
                    // we don't want to be adding them to the end of the
                    // timeline because that would put them out of order.
                    timelineEvents.splice(0, i);

                    // XXX: there's a problem here if the skipped part of the
                    // timeline modifies the state set in stateEvents, because
                    // we'll end up using the state from stateEvents rather
                    // than the later state from timelineEvents. We probably
                    // need to wind stateEvents forward over the events we're
                    // skipping.
                    break;
                }
            }

            if (limited) {
                room.resetLiveTimeline(
                    roomData.prev_batch,
                    null, // TODO this.syncOpts.canResetEntireTimeline(room.roomId) ? null : syncEventData.oldSyncToken,
                );

                // We have to assume any gap in any timeline is
                // reason to stop incrementally tracking notifications and
                // reset the timeline.
                this.client.resetNotifTimelineSet();
                this.registerStateListeners(room);
            }
        } */

        await this.injectRoomEvents(room, stateEvents, timelineEvents, roomData.num_live);

        // we deliberately don't add ephemeral events to the timeline
        room.addEphemeralEvents(ephemeralEvents);

        // local fields must be set before any async calls because call site assumes
        // synchronous execution prior to emitting SlidingSyncState.Complete
        room.updateMyMembership("join");

        room.recalculate();
        if (roomData.initial) {
            client.store.storeRoom(room);
            client.emit(ClientEvent.Room, room);
        }

        // check if any timeline events should bing and add them to the notifEvents array:
        // we'll purge this once we've fully processed the sync response
        this.addNotifications(timelineEvents);

        const processRoomEvent = async (e: MatrixEvent): Promise<void> => {
            client.emit(ClientEvent.Event, e);
            if (e.isState() && e.getType() == EventType.RoomEncryption && this.syncOpts.cryptoCallbacks) {
                await this.syncOpts.cryptoCallbacks.onCryptoEvent(room, e);
            }
        };

        await promiseMapSeries(stateEvents, processRoomEvent);
        await promiseMapSeries(timelineEvents, processRoomEvent);
        ephemeralEvents.forEach(function (e) {
            client.emit(ClientEvent.Event, e);
        });

        // Decrypt only the last message in all rooms to make sure we can generate a preview
        // And decrypt all events after the recorded read receipt to ensure an accurate
        // notification count
        room.decryptCriticalEvents();
    }

    /**
     * Injects events into a room's model.
     * @param stateEventList - A list of state events. This is the state
     * at the *START* of the timeline list if it is supplied.
     * @param timelineEventList - A list of timeline events. Lower index
     * is earlier in time. Higher index is later.
     * @param numLive - the number of events in timelineEventList which just happened,
     * supplied from the server.
     */
    public async injectRoomEvents(
        room: Room,
        stateEventList: MatrixEvent[],
        timelineEventList?: MatrixEvent[],
        numLive?: number,
    ): Promise<void> {
        timelineEventList = timelineEventList || [];
        stateEventList = stateEventList || [];
        numLive = numLive || 0;

        // If there are no events in the timeline yet, initialise it with
        // the given state events
        const liveTimeline = room.getLiveTimeline();
        const timelineWasEmpty = liveTimeline.getEvents().length == 0;
        if (timelineWasEmpty) {
            // Passing these events into initialiseState will freeze them, so we need
            // to compute and cache the push actions for them now, otherwise sync dies
            // with an attempt to assign to read only property.
            // XXX: This is pretty horrible and is assuming all sorts of behaviour from
            // these functions that it shouldn't be. We should probably either store the
            // push actions cache elsewhere so we can freeze MatrixEvents, or otherwise
            // find some solution where MatrixEvents are immutable but allow for a cache
            // field.
            for (const ev of stateEventList) {
                this.client.getPushActionsForEvent(ev);
            }
            liveTimeline.initialiseState(stateEventList);
        }

        // If the timeline wasn't empty, we process the state events here: they're
        // defined as updates to the state before the start of the timeline, so this
        // starts to roll the state forward.
        // XXX: That's what we *should* do, but this can happen if we were previously
        // peeking in a room, in which case we obviously do *not* want to add the
        // state events here onto the end of the timeline. Historically, the js-sdk
        // has just set these new state events on the old and new state. This seems
        // very wrong because there could be events in the timeline that diverge the
        // state, in which case this is going to leave things out of sync. However,
        // for now I think it;s best to behave the same as the code has done previously.
        if (!timelineWasEmpty) {
            // XXX: As above, don't do this...
            //room.addLiveEvents(stateEventList || []);
            // Do this instead...
            room.oldState.setStateEvents(stateEventList);
            room.currentState.setStateEvents(stateEventList);
        }

        // the timeline is broken into 'live' events which just happened and normal timeline events
        // which are still to be appended to the end of the live timeline but happened a while ago.
        // The live events are marked as fromCache=false to ensure that downstream components know
        // this is a live event, not historical (from a remote server cache).

        let liveTimelineEvents: MatrixEvent[] = [];
        if (numLive > 0) {
            // last numLive events are live
            liveTimelineEvents = timelineEventList.slice(-1 * numLive);
            // everything else is not live
            timelineEventList = timelineEventList.slice(0, -1 * liveTimelineEvents.length);
        }

        // execute the timeline events. This will continue to diverge the current state
        // if the timeline has any state events in it.
        // This also needs to be done before running push rules on the events as they need
        // to be decorated with sender etc.
        await room.addLiveEvents(timelineEventList, {
            fromCache: true,
        });
        if (liveTimelineEvents.length > 0) {
            await room.addLiveEvents(liveTimelineEvents, {
                fromCache: false,
            });
        }

        room.recalculate();

        // resolve invites now we have set the latest state
        this.resolveInvites(room);
    }

    private resolveInvites(room: Room): void {
        if (!room || !this.opts.resolveInvitesToProfiles) {
            return;
        }
        const client = this.client;
        // For each invited room member we want to give them a displayname/avatar url
        // if they have one (the m.room.member invites don't contain this).
        room.getMembersWithMembership("invite").forEach(function (member) {
            if (member.requestedProfileInfo) return;
            member.requestedProfileInfo = true;
            // try to get a cached copy first.
            const user = client.getUser(member.userId);
            let promise: ReturnType<MatrixClient["getProfileInfo"]>;
            if (user) {
                promise = Promise.resolve({
                    avatar_url: user.avatarUrl,
                    displayname: user.displayName,
                });
            } else {
                promise = client.getProfileInfo(member.userId);
            }
            promise.then(
                function (info) {
                    // slightly naughty by doctoring the invite event but this means all
                    // the code paths remain the same between invite/join display name stuff
                    // which is a worthy trade-off for some minor pollution.
                    const inviteEvent = member.events.member!;
                    if (inviteEvent.getContent().membership !== "invite") {
                        // between resolving and now they have since joined, so don't clobber
                        return;
                    }
                    inviteEvent.getContent().avatar_url = info.avatar_url;
                    inviteEvent.getContent().displayname = info.displayname;
                    // fire listeners
                    member.setMembershipEvent(inviteEvent, room.currentState);
                },
                function (_err) {
                    // OH WELL.
                },
            );
        });
    }

    public retryImmediately(): boolean {
        return true;
    }

    /**
     * Main entry point. Blocks until stop() is called.
     */
    public async sync(): Promise<void> {
        logger.debug("Sliding sync init loop");

        //   1) We need to get push rules so we can check if events should bing as we get
        //      them from /sync.
        while (!this.client.isGuest()) {
            try {
                logger.debug("Getting push rules...");
                const result = await this.client.getPushRules();
                logger.debug("Got push rules");
                this.client.pushRules = result;
                break;
            } catch (err) {
                logger.error("Getting push rules failed", err);
                if (this.shouldAbortSync(<MatrixError>err)) {
                    return;
                }
            }
        }

        // start syncing
        await this.slidingSync.start();
    }

    /**
     * Stops the sync object from syncing.
     */
    public stop(): void {
        logger.debug("SyncApi.stop");
        this.slidingSync.stop();
    }

    /**
     * Sets the sync state and emits an event to say so
     * @param newState - The new state string
     * @param data - Object of additional data to emit in the event
     */
    private updateSyncState(newState: SyncState, data?: ISyncStateData): void {
        const old = this.syncState;
        this.syncState = newState;
        this.syncStateData = data;
        this.client.emit(ClientEvent.Sync, this.syncState, old, data);
    }

    /**
     * Takes a list of timelineEvents and adds and adds to notifEvents
     * as appropriate.
     * This must be called after the room the events belong to has been stored.
     *
     * @param timelineEventList - A list of timeline events. Lower index
     * is earlier in time. Higher index is later.
     */
    private addNotifications(timelineEventList: MatrixEvent[]): void {
        // gather our notifications into this.notifEvents
        if (!this.client.getNotifTimelineSet()) {
            return;
        }
        for (const timelineEvent of timelineEventList) {
            const pushActions = this.client.getPushActionsForEvent(timelineEvent);
            if (pushActions && pushActions.notify && pushActions.tweaks && pushActions.tweaks.highlight) {
                this.notifEvents.push(timelineEvent);
            }
        }
    }

    /**
     * Purge any events in the notifEvents array. Used after a /sync has been complete.
     * This should not be called at a per-room scope (e.g in onRoomData) because otherwise the ordering
     * will be messed up e.g room A gets a bing, room B gets a newer bing, but both in the same /sync
     * response. If we purge at a per-room scope then we could process room B before room A leading to
     * room B appearing earlier in the notifications timeline, even though it has the higher origin_server_ts.
     */
    private purgeNotifications(): void {
        this.notifEvents.sort(function (a, b) {
            return a.getTs() - b.getTs();
        });
        this.notifEvents.forEach((event) => {
            this.client.getNotifTimelineSet()?.addLiveEvent(event);
        });
        this.notifEvents = [];
    }
}

function ensureNameEvent(client: MatrixClient, roomId: string, roomData: MSC3575RoomData): MSC3575RoomData {
    // make sure m.room.name is in required_state if there is a name, replacing anything previously
    // there if need be. This ensures clients transparently 'calculate' the right room name. Native
    // sliding sync clients should just read the "name" field.
    if (!roomData.name) {
        return roomData;
    }
    for (const stateEvent of roomData.required_state) {
        if (stateEvent.type === EventType.RoomName && stateEvent.state_key === "") {
            stateEvent.content = {
                name: roomData.name,
            };
            return roomData;
        }
    }
    roomData.required_state.push({
        event_id: "$fake-sliding-sync-name-event-" + roomId,
        state_key: "",
        type: EventType.RoomName,
        content: {
            name: roomData.name,
        },
        sender: client.getUserId()!,
        origin_server_ts: new Date().getTime(),
    });
    return roomData;
}

type TaggedEvent = (IStrippedState | IRoomEvent | IStateEvent | IMinimalEvent) & { room_id?: string };

// Helper functions which set up JS SDK structs are below and are identical to the sync v2 counterparts,
// just outside the class.
function mapEvents(client: MatrixClient, roomId: string | undefined, events: object[], decrypt = true): MatrixEvent[] {
    const mapper = client.getEventMapper({ decrypt });
    return (events as TaggedEvent[]).map(function (e) {
        e.room_id = roomId;
        return mapper(e);
    });
}

function processEphemeralEvents(client: MatrixClient, roomId: string, ephEvents: IMinimalEvent[]): void {
    const ephemeralEvents = mapEvents(client, roomId, ephEvents);
    const room = client.getRoom(roomId);
    if (!room) {
        logger.warn("got ephemeral events for room but room doesn't exist on client:", roomId);
        return;
    }
    room.addEphemeralEvents(ephemeralEvents);
    ephemeralEvents.forEach((e) => {
        client.emit(ClientEvent.Event, e);
    });
}
