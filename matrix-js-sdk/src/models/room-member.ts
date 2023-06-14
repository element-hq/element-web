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

import { getHttpUriForMxc } from "../content-repo";
import { removeDirectionOverrideChars, removeHiddenChars } from "../utils";
import { User } from "./user";
import { MatrixEvent } from "./event";
import { RoomState } from "./room-state";
import { logger } from "../logger";
import { TypedEventEmitter } from "./typed-event-emitter";
import { EventType } from "../@types/event";

export enum RoomMemberEvent {
    Membership = "RoomMember.membership",
    Name = "RoomMember.name",
    PowerLevel = "RoomMember.powerLevel",
    Typing = "RoomMember.typing",
}

export type RoomMemberEventHandlerMap = {
    /**
     * Fires whenever any room member's membership state changes.
     * @param event - The matrix event which caused this event to fire.
     * @param member - The member whose RoomMember.membership changed.
     * @param oldMembership - The previous membership state. Null if it's a new member.
     * @example
     * ```
     * matrixClient.on("RoomMember.membership", function(event, member, oldMembership){
     *   var newState = member.membership;
     * });
     * ```
     */
    [RoomMemberEvent.Membership]: (event: MatrixEvent, member: RoomMember, oldMembership?: string) => void;
    /**
     * Fires whenever any room member's name changes.
     * @param event - The matrix event which caused this event to fire.
     * @param member - The member whose RoomMember.name changed.
     * @param oldName - The previous name. Null if the member didn't have a name previously.
     * @example
     * ```
     * matrixClient.on("RoomMember.name", function(event, member){
     *   var newName = member.name;
     * });
     * ```
     */
    [RoomMemberEvent.Name]: (event: MatrixEvent, member: RoomMember, oldName: string | null) => void;
    /**
     * Fires whenever any room member's power level changes.
     * @param event - The matrix event which caused this event to fire.
     * @param member - The member whose RoomMember.powerLevel changed.
     * @example
     * ```
     * matrixClient.on("RoomMember.powerLevel", function(event, member){
     *   var newPowerLevel = member.powerLevel;
     *   var newNormPowerLevel = member.powerLevelNorm;
     * });
     * ```
     */
    [RoomMemberEvent.PowerLevel]: (event: MatrixEvent, member: RoomMember) => void;
    /**
     * Fires whenever any room member's typing state changes.
     * @param event - The matrix event which caused this event to fire.
     * @param member - The member whose RoomMember.typing changed.
     * @example
     * ```
     * matrixClient.on("RoomMember.typing", function(event, member){
     *   var isTyping = member.typing;
     * });
     * ```
     */
    [RoomMemberEvent.Typing]: (event: MatrixEvent, member: RoomMember) => void;
};

export class RoomMember extends TypedEventEmitter<RoomMemberEvent, RoomMemberEventHandlerMap> {
    private _isOutOfBand = false;
    private modified = -1;
    public requestedProfileInfo = false; // used by sync.ts

    // XXX these should be read-only
    /**
     * True if the room member is currently typing.
     */
    public typing = false;
    /**
     * The human-readable name for this room member. This will be
     * disambiguated with a suffix of " (\@user_id:matrix.org)" if another member shares the
     * same displayname.
     */
    public name: string;
    /**
     * The ambiguous displayname of this room member.
     */
    public rawDisplayName: string;
    /**
     * The power level for this room member.
     */
    public powerLevel = 0;
    /**
     * The normalised power level (0-100) for this room member.
     */
    public powerLevelNorm = 0;
    /**
     * The User object for this room member, if one exists.
     */
    public user?: User;
    /**
     * The membership state for this room member e.g. 'join'.
     */
    public membership?: string;
    /**
     * True if the member's name is disambiguated.
     */
    public disambiguate = false;
    /**
     * The events describing this RoomMember.
     */
    public events: {
        /**
         * The m.room.member event for this RoomMember.
         */
        member?: MatrixEvent;
    } = {};

    /**
     * Construct a new room member.
     *
     * @param roomId - The room ID of the member.
     * @param userId - The user ID of the member.
     */
    public constructor(public readonly roomId: string, public readonly userId: string) {
        super();

        this.name = userId;
        this.rawDisplayName = userId;
        this.updateModifiedTime();
    }

    /**
     * Mark the member as coming from a channel that is not sync
     */
    public markOutOfBand(): void {
        this._isOutOfBand = true;
    }

    /**
     * @returns does the member come from a channel that is not sync?
     * This is used to store the member seperately
     * from the sync state so it available across browser sessions.
     */
    public isOutOfBand(): boolean {
        return this._isOutOfBand;
    }

    /**
     * Update this room member's membership event. May fire "RoomMember.name" if
     * this event updates this member's name.
     * @param event - The `m.room.member` event
     * @param roomState - Optional. The room state to take into account
     * when calculating (e.g. for disambiguating users with the same name).
     *
     * @remarks
     * Fires {@link RoomMemberEvent.Name}
     * Fires {@link RoomMemberEvent.Membership}
     */
    public setMembershipEvent(event: MatrixEvent, roomState?: RoomState): void {
        const displayName = event.getDirectionalContent().displayname ?? "";

        if (event.getType() !== EventType.RoomMember) {
            return;
        }

        this._isOutOfBand = false;

        this.events.member = event;

        const oldMembership = this.membership;
        this.membership = event.getDirectionalContent().membership;
        if (this.membership === undefined) {
            // logging to diagnose https://github.com/vector-im/element-web/issues/20962
            // (logs event content, although only of membership events)
            logger.trace(
                `membership event with membership undefined (forwardLooking: ${event.forwardLooking})!`,
                event.getContent(),
                `prevcontent is `,
                event.getPrevContent(),
            );
        }

        this.disambiguate = shouldDisambiguate(this.userId, displayName, roomState);

        const oldName = this.name;
        this.name = calculateDisplayName(this.userId, displayName, this.disambiguate);

        // not quite raw: we strip direction override chars so it can safely be inserted into
        // blocks of text without breaking the text direction
        this.rawDisplayName = removeDirectionOverrideChars(event.getDirectionalContent().displayname ?? "");
        if (!this.rawDisplayName || !removeHiddenChars(this.rawDisplayName)) {
            this.rawDisplayName = this.userId;
        }

        if (oldMembership !== this.membership) {
            this.updateModifiedTime();
            this.emit(RoomMemberEvent.Membership, event, this, oldMembership);
        }
        if (oldName !== this.name) {
            this.updateModifiedTime();
            this.emit(RoomMemberEvent.Name, event, this, oldName);
        }
    }

    /**
     * Update this room member's power level event. May fire
     * "RoomMember.powerLevel" if this event updates this member's power levels.
     * @param powerLevelEvent - The `m.room.power_levels` event
     *
     * @remarks
     * Fires {@link RoomMemberEvent.PowerLevel}
     */
    public setPowerLevelEvent(powerLevelEvent: MatrixEvent): void {
        if (powerLevelEvent.getType() !== EventType.RoomPowerLevels || powerLevelEvent.getStateKey() !== "") {
            return;
        }

        const evContent = powerLevelEvent.getDirectionalContent();

        let maxLevel = evContent.users_default || 0;
        const users: { [userId: string]: number } = evContent.users || {};
        Object.values(users).forEach((lvl: number) => {
            maxLevel = Math.max(maxLevel, lvl);
        });
        const oldPowerLevel = this.powerLevel;
        const oldPowerLevelNorm = this.powerLevelNorm;

        if (users[this.userId] !== undefined && Number.isInteger(users[this.userId])) {
            this.powerLevel = users[this.userId];
        } else if (evContent.users_default !== undefined) {
            this.powerLevel = evContent.users_default;
        } else {
            this.powerLevel = 0;
        }
        this.powerLevelNorm = 0;
        if (maxLevel > 0) {
            this.powerLevelNorm = (this.powerLevel * 100) / maxLevel;
        }

        // emit for changes in powerLevelNorm as well (since the app will need to
        // redraw everyone's level if the max has changed)
        if (oldPowerLevel !== this.powerLevel || oldPowerLevelNorm !== this.powerLevelNorm) {
            this.updateModifiedTime();
            this.emit(RoomMemberEvent.PowerLevel, powerLevelEvent, this);
        }
    }

    /**
     * Update this room member's typing event. May fire "RoomMember.typing" if
     * this event changes this member's typing state.
     * @param event - The typing event
     *
     * @remarks
     * Fires {@link RoomMemberEvent.Typing}
     */
    public setTypingEvent(event: MatrixEvent): void {
        if (event.getType() !== "m.typing") {
            return;
        }
        const oldTyping = this.typing;
        this.typing = false;
        const typingList = event.getContent().user_ids;
        if (!Array.isArray(typingList)) {
            // malformed event :/ bail early. TODO: whine?
            return;
        }
        if (typingList.indexOf(this.userId) !== -1) {
            this.typing = true;
        }
        if (oldTyping !== this.typing) {
            this.updateModifiedTime();
            this.emit(RoomMemberEvent.Typing, event, this);
        }
    }

    /**
     * Update the last modified time to the current time.
     */
    private updateModifiedTime(): void {
        this.modified = Date.now();
    }

    /**
     * Get the timestamp when this RoomMember was last updated. This timestamp is
     * updated when properties on this RoomMember are updated.
     * It is updated <i>before</i> firing events.
     * @returns The timestamp
     */
    public getLastModifiedTime(): number {
        return this.modified;
    }

    public isKicked(): boolean {
        return (
            this.membership === "leave" &&
            this.events.member !== undefined &&
            this.events.member.getSender() !== this.events.member.getStateKey()
        );
    }

    /**
     * If this member was invited with the is_direct flag set, return
     * the user that invited this member
     * @returns user id of the inviter
     */
    public getDMInviter(): string | undefined {
        // when not available because that room state hasn't been loaded in,
        // we don't really know, but more likely to not be a direct chat
        if (this.events.member) {
            // TODO: persist the is_direct flag on the member as more member events
            //       come in caused by displayName changes.

            // the is_direct flag is set on the invite member event.
            // This is copied on the prev_content section of the join member event
            // when the invite is accepted.

            const memberEvent = this.events.member;
            let memberContent = memberEvent.getContent();
            let inviteSender: string | undefined = memberEvent.getSender();

            if (memberContent.membership === "join") {
                memberContent = memberEvent.getPrevContent();
                inviteSender = memberEvent.getUnsigned().prev_sender;
            }

            if (memberContent.membership === "invite" && memberContent.is_direct) {
                return inviteSender;
            }
        }
    }

    /**
     * Get the avatar URL for a room member.
     * @param baseUrl - The base homeserver URL See
     * {@link MatrixClient#getHomeserverUrl}.
     * @param width - The desired width of the thumbnail.
     * @param height - The desired height of the thumbnail.
     * @param resizeMethod - The thumbnail resize method to use, either
     * "crop" or "scale".
     * @param allowDefault - (optional) Passing false causes this method to
     * return null if the user has no avatar image. Otherwise, a default image URL
     * will be returned. Default: true. (Deprecated)
     * @param allowDirectLinks - (optional) If true, the avatar URL will be
     * returned even if it is a direct hyperlink rather than a matrix content URL.
     * If false, any non-matrix content URLs will be ignored. Setting this option to
     * true will expose URLs that, if fetched, will leak information about the user
     * to anyone who they share a room with.
     * @returns the avatar URL or null.
     */
    public getAvatarUrl(
        baseUrl: string,
        width: number,
        height: number,
        resizeMethod: string,
        allowDefault = true,
        allowDirectLinks: boolean,
    ): string | null {
        const rawUrl = this.getMxcAvatarUrl();

        if (!rawUrl && !allowDefault) {
            return null;
        }
        const httpUrl = getHttpUriForMxc(baseUrl, rawUrl, width, height, resizeMethod, allowDirectLinks);
        if (httpUrl) {
            return httpUrl;
        }
        return null;
    }

    /**
     * get the mxc avatar url, either from a state event, or from a lazily loaded member
     * @returns the mxc avatar url
     */
    public getMxcAvatarUrl(): string | undefined {
        if (this.events.member) {
            return this.events.member.getDirectionalContent().avatar_url;
        } else if (this.user) {
            return this.user.avatarUrl;
        }
    }
}

const MXID_PATTERN = /@.+:.+/;
const LTR_RTL_PATTERN = /[\u200E\u200F\u202A-\u202F]/;

function shouldDisambiguate(selfUserId: string, displayName?: string, roomState?: RoomState): boolean {
    if (!displayName || displayName === selfUserId) return false;

    // First check if the displayname is something we consider truthy
    // after stripping it of zero width characters and padding spaces
    if (!removeHiddenChars(displayName)) return false;

    if (!roomState) return false;

    // Next check if the name contains something that look like a mxid
    // If it does, it may be someone trying to impersonate someone else
    // Show full mxid in this case
    if (MXID_PATTERN.test(displayName)) return true;

    // Also show mxid if the display name contains any LTR/RTL characters as these
    // make it very difficult for us to find similar *looking* display names
    // E.g "Mark" could be cloned by writing "kraM" but in RTL.
    if (LTR_RTL_PATTERN.test(displayName)) return true;

    // Also show mxid if there are other people with the same or similar
    // displayname, after hidden character removal.
    const userIds = roomState.getUserIdsWithDisplayName(displayName);
    if (userIds.some((u) => u !== selfUserId)) return true;

    return false;
}

function calculateDisplayName(selfUserId: string, displayName: string | undefined, disambiguate: boolean): string {
    if (!displayName || displayName === selfUserId) return selfUserId;

    if (disambiguate) return removeDirectionOverrideChars(displayName) + " (" + selfUserId + ")";

    // First check if the displayname is something we consider truthy
    // after stripping it of zero width characters and padding spaces
    if (!removeHiddenChars(displayName)) return selfUserId;

    // We always strip the direction override characters (LRO and RLO).
    // These override the text direction for all subsequent characters
    // in the paragraph so if display names contained these, they'd
    // need to be wrapped in something to prevent this from leaking out
    // (which we can do in HTML but not text) or we'd need to add
    // control characters to the string to reset any overrides (eg.
    // adding PDF characters at the end). As far as we can see,
    // there should be no reason these would be necessary - rtl display
    // names should flip into the correct direction automatically based on
    // the characters, and you can still embed rtl in ltr or vice versa
    // with the embed chars or marker chars.
    return removeDirectionOverrideChars(displayName);
}
