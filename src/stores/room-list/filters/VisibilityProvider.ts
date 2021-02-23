/*
 * Copyright 2020 The Matrix.org Foundation C.I.C.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Room} from "matrix-js-sdk/src/models/room";
import CallHandler from "../../../CallHandler";
import { RoomListCustomisations } from "../../../customisations/RoomList";
import VoipUserMapper from "../../../VoipUserMapper";

export class VisibilityProvider {
    private static internalInstance: VisibilityProvider;

    private constructor() {
    }

    public static get instance(): VisibilityProvider {
        if (!VisibilityProvider.internalInstance) {
            VisibilityProvider.internalInstance = new VisibilityProvider();
        }
        return VisibilityProvider.internalInstance;
    }

    public async onNewInvitedRoom(room: Room) {
        await VoipUserMapper.sharedInstance().onNewInvitedRoom(room);
    }

    public isRoomVisible(room: Room): boolean {
        let isVisible = true; // Returned at the end of this function
        let forced = false; // When true, this function won't bother calling the customisation points

        if (
            CallHandler.sharedInstance().getSupportsVirtualRooms() &&
            VoipUserMapper.sharedInstance().isVirtualRoom(room)
        ) {
            isVisible = false;
            forced = true;
        }

        const isVisibleFn = RoomListCustomisations.isRoomVisible;
        if (!forced && isVisibleFn) {
            isVisible = isVisibleFn(room);
        }

        return isVisible;
    }
}
