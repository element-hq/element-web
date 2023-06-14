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

import { MatrixEvent } from "./event";
import { TypedEventEmitter } from "./typed-event-emitter";

export enum UserEvent {
    DisplayName = "User.displayName",
    AvatarUrl = "User.avatarUrl",
    Presence = "User.presence",
    CurrentlyActive = "User.currentlyActive",
    LastPresenceTs = "User.lastPresenceTs",
}

export type UserEventHandlerMap = {
    /**
     * Fires whenever any user's display name changes.
     * @param event - The matrix event which caused this event to fire.
     * @param user - The user whose User.displayName changed.
     * @example
     * ```
     * matrixClient.on("User.displayName", function(event, user){
     *   var newName = user.displayName;
     * });
     * ```
     */
    [UserEvent.DisplayName]: (event: MatrixEvent | undefined, user: User) => void;
    /**
     * Fires whenever any user's avatar URL changes.
     * @param event - The matrix event which caused this event to fire.
     * @param user - The user whose User.avatarUrl changed.
     * @example
     * ```
     * matrixClient.on("User.avatarUrl", function(event, user){
     *   var newUrl = user.avatarUrl;
     * });
     * ```
     */
    [UserEvent.AvatarUrl]: (event: MatrixEvent | undefined, user: User) => void;
    /**
     * Fires whenever any user's presence changes.
     * @param event - The matrix event which caused this event to fire.
     * @param user - The user whose User.presence changed.
     * @example
     * ```
     * matrixClient.on("User.presence", function(event, user){
     *   var newPresence = user.presence;
     * });
     * ```
     */
    [UserEvent.Presence]: (event: MatrixEvent | undefined, user: User) => void;
    /**
     * Fires whenever any user's currentlyActive changes.
     * @param event - The matrix event which caused this event to fire.
     * @param user - The user whose User.currentlyActive changed.
     * @example
     * ```
     * matrixClient.on("User.currentlyActive", function(event, user){
     *   var newCurrentlyActive = user.currentlyActive;
     * });
     * ```
     */
    [UserEvent.CurrentlyActive]: (event: MatrixEvent | undefined, user: User) => void;
    /**
     * Fires whenever any user's lastPresenceTs changes,
     * ie. whenever any presence event is received for a user.
     * @param event - The matrix event which caused this event to fire.
     * @param user - The user whose User.lastPresenceTs changed.
     * @example
     * ```
     * matrixClient.on("User.lastPresenceTs", function(event, user){
     *   var newlastPresenceTs = user.lastPresenceTs;
     * });
     * ```
     */
    [UserEvent.LastPresenceTs]: (event: MatrixEvent | undefined, user: User) => void;
};

export class User extends TypedEventEmitter<UserEvent, UserEventHandlerMap> {
    private modified = -1;

    /**
     * The 'displayname' of the user if known.
     * @privateRemarks
     * Should be read-only
     */
    public displayName?: string;
    public rawDisplayName?: string;
    /**
     * The 'avatar_url' of the user if known.
     * @privateRemarks
     * Should be read-only
     */
    public avatarUrl?: string;
    /**
     * The presence status message if known.
     * @privateRemarks
     * Should be read-only
     */
    public presenceStatusMsg?: string;
    /**
     * The presence enum if known.
     * @privateRemarks
     * Should be read-only
     */
    public presence = "offline";
    /**
     * Timestamp (ms since the epoch) for when we last received presence data for this user.
     * We can subtract lastActiveAgo from this to approximate an absolute value for when a user was last active.
     * @privateRemarks
     * Should be read-only
     */
    public lastActiveAgo = 0;
    /**
     * The time elapsed in ms since the user interacted proactively with the server,
     * or we saw a message from the user
     * @privateRemarks
     * Should be read-only
     */
    public lastPresenceTs = 0;
    /**
     * Whether we should consider lastActiveAgo to be an approximation
     * and that the user should be seen as active 'now'
     * @privateRemarks
     * Should be read-only
     */
    public currentlyActive = false;
    /**
     * The events describing this user.
     * @privateRemarks
     * Should be read-only
     */
    public events: {
        /** The m.presence event for this user. */
        presence?: MatrixEvent;
        profile?: MatrixEvent;
    } = {};

    /**
     * Construct a new User. A User must have an ID and can optionally have extra information associated with it.
     * @param userId - Required. The ID of this user.
     */
    public constructor(public readonly userId: string) {
        super();
        this.displayName = userId;
        this.rawDisplayName = userId;
        this.updateModifiedTime();
    }

    /**
     * Update this User with the given presence event. May fire "User.presence",
     * "User.avatarUrl" and/or "User.displayName" if this event updates this user's
     * properties.
     * @param event - The `m.presence` event.
     *
     * @remarks
     * Fires {@link UserEvent.Presence}
     * Fires {@link UserEvent.DisplayName}
     * Fires {@link UserEvent.AvatarUrl}
     */
    public setPresenceEvent(event: MatrixEvent): void {
        if (event.getType() !== "m.presence") {
            return;
        }
        const firstFire = this.events.presence === null;
        this.events.presence = event;

        const eventsToFire: UserEvent[] = [];
        if (event.getContent().presence !== this.presence || firstFire) {
            eventsToFire.push(UserEvent.Presence);
        }
        if (event.getContent().avatar_url && event.getContent().avatar_url !== this.avatarUrl) {
            eventsToFire.push(UserEvent.AvatarUrl);
        }
        if (event.getContent().displayname && event.getContent().displayname !== this.displayName) {
            eventsToFire.push(UserEvent.DisplayName);
        }
        if (
            event.getContent().currently_active !== undefined &&
            event.getContent().currently_active !== this.currentlyActive
        ) {
            eventsToFire.push(UserEvent.CurrentlyActive);
        }

        this.presence = event.getContent().presence;
        eventsToFire.push(UserEvent.LastPresenceTs);

        if (event.getContent().status_msg) {
            this.presenceStatusMsg = event.getContent().status_msg;
        }
        if (event.getContent().displayname) {
            this.displayName = event.getContent().displayname;
        }
        if (event.getContent().avatar_url) {
            this.avatarUrl = event.getContent().avatar_url;
        }
        this.lastActiveAgo = event.getContent().last_active_ago;
        this.lastPresenceTs = Date.now();
        this.currentlyActive = event.getContent().currently_active;

        this.updateModifiedTime();

        for (const eventToFire of eventsToFire) {
            this.emit(eventToFire, event, this);
        }
    }

    /**
     * Manually set this user's display name. No event is emitted in response to this
     * as there is no underlying MatrixEvent to emit with.
     * @param name - The new display name.
     */
    public setDisplayName(name: string): void {
        const oldName = this.displayName;
        this.displayName = name;
        if (name !== oldName) {
            this.updateModifiedTime();
        }
    }

    /**
     * Manually set this user's non-disambiguated display name. No event is emitted
     * in response to this as there is no underlying MatrixEvent to emit with.
     * @param name - The new display name.
     */
    public setRawDisplayName(name?: string): void {
        this.rawDisplayName = name;
    }

    /**
     * Manually set this user's avatar URL. No event is emitted in response to this
     * as there is no underlying MatrixEvent to emit with.
     * @param url - The new avatar URL.
     */
    public setAvatarUrl(url?: string): void {
        const oldUrl = this.avatarUrl;
        this.avatarUrl = url;
        if (url !== oldUrl) {
            this.updateModifiedTime();
        }
    }

    /**
     * Update the last modified time to the current time.
     */
    private updateModifiedTime(): void {
        this.modified = Date.now();
    }

    /**
     * Get the timestamp when this User was last updated. This timestamp is
     * updated when this User receives a new Presence event which has updated a
     * property on this object. It is updated <i>before</i> firing events.
     * @returns The timestamp
     */
    public getLastModifiedTime(): number {
        return this.modified;
    }

    /**
     * Get the absolute timestamp when this User was last known active on the server.
     * It is *NOT* accurate if this.currentlyActive is true.
     * @returns The timestamp
     */
    public getLastActiveTs(): number {
        return this.lastPresenceTs - this.lastActiveAgo;
    }
}
