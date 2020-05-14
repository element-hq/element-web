/*
Copyright 2017 Vector Creations Ltd
Copyright 2017 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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
import createReactClass from 'create-react-class';
import dis from '../../../dispatcher/dispatcher';
import Modal from '../../../Modal';
import * as sdk from '../../../index';
import { _t } from '../../../languageHandler';
import { GroupMemberType } from '../../../groups';
import GroupStore from '../../../stores/GroupStore';
import AccessibleButton from '../elements/AccessibleButton';
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import AutoHideScrollbar from "../../structures/AutoHideScrollbar";
import {Action} from "../../../dispatcher/actions";

export default createReactClass({
    displayName: 'GroupMemberInfo',

    statics: {
        contextType: MatrixClientContext,
    },

    propTypes: {
        groupId: PropTypes.string,
        groupMember: GroupMemberType,
        isInvited: PropTypes.bool,
    },

    getInitialState: function() {
        return {
            removingUser: false,
            isUserPrivilegedInGroup: null,
        };
    },

    componentDidMount: function() {
        this._unmounted = false;
        this._initGroupStore(this.props.groupId);
    },

    // TODO: [REACT-WARNING] Replace with appropriate lifecycle event
    UNSAFE_componentWillReceiveProps(newProps) {
        if (newProps.groupId !== this.props.groupId) {
            this._unregisterGroupStore(this.props.groupId);
            this._initGroupStore(newProps.groupId);
        }
    },

    componentWillUnmount() {
        this._unmounted = true;
        this._unregisterGroupStore(this.props.groupId);
    },

    _initGroupStore(groupId) {
        GroupStore.registerListener(groupId, this.onGroupStoreUpdated);
    },

    _unregisterGroupStore(groupId) {
        GroupStore.unregisterListener(this.onGroupStoreUpdated);
    },

    onGroupStoreUpdated: function() {
        if (this._unmounted) return;
        this.setState({
            isUserInvited: GroupStore.getGroupInvitedMembers(this.props.groupId).some(
                (m) => m.userId === this.props.groupMember.userId,
            ),
            isUserPrivilegedInGroup: GroupStore.isUserPrivileged(this.props.groupId),
        });
    },

    _onKick: function() {
        const ConfirmUserActionDialog = sdk.getComponent("dialogs.ConfirmUserActionDialog");
        Modal.createDialog(ConfirmUserActionDialog, {
            matrixClient: this.context,
            groupMember: this.props.groupMember,
            action: this.state.isUserInvited ? _t('Disinvite') : _t('Remove from community'),
            title: this.state.isUserInvited ? _t('Disinvite this user from community?')
                                            : _t('Remove this user from community?'),
            danger: true,
            onFinished: (proceed) => {
                if (!proceed) return;

                this.setState({removingUser: true});
                this.context.removeUserFromGroup(
                    this.props.groupId, this.props.groupMember.userId,
                ).then(() => {
                    // return to the user list
                    dis.dispatch({
                        action: Action.ViewUser,
                        member: null,
                    });
                }).catch((e) => {
                    const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                    Modal.createTrackedDialog('Failed to remove user from group', '', ErrorDialog, {
                        title: _t('Error'),
                        description: this.state.isUserInvited ?
                            _t('Failed to withdraw invitation') :
                            _t('Failed to remove user from community'),
                    });
                }).finally(() => {
                    this.setState({removingUser: false});
                });
            },
        });
    },

    _onCancel: function(e) {
        // Go back to the user list
        dis.dispatch({
            action: Action.ViewUser,
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
        if (this.state.removingUser) {
            const Spinner = sdk.getComponent("elements.Spinner");
            return <div className="mx_MemberInfo">
                <Spinner />
            </div>;
        }

        let adminTools;
        if (this.state.isUserPrivilegedInGroup) {
            const kickButton = (
                <AccessibleButton className="mx_MemberInfo_field"
                        onClick={this._onKick}>
                    { this.state.isUserInvited ? _t('Disinvite') : _t('Remove from community') }
                </AccessibleButton>
            );

            // No make/revoke admin API yet
            /*const opLabel = this.state.isTargetMod ? _t("Revoke Moderator") : _t("Make Moderator");
            giveModButton = <AccessibleButton className="mx_MemberInfo_field" onClick={this.onModToggle}>
                {giveOpLabel}
            </AccessibleButton>;*/

            if (kickButton) {
                adminTools =
                    <div className="mx_MemberInfo_adminTools">
                        <h3>{ _t("Admin Tools") }</h3>
                        <div className="mx_MemberInfo_buttons">
                            { kickButton }
                        </div>
                    </div>;
            }
        }


        const avatarUrl = this.props.groupMember.avatarUrl;
        let avatarElement;
        if (avatarUrl) {
            const httpUrl = this.context.mxcUrlToHttp(avatarUrl, 800, 800);
            avatarElement = (<div className="mx_MemberInfo_avatar">
                            <img src={httpUrl} />
                        </div>);
        }

        const groupMemberName = (
            this.props.groupMember.displayname || this.props.groupMember.userId
        );

        return (
            <div className="mx_MemberInfo" role="tabpanel">
                <AutoHideScrollbar>
                    <AccessibleButton className="mx_MemberInfo_cancel" onClick={this._onCancel}>
                        <img src={require("../../../../res/img/cancel.svg")} width="18" height="18" className="mx_filterFlipColor" />
                    </AccessibleButton>
                    { avatarElement }
                    <h2>{ groupMemberName }</h2>

                    <div className="mx_MemberInfo_profile">
                        <div className="mx_MemberInfo_profileField">
                            { this.props.groupMember.userId }
                        </div>
                    </div>

                    { adminTools }
                </AutoHideScrollbar>
            </div>
        );
    },
});
