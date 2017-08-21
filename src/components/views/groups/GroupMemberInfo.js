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

import PropTypes from 'prop-types';
import React from 'react';
import dis from '../../../dispatcher';
import Modal from '../../../Modal';
import sdk from '../../../index';
import { _t } from '../../../languageHandler';
import { GroupMemberType } from '../../../groups';
import { groupMemberFromApiObject } from '../../../groups';
import withMatrixClient from '../../../wrappers/withMatrixClient';
import AccessibleButton from '../elements/AccessibleButton';
import GeminiScrollbar from 'react-gemini-scrollbar';


module.exports = withMatrixClient(React.createClass({
    displayName: 'GroupMemberInfo',

    propTypes: {
        matrixClient: PropTypes.object.isRequired,
        groupId: PropTypes.string,
        member: GroupMemberType,
    },

    getInitialState: function() {
        return {
            fetching: false,
            removingUser: false,
            members: null,
        };
    },

    componentWillMount: function() {
        this._fetchMembers();
    },

    _fetchMembers: function() {
        this.setState({fetching: true});
        this.props.matrixClient.getGroupUsers(this.props.groupId).then((result) => {
            this.setState({
                members: result.chunk.map((apiMember) => {
                    return groupMemberFromApiObject(apiMember);
                }),
                fetching: false,
            });
        }).catch((e) => {
            this.setState({fetching: false});
            console.error("Failed to get group member list: " + e);
        });
    },

    _onKick: function() {
        const ConfirmUserActionDialog = sdk.getComponent("dialogs.ConfirmUserActionDialog");
        Modal.createDialog(ConfirmUserActionDialog, {
            groupMember: this.props.member,
            action: _t('Remove from group'),
            danger: true,
            onFinished: (proceed) => {
                if (!proceed) return;

                this.setState({removingUser: true});
                this.props.matrixClient.removeUserFromGroup(this.props.groupId, this.props.member.userId).then(() => {
                    dis.dispatch({
                        action: "view_user",
                        member: null,
                    });
                }).catch((e) => {
                    const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                    Modal.createTrackedDialog('Failed to remove user from group', '', ErrorDialog, {
                        title: _t('Error'),
                        description: _t('Failed to remove user from group'),
                    });
                }).finally(() => {
                    this.setState({removingUser: false});
                });
            },
        });
    },

    _onCancel: function(e) {
        dis.dispatch({
            action: "view_user",
            member: null,
        });
    },

    onRoomTileClick(roomId) {
        dis.dispatch({
            action: 'view_room',
            room_id: roomId,
        });
    },

    render: function() {
        if (this.state.fetching || this.state.removingUser) {
            const Loader = sdk.getComponent("elements.Spinner");
            return <Loader />;
        }
        if (!this.state.members) return null;

        let targetIsInGroup = false;
        for (const m of this.state.members) {
            if (m.userId == this.props.member.userId) {
                targetIsInGroup = true;
            }
        }

        let kickButton;
        let adminButton;

        if (targetIsInGroup) {
            kickButton = (
                <AccessibleButton className="mx_MemberInfo_field"
                        onClick={this._onKick}>
                    {_t('Remove from group')}
                </AccessibleButton>
            );

            // No make/revoke admin API yet
            /*const opLabel = this.state.isTargetMod ? _t("Revoke Moderator") : _t("Make Moderator");
            giveModButton = <AccessibleButton className="mx_MemberInfo_field" onClick={this.onModToggle}>
                {giveOpLabel}
            </AccessibleButton>;*/
        }

        let adminTools;
        if (kickButton || adminButton) {
            adminTools =
                <div>
                    <h3>{_t("Admin tools")}</h3>

                    <div className="mx_MemberInfo_buttons">
                        {kickButton}
                        {adminButton}
                    </div>
                </div>;
        }

        const BaseAvatar = sdk.getComponent('avatars.BaseAvatar');
        const avatar = (
            <BaseAvatar name={this.props.member.userId} width={36} height={36} />
        );

        const memberName = this.props.member.userId;

        const EmojiText = sdk.getComponent('elements.EmojiText');
        return (
            <div className="mx_MemberInfo">
                <GeminiScrollbar autoshow={true}>
                    <AccessibleButton className="mx_MemberInfo_cancel" onClick={this._onCancel}> <img src="img/cancel.svg" width="18" height="18"/></AccessibleButton>
                    <div className="mx_MemberInfo_avatar">
                        {avatar}
                    </div>

                    <EmojiText element="h2">{memberName}</EmojiText>

                    <div className="mx_MemberInfo_profile">
                        <div className="mx_MemberInfo_profileField">
                            { this.props.member.userId }
                        </div>
                    </div>

                    { adminTools }
                </GeminiScrollbar>
            </div>
        );
    },
}));
