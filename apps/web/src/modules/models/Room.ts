/*
 * Copyright 2025-2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    type HistoryVisibility,
    type JoinRule,
    type Room as IRoom,
    type RoomStateEvent as ModuleRoomStateEvent,
    Watchable,
} from "@element-hq/element-web-module-api";
import {
    EventType,
    JoinRule as SdkJoinRule,
    type MatrixEvent,
    RoomEvent,
    RoomStateEvent,
    type Room as SdkRoom,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { RoomStateEventWatchable } from "./RoomStateEventWatchable";
import { canInviteTo } from "../../utils/room/canInviteTo";
import { doesRoomVersionSupport, PreferredRoomVersions } from "../../utils/PreferredRoomVersions";

/**
 * Convert a module API join rule to the matrix-js-sdk join rule.
 */
function toSdkJoinRule(joinRule: JoinRule): SdkJoinRule {
    switch (joinRule) {
        case "public":
            return SdkJoinRule.Public;
        case "invite":
            return SdkJoinRule.Invite;
        case "knock":
            return SdkJoinRule.Knock;
        case "restricted":
            return SdkJoinRule.Restricted;
        case "knock_restricted":
            return SdkJoinRule.KnockRestricted;
        case "private":
            return SdkJoinRule.Private;
    }
}

export class Room implements IRoom {
    public name: Watchable<string>;
    public joinRule: Watchable<JoinRule>;
    public historyVisibility: Watchable<HistoryVisibility>;
    public isEncrypted: Watchable<boolean | undefined>;
    private readonly stateWatchables = new Map<string, RoomStateEventWatchable>();

    public constructor(private sdkRoom: SdkRoom) {
        this.name = new WatchableName(sdkRoom);
        this.joinRule = new WatchableJoinRule(sdkRoom);
        this.historyVisibility = new WatchableHistoryVisibility(sdkRoom);
        this.isEncrypted = new WatchableIsEncrypted(sdkRoom);
    }

    public getLastActiveTimestamp(): number {
        return this.sdkRoom.getLastActiveTimestamp();
    }

    /** Get the current state events of one type in this room. */
    public getStateEvents(eventType: string): Watchable<ModuleRoomStateEvent[]> {
        let watchable = this.stateWatchables.get(eventType);
        if (!watchable) {
            watchable = new RoomStateEventWatchable(this.sdkRoom, eventType);
            this.stateWatchables.set(eventType, watchable);
        }
        return watchable;
    }

    public async setJoinRule(joinRule: JoinRule): Promise<void> {
        await this.sdkRoom.client.sendStateEvent(this.sdkRoom.roomId, EventType.RoomJoinRules, {
            join_rule: toSdkJoinRule(joinRule),
        });
    }

    public canInvite(): boolean {
        return canInviteTo(this.sdkRoom);
    }

    public canChangeJoinRule(): boolean {
        return this.sdkRoom.currentState.maySendStateEvent(
            EventType.RoomJoinRules,
            this.sdkRoom.client.getSafeUserId(),
        );
    }

    public supportsKnock(): boolean {
        return doesRoomVersionSupport(this.sdkRoom.getVersion(), PreferredRoomVersions.KnockRooms);
    }

    public get id(): string {
        return this.sdkRoom.roomId;
    }
}

/**
 * A custom watchable for room name.
 */
class WatchableName extends Watchable<string> {
    public constructor(private sdkRoom: SdkRoom) {
        super(sdkRoom.name);
    }

    private onNameUpdate = (): void => {
        super.value = this.sdkRoom.name;
    };
    protected onFirstWatch(): void {
        this.sdkRoom.on(RoomEvent.Name, this.onNameUpdate);
        this.onNameUpdate();
    }

    protected onLastWatch(): void {
        this.sdkRoom.off(RoomEvent.Name, this.onNameUpdate);
    }
}

/**
 * A custom watchable for whether the room is encrypted.
 * The value is computed via the crypto API on construction, and recomputed whenever the room's
 * encryption state event changes. The method to check is async, so it return undefined until
 * the method returns.
 */
class WatchableIsEncrypted extends Watchable<boolean | undefined> {
    // Incremented on every check so that a slow, stale result can't overwrite a newer one.
    private checkId = 0;

    public constructor(private sdkRoom: SdkRoom) {
        super(undefined);
        void this.updateIsEncrypted();
    }

    private async updateIsEncrypted(): Promise<void> {
        const checkId = ++this.checkId;
        try {
            const isEncrypted = Boolean(
                await this.sdkRoom.client.getCrypto()?.isEncryptionEnabledInRoom(this.sdkRoom.roomId),
            );
            if (checkId === this.checkId) super.value = isEncrypted;
        } catch (e) {
            logger.error(`Failed to check whether room ${this.sdkRoom.roomId} is encrypted`, e);
        }
    }

    private onStateEvent = (event: MatrixEvent): void => {
        if (event.getType() !== EventType.RoomEncryption) return;
        void this.updateIsEncrypted();
    };

    protected onFirstWatch(): void {
        this.sdkRoom.on(RoomStateEvent.Events, this.onStateEvent);
        void this.updateIsEncrypted();
    }

    protected onLastWatch(): void {
        this.sdkRoom.off(RoomStateEvent.Events, this.onStateEvent);
        // Discard any check still in flight.
        this.checkId++;
    }
}

/**
 * A custom watchable for the room join rule.
 */
class WatchableJoinRule extends Watchable<JoinRule> {
    public constructor(private sdkRoom: SdkRoom) {
        super(sdkRoom.getJoinRule());
    }

    private onStateEvent = (event: MatrixEvent): void => {
        if (event.getType() !== EventType.RoomJoinRules) return;
        super.value = this.sdkRoom.getJoinRule();
    };

    protected onFirstWatch(): void {
        // The join rule may have changed while nobody was watching
        super.value = this.sdkRoom.getJoinRule();
        this.sdkRoom.on(RoomStateEvent.Events, this.onStateEvent);
    }

    protected onLastWatch(): void {
        this.sdkRoom.off(RoomStateEvent.Events, this.onStateEvent);
    }
}

/**
 * A custom watchable for the room history visibility.
 */
class WatchableHistoryVisibility extends Watchable<HistoryVisibility> {
    public constructor(private sdkRoom: SdkRoom) {
        super(sdkRoom.currentState.getHistoryVisibility());
    }

    private onStateEvent = (event: MatrixEvent): void => {
        if (event.getType() !== EventType.RoomHistoryVisibility) return;
        super.value = this.sdkRoom.currentState.getHistoryVisibility();
    };

    protected onFirstWatch(): void {
        // The history visibility may have changed while nobody was watching
        super.value = this.sdkRoom.currentState.getHistoryVisibility();
        this.sdkRoom.on(RoomStateEvent.Events, this.onStateEvent);
    }

    protected onLastWatch(): void {
        this.sdkRoom.off(RoomStateEvent.Events, this.onStateEvent);
    }
}
