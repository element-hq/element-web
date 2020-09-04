/*
Copyright 2017 New Vector Ltd.

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
import { _t } from '../../../languageHandler';
import * as sdk from '../../../index';
import GroupStore from '../../../stores/GroupStore';
import PropTypes from 'prop-types';
import { showGroupAddRoomDialog } from '../../../GroupAddressPicker';
import AccessibleButton from '../elements/AccessibleButton';
import AutoHideScrollbar from "../../structures/AutoHideScrollbar";

const INITIAL_LOAD_NUM_ROOMS = 30;

export default class GroupRoomList extends React.Component {
    static propTypes = {
        groupId: PropTypes.string.isRequired,
    };

    state = {
        rooms: null,
        truncateAt: INITIAL_LOAD_NUM_ROOMS,
        searchQuery: "",
    };

    componentDidMount() {
        this._unmounted = false;
        this._initGroupStore(this.props.groupId);
    }

    componentWillUnmount() {
        this._unmounted = true;
        this._unregisterGroupStore();
    }

    _unregisterGroupStore() {
        GroupStore.unregisterListener(this.onGroupStoreUpdated);
    }

    _initGroupStore(groupId) {
        GroupStore.registerListener(groupId, this.onGroupStoreUpdated);
        // XXX: This should be more fluxy - let's get the error from GroupStore .getError or something
        // XXX: This is also leaked - we should remove it when unmounting
        GroupStore.on('error', (err, errorGroupId) => {
            if (errorGroupId !== groupId) return;
            this.setState({
                rooms: null,
            });
        });
    }

    onGroupStoreUpdated = () => {
        if (this._unmounted) return;
        this.setState({
            rooms: GroupStore.getGroupRooms(this.props.groupId),
        });
    };

    _createOverflowTile = (overflowCount, totalCount) => {
        // For now we'll pretend this is any entity. It should probably be a separate tile.
        const EntityTile = sdk.getComponent("rooms.EntityTile");
        const BaseAvatar = sdk.getComponent("avatars.BaseAvatar");
        const text = _t("and %(count)s others...", { count: overflowCount });
        return (
            <EntityTile className="mx_EntityTile_ellipsis" avatarJsx={
                <BaseAvatar url={require("../../../../res/img/ellipsis.svg")} name="..." width={36} height={36} />
            } name={text} presenceState="online" suppressOnHover={true}
            onClick={this._showFullRoomList} />
        );
    };

    _showFullRoomList = () => {
        this.setState({
            truncateAt: -1,
        });
    };

    onSearchQueryChanged = ev => {
        this.setState({ searchQuery: ev.target.value });
    };

    onAddRoomToGroupButtonClick = () => {
        showGroupAddRoomDialog(this.props.groupId).then(() => {
            this.forceUpdate();
        });
    };

    makeGroupRoomTiles(query) {
        const GroupRoomTile = sdk.getComponent("groups.GroupRoomTile");
        query = (query || "").toLowerCase();

        let roomList = this.state.rooms;
        if (query) {
            roomList = roomList.filter((room) => {
                const matchesName = (room.name || "").toLowerCase().includes(query);
                const matchesAlias = (room.canonicalAlias || "").toLowerCase().includes(query);
                return matchesName || matchesAlias;
            });
        }

        roomList = roomList.map((groupRoom, index) => {
            return (
                <GroupRoomTile
                    key={index}
                    groupId={this.props.groupId}
                    groupRoom={groupRoom} />
            );
        });

        return roomList;
    }

    render() {
        if (this.state.rooms === null) {
            return null;
        }

        let inviteButton;
        if (GroupStore.isUserPrivileged(this.props.groupId)) {
            inviteButton = (
                <AccessibleButton
                    className="mx_MemberList_invite mx_MemberList_addRoomToCommunity"
                    onClick={this.onAddRoomToGroupButtonClick}
                >
                    <span>{ _t('Add rooms to this community') }</span>
                </AccessibleButton>
            );
        }
        const inputBox = (
            <input className="mx_GroupRoomList_query mx_textinput" id="mx_GroupRoomList_query" type="text"
                    onChange={this.onSearchQueryChanged} value={this.state.searchQuery}
                    placeholder={_t('Filter community rooms')} autoComplete="off" />
        );

        const TruncatedList = sdk.getComponent("elements.TruncatedList");
        return (
            <div className="mx_GroupRoomList" role="tabpanel">
                { inviteButton }
                <AutoHideScrollbar className="mx_GroupRoomList_joined mx_GroupRoomList_outerWrapper">
                    <TruncatedList className="mx_GroupRoomList_wrapper" truncateAt={this.state.truncateAt}
                            createOverflowElement={this._createOverflowTile}>
                        { this.makeGroupRoomTiles(this.state.searchQuery) }
                    </TruncatedList>
                </AutoHideScrollbar>
                { inputBox }
            </div>
        );
    }
}
