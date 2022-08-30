/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import React, { FC, useContext, useEffect } from "react";

import type { Room } from "matrix-js-sdk/src/models/room";
import type { Call } from "../../models/Call";
import { useCall, useConnectionState } from "../../hooks/useCall";
import { isConnected } from "../../models/Call";
import MatrixClientContext from "../../contexts/MatrixClientContext";
import AppTile from "../views/elements/AppTile";
import { CallLobby } from "../views/voip/CallLobby";

interface Props {
    room: Room;
    resizing: boolean;
}

const LoadedVideoRoomView: FC<Props & { call: Call }> = ({ room, resizing, call }) => {
    const cli = useContext(MatrixClientContext);
    const connected = isConnected(useConnectionState(call));

    // We'll take this opportunity to tidy up our room state
    useEffect(() => { call?.clean(); }, [call]);

    if (!call) return null;

    return <div className="mx_VideoRoomView">
        { connected ? null : <CallLobby room={room} call={call} /> }
        { /* We render the widget even if we're disconnected, so it stays loaded */ }
        <AppTile
            app={call.widget}
            room={room}
            userId={cli.credentials.userId}
            creatorUserId={call.widget.creatorUserId}
            waitForIframeLoad={call.widget.waitForIframeLoad}
            showMenubar={false}
            pointerEvents={resizing ? "none" : undefined}
        />
    </div>;
};

export const VideoRoomView: FC<Props> = ({ room, resizing }) => {
    const call = useCall(room.roomId);
    return call ? <LoadedVideoRoomView room={room} resizing={resizing} call={call} /> : null;
};
