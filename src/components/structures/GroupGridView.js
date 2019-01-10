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
import OpenRoomsStore from '../../stores/OpenRoomsStore';
import dis from '../../dispatcher';
import {_t} from '../../languageHandler';
import RoomView from './RoomView';
import classNames from 'classnames';
import MainSplit from './MainSplit';
import RightPanel from './RightPanel';
import RoomHeaderButtons from '../views/right_panel/RoomHeaderButtons';

export default class RoomGridView extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            roomStores: OpenRoomsStore.getRoomStores(),
            activeRoomStore: OpenRoomsStore.getActiveRoomStore(),
        };
        this.onRoomsChanged = this.onRoomsChanged.bind(this);
    }

    componentDidUpdate(_, prevState) {
        const store = this.state.activeRoomStore;
        if (store) {
            store.getDispatcher().dispatch({action: 'focus_composer'});
        }
    }

    componentDidMount() {
        this.componentDidUpdate();
    }

    componentWillMount() {
        this._unmounted = false;
        this._openRoomsStoreRegistration = OpenRoomsStore.addListener(this.onRoomsChanged);
    }

    componentWillUnmount() {
        this._unmounted = true;
        if (this._openRoomsStoreRegistration) {
            this._openRoomsStoreRegistration.remove();
        }
    }

    onRoomsChanged() {
        if (this._unmounted) return;
        this.setState({
            roomStores: OpenRoomsStore.getRoomStores(),
            activeRoomStore: OpenRoomsStore.getActiveRoomStore(),
        });
    }

    _setActive(i) {
        const store = OpenRoomsStore.getRoomStoreAt(i);
        if (store !== this.state.activeRoomStore) {
            dis.dispatch({
                action: 'group_grid_set_active',
                room_id: store.getRoomId(),
            });
        }
    }

    render() {
        let roomStores = this.state.roomStores.slice(0, 6);
        const emptyCount = 6 - roomStores.length;
        if (emptyCount) {
            const emptyTiles = Array.from({length: emptyCount}, () => null);
            roomStores = roomStores.concat(emptyTiles);
        }
        const activeRoomId = this.state.activeRoomStore && this.state.activeRoomStore.getRoomId();
        let rightPanel;
        if (activeRoomId) {
            rightPanel = (
                <div className="mx_GroupGridView_rightPanel">
                    <div className="mx_GroupGridView_tabs"><RoomHeaderButtons /></div>
                    <RightPanel roomId={activeRoomId} />
                </div>
            );
        }

        return (<main className="mx_GroupGridView">
            <MainSplit panel={rightPanel} collapsedRhs={this.props.collapsedRhs} >
                <div className="mx_GroupGridView_rooms">
                    { roomStores.map((roomStore, i) => {
                        if (roomStore) {
                            const isActive = roomStore === this.state.activeRoomStore;
                            const tileClasses = classNames({
                                "mx_GroupGridView_tile": true,
                                "mx_GroupGridView_activeTile": isActive,
                            });
                            return (<section
                                    onClick={() => {this._setActive(i);}}
                                    key={roomStore.getRoomId()}
                                    className={tileClasses}
                                >
                                    <RoomView
                                        collapsedRhs={this.props.collapsedRhs}
                                        isGrid={true}
                                        roomViewStore={roomStore}
                                        isActive={isActive}
                                    />
                                </section>);
                        } else {
                            return (<section className={"mx_GroupGridView_emptyTile"} key={`empty-${i}`}>{_t("No room in this tile yet.")}</section>);
                        }
                    }) }
                </div>
            </MainSplit>
        </main>);
    }
}
