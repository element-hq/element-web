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

import { NotificationColor } from "./NotificationColor";
import { Room } from "matrix-js-sdk/src/models/room";
import { TagID } from "../room-list/models";
import { RoomNotificationState } from "./RoomNotificationState";

export class TagSpecificNotificationState extends RoomNotificationState {
    private static TAG_TO_COLOR: {
        // @ts-ignore - TS wants this to be a string key, but we know better
        [tagId: TagID]: NotificationColor,
    } = {
        // TODO: Update for FTUE Notifications: https://github.com/vector-im/riot-web/issues/14261
        //[DefaultTagID.DM]: NotificationColor.Red,
    };

    private readonly colorWhenNotIdle?: NotificationColor;

    constructor(room: Room, tagId: TagID) {
        super(room);

        const specificColor = TagSpecificNotificationState.TAG_TO_COLOR[tagId];
        if (specificColor) this.colorWhenNotIdle = specificColor;
    }

    public get color(): NotificationColor {
        if (!this.colorWhenNotIdle) return super.color;

        if (super.color !== NotificationColor.None) return this.colorWhenNotIdle;
        return super.color;
    }
}
