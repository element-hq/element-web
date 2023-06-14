/*
Copyright 2015 - 2021 The Matrix.org Foundation C.I.C.

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

import { RoomMember } from "./room-member";
import { logger } from "../logger";
import { isNumber, removeHiddenChars } from "../utils";
import { EventType, UNSTABLE_MSC2716_MARKER } from "../@types/event";
import { IEvent, MatrixEvent, MatrixEventEvent } from "./event";
import { MatrixClient } from "../client";
import { GuestAccess, HistoryVisibility, IJoinRuleEventContent, JoinRule } from "../@types/partials";
import { TypedEventEmitter } from "./typed-event-emitter";
import { Beacon, BeaconEvent, BeaconEventHandlerMap, getBeaconInfoIdentifier, BeaconIdentifier } from "./beacon";
import { TypedReEmitter } from "../ReEmitter";
import { M_BEACON, M_BEACON_INFO } from "../@types/beacon";

export interface IMarkerFoundOptions {
    /** Whether the timeline was empty before the marker event arrived in the
     *  room. This could be happen in a variety of cases:
     *  1. From the initial sync
     *  2. It's the first state we're seeing after joining the room
     *  3. Or whether it's coming from `syncFromCache`
     *
     * A marker event refers to `UNSTABLE_MSC2716_MARKER` and indicates that
     * history was imported somewhere back in time. It specifically points to an
     * MSC2716 insertion event where the history was imported at. Marker events
     * are sent as state events so they are easily discoverable by clients and
     * homeservers and don't get lost in timeline gaps.
     */
    timelineWasEmpty?: boolean;
}

// possible statuses for out-of-band member loading
enum OobStatus {
    NotStarted,
    InProgress,
    Finished,
}

export interface IPowerLevelsContent {
    users?: Record<string, number>;
    events?: Record<string, number>;
    // eslint-disable-next-line camelcase
    users_default?: number;
    // eslint-disable-next-line camelcase
    events_default?: number;
    // eslint-disable-next-line camelcase
    state_default?: number;
    ban?: number;
    kick?: number;
    redact?: number;
}

export enum RoomStateEvent {
    Events = "RoomState.events",
    Members = "RoomState.members",
    NewMember = "RoomState.newMember",
    Update = "RoomState.update", // signals batches of updates without specificity
    BeaconLiveness = "RoomState.BeaconLiveness",
    Marker = "RoomState.Marker",
}

export type RoomStateEventHandlerMap = {
    /**
     * Fires whenever the event dictionary in room state is updated.
     * @param event - The matrix event which caused this event to fire.
     * @param state - The room state whose RoomState.events dictionary
     * was updated.
     * @param prevEvent - The event being replaced by the new state, if
     * known. Note that this can differ from `getPrevContent()` on the new state event
     * as this is the store's view of the last state, not the previous state provided
     * by the server.
     * @example
     * ```
     * matrixClient.on("RoomState.events", function(event, state, prevEvent){
     *   var newStateEvent = event;
     * });
     * ```
     */
    [RoomStateEvent.Events]: (event: MatrixEvent, state: RoomState, lastStateEvent: MatrixEvent | null) => void;
    /**
     * Fires whenever a member in the members dictionary is updated in any way.
     * @param event - The matrix event which caused this event to fire.
     * @param state - The room state whose RoomState.members dictionary
     * was updated.
     * @param member - The room member that was updated.
     * @example
     * ```
     * matrixClient.on("RoomState.members", function(event, state, member){
     *   var newMembershipState = member.membership;
     * });
     * ```
     */
    [RoomStateEvent.Members]: (event: MatrixEvent, state: RoomState, member: RoomMember) => void;
    /**
     * Fires whenever a member is added to the members dictionary. The RoomMember
     * will not be fully populated yet (e.g. no membership state) but will already
     * be available in the members dictionary.
     * @param event - The matrix event which caused this event to fire.
     * @param state - The room state whose RoomState.members dictionary
     * was updated with a new entry.
     * @param member - The room member that was added.
     * @example
     * ```
     * matrixClient.on("RoomState.newMember", function(event, state, member){
     *   // add event listeners on 'member'
     * });
     * ```
     */
    [RoomStateEvent.NewMember]: (event: MatrixEvent, state: RoomState, member: RoomMember) => void;
    [RoomStateEvent.Update]: (state: RoomState) => void;
    [RoomStateEvent.BeaconLiveness]: (state: RoomState, hasLiveBeacons: boolean) => void;
    [RoomStateEvent.Marker]: (event: MatrixEvent, setStateOptions?: IMarkerFoundOptions) => void;
    [BeaconEvent.New]: (event: MatrixEvent, beacon: Beacon) => void;
};

type EmittedEvents = RoomStateEvent | BeaconEvent;
type EventHandlerMap = RoomStateEventHandlerMap & BeaconEventHandlerMap;

export class RoomState extends TypedEventEmitter<EmittedEvents, EventHandlerMap> {
    public readonly reEmitter = new TypedReEmitter<EmittedEvents, EventHandlerMap>(this);
    private sentinels: Record<string, RoomMember> = {}; // userId: RoomMember
    // stores fuzzy matches to a list of userIDs (applies utils.removeHiddenChars to keys)
    private displayNameToUserIds = new Map<string, string[]>();
    private userIdsToDisplayNames: Record<string, string> = {};
    private tokenToInvite: Record<string, MatrixEvent> = {}; // 3pid invite state_key to m.room.member invite
    private joinedMemberCount: number | null = null; // cache of the number of joined members
    // joined members count from summary api
    // once set, we know the server supports the summary api
    // and we should only trust that
    // we could also only trust that before OOB members
    // are loaded but doesn't seem worth the hassle atm
    private summaryJoinedMemberCount: number | null = null;
    // same for invited member count
    private invitedMemberCount: number | null = null;
    private summaryInvitedMemberCount: number | null = null;
    private modified = -1;

    // XXX: Should be read-only
    // The room member dictionary, keyed on the user's ID.
    public members: Record<string, RoomMember> = {}; // userId: RoomMember
    // The state events dictionary, keyed on the event type and then the state_key value.
    public events = new Map<string, Map<string, MatrixEvent>>(); // Map<eventType, Map<stateKey, MatrixEvent>>
    // The pagination token for this state.
    public paginationToken: string | null = null;

    public readonly beacons = new Map<BeaconIdentifier, Beacon>();
    private _liveBeaconIds: BeaconIdentifier[] = [];

    /**
     * Construct room state.
     *
     * Room State represents the state of the room at a given point.
     * It can be mutated by adding state events to it.
     * There are two types of room member associated with a state event:
     * normal member objects (accessed via getMember/getMembers) which mutate
     * with the state to represent the current state of that room/user, e.g.
     * the object returned by `getMember('@bob:example.com')` will mutate to
     * get a different display name if Bob later changes his display name
     * in the room.
     * There are also 'sentinel' members (accessed via getSentinelMember).
     * These also represent the state of room members at the point in time
     * represented by the RoomState object, but unlike objects from getMember,
     * sentinel objects will always represent the room state as at the time
     * getSentinelMember was called, so if Bob subsequently changes his display
     * name, a room member object previously acquired with getSentinelMember
     * will still have his old display name. Calling getSentinelMember again
     * after the display name change will return a new RoomMember object
     * with Bob's new display name.
     *
     * @param roomId - Optional. The ID of the room which has this state.
     * If none is specified it just tracks paginationTokens, useful for notifTimelineSet
     * @param oobMemberFlags - Optional. The state of loading out of bound members.
     * As the timeline might get reset while they are loading, this state needs to be inherited
     * and shared when the room state is cloned for the new timeline.
     * This should only be passed from clone.
     */
    public constructor(public readonly roomId: string, private oobMemberFlags = { status: OobStatus.NotStarted }) {
        super();
        this.updateModifiedTime();
    }

    /**
     * Returns the number of joined members in this room
     * This method caches the result.
     * @returns The number of members in this room whose membership is 'join'
     */
    public getJoinedMemberCount(): number {
        if (this.summaryJoinedMemberCount !== null) {
            return this.summaryJoinedMemberCount;
        }
        if (this.joinedMemberCount === null) {
            this.joinedMemberCount = this.getMembers().reduce((count, m) => {
                return m.membership === "join" ? count + 1 : count;
            }, 0);
        }
        return this.joinedMemberCount;
    }

    /**
     * Set the joined member count explicitly (like from summary part of the sync response)
     * @param count - the amount of joined members
     */
    public setJoinedMemberCount(count: number): void {
        this.summaryJoinedMemberCount = count;
    }

    /**
     * Returns the number of invited members in this room
     * @returns The number of members in this room whose membership is 'invite'
     */
    public getInvitedMemberCount(): number {
        if (this.summaryInvitedMemberCount !== null) {
            return this.summaryInvitedMemberCount;
        }
        if (this.invitedMemberCount === null) {
            this.invitedMemberCount = this.getMembers().reduce((count, m) => {
                return m.membership === "invite" ? count + 1 : count;
            }, 0);
        }
        return this.invitedMemberCount;
    }

    /**
     * Set the amount of invited members in this room
     * @param count - the amount of invited members
     */
    public setInvitedMemberCount(count: number): void {
        this.summaryInvitedMemberCount = count;
    }

    /**
     * Get all RoomMembers in this room.
     * @returns A list of RoomMembers.
     */
    public getMembers(): RoomMember[] {
        return Object.values(this.members);
    }

    /**
     * Get all RoomMembers in this room, excluding the user IDs provided.
     * @param excludedIds - The user IDs to exclude.
     * @returns A list of RoomMembers.
     */
    public getMembersExcept(excludedIds: string[]): RoomMember[] {
        return this.getMembers().filter((m) => !excludedIds.includes(m.userId));
    }

    /**
     * Get a room member by their user ID.
     * @param userId - The room member's user ID.
     * @returns The member or null if they do not exist.
     */
    public getMember(userId: string): RoomMember | null {
        return this.members[userId] || null;
    }

    /**
     * Get a room member whose properties will not change with this room state. You
     * typically want this if you want to attach a RoomMember to a MatrixEvent which
     * may no longer be represented correctly by Room.currentState or Room.oldState.
     * The term 'sentinel' refers to the fact that this RoomMember is an unchanging
     * guardian for state at this particular point in time.
     * @param userId - The room member's user ID.
     * @returns The member or null if they do not exist.
     */
    public getSentinelMember(userId: string): RoomMember | null {
        if (!userId) return null;
        let sentinel = this.sentinels[userId];

        if (sentinel === undefined) {
            sentinel = new RoomMember(this.roomId, userId);
            const member = this.members[userId];
            if (member?.events.member) {
                sentinel.setMembershipEvent(member.events.member, this);
            }
            this.sentinels[userId] = sentinel;
        }
        return sentinel;
    }

    /**
     * Get state events from the state of the room.
     * @param eventType - The event type of the state event.
     * @param stateKey - Optional. The state_key of the state event. If
     * this is `undefined` then all matching state events will be
     * returned.
     * @returns A list of events if state_key was
     * `undefined`, else a single event (or null if no match found).
     */
    public getStateEvents(eventType: EventType | string): MatrixEvent[];
    public getStateEvents(eventType: EventType | string, stateKey: string): MatrixEvent | null;
    public getStateEvents(eventType: EventType | string, stateKey?: string): MatrixEvent[] | MatrixEvent | null {
        if (!this.events.has(eventType)) {
            // no match
            return stateKey === undefined ? [] : null;
        }
        if (stateKey === undefined) {
            // return all values
            return Array.from(this.events.get(eventType)!.values());
        }
        const event = this.events.get(eventType)!.get(stateKey);
        return event ? event : null;
    }

    public get hasLiveBeacons(): boolean {
        return !!this.liveBeaconIds?.length;
    }

    public get liveBeaconIds(): BeaconIdentifier[] {
        return this._liveBeaconIds;
    }

    /**
     * Creates a copy of this room state so that mutations to either won't affect the other.
     * @returns the copy of the room state
     */
    public clone(): RoomState {
        const copy = new RoomState(this.roomId, this.oobMemberFlags);

        // Ugly hack: because setStateEvents will mark
        // members as susperseding future out of bound members
        // if loading is in progress (through oobMemberFlags)
        // since these are not new members, we're merely copying them
        // set the status to not started
        // after copying, we set back the status
        const status = this.oobMemberFlags.status;
        this.oobMemberFlags.status = OobStatus.NotStarted;

        Array.from(this.events.values()).forEach((eventsByStateKey) => {
            copy.setStateEvents(Array.from(eventsByStateKey.values()));
        });

        // Ugly hack: see above
        this.oobMemberFlags.status = status;

        if (this.summaryInvitedMemberCount !== null) {
            copy.setInvitedMemberCount(this.getInvitedMemberCount());
        }
        if (this.summaryJoinedMemberCount !== null) {
            copy.setJoinedMemberCount(this.getJoinedMemberCount());
        }

        // copy out of band flags if needed
        if (this.oobMemberFlags.status == OobStatus.Finished) {
            // copy markOutOfBand flags
            this.getMembers().forEach((member) => {
                if (member.isOutOfBand()) {
                    copy.getMember(member.userId)?.markOutOfBand();
                }
            });
        }

        return copy;
    }

    /**
     * Add previously unknown state events.
     * When lazy loading members while back-paginating,
     * the relevant room state for the timeline chunk at the end
     * of the chunk can be set with this method.
     * @param events - state events to prepend
     */
    public setUnknownStateEvents(events: MatrixEvent[]): void {
        const unknownStateEvents = events.filter((event) => {
            return !this.events.has(event.getType()) || !this.events.get(event.getType())!.has(event.getStateKey()!);
        });

        this.setStateEvents(unknownStateEvents);
    }

    /**
     * Add an array of one or more state MatrixEvents, overwriting any existing
     * state with the same `{type, stateKey}` tuple. Will fire "RoomState.events"
     * for every event added. May fire "RoomState.members" if there are
     * `m.room.member` events. May fire "RoomStateEvent.Marker" if there are
     * `UNSTABLE_MSC2716_MARKER` events.
     * @param stateEvents - a list of state events for this room.
     *
     * @remarks
     * Fires {@link RoomStateEvent.Members}
     * Fires {@link RoomStateEvent.NewMember}
     * Fires {@link RoomStateEvent.Events}
     * Fires {@link RoomStateEvent.Marker}
     */
    public setStateEvents(stateEvents: MatrixEvent[], markerFoundOptions?: IMarkerFoundOptions): void {
        this.updateModifiedTime();

        // update the core event dict
        stateEvents.forEach((event) => {
            if (event.getRoomId() !== this.roomId || !event.isState()) return;

            if (M_BEACON_INFO.matches(event.getType())) {
                this.setBeacon(event);
            }

            const lastStateEvent = this.getStateEventMatching(event);
            this.setStateEvent(event);
            if (event.getType() === EventType.RoomMember) {
                this.updateDisplayNameCache(event.getStateKey()!, event.getContent().displayname ?? "");
                this.updateThirdPartyTokenCache(event);
            }
            this.emit(RoomStateEvent.Events, event, this, lastStateEvent);
        });

        this.onBeaconLivenessChange();
        // update higher level data structures. This needs to be done AFTER the
        // core event dict as these structures may depend on other state events in
        // the given array (e.g. disambiguating display names in one go to do both
        // clashing names rather than progressively which only catches 1 of them).
        stateEvents.forEach((event) => {
            if (event.getRoomId() !== this.roomId || !event.isState()) return;

            if (event.getType() === EventType.RoomMember) {
                const userId = event.getStateKey()!;

                // leave events apparently elide the displayname or avatar_url,
                // so let's fake one up so that we don't leak user ids
                // into the timeline
                if (event.getContent().membership === "leave" || event.getContent().membership === "ban") {
                    event.getContent().avatar_url = event.getContent().avatar_url || event.getPrevContent().avatar_url;
                    event.getContent().displayname =
                        event.getContent().displayname || event.getPrevContent().displayname;
                }

                const member = this.getOrCreateMember(userId, event);
                member.setMembershipEvent(event, this);
                this.updateMember(member);
                this.emit(RoomStateEvent.Members, event, this, member);
            } else if (event.getType() === EventType.RoomPowerLevels) {
                // events with unknown state keys should be ignored
                // and should not aggregate onto members power levels
                if (event.getStateKey() !== "") {
                    return;
                }
                const members = Object.values(this.members);
                members.forEach((member) => {
                    // We only propagate `RoomState.members` event if the
                    // power levels has been changed
                    // large room suffer from large re-rendering especially when not needed
                    const oldLastModified = member.getLastModifiedTime();
                    member.setPowerLevelEvent(event);
                    if (oldLastModified !== member.getLastModifiedTime()) {
                        this.emit(RoomStateEvent.Members, event, this, member);
                    }
                });

                // assume all our sentinels are now out-of-date
                this.sentinels = {};
            } else if (UNSTABLE_MSC2716_MARKER.matches(event.getType())) {
                this.emit(RoomStateEvent.Marker, event, markerFoundOptions);
            }
        });

        this.emit(RoomStateEvent.Update, this);
    }

    public async processBeaconEvents(events: MatrixEvent[], matrixClient: MatrixClient): Promise<void> {
        if (
            !events.length ||
            // discard locations if we have no beacons
            !this.beacons.size
        ) {
            return;
        }

        const beaconByEventIdDict = [...this.beacons.values()].reduce<Record<string, Beacon>>((dict, beacon) => {
            dict[beacon.beaconInfoId] = beacon;
            return dict;
        }, {});

        const processBeaconRelation = (beaconInfoEventId: string, event: MatrixEvent): void => {
            if (!M_BEACON.matches(event.getType())) {
                return;
            }

            const beacon = beaconByEventIdDict[beaconInfoEventId];

            if (beacon) {
                beacon.addLocations([event]);
            }
        };

        for (const event of events) {
            const relatedToEventId = event.getRelation()?.event_id;
            // not related to a beacon we know about; discard
            if (!relatedToEventId || !beaconByEventIdDict[relatedToEventId]) return;
            if (!M_BEACON.matches(event.getType()) && !event.isEncrypted()) return;

            try {
                await matrixClient.decryptEventIfNeeded(event);
                processBeaconRelation(relatedToEventId, event);
            } catch {
                if (event.isDecryptionFailure()) {
                    // add an event listener for once the event is decrypted.
                    event.once(MatrixEventEvent.Decrypted, async () => {
                        processBeaconRelation(relatedToEventId, event);
                    });
                }
            }
        }
    }

    /**
     * Looks up a member by the given userId, and if it doesn't exist,
     * create it and emit the `RoomState.newMember` event.
     * This method makes sure the member is added to the members dictionary
     * before emitting, as this is done from setStateEvents and setOutOfBandMember.
     * @param userId - the id of the user to look up
     * @param event - the membership event for the (new) member. Used to emit.
     * @returns the member, existing or newly created.
     *
     * @remarks
     * Fires {@link RoomStateEvent.NewMember}
     */
    private getOrCreateMember(userId: string, event: MatrixEvent): RoomMember {
        let member = this.members[userId];
        if (!member) {
            member = new RoomMember(this.roomId, userId);
            // add member to members before emitting any events,
            // as event handlers often lookup the member
            this.members[userId] = member;
            this.emit(RoomStateEvent.NewMember, event, this, member);
        }
        return member;
    }

    private setStateEvent(event: MatrixEvent): void {
        if (!this.events.has(event.getType())) {
            this.events.set(event.getType(), new Map());
        }
        this.events.get(event.getType())!.set(event.getStateKey()!, event);
    }

    /**
     * @experimental
     */
    private setBeacon(event: MatrixEvent): void {
        const beaconIdentifier = getBeaconInfoIdentifier(event);

        if (this.beacons.has(beaconIdentifier)) {
            const beacon = this.beacons.get(beaconIdentifier)!;

            if (event.isRedacted()) {
                if (beacon.beaconInfoId === (<IEvent>event.getRedactionEvent())?.redacts) {
                    beacon.destroy();
                    this.beacons.delete(beaconIdentifier);
                }
                return;
            }

            return beacon.update(event);
        }

        if (event.isRedacted()) {
            return;
        }

        const beacon = new Beacon(event);

        this.reEmitter.reEmit<BeaconEvent, BeaconEvent>(beacon, [
            BeaconEvent.New,
            BeaconEvent.Update,
            BeaconEvent.Destroy,
            BeaconEvent.LivenessChange,
        ]);

        this.emit(BeaconEvent.New, event, beacon);
        beacon.on(BeaconEvent.LivenessChange, this.onBeaconLivenessChange.bind(this));
        beacon.on(BeaconEvent.Destroy, this.onBeaconLivenessChange.bind(this));

        this.beacons.set(beacon.identifier, beacon);
    }

    /**
     * @experimental
     * Check liveness of room beacons
     * emit RoomStateEvent.BeaconLiveness event
     */
    private onBeaconLivenessChange(): void {
        this._liveBeaconIds = Array.from(this.beacons.values())
            .filter((beacon) => beacon.isLive)
            .map((beacon) => beacon.identifier);

        this.emit(RoomStateEvent.BeaconLiveness, this, this.hasLiveBeacons);
    }

    private getStateEventMatching(event: MatrixEvent): MatrixEvent | null {
        return this.events.get(event.getType())?.get(event.getStateKey()!) ?? null;
    }

    private updateMember(member: RoomMember): void {
        // this member may have a power level already, so set it.
        const pwrLvlEvent = this.getStateEvents(EventType.RoomPowerLevels, "");
        if (pwrLvlEvent) {
            member.setPowerLevelEvent(pwrLvlEvent);
        }

        // blow away the sentinel which is now outdated
        delete this.sentinels[member.userId];

        this.members[member.userId] = member;
        this.joinedMemberCount = null;
        this.invitedMemberCount = null;
    }

    /**
     * Get the out-of-band members loading state, whether loading is needed or not.
     * Note that loading might be in progress and hence isn't needed.
     * @returns whether or not the members of this room need to be loaded
     */
    public needsOutOfBandMembers(): boolean {
        return this.oobMemberFlags.status === OobStatus.NotStarted;
    }

    /**
     * Check if loading of out-of-band-members has completed
     *
     * @returns true if the full membership list of this room has been loaded. False if it is not started or is in
     *    progress.
     */
    public outOfBandMembersReady(): boolean {
        return this.oobMemberFlags.status === OobStatus.Finished;
    }

    /**
     * Mark this room state as waiting for out-of-band members,
     * ensuring it doesn't ask for them to be requested again
     * through needsOutOfBandMembers
     */
    public markOutOfBandMembersStarted(): void {
        if (this.oobMemberFlags.status !== OobStatus.NotStarted) {
            return;
        }
        this.oobMemberFlags.status = OobStatus.InProgress;
    }

    /**
     * Mark this room state as having failed to fetch out-of-band members
     */
    public markOutOfBandMembersFailed(): void {
        if (this.oobMemberFlags.status !== OobStatus.InProgress) {
            return;
        }
        this.oobMemberFlags.status = OobStatus.NotStarted;
    }

    /**
     * Clears the loaded out-of-band members
     */
    public clearOutOfBandMembers(): void {
        let count = 0;
        Object.keys(this.members).forEach((userId) => {
            const member = this.members[userId];
            if (member.isOutOfBand()) {
                ++count;
                delete this.members[userId];
            }
        });
        logger.log(`LL: RoomState removed ${count} members...`);
        this.oobMemberFlags.status = OobStatus.NotStarted;
    }

    /**
     * Sets the loaded out-of-band members.
     * @param stateEvents - array of membership state events
     */
    public setOutOfBandMembers(stateEvents: MatrixEvent[]): void {
        logger.log(`LL: RoomState about to set ${stateEvents.length} OOB members ...`);
        if (this.oobMemberFlags.status !== OobStatus.InProgress) {
            return;
        }
        logger.log(`LL: RoomState put in finished state ...`);
        this.oobMemberFlags.status = OobStatus.Finished;
        stateEvents.forEach((e) => this.setOutOfBandMember(e));
        this.emit(RoomStateEvent.Update, this);
    }

    /**
     * Sets a single out of band member, used by both setOutOfBandMembers and clone
     * @param stateEvent - membership state event
     */
    private setOutOfBandMember(stateEvent: MatrixEvent): void {
        if (stateEvent.getType() !== EventType.RoomMember) {
            return;
        }
        const userId = stateEvent.getStateKey()!;
        const existingMember = this.getMember(userId);
        // never replace members received as part of the sync
        if (existingMember && !existingMember.isOutOfBand()) {
            return;
        }

        const member = this.getOrCreateMember(userId, stateEvent);
        member.setMembershipEvent(stateEvent, this);
        // needed to know which members need to be stored seperately
        // as they are not part of the sync accumulator
        // this is cleared by setMembershipEvent so when it's updated through /sync
        member.markOutOfBand();

        this.updateDisplayNameCache(member.userId, member.name);

        this.setStateEvent(stateEvent);
        this.updateMember(member);
        this.emit(RoomStateEvent.Members, stateEvent, this, member);
    }

    /**
     * Set the current typing event for this room.
     * @param event - The typing event
     */
    public setTypingEvent(event: MatrixEvent): void {
        Object.values(this.members).forEach(function (member) {
            member.setTypingEvent(event);
        });
    }

    /**
     * Get the m.room.member event which has the given third party invite token.
     *
     * @param token - The token
     * @returns The m.room.member event or null
     */
    public getInviteForThreePidToken(token: string): MatrixEvent | null {
        return this.tokenToInvite[token] || null;
    }

    /**
     * Update the last modified time to the current time.
     */
    private updateModifiedTime(): void {
        this.modified = Date.now();
    }

    /**
     * Get the timestamp when this room state was last updated. This timestamp is
     * updated when this object has received new state events.
     * @returns The timestamp
     */
    public getLastModifiedTime(): number {
        return this.modified;
    }

    /**
     * Get user IDs with the specified or similar display names.
     * @param displayName - The display name to get user IDs from.
     * @returns An array of user IDs or an empty array.
     */
    public getUserIdsWithDisplayName(displayName: string): string[] {
        return this.displayNameToUserIds.get(removeHiddenChars(displayName)) ?? [];
    }

    /**
     * Returns true if userId is in room, event is not redacted and either sender of
     * mxEvent or has power level sufficient to redact events other than their own.
     * @param mxEvent - The event to test permission for
     * @param userId - The user ID of the user to test permission for
     * @returns true if the given used ID can redact given event
     */
    public maySendRedactionForEvent(mxEvent: MatrixEvent, userId: string): boolean {
        const member = this.getMember(userId);
        if (!member || member.membership === "leave") return false;

        if (mxEvent.status || mxEvent.isRedacted()) return false;

        // The user may have been the sender, but they can't redact their own message
        // if redactions are blocked.
        const canRedact = this.maySendEvent(EventType.RoomRedaction, userId);
        if (mxEvent.getSender() === userId) return canRedact;

        return this.hasSufficientPowerLevelFor("redact", member.powerLevel);
    }

    /**
     * Returns true if the given power level is sufficient for action
     * @param action - The type of power level to check
     * @param powerLevel - The power level of the member
     * @returns true if the given power level is sufficient
     */
    public hasSufficientPowerLevelFor(action: "ban" | "kick" | "redact", powerLevel: number): boolean {
        const powerLevelsEvent = this.getStateEvents(EventType.RoomPowerLevels, "");

        let powerLevels: IPowerLevelsContent = {};
        if (powerLevelsEvent) {
            powerLevels = powerLevelsEvent.getContent();
        }

        let requiredLevel = 50;
        if (isNumber(powerLevels[action])) {
            requiredLevel = powerLevels[action]!;
        }

        return powerLevel >= requiredLevel;
    }

    /**
     * Short-form for maySendEvent('m.room.message', userId)
     * @param userId - The user ID of the user to test permission for
     * @returns true if the given user ID should be permitted to send
     *                   message events into the given room.
     */
    public maySendMessage(userId: string): boolean {
        return this.maySendEventOfType(EventType.RoomMessage, userId, false);
    }

    /**
     * Returns true if the given user ID has permission to send a normal
     * event of type `eventType` into this room.
     * @param eventType - The type of event to test
     * @param userId - The user ID of the user to test permission for
     * @returns true if the given user ID should be permitted to send
     *                        the given type of event into this room,
     *                        according to the room's state.
     */
    public maySendEvent(eventType: EventType | string, userId: string): boolean {
        return this.maySendEventOfType(eventType, userId, false);
    }

    /**
     * Returns true if the given MatrixClient has permission to send a state
     * event of type `stateEventType` into this room.
     * @param stateEventType - The type of state events to test
     * @param cli - The client to test permission for
     * @returns true if the given client should be permitted to send
     *                        the given type of state event into this room,
     *                        according to the room's state.
     */
    public mayClientSendStateEvent(stateEventType: EventType | string, cli: MatrixClient): boolean {
        if (cli.isGuest() || !cli.credentials.userId) {
            return false;
        }
        return this.maySendStateEvent(stateEventType, cli.credentials.userId);
    }

    /**
     * Returns true if the given user ID has permission to send a state
     * event of type `stateEventType` into this room.
     * @param stateEventType - The type of state events to test
     * @param userId - The user ID of the user to test permission for
     * @returns true if the given user ID should be permitted to send
     *                        the given type of state event into this room,
     *                        according to the room's state.
     */
    public maySendStateEvent(stateEventType: EventType | string, userId: string): boolean {
        return this.maySendEventOfType(stateEventType, userId, true);
    }

    /**
     * Returns true if the given user ID has permission to send a normal or state
     * event of type `eventType` into this room.
     * @param eventType - The type of event to test
     * @param userId - The user ID of the user to test permission for
     * @param state - If true, tests if the user may send a state
     event of this type. Otherwise tests whether
     they may send a regular event.
     * @returns true if the given user ID should be permitted to send
     *                        the given type of event into this room,
     *                        according to the room's state.
     */
    private maySendEventOfType(eventType: EventType | string, userId: string, state: boolean): boolean {
        const powerLevelsEvent = this.getStateEvents(EventType.RoomPowerLevels, "");

        let powerLevels: IPowerLevelsContent;
        let eventsLevels: Record<EventType | string, number> = {};

        let stateDefault = 0;
        let eventsDefault = 0;
        let powerLevel = 0;
        if (powerLevelsEvent) {
            powerLevels = powerLevelsEvent.getContent();
            eventsLevels = powerLevels.events || {};

            if (Number.isSafeInteger(powerLevels.state_default)) {
                stateDefault = powerLevels.state_default!;
            } else {
                stateDefault = 50;
            }

            const userPowerLevel = powerLevels.users && powerLevels.users[userId];
            if (Number.isSafeInteger(userPowerLevel)) {
                powerLevel = userPowerLevel!;
            } else if (Number.isSafeInteger(powerLevels.users_default)) {
                powerLevel = powerLevels.users_default!;
            }

            if (Number.isSafeInteger(powerLevels.events_default)) {
                eventsDefault = powerLevels.events_default!;
            }
        }

        let requiredLevel = state ? stateDefault : eventsDefault;
        if (Number.isSafeInteger(eventsLevels[eventType])) {
            requiredLevel = eventsLevels[eventType];
        }
        return powerLevel >= requiredLevel;
    }

    /**
     * Returns true if the given user ID has permission to trigger notification
     * of type `notifLevelKey`
     * @param notifLevelKey - The level of notification to test (eg. 'room')
     * @param userId - The user ID of the user to test permission for
     * @returns true if the given user ID has permission to trigger a
     *                        notification of this type.
     */
    public mayTriggerNotifOfType(notifLevelKey: string, userId: string): boolean {
        const member = this.getMember(userId);
        if (!member) {
            return false;
        }

        const powerLevelsEvent = this.getStateEvents(EventType.RoomPowerLevels, "");

        let notifLevel = 50;
        if (
            powerLevelsEvent &&
            powerLevelsEvent.getContent() &&
            powerLevelsEvent.getContent().notifications &&
            isNumber(powerLevelsEvent.getContent().notifications[notifLevelKey])
        ) {
            notifLevel = powerLevelsEvent.getContent().notifications[notifLevelKey];
        }

        return member.powerLevel >= notifLevel;
    }

    /**
     * Returns the join rule based on the m.room.join_rule state event, defaulting to `invite`.
     * @returns the join_rule applied to this room
     */
    public getJoinRule(): JoinRule {
        const joinRuleEvent = this.getStateEvents(EventType.RoomJoinRules, "");
        const joinRuleContent: Partial<IJoinRuleEventContent> = joinRuleEvent?.getContent() ?? {};
        return joinRuleContent["join_rule"] || JoinRule.Invite;
    }

    /**
     * Returns the history visibility based on the m.room.history_visibility state event, defaulting to `shared`.
     * @returns the history_visibility applied to this room
     */
    public getHistoryVisibility(): HistoryVisibility {
        const historyVisibilityEvent = this.getStateEvents(EventType.RoomHistoryVisibility, "");
        const historyVisibilityContent = historyVisibilityEvent?.getContent() ?? {};
        return historyVisibilityContent["history_visibility"] || HistoryVisibility.Shared;
    }

    /**
     * Returns the guest access based on the m.room.guest_access state event, defaulting to `shared`.
     * @returns the guest_access applied to this room
     */
    public getGuestAccess(): GuestAccess {
        const guestAccessEvent = this.getStateEvents(EventType.RoomGuestAccess, "");
        const guestAccessContent = guestAccessEvent?.getContent() ?? {};
        return guestAccessContent["guest_access"] || GuestAccess.Forbidden;
    }

    /**
     * Find the predecessor room based on this room state.
     *
     * @param msc3946ProcessDynamicPredecessor - if true, look for an
     * m.room.predecessor state event and use it if found (MSC3946).
     * @returns null if this room has no predecessor. Otherwise, returns
     * the roomId, last eventId and viaServers of the predecessor room.
     *
     * If msc3946ProcessDynamicPredecessor is true, use m.predecessor events
     * as well as m.room.create events to find predecessors.
     *
     * Note: if an m.predecessor event is used, eventId may be undefined
     * since last_known_event_id is optional.
     *
     * Note: viaServers may be undefined, and will definitely be undefined if
     * this predecessor comes from a RoomCreate event (rather than a
     * RoomPredecessor, which has the optional via_servers property).
     */
    public findPredecessor(
        msc3946ProcessDynamicPredecessor = false,
    ): { roomId: string; eventId?: string; viaServers?: string[] } | null {
        // Note: the tests for this function are against Room.findPredecessor,
        // which just calls through to here.

        if (msc3946ProcessDynamicPredecessor) {
            const predecessorEvent = this.getStateEvents(EventType.RoomPredecessor, "");
            if (predecessorEvent) {
                const content = predecessorEvent.getContent<{
                    predecessor_room_id: string;
                    last_known_event_id?: string;
                    via_servers?: string[];
                }>();
                const roomId = content.predecessor_room_id;
                let eventId = content.last_known_event_id;
                if (typeof eventId !== "string") {
                    eventId = undefined;
                }
                let viaServers = content.via_servers;
                if (!Array.isArray(viaServers)) {
                    viaServers = undefined;
                }
                if (typeof roomId === "string") {
                    return { roomId, eventId, viaServers };
                }
            }
        }

        const createEvent = this.getStateEvents(EventType.RoomCreate, "");
        if (createEvent) {
            const predecessor = createEvent.getContent<{
                predecessor?: Partial<{
                    room_id: string;
                    event_id: string;
                }>;
            }>()["predecessor"];
            if (predecessor) {
                const roomId = predecessor["room_id"];
                if (typeof roomId === "string") {
                    let eventId = predecessor["event_id"];
                    if (typeof eventId !== "string" || eventId === "") {
                        eventId = undefined;
                    }
                    return { roomId, eventId };
                }
            }
        }
        return null;
    }

    private updateThirdPartyTokenCache(memberEvent: MatrixEvent): void {
        if (!memberEvent.getContent().third_party_invite) {
            return;
        }
        const token = (memberEvent.getContent().third_party_invite.signed || {}).token;
        if (!token) {
            return;
        }
        const threePidInvite = this.getStateEvents(EventType.RoomThirdPartyInvite, token);
        if (!threePidInvite) {
            return;
        }
        this.tokenToInvite[token] = memberEvent;
    }

    private updateDisplayNameCache(userId: string, displayName: string): void {
        const oldName = this.userIdsToDisplayNames[userId];
        delete this.userIdsToDisplayNames[userId];
        if (oldName) {
            // Remove the old name from the cache.
            // We clobber the user_id > name lookup but the name -> [user_id] lookup
            // means we need to remove that user ID from that array rather than nuking
            // the lot.
            const strippedOldName = removeHiddenChars(oldName);

            const existingUserIds = this.displayNameToUserIds.get(strippedOldName);
            if (existingUserIds) {
                // remove this user ID from this array
                const filteredUserIDs = existingUserIds.filter((id) => id !== userId);
                this.displayNameToUserIds.set(strippedOldName, filteredUserIDs);
            }
        }

        this.userIdsToDisplayNames[userId] = displayName;

        const strippedDisplayname = displayName && removeHiddenChars(displayName);
        // an empty stripped displayname (undefined/'') will be set to MXID in room-member.js
        if (strippedDisplayname) {
            const arr = this.displayNameToUserIds.get(strippedDisplayname) ?? [];
            arr.push(userId);
            this.displayNameToUserIds.set(strippedDisplayname, arr);
        }
    }
}
