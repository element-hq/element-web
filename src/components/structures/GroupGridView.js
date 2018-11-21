/*
Copyright 2017 Vector Creations Ltd.
Copyright 2017, 2018 New Vector Ltd.

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
import PropTypes from 'prop-types';
import OpenRoomsStore from '../../stores/OpenRoomsStore';
import dis from '../../dispatcher';
import RoomView from './RoomView';
import classNames from 'classnames';

export default class RoomGridView extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            roomStores: OpenRoomsStore.getRoomStores(),
        };
        this.onRoomsChanged = this.onRoomsChanged.bind(this);
    }

    componentWillMount() {
        this._unmounted = false;
        this._openRoomsStoreRegistration = OpenRoomsStore.addListener(this.onRoomsChanged);
        this._dispatcherRef = dis.register(this._onAction);
    }

    componentWillUnmount() {
        this._unmounted = true;
        if (this._openRoomsStoreRegistration) {
            this._openRoomsStoreRegistration.remove();
        }
        dis.unregister(this._dispatcherRef);
    }

    onRoomsChanged() {
        if (this._unmounted) return;
        this.setState({
            roomStores: OpenRoomsStore.getRoomStores(),
            currentRoomStore: OpenRoomsStore.getCurrentRoomStore(),
        });
    }

    _onAction(payload) {
        switch (payload.action) {
            default:
                break;
        }
    }

    render() {
        let roomStores = this.state.roomStores.slice(0, 6);
        const emptyCount = 6 - roomStores.length;
        if (emptyCount) {
            const emptyTiles = Array.from({length: emptyCount}, () => null);
            roomStores = roomStores.concat(emptyTiles);
        }
        return (<main className="mx_GroupGridView">
            { roomStores.map((roomStore) => {
                if (roomStore) {
                    const isActive = roomStore === this.state.currentRoomStore;
                    const tileClasses = classNames({
                        "mx_GroupGridView_tile": true,
                        "mx_GroupGridView_activeTile": isActive,
                    });
                    return (<section key={roomStore.getRoomId()} className={tileClasses}>
                        <RoomView
                            collapsedRhs={true}
                            roomViewStore={roomStore}
                        />
                    </section>);
                } else {
                    return (<section className={"mx_GroupGridView_emptyTile"} />);
                }
            }) }
        </main>);
    }

}
