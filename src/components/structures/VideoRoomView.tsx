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

import React, { FC, useContext, useState, useMemo } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { Room } from "matrix-js-sdk/src/models/room";

import MatrixClientContext from "../../contexts/MatrixClientContext";
import { useEventEmitter } from "../../hooks/useEventEmitter";
import { getVideoChannel } from "../../utils/VideoChannelUtils";
import WidgetStore from "../../stores/WidgetStore";
import { UPDATE_EVENT } from "../../stores/AsyncStore";
import VideoChannelStore, { VideoChannelEvent } from "../../stores/VideoChannelStore";
import AppTile from "../views/elements/AppTile";
import VideoLobby from "../views/voip/VideoLobby";

const VideoRoomView: FC<{ room: Room, resizing: boolean }> = ({ room, resizing }) => {
    const cli = useContext(MatrixClientContext);
    const store = VideoChannelStore.instance;

    // In case we mount before the WidgetStore knows about our Jitsi widget
    const [widgetLoaded, setWidgetLoaded] = useState(false);
    useEventEmitter(WidgetStore.instance, UPDATE_EVENT, (roomId: string) => {
        if (roomId === null || roomId === room.roomId) setWidgetLoaded(true);
    });

    const app = useMemo(() => {
        const app = getVideoChannel(room.roomId);
        if (!app) logger.warn(`No video channel for room ${room.roomId}`);
        return app;
    }, [room, widgetLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

    const [connected, setConnected] = useState(store.connected && store.roomId === room.roomId);
    useEventEmitter(store, VideoChannelEvent.Connect, () => setConnected(store.roomId === room.roomId));
    useEventEmitter(store, VideoChannelEvent.Disconnect, () => setConnected(false));

    if (!app) return null;

    return <div className="mx_VideoRoomView">
        { connected ? null : <VideoLobby room={room} /> }
        { /* We render the widget even if we're disconnected, so it stays loaded */ }
        <AppTile
            app={app}
            room={room}
            userId={cli.credentials.userId}
            creatorUserId={app.creatorUserId}
            waitForIframeLoad={app.waitForIframeLoad}
            showMenubar={false}
            pointerEvents={resizing ? "none" : null}
        />
    </div>;
};

export default VideoRoomView;
