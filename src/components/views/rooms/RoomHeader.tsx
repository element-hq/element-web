/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import React from "react";

import type { Room } from "matrix-js-sdk/src/models/room";
import { _t } from "../../../languageHandler";
import RoomName from "../elements/RoomName";
import { IOOBData } from "../../../stores/ThreepidInviteStore";

export default function RoomHeader({ room, oobData }: { room?: Room; oobData?: IOOBData }): JSX.Element {
    let oobName = _t("Join Room");
    if (oobData && oobData.name) {
        oobName = oobData.name;
    }

    return (
        <header className="mx_LegacyRoomHeader light-panel">
            <div className="mx_LegacyRoomHeader_wrapper">
                {room && (
                    <RoomName room={room}>
                        {(name) => {
                            const roomName = name || oobName;
                            return (
                                <div
                                    className="mx_LegacyRoomHeader_name"
                                    dir="auto"
                                    title={roomName}
                                    role="heading"
                                    aria-level={1}
                                >
                                    {roomName}
                                </div>
                            );
                        }}
                    </RoomName>
                )}
            </div>
        </header>
    );
}
