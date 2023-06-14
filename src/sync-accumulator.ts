/*
Copyright 2017 - 2023 The Matrix.org Foundation C.I.C.

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

/**
 * This is an internal module. See {@link SyncAccumulator} for the public class.
 */

import { logger } from "./logger";
import { deepCopy } from "./utils";
import { IContent, IUnsigned } from "./models/event";
import { IRoomSummary } from "./models/room-summary";
import { EventType } from "./@types/event";
import { UNREAD_THREAD_NOTIFICATIONS } from "./@types/sync";
import { ReceiptAccumulator } from "./receipt-accumulator";

interface IOpts {
    /**
     * The ideal maximum number of timeline entries to keep in the sync response.
     * This is best-effort, as clients do not always have a back-pagination token for each event,
     * so it's possible there may be slightly *less* than this value. There will never be more.
     * This cannot be 0 or else it makes it impossible to scroll back in a room.
     * Default: 50.
     */
    maxTimelineEntries?: number;
}

export interface IMinimalEvent {
    content: IContent;
    type: EventType | string;
    room_id?: string;
    unsigned?: IUnsigned;
}

export interface IEphemeral {
    events: IMinimalEvent[];
}

/* eslint-disable camelcase */
interface UnreadNotificationCounts {
    highlight_count?: number;
    notification_count?: number;
}

export interface IRoomEvent extends IMinimalEvent {
    event_id: string;
    sender: string;
    origin_server_ts: number;
    /** @deprecated - legacy field */
    age?: number;
}

export interface IStateEvent extends IRoomEvent {
    prev_content?: IContent;
    state_key: string;
}

interface IState {
    events: IStateEvent[];
}

export interface ITimeline {
    events: Array<IRoomEvent | IStateEvent>;
    limited?: boolean;
    prev_batch: string | null;
}

export interface IJoinedRoom {
    "summary": IRoomSummary;
    "state": IState;
    "timeline": ITimeline;
    "ephemeral": IEphemeral;
    "account_data": IAccountData;
    "unread_notifications": UnreadNotificationCounts;
    "unread_thread_notifications"?: Record<string, UnreadNotificationCounts>;
    "org.matrix.msc3773.unread_thread_notifications"?: Record<string, UnreadNotificationCounts>;
}

export interface IStrippedState {
    content: IContent;
    state_key: string;
    type: EventType | string;
    sender: string;
}

export interface IInviteState {
    events: IStrippedState[];
}

export interface IInvitedRoom {
    invite_state: IInviteState;
}

export interface ILeftRoom {
    state: IState;
    timeline: ITimeline;
    account_data: IAccountData;
}

export interface IRooms {
    [Category.Join]: Record<string, IJoinedRoom>;
    [Category.Invite]: Record<string, IInvitedRoom>;
    [Category.Leave]: Record<string, ILeftRoom>;
}

interface IPresence {
    events: IMinimalEvent[];
}

interface IAccountData {
    events: IMinimalEvent[];
}

export interface IToDeviceEvent {
    content: IContent;
    sender: string;
    type: string;
}

interface IToDevice {
    events: IToDeviceEvent[];
}

export interface IDeviceLists {
    changed?: string[];
    left?: string[];
}

export interface ISyncResponse {
    "next_batch": string;
    "rooms": IRooms;
    "presence"?: IPresence;
    "account_data": IAccountData;
    "to_device"?: IToDevice;
    "device_lists"?: IDeviceLists;
    "device_one_time_keys_count"?: Record<string, number>;

    "device_unused_fallback_key_types"?: string[];
    "org.matrix.msc2732.device_unused_fallback_key_types"?: string[];
}
/* eslint-enable camelcase */

export enum Category {
    Invite = "invite",
    Leave = "leave",
    Join = "join",
}

interface IRoom {
    _currentState: { [eventType: string]: { [stateKey: string]: IStateEvent } };
    _timeline: {
        event: IRoomEvent | IStateEvent;
        token: string | null;
    }[];
    _summary: Partial<IRoomSummary>;
    _accountData: { [eventType: string]: IMinimalEvent };
    _unreadNotifications: Partial<UnreadNotificationCounts>;
    _unreadThreadNotifications?: Record<string, Partial<UnreadNotificationCounts>>;
    _receipts: ReceiptAccumulator;
}

export interface ISyncData {
    nextBatch: string;
    accountData: IMinimalEvent[];
    roomsData: IRooms;
}

type TaggedEvent = IRoomEvent & { _localTs?: number };

function isTaggedEvent(event: IRoomEvent): event is TaggedEvent {
    return "_localTs" in event && event["_localTs"] !== undefined;
}

/**
 * The purpose of this class is to accumulate /sync responses such that a
 * complete "initial" JSON response can be returned which accurately represents
 * the sum total of the /sync responses accumulated to date. It only handles
 * room data: that is, everything under the "rooms" top-level key.
 *
 * This class is used when persisting room data so a complete /sync response can
 * be loaded from disk and incremental syncs can be performed on the server,
 * rather than asking the server to do an initial sync on startup.
 */
export class SyncAccumulator {
    private accountData: Record<string, IMinimalEvent> = {}; // $event_type: Object
    private inviteRooms: Record<string, IInvitedRoom> = {}; // $roomId: { ... sync 'invite' json data ... }
    private joinRooms: { [roomId: string]: IRoom } = {};
    // the /sync token which corresponds to the last time rooms were
    // accumulated. We remember this so that any caller can obtain a
    // coherent /sync response and know at what point they should be
    // streaming from without losing events.
    private nextBatch: string | null = null;

    public constructor(private readonly opts: IOpts = {}) {
        this.opts.maxTimelineEntries = this.opts.maxTimelineEntries || 50;
    }

    public accumulate(syncResponse: ISyncResponse, fromDatabase = false): void {
        this.accumulateRooms(syncResponse, fromDatabase);
        this.accumulateAccountData(syncResponse);
        this.nextBatch = syncResponse.next_batch;
    }

    private accumulateAccountData(syncResponse: ISyncResponse): void {
        if (!syncResponse.account_data || !syncResponse.account_data.events) {
            return;
        }
        // Clobbers based on event type.
        syncResponse.account_data.events.forEach((e) => {
            this.accountData[e.type] = e;
        });
    }

    /**
     * Accumulate incremental /sync room data.
     * @param syncResponse - the complete /sync JSON
     * @param fromDatabase - True if the sync response is one saved to the database
     */
    private accumulateRooms(syncResponse: ISyncResponse, fromDatabase = false): void {
        if (!syncResponse.rooms) {
            return;
        }
        if (syncResponse.rooms.invite) {
            Object.keys(syncResponse.rooms.invite).forEach((roomId) => {
                this.accumulateRoom(roomId, Category.Invite, syncResponse.rooms.invite[roomId], fromDatabase);
            });
        }
        if (syncResponse.rooms.join) {
            Object.keys(syncResponse.rooms.join).forEach((roomId) => {
                this.accumulateRoom(roomId, Category.Join, syncResponse.rooms.join[roomId], fromDatabase);
            });
        }
        if (syncResponse.rooms.leave) {
            Object.keys(syncResponse.rooms.leave).forEach((roomId) => {
                this.accumulateRoom(roomId, Category.Leave, syncResponse.rooms.leave[roomId], fromDatabase);
            });
        }
    }

    private accumulateRoom(roomId: string, category: Category.Invite, data: IInvitedRoom, fromDatabase: boolean): void;
    private accumulateRoom(roomId: string, category: Category.Join, data: IJoinedRoom, fromDatabase: boolean): void;
    private accumulateRoom(roomId: string, category: Category.Leave, data: ILeftRoom, fromDatabase: boolean): void;
    private accumulateRoom(roomId: string, category: Category, data: any, fromDatabase = false): void {
        // Valid /sync state transitions
        //       +--------+ <======+            1: Accept an invite
        //   +== | INVITE |        | (5)        2: Leave a room
        //   |   +--------+ =====+ |            3: Join a public room previously
        //   |(1)            (4) | |               left (handle as if new room)
        //   V         (2)       V |            4: Reject an invite
        // +------+ ========> +--------+         5: Invite to a room previously
        // | JOIN |    (3)    | LEAVE* |            left (handle as if new room)
        // +------+ <======== +--------+
        //
        // * equivalent to "no state"
        switch (category) {
            case Category.Invite: // (5)
                this.accumulateInviteState(roomId, data as IInvitedRoom);
                break;

            case Category.Join:
                if (this.inviteRooms[roomId]) {
                    // (1)
                    // was previously invite, now join. We expect /sync to give
                    // the entire state and timeline on 'join', so delete previous
                    // invite state
                    delete this.inviteRooms[roomId];
                }
                // (3)
                this.accumulateJoinState(roomId, data as IJoinedRoom, fromDatabase);
                break;

            case Category.Leave:
                if (this.inviteRooms[roomId]) {
                    // (4)
                    delete this.inviteRooms[roomId];
                } else {
                    // (2)
                    delete this.joinRooms[roomId];
                }
                break;

            default:
                logger.error("Unknown cateogory: ", category);
        }
    }

    private accumulateInviteState(roomId: string, data: IInvitedRoom): void {
        if (!data.invite_state || !data.invite_state.events) {
            // no new data
            return;
        }
        if (!this.inviteRooms[roomId]) {
            this.inviteRooms[roomId] = {
                invite_state: data.invite_state,
            };
            return;
        }
        // accumulate extra keys for invite->invite transitions
        // clobber based on event type / state key
        // We expect invite_state to be small, so just loop over the events
        const currentData = this.inviteRooms[roomId];
        data.invite_state.events.forEach((e) => {
            let hasAdded = false;
            for (let i = 0; i < currentData.invite_state.events.length; i++) {
                const current = currentData.invite_state.events[i];
                if (current.type === e.type && current.state_key == e.state_key) {
                    currentData.invite_state.events[i] = e; // update
                    hasAdded = true;
                }
            }
            if (!hasAdded) {
                currentData.invite_state.events.push(e);
            }
        });
    }

    // Accumulate timeline and state events in a room.
    private accumulateJoinState(roomId: string, data: IJoinedRoom, fromDatabase = false): void {
        // We expect this function to be called a lot (every /sync) so we want
        // this to be fast. /sync stores events in an array but we often want
        // to clobber based on type/state_key. Rather than convert arrays to
        // maps all the time, just keep private maps which contain
        // the actual current accumulated sync state, and array-ify it when
        // getJSON() is called.

        // State resolution:
        // The 'state' key is the delta from the previous sync (or start of time
        // if no token was supplied), to the START of the timeline. To obtain
        // the current state, we need to "roll forward" state by reading the
        // timeline. We want to store the current state so we can drop events
        // out the end of the timeline based on opts.maxTimelineEntries.
        //
        //      'state'     'timeline'     current state
        // |-------x<======================>x
        //          T   I   M   E
        //
        // When getJSON() is called, we 'roll back' the current state by the
        // number of entries in the timeline to work out what 'state' should be.

        // Back-pagination:
        // On an initial /sync, the server provides a back-pagination token for
        // the start of the timeline. When /sync deltas come down, they also
        // include back-pagination tokens for the start of the timeline. This
        // means not all events in the timeline have back-pagination tokens, as
        // it is only the ones at the START of the timeline which have them.
        // In order for us to have a valid timeline (and back-pagination token
        // to match), we need to make sure that when we remove old timeline
        // events, that we roll forward to an event which has a back-pagination
        // token. This means we can't keep a strict sliding-window based on
        // opts.maxTimelineEntries, and we may have a few less. We should never
        // have more though, provided that the /sync limit is less than or equal
        // to opts.maxTimelineEntries.

        if (!this.joinRooms[roomId]) {
            // Create truly empty objects so event types of 'hasOwnProperty' and co
            // don't cause this code to break.
            this.joinRooms[roomId] = {
                _currentState: Object.create(null),
                _timeline: [],
                _accountData: Object.create(null),
                _unreadNotifications: {},
                _unreadThreadNotifications: {},
                _summary: {},
                _receipts: new ReceiptAccumulator(),
            };
        }
        const currentData = this.joinRooms[roomId];

        if (data.account_data && data.account_data.events) {
            // clobber based on type
            data.account_data.events.forEach((e) => {
                currentData._accountData[e.type] = e;
            });
        }

        // these probably clobber, spec is unclear.
        if (data.unread_notifications) {
            currentData._unreadNotifications = data.unread_notifications;
        }
        currentData._unreadThreadNotifications =
            data[UNREAD_THREAD_NOTIFICATIONS.stable!] ?? data[UNREAD_THREAD_NOTIFICATIONS.unstable!] ?? undefined;

        if (data.summary) {
            const HEROES_KEY = "m.heroes";
            const INVITED_COUNT_KEY = "m.invited_member_count";
            const JOINED_COUNT_KEY = "m.joined_member_count";

            const acc = currentData._summary;
            const sum = data.summary;
            acc[HEROES_KEY] = sum[HEROES_KEY] ?? acc[HEROES_KEY];
            acc[JOINED_COUNT_KEY] = sum[JOINED_COUNT_KEY] ?? acc[JOINED_COUNT_KEY];
            acc[INVITED_COUNT_KEY] = sum[INVITED_COUNT_KEY] ?? acc[INVITED_COUNT_KEY];
        }

        // We purposefully do not persist m.typing events.
        // Technically you could refresh a browser before the timer on a
        // typing event is up, so it'll look like you aren't typing when
        // you really still are. However, the alternative is worse. If
        // we do persist typing events, it will look like people are
        // typing forever until someone really does start typing (which
        // will prompt Synapse to send down an actual m.typing event to
        // clobber the one we persisted).

        // Persist the receipts
        currentData._receipts.consumeEphemeralEvents(data.ephemeral?.events);

        // if we got a limited sync, we need to remove all timeline entries or else
        // we will have gaps in the timeline.
        if (data.timeline && data.timeline.limited) {
            currentData._timeline = [];
        }

        // Work out the current state. The deltas need to be applied in the order:
        // - existing state which didn't come down /sync.
        // - State events under the 'state' key.
        // - State events in the 'timeline'.
        data.state?.events?.forEach((e) => {
            setState(currentData._currentState, e);
        });
        data.timeline?.events?.forEach((e, index) => {
            // this nops if 'e' isn't a state event
            setState(currentData._currentState, e);
            // append the event to the timeline. The back-pagination token
            // corresponds to the first event in the timeline
            let transformedEvent: TaggedEvent;
            if (!fromDatabase) {
                transformedEvent = Object.assign({}, e);
                if (transformedEvent.unsigned !== undefined) {
                    transformedEvent.unsigned = Object.assign({}, transformedEvent.unsigned);
                }
                const age = e.unsigned ? e.unsigned.age : e.age;
                if (age !== undefined) transformedEvent._localTs = Date.now() - age;
            } else {
                transformedEvent = e;
            }

            currentData._timeline.push({
                event: transformedEvent,
                token: index === 0 ? data.timeline.prev_batch ?? null : null,
            });
        });

        // attempt to prune the timeline by jumping between events which have
        // pagination tokens.
        if (currentData._timeline.length > this.opts.maxTimelineEntries!) {
            const startIndex = currentData._timeline.length - this.opts.maxTimelineEntries!;
            for (let i = startIndex; i < currentData._timeline.length; i++) {
                if (currentData._timeline[i].token) {
                    // keep all events after this, including this one
                    currentData._timeline = currentData._timeline.slice(i, currentData._timeline.length);
                    break;
                }
            }
        }
    }

    /**
     * Return everything under the 'rooms' key from a /sync response which
     * represents all room data that should be stored. This should be paired
     * with the sync token which represents the most recent /sync response
     * provided to accumulate().
     * @param forDatabase - True to generate a sync to be saved to storage
     * @returns An object with a "nextBatch", "roomsData" and "accountData"
     * keys.
     * The "nextBatch" key is a string which represents at what point in the
     * /sync stream the accumulator reached. This token should be used when
     * restarting a /sync stream at startup. Failure to do so can lead to missing
     * events. The "roomsData" key is an Object which represents the entire
     * /sync response from the 'rooms' key onwards. The "accountData" key is
     * a list of raw events which represent global account data.
     */
    public getJSON(forDatabase = false): ISyncData {
        const data: IRooms = {
            join: {},
            invite: {},
            // always empty. This is set by /sync when a room was previously
            // in 'invite' or 'join'. On fresh startup, the client won't know
            // about any previous room being in 'invite' or 'join' so we can
            // just omit mentioning it at all, even if it has previously come
            // down /sync.
            // The notable exception is when a client is kicked or banned:
            // we may want to hold onto that room so the client can clearly see
            // why their room has disappeared. We don't persist it though because
            // it is unclear *when* we can safely remove the room from the DB.
            // Instead, we assume that if you're loading from the DB, you've
            // refreshed the page, which means you've seen the kick/ban already.
            leave: {},
        };
        Object.keys(this.inviteRooms).forEach((roomId) => {
            data.invite[roomId] = this.inviteRooms[roomId];
        });
        Object.keys(this.joinRooms).forEach((roomId) => {
            const roomData = this.joinRooms[roomId];
            const roomJson: IJoinedRoom = {
                ephemeral: { events: [] },
                account_data: { events: [] },
                state: { events: [] },
                timeline: {
                    events: [],
                    prev_batch: null,
                },
                unread_notifications: roomData._unreadNotifications,
                unread_thread_notifications: roomData._unreadThreadNotifications,
                summary: roomData._summary as IRoomSummary,
            };
            // Add account data
            Object.keys(roomData._accountData).forEach((evType) => {
                roomJson.account_data.events.push(roomData._accountData[evType]);
            });

            const receiptEvent = roomData._receipts.buildAccumulatedReceiptEvent(roomId);

            // add only if we have some receipt data
            if (receiptEvent) {
                roomJson.ephemeral.events.push(receiptEvent);
            }

            // Add timeline data
            roomData._timeline.forEach((msgData) => {
                if (!roomJson.timeline.prev_batch) {
                    // the first event we add to the timeline MUST match up to
                    // the prev_batch token.
                    if (!msgData.token) {
                        return; // this shouldn't happen as we prune constantly.
                    }
                    roomJson.timeline.prev_batch = msgData.token;
                }

                let transformedEvent: (IRoomEvent | IStateEvent) & { _localTs?: number };
                if (!forDatabase && isTaggedEvent(msgData.event)) {
                    // This means we have to copy each event, so we can fix it up to
                    // set a correct 'age' parameter whilst keeping the local timestamp
                    // on our stored event. If this turns out to be a bottleneck, it could
                    // be optimised either by doing this in the main process after the data
                    // has been structured-cloned to go between the worker & main process,
                    // or special-casing data from saved syncs to read the local timestamp
                    // directly rather than turning it into age to then immediately be
                    // transformed back again into a local timestamp.
                    transformedEvent = Object.assign({}, msgData.event);
                    if (transformedEvent.unsigned !== undefined) {
                        transformedEvent.unsigned = Object.assign({}, transformedEvent.unsigned);
                    }
                    delete transformedEvent._localTs;
                    transformedEvent.unsigned = transformedEvent.unsigned || {};
                    transformedEvent.unsigned.age = Date.now() - msgData.event._localTs!;
                } else {
                    transformedEvent = msgData.event;
                }
                roomJson.timeline.events.push(transformedEvent);
            });

            // Add state data: roll back current state to the start of timeline,
            // by "reverse clobbering" from the end of the timeline to the start.
            // Convert maps back into arrays.
            const rollBackState = Object.create(null);
            for (let i = roomJson.timeline.events.length - 1; i >= 0; i--) {
                const timelineEvent = roomJson.timeline.events[i];
                if (
                    (timelineEvent as IStateEvent).state_key === null ||
                    (timelineEvent as IStateEvent).state_key === undefined
                ) {
                    continue; // not a state event
                }
                // since we're going back in time, we need to use the previous
                // state value else we'll break causality. We don't have the
                // complete previous state event, so we need to create one.
                const prevStateEvent = deepCopy(timelineEvent);
                if (prevStateEvent.unsigned) {
                    if (prevStateEvent.unsigned.prev_content) {
                        prevStateEvent.content = prevStateEvent.unsigned.prev_content;
                    }
                    if (prevStateEvent.unsigned.prev_sender) {
                        prevStateEvent.sender = prevStateEvent.unsigned.prev_sender;
                    }
                }
                setState(rollBackState, prevStateEvent);
            }
            Object.keys(roomData._currentState).forEach((evType) => {
                Object.keys(roomData._currentState[evType]).forEach((stateKey) => {
                    let ev = roomData._currentState[evType][stateKey];
                    if (rollBackState[evType] && rollBackState[evType][stateKey]) {
                        // use the reverse clobbered event instead.
                        ev = rollBackState[evType][stateKey];
                    }
                    roomJson.state.events.push(ev);
                });
            });
            data.join[roomId] = roomJson;
        });

        // Add account data
        const accData: IMinimalEvent[] = [];
        Object.keys(this.accountData).forEach((evType) => {
            accData.push(this.accountData[evType]);
        });

        return {
            nextBatch: this.nextBatch!,
            roomsData: data,
            accountData: accData,
        };
    }

    public getNextBatchToken(): string {
        return this.nextBatch!;
    }
}

function setState(eventMap: Record<string, Record<string, IStateEvent>>, event: IRoomEvent | IStateEvent): void {
    if ((event as IStateEvent).state_key === null || (event as IStateEvent).state_key === undefined || !event.type) {
        return;
    }
    if (!eventMap[event.type]) {
        eventMap[event.type] = Object.create(null);
    }
    eventMap[event.type][(event as IStateEvent).state_key] = event as IStateEvent;
}
