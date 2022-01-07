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

/**
 * @module models/room-state
 */

import { EventEmitter } from "events";

import { RoomMember } from "./room-member";
import { logger } from '../logger';
import * as utils from "../utils";
import { EventType } from "../@types/event";
import { MatrixEvent } from "./event";
import { MatrixClient } from "../client";
import { GuestAccess, HistoryVisibility, IJoinRuleEventContent, JoinRule } from "../@types/partials";

// possible statuses for out-of-band member loading
enum OobStatus {
    NotStarted,
    InProgress,
    Finished,
}

export class RoomState extends EventEmitter {
    private sentinels: Record<string, RoomMember> = {}; // userId: RoomMember
    // stores fuzzy matches to a list of userIDs (applies utils.removeHiddenChars to keys)
    private displayNameToUserIds: Record<string, string[]> = {};
    private userIdsToDisplayNames: Record<string, string> = {};
    private tokenToInvite: Record<string, MatrixEvent> = {}; // 3pid invite state_key to m.room.member invite
    private joinedMemberCount: number = null; // cache of the number of joined members
    // joined members count from summary api
    // once set, we know the server supports the summary api
    // and we should only trust that
    // we could also only trust that before OOB members
    // are loaded but doesn't seem worth the hassle atm
    private summaryJoinedMemberCount: number = null;
    // same for invited member count
    private invitedMemberCount: number = null;
    private summaryInvitedMemberCount: number = null;
    private modified: number;

    // XXX: Should be read-only
    public members: Record<string, RoomMember> = {}; // userId: RoomMember
    public events = new Map<string, Map<string, MatrixEvent>>(); // Map<eventType, Map<stateKey, MatrixEvent>>
    public paginationToken: string = null;

    /**
     * Construct room state.
     *
     * Room State represents the state of the room at a given point.
     * It can be mutated by adding state events to it.
     * There are two types of room member associated with a state event:
     * normal member objects (accessed via getMember/getMembers) which mutate
     * with the state to represent the current state of that room/user, eg.
     * the object returned by getMember('@bob:example.com') will mutate to
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
     * @constructor
     * @param {?string} roomId Optional. The ID of the room which has this state.
     * If none is specified it just tracks paginationTokens, useful for notifTimelineSet
     * @param {?object} oobMemberFlags Optional. The state of loading out of bound members.
     * As the timeline might get reset while they are loading, this state needs to be inherited
     * and shared when the room state is cloned for the new timeline.
     * This should only be passed from clone.
     * @prop {Object.<string, RoomMember>} members The room member dictionary, keyed
     * on the user's ID.
     * @prop {Object.<string, Object.<string, MatrixEvent>>} events The state
     * events dictionary, keyed on the event type and then the state_key value.
     * @prop {string} paginationToken The pagination token for this state.
     */
    constructor(public readonly roomId: string, private oobMemberFlags = { status: OobStatus.NotStarted }) {
        super();
        this.updateModifiedTime();
    }

    /**
     * Returns the number of joined members in this room
     * This method caches the result.
     * @return {number} The number of members in this room whose membership is 'join'
     */
    public getJoinedMemberCount(): number {
        if (this.summaryJoinedMemberCount !== null) {
            return this.summaryJoinedMemberCount;
        }
        if (this.joinedMemberCount === null) {
            this.joinedMemberCount = this.getMembers().reduce((count, m) => {
                return m.membership === 'join' ? count + 1 : count;
            }, 0);
        }
        return this.joinedMemberCount;
    }

    /**
     * Set the joined member count explicitly (like from summary part of the sync response)
     * @param {number} count the amount of joined members
     */
    public setJoinedMemberCount(count: number): void {
        this.summaryJoinedMemberCount = count;
    }

    /**
     * Returns the number of invited members in this room
     * @return {number} The number of members in this room whose membership is 'invite'
     */
    public getInvitedMemberCount(): number {
        if (this.summaryInvitedMemberCount !== null) {
            return this.summaryInvitedMemberCount;
        }
        if (this.invitedMemberCount === null) {
            this.invitedMemberCount = this.getMembers().reduce((count, m) => {
                return m.membership === 'invite' ? count + 1 : count;
            }, 0);
        }
        return this.invitedMemberCount;
    }

    /**
     * Set the amount of invited members in this room
     * @param {number} count the amount of invited members
     */
    public setInvitedMemberCount(count: number): void {
        this.summaryInvitedMemberCount = count;
    }

    /**
     * Get all RoomMembers in this room.
     * @return {Array<RoomMember>} A list of RoomMembers.
     */
    public getMembers(): RoomMember[] {
        return Object.values(this.members);
    }

    /**
     * Get all RoomMembers in this room, excluding the user IDs provided.
     * @param {Array<string>} excludedIds The user IDs to exclude.
     * @return {Array<RoomMember>} A list of RoomMembers.
     */
    public getMembersExcept(excludedIds: string[]): RoomMember[] {
        return this.getMembers().filter((m) => !excludedIds.includes(m.userId));
    }

    /**
     * Get a room member by their user ID.
     * @param {string} userId The room member's user ID.
     * @return {RoomMember} The member or null if they do not exist.
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
     * @param {string} userId The room member's user ID.
     * @return {RoomMember} The member or null if they do not exist.
     */
    public getSentinelMember(userId: string): RoomMember | null {
        if (!userId) return null;
        let sentinel = this.sentinels[userId];

        if (sentinel === undefined) {
            sentinel = new RoomMember(this.roomId, userId);
            const member = this.members[userId];
            if (member) {
                sentinel.setMembershipEvent(member.events.member, this);
            }
            this.sentinels[userId] = sentinel;
        }
        return sentinel;
    }

    /**
     * Get state events from the state of the room.
     * @param {string} eventType The event type of the state event.
     * @param {string} stateKey Optional. The state_key of the state event. If
     * this is <code>undefined</code> then all matching state events will be
     * returned.
     * @return {MatrixEvent[]|MatrixEvent} A list of events if state_key was
     * <code>undefined</code>, else a single event (or null if no match found).
     */
    public getStateEvents(eventType: EventType | string): MatrixEvent[];
    public getStateEvents(eventType: EventType | string, stateKey: string): MatrixEvent;
    public getStateEvents(eventType: EventType | string, stateKey?: string) {
        if (!this.events.has(eventType)) {
            // no match
            return stateKey === undefined ? [] : null;
        }
        if (stateKey === undefined) { // return all values
            return Array.from(this.events.get(eventType).values());
        }
        const event = this.events.get(eventType).get(stateKey);
        return event ? event : null;
    }

    /**
     * Creates a copy of this room state so that mutations to either won't affect the other.
     * @return {RoomState} the copy of the room state
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
                    const copyMember = copy.getMember(member.userId);
                    copyMember.markOutOfBand();
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
     * @param {MatrixEvent[]} events state events to prepend
     */
    public setUnknownStateEvents(events: MatrixEvent[]): void {
        const unknownStateEvents = events.filter((event) => {
            return !this.events.has(event.getType()) ||
                !this.events.get(event.getType()).has(event.getStateKey());
        });

        this.setStateEvents(unknownStateEvents);
    }

    /**
     * Add an array of one or more state MatrixEvents, overwriting
     * any existing state with the same {type, stateKey} tuple. Will fire
     * "RoomState.events" for every event added. May fire "RoomState.members"
     * if there are <code>m.room.member</code> events.
     * @param {MatrixEvent[]} stateEvents a list of state events for this room.
     * @fires module:client~MatrixClient#event:"RoomState.members"
     * @fires module:client~MatrixClient#event:"RoomState.newMember"
     * @fires module:client~MatrixClient#event:"RoomState.events"
     */
    public setStateEvents(stateEvents: MatrixEvent[]) {
        this.updateModifiedTime();

        // update the core event dict
        stateEvents.forEach((event) => {
            if (event.getRoomId() !== this.roomId) {
                return;
            }
            if (!event.isState()) {
                return;
            }

            const lastStateEvent = this.getStateEventMatching(event);
            this.setStateEvent(event);
            if (event.getType() === EventType.RoomMember) {
                this.updateDisplayNameCache(event.getStateKey(), event.getContent().displayname);
                this.updateThirdPartyTokenCache(event);
            }
            this.emit("RoomState.events", event, this, lastStateEvent);
        });

        // update higher level data structures. This needs to be done AFTER the
        // core event dict as these structures may depend on other state events in
        // the given array (e.g. disambiguating display names in one go to do both
        // clashing names rather than progressively which only catches 1 of them).
        stateEvents.forEach((event) => {
            if (event.getRoomId() !== this.roomId) {
                return;
            }
            if (!event.isState()) {
                return;
            }

            if (event.getType() === EventType.RoomMember) {
                const userId = event.getStateKey();

                // leave events apparently elide the displayname or avatar_url,
                // so let's fake one up so that we don't leak user ids
                // into the timeline
                if (event.getContent().membership === "leave" ||
                    event.getContent().membership === "ban") {
                    event.getContent().avatar_url =
                        event.getContent().avatar_url ||
                        event.getPrevContent().avatar_url;
                    event.getContent().displayname =
                        event.getContent().displayname ||
                        event.getPrevContent().displayname;
                }

                const member = this.getOrCreateMember(userId, event);
                member.setMembershipEvent(event, this);

                this.updateMember(member);
                this.emit("RoomState.members", event, this, member);
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
                        this.emit("RoomState.members", event, this, member);
                    }
                });

                // assume all our sentinels are now out-of-date
                this.sentinels = {};
            }
        });
    }

    /**
     * Looks up a member by the given userId, and if it doesn't exist,
     * create it and emit the `RoomState.newMember` event.
     * This method makes sure the member is added to the members dictionary
     * before emitting, as this is done from setStateEvents and setOutOfBandMember.
     * @param {string} userId the id of the user to look up
     * @param {MatrixEvent} event the membership event for the (new) member. Used to emit.
     * @fires module:client~MatrixClient#event:"RoomState.newMember"
     * @returns {RoomMember} the member, existing or newly created.
     */
    private getOrCreateMember(userId: string, event: MatrixEvent): RoomMember {
        let member = this.members[userId];
        if (!member) {
            member = new RoomMember(this.roomId, userId);
            // add member to members before emitting any events,
            // as event handlers often lookup the member
            this.members[userId] = member;
            this.emit("RoomState.newMember", event, this, member);
        }
        return member;
    }

    private setStateEvent(event: MatrixEvent): void {
        if (!this.events.has(event.getType())) {
            this.events.set(event.getType(), new Map());
        }
        this.events.get(event.getType()).set(event.getStateKey(), event);
    }

    private getStateEventMatching(event: MatrixEvent): MatrixEvent | null {
        if (!this.events.has(event.getType())) return null;
        return this.events.get(event.getType()).get(event.getStateKey());
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
     * @return {boolean} whether or not the members of this room need to be loaded
     */
    public needsOutOfBandMembers(): boolean {
        return this.oobMemberFlags.status === OobStatus.NotStarted;
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
     * @param {MatrixEvent[]} stateEvents array of membership state events
     */
    public setOutOfBandMembers(stateEvents: MatrixEvent[]): void {
        logger.log(`LL: RoomState about to set ${stateEvents.length} OOB members ...`);
        if (this.oobMemberFlags.status !== OobStatus.InProgress) {
            return;
        }
        logger.log(`LL: RoomState put in finished state ...`);
        this.oobMemberFlags.status = OobStatus.Finished;
        stateEvents.forEach((e) => this.setOutOfBandMember(e));
    }

    /**
     * Sets a single out of band member, used by both setOutOfBandMembers and clone
     * @param {MatrixEvent} stateEvent membership state event
     */
    private setOutOfBandMember(stateEvent: MatrixEvent): void {
        if (stateEvent.getType() !== EventType.RoomMember) {
            return;
        }
        const userId = stateEvent.getStateKey();
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
        this.emit("RoomState.members", stateEvent, this, member);
    }

    /**
     * Set the current typing event for this room.
     * @param {MatrixEvent} event The typing event
     */
    public setTypingEvent(event: MatrixEvent): void {
        Object.values(this.members).forEach(function(member) {
            member.setTypingEvent(event);
        });
    }

    /**
     * Get the m.room.member event which has the given third party invite token.
     *
     * @param {string} token The token
     * @return {?MatrixEvent} The m.room.member event or null
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
     * @return {number} The timestamp
     */
    public getLastModifiedTime(): number {
        return this.modified;
    }

    /**
     * Get user IDs with the specified or similar display names.
     * @param {string} displayName The display name to get user IDs from.
     * @return {string[]} An array of user IDs or an empty array.
     */
    public getUserIdsWithDisplayName(displayName: string): string[] {
        return this.displayNameToUserIds[utils.removeHiddenChars(displayName)] || [];
    }

    /**
     * Returns true if userId is in room, event is not redacted and either sender of
     * mxEvent or has power level sufficient to redact events other than their own.
     * @param {MatrixEvent} mxEvent The event to test permission for
     * @param {string} userId The user ID of the user to test permission for
     * @return {boolean} true if the given used ID can redact given event
     */
    public maySendRedactionForEvent(mxEvent: MatrixEvent, userId: string): boolean {
        const member = this.getMember(userId);
        if (!member || member.membership === 'leave') return false;

        if (mxEvent.status || mxEvent.isRedacted()) return false;

        // The user may have been the sender, but they can't redact their own message
        // if redactions are blocked.
        const canRedact = this.maySendEvent(EventType.RoomRedaction, userId);
        if (mxEvent.getSender() === userId) return canRedact;

        return this.hasSufficientPowerLevelFor('redact', member.powerLevel);
    }

    /**
     * Returns true if the given power level is sufficient for action
     * @param {string} action The type of power level to check
     * @param {number} powerLevel The power level of the member
     * @return {boolean} true if the given power level is sufficient
     */
    public hasSufficientPowerLevelFor(action: string, powerLevel: number): boolean {
        const powerLevelsEvent = this.getStateEvents(EventType.RoomPowerLevels, "");

        let powerLevels = {};
        if (powerLevelsEvent) {
            powerLevels = powerLevelsEvent.getContent();
        }

        let requiredLevel = 50;
        if (utils.isNumber(powerLevels[action])) {
            requiredLevel = powerLevels[action];
        }

        return powerLevel >= requiredLevel;
    }

    /**
     * Short-form for maySendEvent('m.room.message', userId)
     * @param {string} userId The user ID of the user to test permission for
     * @return {boolean} true if the given user ID should be permitted to send
     *                   message events into the given room.
     */
    public maySendMessage(userId: string): boolean {
        return this.maySendEventOfType(EventType.RoomMessage, userId, false);
    }

    /**
     * Returns true if the given user ID has permission to send a normal
     * event of type `eventType` into this room.
     * @param {string} eventType The type of event to test
     * @param {string} userId The user ID of the user to test permission for
     * @return {boolean} true if the given user ID should be permitted to send
     *                        the given type of event into this room,
     *                        according to the room's state.
     */
    public maySendEvent(eventType: EventType | string, userId: string): boolean {
        return this.maySendEventOfType(eventType, userId, false);
    }

    /**
     * Returns true if the given MatrixClient has permission to send a state
     * event of type `stateEventType` into this room.
     * @param {string} stateEventType The type of state events to test
     * @param {MatrixClient} cli The client to test permission for
     * @return {boolean} true if the given client should be permitted to send
     *                        the given type of state event into this room,
     *                        according to the room's state.
     */
    public mayClientSendStateEvent(stateEventType: EventType | string, cli: MatrixClient): boolean {
        if (cli.isGuest()) {
            return false;
        }
        return this.maySendStateEvent(stateEventType, cli.credentials.userId);
    }

    /**
     * Returns true if the given user ID has permission to send a state
     * event of type `stateEventType` into this room.
     * @param {string} stateEventType The type of state events to test
     * @param {string} userId The user ID of the user to test permission for
     * @return {boolean} true if the given user ID should be permitted to send
     *                        the given type of state event into this room,
     *                        according to the room's state.
     */
    public maySendStateEvent(stateEventType: EventType | string, userId: string): boolean {
        return this.maySendEventOfType(stateEventType, userId, true);
    }

    /**
     * Returns true if the given user ID has permission to send a normal or state
     * event of type `eventType` into this room.
     * @param {string} eventType The type of event to test
     * @param {string} userId The user ID of the user to test permission for
     * @param {boolean} state If true, tests if the user may send a state
     event of this type. Otherwise tests whether
     they may send a regular event.
     * @return {boolean} true if the given user ID should be permitted to send
     *                        the given type of event into this room,
     *                        according to the room's state.
     */
    private maySendEventOfType(eventType: EventType | string, userId: string, state: boolean): boolean {
        const powerLevelsEvent = this.getStateEvents(EventType.RoomPowerLevels, '');

        let powerLevels;
        let eventsLevels = {};

        let stateDefault = 0;
        let eventsDefault = 0;
        let powerLevel = 0;
        if (powerLevelsEvent) {
            powerLevels = powerLevelsEvent.getContent();
            eventsLevels = powerLevels.events || {};

            if (Number.isSafeInteger(powerLevels.state_default)) {
                stateDefault = powerLevels.state_default;
            } else {
                stateDefault = 50;
            }

            const userPowerLevel = powerLevels.users && powerLevels.users[userId];
            if (Number.isSafeInteger(userPowerLevel)) {
                powerLevel = userPowerLevel;
            } else if (Number.isSafeInteger(powerLevels.users_default)) {
                powerLevel = powerLevels.users_default;
            }

            if (Number.isSafeInteger(powerLevels.events_default)) {
                eventsDefault = powerLevels.events_default;
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
     * @param {string} notifLevelKey The level of notification to test (eg. 'room')
     * @param {string} userId The user ID of the user to test permission for
     * @return {boolean} true if the given user ID has permission to trigger a
     *                        notification of this type.
     */
    public mayTriggerNotifOfType(notifLevelKey: string, userId: string): boolean {
        const member = this.getMember(userId);
        if (!member) {
            return false;
        }

        const powerLevelsEvent = this.getStateEvents(EventType.RoomPowerLevels, '');

        let notifLevel = 50;
        if (
            powerLevelsEvent &&
            powerLevelsEvent.getContent() &&
            powerLevelsEvent.getContent().notifications &&
            utils.isNumber(powerLevelsEvent.getContent().notifications[notifLevelKey])
        ) {
            notifLevel = powerLevelsEvent.getContent().notifications[notifLevelKey];
        }

        return member.powerLevel >= notifLevel;
    }

    /**
     * Returns the join rule based on the m.room.join_rule state event, defaulting to `invite`.
     * @returns {string} the join_rule applied to this room
     */
    public getJoinRule(): JoinRule {
        const joinRuleEvent = this.getStateEvents(EventType.RoomJoinRules, "");
        const joinRuleContent = joinRuleEvent?.getContent<IJoinRuleEventContent>() ?? {};
        return joinRuleContent["join_rule"] || JoinRule.Invite;
    }

    /**
     * Returns the history visibility based on the m.room.history_visibility state event, defaulting to `shared`.
     * @returns {HistoryVisibility} the history_visibility applied to this room
     */
    public getHistoryVisibility(): HistoryVisibility {
        const historyVisibilityEvent = this.getStateEvents(EventType.RoomHistoryVisibility, "");
        const historyVisibilityContent = historyVisibilityEvent?.getContent() ?? {};
        return historyVisibilityContent["history_visibility"] || HistoryVisibility.Shared;
    }

    /**
     * Returns the guest access based on the m.room.guest_access state event, defaulting to `shared`.
     * @returns {GuestAccess} the guest_access applied to this room
     */
    public getGuestAccess(): GuestAccess {
        const guestAccessEvent = this.getStateEvents(EventType.RoomGuestAccess, "");
        const guestAccessContent = guestAccessEvent?.getContent() ?? {};
        return guestAccessContent["guest_access"] || GuestAccess.Forbidden;
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
            const strippedOldName = utils.removeHiddenChars(oldName);

            const existingUserIds = this.displayNameToUserIds[strippedOldName];
            if (existingUserIds) {
                // remove this user ID from this array
                const filteredUserIDs = existingUserIds.filter((id) => id !== userId);
                this.displayNameToUserIds[strippedOldName] = filteredUserIDs;
            }
        }

        this.userIdsToDisplayNames[userId] = displayName;

        const strippedDisplayname = displayName && utils.removeHiddenChars(displayName);
        // an empty stripped displayname (undefined/'') will be set to MXID in room-member.js
        if (strippedDisplayname) {
            if (!this.displayNameToUserIds[strippedDisplayname]) {
                this.displayNameToUserIds[strippedDisplayname] = [];
            }
            this.displayNameToUserIds[strippedDisplayname].push(userId);
        }
    }
}

/**
 * Fires whenever the event dictionary in room state is updated.
 * @event module:client~MatrixClient#"RoomState.events"
 * @param {MatrixEvent} event The matrix event which caused this event to fire.
 * @param {RoomState} state The room state whose RoomState.events dictionary
 * was updated.
 * @param {MatrixEvent} prevEvent The event being replaced by the new state, if
 * known. Note that this can differ from `getPrevContent()` on the new state event
 * as this is the store's view of the last state, not the previous state provided
 * by the server.
 * @example
 * matrixClient.on("RoomState.events", function(event, state, prevEvent){
 *   var newStateEvent = event;
 * });
 */

/**
 * Fires whenever a member in the members dictionary is updated in any way.
 * @event module:client~MatrixClient#"RoomState.members"
 * @param {MatrixEvent} event The matrix event which caused this event to fire.
 * @param {RoomState} state The room state whose RoomState.members dictionary
 * was updated.
 * @param {RoomMember} member The room member that was updated.
 * @example
 * matrixClient.on("RoomState.members", function(event, state, member){
 *   var newMembershipState = member.membership;
 * });
 */

/**
 * Fires whenever a member is added to the members dictionary. The RoomMember
 * will not be fully populated yet (e.g. no membership state) but will already
 * be available in the members dictionary.
 * @event module:client~MatrixClient#"RoomState.newMember"
 * @param {MatrixEvent} event The matrix event which caused this event to fire.
 * @param {RoomState} state The room state whose RoomState.members dictionary
 * was updated with a new entry.
 * @param {RoomMember} member The room member that was added.
 * @example
 * matrixClient.on("RoomState.newMember", function(event, state, member){
 *   // add event listeners on 'member'
 * });
 */
