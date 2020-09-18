/*
Copyright 2018 New Vector Ltd
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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

import React from 'react';
import RoomViewStore from '../../../stores/RoomViewStore';
import ActiveWidgetStore from '../../../stores/ActiveWidgetStore';
import WidgetUtils from '../../../utils/WidgetUtils';
import * as sdk from '../../../index';
import {MatrixClientPeg} from '../../../MatrixClientPeg';

export default class PersistentApp extends React.Component {
    state = {
        roomId: RoomViewStore.getRoomId(),
        persistentWidgetId: ActiveWidgetStore.getPersistentWidgetId(),
    };

    componentDidMount() {
        this._roomStoreToken = RoomViewStore.addListener(this._onRoomViewStoreUpdate);
        ActiveWidgetStore.on('update', this._onActiveWidgetStoreUpdate);
    }

    componentWillUnmount() {
        if (this._roomStoreToken) {
            this._roomStoreToken.remove();
        }
        ActiveWidgetStore.removeListener('update', this._onActiveWidgetStoreUpdate);
    }

    _onRoomViewStoreUpdate = payload => {
        if (RoomViewStore.getRoomId() === this.state.roomId) return;
        this.setState({
            roomId: RoomViewStore.getRoomId(),
        });
    };

    _onActiveWidgetStoreUpdate = () => {
        this.setState({
            persistentWidgetId: ActiveWidgetStore.getPersistentWidgetId(),
        });
    };

    render() {
        if (this.state.persistentWidgetId) {
            const persistentWidgetInRoomId = ActiveWidgetStore.getRoomId(this.state.persistentWidgetId);
            if (this.state.roomId !== persistentWidgetInRoomId) {
                const persistentWidgetInRoom = MatrixClientPeg.get().getRoom(persistentWidgetInRoomId);
                // get the widget data
                const appEvent = WidgetUtils.getRoomWidgets(persistentWidgetInRoom).find((ev) => {
                    return ev.getStateKey() === ActiveWidgetStore.getPersistentWidgetId();
                });
                const app = WidgetUtils.makeAppConfig(
                    appEvent.getStateKey(), appEvent.getContent(), appEvent.getSender(),
                    persistentWidgetInRoomId, appEvent.getId(),
                );
                const capWhitelist = WidgetUtils.getCapWhitelistForAppTypeInRoomId(app.type, persistentWidgetInRoomId);
                const AppTile = sdk.getComponent('elements.AppTile');
                return <AppTile
                    key={app.id}
                    app={app}
                    fullWidth={true}
                    room={persistentWidgetInRoom}
                    userId={MatrixClientPeg.get().credentials.userId}
                    show={true}
                    creatorUserId={app.creatorUserId}
                    widgetPageTitle={WidgetUtils.getWidgetDataTitle(app)}
                    waitForIframeLoad={app.waitForIframeLoad}
                    whitelistCapabilities={capWhitelist}
                    showDelete={false}
                    showMinimise={false}
                    miniMode={true}
                />;
            }
        }
        return null;
    }
}

