/*
Copyright 2017 Vector Creations Ltd

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
import sdk from '../../../index';
import dis from '../../../dispatcher';
import MatrixClientPeg from '../../../MatrixClientPeg';
import { _t } from '../../../languageHandler';
import DMRoomMap from '../../../utils/DMRoomMap';
import AccessibleButton from '../elements/AccessibleButton';
import Unread from '../../../Unread';
import classNames from 'classnames';
import createRoom from '../../../createRoom';
import { RoomMember } from "matrix-js-sdk";

export default class ChatCreateOrReuseDialog extends React.Component {

    constructor(props) {
        super(props);
        this.onRoomTileClick = this.onRoomTileClick.bind(this);

        this.state = {
            tiles: [],
            profile: {
                displayName: null,
                avatarUrl: null,
            },
            profileError: null,
        };
    }

    componentWillMount() {
        const client = MatrixClientPeg.get();

        const dmRoomMap = new DMRoomMap(client);
        const dmRooms = dmRoomMap.getDMRoomsForUserId(this.props.userId);

        const RoomTile = sdk.getComponent("rooms.RoomTile");

        const tiles = [];
        for (const roomId of dmRooms) {
            const room = client.getRoom(roomId);
            if (room) {
                const me = room.getMember(client.credentials.userId);
                const highlight = (
                    room.getUnreadNotificationCount('highlight') > 0 ||
                    me.membership == "invite"
                );
                tiles.push(
                    <RoomTile key={room.roomId} room={room}
                        collapsed={false}
                        selected={false}
                        unread={Unread.doesRoomHaveUnreadMessages(room)}
                        highlight={highlight}
                        isInvite={me.membership == "invite"}
                        onClick={this.onRoomTileClick}
                    />,
                );
            }
        }

        this.setState({
            tiles: tiles,
        });

        if (tiles.length === 0) {
            this.setState({
                busyProfile: true,
            });
            MatrixClientPeg.get().getProfileInfo(this.props.userId).done((resp) => {
                const profile = {
                    displayName: resp.displayname,
                    avatarUrl: null,
                };
                if (resp.avatar_url) {
                    profile.avatarUrl = MatrixClientPeg.get().mxcUrlToHttp(
                        resp.avatar_url, 48, 48, "crop",
                    );
                }
                this.setState({
                    busyProfile: false,
                    profile: profile,
                });
            }, (err) => {
                console.error(
                    'Unable to get profile for user ' + this.props.userId + ':',
                    err,
                );
                this.setState({
                    busyProfile: false,
                    profileError: err,
                });
            });
        }
    }

    onRoomTileClick(roomId) {
        this.props.onExistingRoomSelected(roomId);
    }

    render() {
        let title = '';
        let content = null;
        if (this.state.tiles.length > 0) {
            // Show the existing rooms with a "+" to add a new dm
            title = _t('Create a new chat or reuse an existing one');
            const labelClasses = classNames({
                mx_MemberInfo_createRoom_label: true,
                mx_RoomTile_name: true,
            });
            const startNewChat = <AccessibleButton
                className="mx_MemberInfo_createRoom"
                onClick={this.props.onNewDMClick}
            >
                <div className="mx_RoomTile_avatar">
                    <img src="img/create-big.svg" width="26" height="26" />
                </div>
                <div className={labelClasses}><i>{ _t("Start new chat") }</i></div>
            </AccessibleButton>;
            content = <div className="mx_Dialog_content">
                { _t('You already have existing direct chats with this user:') }
                <div className="mx_ChatCreateOrReuseDialog_tiles">
                    { this.state.tiles }
                    { startNewChat }
                </div>
            </div>;
        } else {
            // Show the avatar, name and a button to confirm that a new chat is requested
            const BaseAvatar = sdk.getComponent('avatars.BaseAvatar');
            const Spinner = sdk.getComponent('elements.Spinner');
            title = _t('Start chatting');

            let profile = null;
            if (this.state.busyProfile) {
                profile = <Spinner />;
            } else if (this.state.profileError) {
                profile = <div className="error">
                    Unable to load profile information for { this.props.userId }
                </div>;
            } else {
                profile = <div className="mx_ChatCreateOrReuseDialog_profile">
                    <BaseAvatar
                        name={this.state.profile.displayName || this.props.userId}
                        url={this.state.profile.avatarUrl}
                        width={48} height={48}
                    />
                    <div className="mx_ChatCreateOrReuseDialog_profile_name">
                        {this.state.profile.displayName || this.props.userId}
                    </div>
                </div>;
            }
            content = <div>
                <div className="mx_Dialog_content">
                    <p>
                        { _t('Click on the button below to start chatting!') }
                    </p>
                    { profile }
                </div>
                <div className="mx_Dialog_buttons">
                    <button className="mx_Dialog_primary" onClick={this.props.onNewDMClick}>
                        { _t('Start Chatting') }
                    </button>
                </div>
            </div>;
        }

        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        return (
            <BaseDialog className='mx_ChatCreateOrReuseDialog'
                onFinished={ this.props.onFinished.bind(false) }
                title={title}
            >
                { content }
            </BaseDialog>
        );
    }
}

ChatCreateOrReuseDialog.propTyps = {
    userId: React.PropTypes.string.isRequired,
    // Called when clicking outside of the dialog
    onFinished: React.PropTypes.func.isRequired,
    onNewDMClick: React.PropTypes.func.isRequired,
    onExistingRoomSelected: React.PropTypes.func.isRequired,
};
