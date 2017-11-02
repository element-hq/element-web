/*
Copyright 2017 New Vector Ltd

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

import PropTypes from 'prop-types';
import React from 'react';
import { MatrixClient } from 'matrix-js-sdk';
import dis from '../../../dispatcher';
import Modal from '../../../Modal';
import sdk from '../../../index';
import { _t } from '../../../languageHandler';
import { GroupRoomType } from '../../../groups';
import GroupStoreCache from '../../../stores/GroupStoreCache';
import GeminiScrollbar from 'react-gemini-scrollbar';

module.exports = React.createClass({
    displayName: 'GroupRoomInfo',

    contextTypes: {
        matrixClient: PropTypes.instanceOf(MatrixClient),
    },

    propTypes: {
        groupId: PropTypes.string,
        groupRoom: GroupRoomType,
    },

    getInitialState: function() {
        return {
            removingRoom: false,
            isUserPrivilegedInGroup: null,
        };
    },

    componentWillMount: function() {
        this._initGroupStore(this.props.groupId);
    },

    componentWillReceiveProps(newProps) {
        if (newProps.groupId !== this.props.groupId) {
            this._unregisterGroupStore();
            this._initGroupStore(newProps.groupId);
        }
    },

    _initGroupStore(groupId) {
        this._groupStore = GroupStoreCache.getGroupStore(
            this.context.matrixClient, this.props.groupId,
        );
        this._groupStore.registerListener(this.onGroupStoreUpdated);
    },

    _unregisterGroupStore() {
        if (this._groupStore) {
            this._groupStore.unregisterListener(this.onGroupStoreUpdated);
        }
    },

    onGroupStoreUpdated: function() {
        this.setState({
            isUserPrivilegedInGroup: this._groupStore.isUserPrivileged(),
        });
    },

    _onRemove: function(e) {
        const groupId = this.props.groupId;
        const roomName = this.props.groupRoom.displayname;
        e.preventDefault();
        e.stopPropagation();
        const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
        Modal.createTrackedDialog('Confirm removal of group from room', '', QuestionDialog, {
            title: _t("Are you sure you want to remove '%(roomName)s' from %(groupId)s?", {roomName, groupId}),
            description: _t("Removing a room from the community will also remove it from the community page."),
            button: _t("Remove"),
            onFinished: (proceed) => {
                if (!proceed) return;
                this.setState({removingRoom: true});
                const groupId = this.props.groupId;
                const roomId = this.props.groupRoom.roomId;
                this._groupStore.removeRoomFromGroup(roomId).then(() => {
                    dis.dispatch({
                        action: "view_group_room_list",
                    });
                }).catch((err) => {
                    console.error(`Error whilst removing ${roomId} from ${groupId}`, err);
                    const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                    Modal.createTrackedDialog('Failed to remove room from group', '', ErrorDialog, {
                        title: _t("Failed to remove room from community"),
                        description: _t(
                            "Failed to remove '%(roomName)s' from %(groupId)s", {groupId, roomName},
                        ),
                    });
                }).finally(() => {
                    this.setState({removingRoom: false});
                });
            },
        });
    },

    _onCancel: function(e) {
        dis.dispatch({
            action: "view_group_room_list",
        });
    },

    render: function() {
        const BaseAvatar = sdk.getComponent('avatars.BaseAvatar');
        const EmojiText = sdk.getComponent('elements.EmojiText');
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        if (this.state.removingRoom) {
            const Spinner = sdk.getComponent("elements.Spinner");
            return <Spinner />;
        }

        let adminTools;
        if (this.state.isUserPrivilegedInGroup) {
            adminTools =
                <div className="mx_MemberInfo_adminTools">
                    <h3>{ _t("Admin Tools") }</h3>
                    <div className="mx_MemberInfo_buttons">
                        <AccessibleButton className="mx_MemberInfo_field" onClick={this._onRemove}>
                            { _t('Remove from community') }
                        </AccessibleButton>
                    </div>
                </div>;
        }

        const avatarUrl = this.context.matrixClient.mxcUrlToHttp(
            this.props.groupRoom.avatarUrl,
            36, 36, 'crop',
        );

        const groupRoomName = this.props.groupRoom.displayname;
        const avatar = <BaseAvatar name={groupRoomName} width={36} height={36} url={avatarUrl} />;
        return (
            <div className="mx_MemberInfo">
                <GeminiScrollbar autoshow={true}>
                    <AccessibleButton className="mx_MemberInfo_cancel"onClick={this._onCancel}>
                        <img src="img/cancel.svg" width="18" height="18" className="mx_filterFlipColor" />
                    </AccessibleButton>
                    <div className="mx_MemberInfo_avatar">
                        { avatar }
                    </div>

                    <EmojiText element="h2">{ groupRoomName }</EmojiText>

                    <div className="mx_MemberInfo_profile">
                        <div className="mx_MemberInfo_profileField">
                            { this.props.groupRoom.canonical_alias }
                        </div>
                    </div>

                    { adminTools }
                </GeminiScrollbar>
            </div>
        );
    },
});
