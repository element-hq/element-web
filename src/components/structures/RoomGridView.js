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

export default class RoomGridView extends React.Component {
    /* displayName: 'GroupView',

    propTypes: {
        groupId: PropTypes.string.isRequired,
    },

    childContextTypes = {
        groupStore: PropTypes.instanceOf(GroupStore),
    };*/

    getInitialState() {
        return {
            rooms: [],
        };
    }

    componentWillMount() {
        this._unmounted = false;
        this._initGroupStore(this.props.groupId);
        this._dispatcherRef = dis.register(this._onAction);
    }

    componentWillUnmount() {
        this._unmounted = true;
        if (this._groupStoreRegistration) {
            this._groupStoreRegistration.unregister();
        }
        dis.unregister(this._dispatcherRef);
    }

    componentWillReceiveProps(newProps) {
        if (this.props.groupId != newProps.groupId) {
            this.setState(this.getInitialState(), () => {
                this._initGroupStore(newProps.groupId);
            });
        }
    }

    _initGroupStore(groupId) {
        if (this._groupStoreRegistration) {
            this._groupStoreRegistration.unregister();
        }
        this._groupStoreRegistration = GroupStore.registerListener(groupId, this.onGroupStoreUpdated);
    }

    onGroupStoreUpdated() {
        if (this._unmounted) return;
        this.setState({
            rooms: GroupStore.getGroupRooms(this.props.groupId),
        });
    }

    _onAction(payload) {
        switch (payload.action) {
            default:
                break;
        }
    }

    render() {
        const rooms = this.state.rooms.slice(0, 6);
        return <main class="mx_RoomGridView">
            { rooms.map(room => {
                <section class="mx_RoomGridView_tile">
                    <RoomView roomId={room.roomId} />
                </section>
            }) }
        </main>
    }

}
