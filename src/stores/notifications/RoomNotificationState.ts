/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import { EventEmitter } from "events";
import { INotificationState, NOTIFICATION_STATE_UPDATE } from "./INotificationState";
import { NotificationColor } from "./NotificationColor";
import { IDestroyable } from "../../utils/IDestroyable";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { EffectiveMembership, getEffectiveMembership } from "../room-list/membership";
import { readReceiptChangeIsFor } from "../../utils/read-receipts";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { Room } from "matrix-js-sdk/src/models/room";
import * as RoomNotifs from '../../RoomNotifs';
import * as Unread from '../../Unread';

export class RoomNotificationState extends EventEmitter implements IDestroyable, INotificationState {
    private _symbol: string;
    private _count: number;
    private _color: NotificationColor;

    constructor(public readonly room: Room) {
        super();
        this.room.on("Room.receipt", this.handleReadReceipt);
        this.room.on("Room.timeline", this.handleRoomEventUpdate);
        this.room.on("Room.redaction", this.handleRoomEventUpdate);
        MatrixClientPeg.get().on("Event.decrypted", this.handleRoomEventUpdate);
        MatrixClientPeg.get().on("accountData", this.handleAccountDataUpdate);
        this.updateNotificationState();
    }

    public get symbol(): string {
        return this._symbol;
    }

    public get count(): number {
        return this._count;
    }

    public get color(): NotificationColor {
        return this._color;
    }

    private get roomIsInvite(): boolean {
        return getEffectiveMembership(this.room.getMyMembership()) === EffectiveMembership.Invite;
    }

    public destroy(): void {
        this.room.removeListener("Room.receipt", this.handleReadReceipt);
        this.room.removeListener("Room.timeline", this.handleRoomEventUpdate);
        this.room.removeListener("Room.redaction", this.handleRoomEventUpdate);
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener("Event.decrypted", this.handleRoomEventUpdate);
            MatrixClientPeg.get().removeListener("accountData", this.handleAccountDataUpdate);
        }
    }

    private handleReadReceipt = (event: MatrixEvent, room: Room) => {
        if (!readReceiptChangeIsFor(event, MatrixClientPeg.get())) return; // not our own - ignore
        if (room.roomId !== this.room.roomId) return; // not for us - ignore
        this.updateNotificationState();
    };

    private handleRoomEventUpdate = (event: MatrixEvent) => {
        const roomId = event.getRoomId();

        if (roomId !== this.room.roomId) return; // ignore - not for us
        this.updateNotificationState();
    };

    private handleAccountDataUpdate = (ev: MatrixEvent) => {
        if (ev.getType() === "m.push_rules") {
            this.updateNotificationState();
        }
    };

    private updateNotificationState() {
        const before = {count: this.count, symbol: this.symbol, color: this.color};

        if (RoomNotifs.getRoomNotifsState(this.room.roomId) === RoomNotifs.MUTE) {
            // When muted we suppress all notification states, even if we have context on them.
            this._color = NotificationColor.None;
            this._symbol = null;
            this._count = 0;
        } else if (this.roomIsInvite) {
            this._color = NotificationColor.Red;
            this._symbol = "!";
            this._count = 1; // not used, technically
        } else {
            const redNotifs = RoomNotifs.getUnreadNotificationCount(this.room, 'highlight');
            const greyNotifs = RoomNotifs.getUnreadNotificationCount(this.room, 'total');

            // For a 'true count' we pick the grey notifications first because they include the
            // red notifications. If we don't have a grey count for some reason we use the red
            // count. If that count is broken for some reason, assume zero. This avoids us showing
            // a badge for 'NaN' (which formats as 'NaNB' for NaN Billion).
            const trueCount = greyNotifs ? greyNotifs : (redNotifs ? redNotifs : 0);

            // Note: we only set the symbol if we have an actual count. We don't want to show
            // zero on badges.

            if (redNotifs > 0) {
                this._color = NotificationColor.Red;
                this._count = trueCount;
                this._symbol = null; // symbol calculated by component
            } else if (greyNotifs > 0) {
                this._color = NotificationColor.Grey;
                this._count = trueCount;
                this._symbol = null; // symbol calculated by component
            } else {
                // We don't have any notified messages, but we might have unread messages. Let's
                // find out.
                const hasUnread = Unread.doesRoomHaveUnreadMessages(this.room);
                if (hasUnread) {
                    this._color = NotificationColor.Bold;
                } else {
                    this._color = NotificationColor.None;
                }

                // no symbol or count for this state
                this._count = 0;
                this._symbol = null;
            }
        }

        // finally, publish an update if needed
        const after = {count: this.count, symbol: this.symbol, color: this.color};
        if (JSON.stringify(before) !== JSON.stringify(after)) {
            this.emit(NOTIFICATION_STATE_UPDATE);
        }
    }
}
