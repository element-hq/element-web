/*
Copyright 2024 New Vector Ltd.
Copyright 2020-2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { MatrixEventEvent, RoomEvent, ClientEvent } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import type { Room, MatrixEvent } from "matrix-js-sdk/src/matrix";
import type { IDestroyable } from "../../utils/IDestroyable";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { readReceiptChangeIsFor } from "../../utils/read-receipts";
import * as RoomNotifs from "../../RoomNotifs";
import { NotificationState } from "./NotificationState";
import SettingsStore from "../../settings/SettingsStore";
import { MARKED_UNREAD_TYPE_STABLE, MARKED_UNREAD_TYPE_UNSTABLE } from "../../utils/notifications";

export class RoomNotificationState extends NotificationState implements IDestroyable {
    public constructor(
        public readonly room: Room,
        private includeThreads: boolean,
    ) {
        super();
        const cli = this.room.client;
        this.room.on(RoomEvent.Receipt, this.handleReadReceipt);
        this.room.on(RoomEvent.MyMembership, this.handleMembershipUpdate);
        this.room.on(RoomEvent.LocalEchoUpdated, this.handleLocalEchoUpdated);
        this.room.on(RoomEvent.Timeline, this.handleRoomEventUpdate);
        this.room.on(RoomEvent.Redaction, this.handleRoomEventUpdate);
        this.room.on(RoomEvent.AccountData, this.handleRoomAccountDataUpdate);

        this.room.on(RoomEvent.UnreadNotifications, this.handleNotificationCountUpdate); // for server-sent counts
        cli.on(MatrixEventEvent.Decrypted, this.onEventDecrypted);
        cli.on(ClientEvent.AccountData, this.handleAccountDataUpdate);
        this.updateNotificationState();
    }

    public destroy(): void {
        super.destroy();
        const cli = this.room.client;
        this.room.removeListener(RoomEvent.Receipt, this.handleReadReceipt);
        this.room.removeListener(RoomEvent.MyMembership, this.handleMembershipUpdate);
        this.room.removeListener(RoomEvent.LocalEchoUpdated, this.handleLocalEchoUpdated);
        this.room.removeListener(RoomEvent.Timeline, this.handleRoomEventUpdate);
        this.room.removeListener(RoomEvent.Redaction, this.handleRoomEventUpdate);
        this.room.removeListener(RoomEvent.AccountData, this.handleRoomAccountDataUpdate);
        cli.removeListener(MatrixEventEvent.Decrypted, this.onEventDecrypted);
        cli.removeListener(ClientEvent.AccountData, this.handleAccountDataUpdate);
    }

    private handleLocalEchoUpdated = (): void => {
        this.updateNotificationState();
    };

    private handleReadReceipt = (event: MatrixEvent, room: Room): void => {
        if (!readReceiptChangeIsFor(event, MatrixClientPeg.safeGet())) return; // not our own - ignore
        if (room.roomId !== this.room.roomId) return; // not for us - ignore
        this.updateNotificationState();
    };

    private handleMembershipUpdate = (): void => {
        this.updateNotificationState();
    };

    private handleNotificationCountUpdate = (): void => {
        this.updateNotificationState();
    };

    private onEventDecrypted = (event: MatrixEvent): void => {
        if (event.getRoomId() !== this.room.roomId) return; // ignore - not for us or notifications timeline

        this.updateNotificationState();
    };

    private handleRoomEventUpdate = (event: MatrixEvent): void => {
        if (event?.getRoomId() !== this.room.roomId) return; // ignore - not for us or notifications timeline
        this.updateNotificationState();
    };

    private handleAccountDataUpdate = (ev: MatrixEvent): void => {
        if (ev.getType() === "m.push_rules") {
            this.updateNotificationState();
        }
    };

    private handleRoomAccountDataUpdate = (ev: MatrixEvent): void => {
        if ([MARKED_UNREAD_TYPE_STABLE, MARKED_UNREAD_TYPE_UNSTABLE].includes(ev.getType())) {
            this.updateNotificationState();
        }
    };

    private updateNotificationState(): void {
        const snapshot = this.snapshot();

        const { level, symbol, count } = RoomNotifs.determineUnreadState(this.room, undefined, this.includeThreads);
        const muted =
            RoomNotifs.getRoomNotifsState(this.room.client, this.room.roomId) === RoomNotifs.RoomNotifState.Mute;
        const knocked =
            SettingsStore.getValue("feature_ask_to_join") && this.room.getMyMembership() === KnownMembership.Knock;
        this._level = level;
        this._symbol = symbol;
        this._count = count;
        this._muted = muted;
        this._knocked = knocked;

        // finally, publish an update if needed
        this.emitIfUpdated(snapshot);
    }
}
