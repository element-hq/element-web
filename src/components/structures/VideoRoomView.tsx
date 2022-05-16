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

import React, { FC, useContext, useState, useMemo, useEffect } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { Room } from "matrix-js-sdk/src/models/room";

import MatrixClientContext from "../../contexts/MatrixClientContext";
import { useEventEmitter } from "../../hooks/useEventEmitter";
import WidgetUtils from "../../utils/WidgetUtils";
import { addVideoChannel, getVideoChannel, fixStuckDevices } from "../../utils/VideoChannelUtils";
import WidgetStore, { IApp } from "../../stores/WidgetStore";
import { UPDATE_EVENT } from "../../stores/AsyncStore";
import VideoChannelStore, { VideoChannelEvent } from "../../stores/VideoChannelStore";
import AppTile from "../views/elements/AppTile";
import VideoLobby from "../views/voip/VideoLobby";

interface IProps {
    room: Room;
    resizing: boolean;
}

const VideoRoomView: FC<IProps> = ({ room, resizing }) => {
    const cli = useContext(MatrixClientContext);
    const store = VideoChannelStore.instance;

    // In case we mount before the WidgetStore knows about our Jitsi widget
    const [widgetStoreReady, setWidgetStoreReady] = useState(Boolean(WidgetStore.instance.matrixClient));
    const [widgetLoaded, setWidgetLoaded] = useState(false);
    useEventEmitter(WidgetStore.instance, UPDATE_EVENT, (roomId: string) => {
        if (roomId === null) setWidgetStoreReady(true);
        if (roomId === null || roomId === room.roomId) {
            setWidgetLoaded(Boolean(getVideoChannel(room.roomId)));
        }
    });

    const app: IApp = useMemo(() => {
        if (widgetStoreReady) {
            const app = getVideoChannel(room.roomId);
            if (!app) {
                logger.warn(`No video channel for room ${room.roomId}`);
                // Since widgets in video rooms are mutable, we'll take this opportunity to
                // reinstate the Jitsi widget in case another client removed it
                if (WidgetUtils.canUserModifyWidgets(room.roomId)) {
                    addVideoChannel(room.roomId, room.name);
                }
            }
            return app;
        }
    }, [room, widgetStoreReady, widgetLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

    // We'll also take this opportunity to fix any stuck devices.
    // The linter thinks that store.connected should be a dependency, but we explicitly
    // *only* want this to happen at mount to avoid racing with normal device updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { fixStuckDevices(room, store.connected); }, [room]);

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
