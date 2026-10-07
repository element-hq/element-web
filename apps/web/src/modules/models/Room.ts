/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type JoinRule, type Room as IRoom, Watchable } from "@element-hq/element-web-module-api";
import {
    EventType,
    JoinRule as SdkJoinRule,
    type MatrixEvent,
    RoomEvent,
    RoomStateEvent,
    type Room as SdkRoom,
} from "matrix-js-sdk/src/matrix";

import { RoomPermalinkCreator } from "../../utils/permalinks/Permalinks";
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
        case "private":
            return SdkJoinRule.Private;
    }
}

export class Room implements IRoom {
    public name: Watchable<string>;
    public joinRule: Watchable<JoinRule>;

    public constructor(private sdkRoom: SdkRoom) {
        this.name = new WatchableName(sdkRoom);
        this.joinRule = new WatchableJoinRule(sdkRoom);
    }

    public getLastActiveTimestamp(): number {
        return this.sdkRoom.getLastActiveTimestamp();
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

    public getPermalink(): string {
        const permalinkCreator = new RoomPermalinkCreator(this.sdkRoom);
        permalinkCreator.load();
        return permalinkCreator.forShareableRoom();
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
    }

    protected onLastWatch(): void {
        this.sdkRoom.off(RoomEvent.Name, this.onNameUpdate);
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
