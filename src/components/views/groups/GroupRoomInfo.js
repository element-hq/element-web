/*
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
import GroupStore from '../../../stores/GroupStore';
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import AutoHideScrollbar from "../../structures/AutoHideScrollbar";

export default createReactClass({
    displayName: 'GroupRoomInfo',

    statics: {
        contextType: MatrixClientContext,
    },

    propTypes: {
        groupId: PropTypes.string,
        groupRoomId: PropTypes.string,
    },

    getInitialState: function() {
        return {
            isUserPrivilegedInGroup: null,
            groupRoom: null,
            groupRoomPublicityLoading: false,
            groupRoomRemoveLoading: false,
        };
    },

    componentDidMount: function() {
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
        this._unregisterGroupStore(this.props.groupId);
    },

    _initGroupStore(groupId) {
        GroupStore.registerListener(groupId, this.onGroupStoreUpdated);
    },

    _unregisterGroupStore(groupId) {
        GroupStore.unregisterListener(this.onGroupStoreUpdated);
    },

    _updateGroupRoom() {
        this.setState({
            groupRoom: GroupStore.getGroupRooms(this.props.groupId).find(
                (r) => r.roomId === this.props.groupRoomId,
            ),
        });
    },

    onGroupStoreUpdated: function() {
        this.setState({
            isUserPrivilegedInGroup: GroupStore.isUserPrivileged(this.props.groupId),
        });
        this._updateGroupRoom();
    },

    _onRemove: function(e) {
        const groupId = this.props.groupId;
        const roomName = this.state.groupRoom.displayname;
        e.preventDefault();
        e.stopPropagation();
        const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
        Modal.createTrackedDialog('Confirm removal of group from room', '', QuestionDialog, {
            title: _t("Are you sure you want to remove '%(roomName)s' from %(groupId)s?", {roomName, groupId}),
            description: _t("Removing a room from the community will also remove it from the community page."),
            button: _t("Remove"),
            onFinished: (proceed) => {
                if (!proceed) return;
                this.setState({groupRoomRemoveLoading: true});
                const groupId = this.props.groupId;
                const roomId = this.props.groupRoomId;
                GroupStore.removeRoomFromGroup(this.props.groupId, roomId).then(() => {
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
                    this.setState({groupRoomRemoveLoading: false});
                });
            },
        });
    },

    _onCancel: function(e) {
        dis.dispatch({
            action: "view_group_room_list",
        });
    },

    _changeGroupRoomPublicity(e) {
        const isPublic = e.target.value === "public";
        this.setState({
            groupRoomPublicityLoading: true,
        });
        const groupId = this.props.groupId;
        const roomId = this.props.groupRoomId;
        const roomName = this.state.groupRoom.displayname;
        GroupStore.updateGroupRoomVisibility(this.props.groupId, roomId, isPublic).catch((err) => {
            console.error(`Error whilst changing visibility of ${roomId} in ${groupId} to ${isPublic}`, err);
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createTrackedDialog('Failed to remove room from group', '', ErrorDialog, {
                title: _t("Something went wrong!"),
                description: _t(
                    "The visibility of '%(roomName)s' in %(groupId)s could not be updated.",
                    {roomName, groupId},
                ),
            });
        }).finally(() => {
            this.setState({
                groupRoomPublicityLoading: false,
            });
        });
    },

    render: function() {
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        const InlineSpinner = sdk.getComponent('elements.InlineSpinner');
        if (this.state.groupRoomRemoveLoading || !this.state.groupRoom) {
            const Spinner = sdk.getComponent("elements.Spinner");
            return <div className="mx_MemberInfo">
                <Spinner />
            </div>;
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
                    <h3>
                        { _t('Visibility in Room List') }
                        { this.state.groupRoomPublicityLoading ?
                            <InlineSpinner /> : <div />
                        }
                    </h3>
                    <div>
                        <label>
                            <input type="radio"
                                value="public"
                                checked={this.state.groupRoom.isPublic}
                                onChange={this._changeGroupRoomPublicity}
                            />
                            <div className="mx_MemberInfo_label_text">
                                { _t('Visible to everyone') }
                            </div>
                        </label>
                    </div>
                    <div>
                        <label>
                            <input type="radio"
                                value="private"
                                checked={!this.state.groupRoom.isPublic}
                                onChange={this._changeGroupRoomPublicity}
                            />
                            <div className="mx_MemberInfo_label_text">
                                { _t('Only visible to community members') }
                            </div>
                        </label>
                    </div>
                </div>;
        }

        const avatarUrl = this.state.groupRoom.avatarUrl;
        let avatarElement;
        if (avatarUrl) {
            const httpUrl = this.context.mxcUrlToHttp(avatarUrl, 800, 800);
            avatarElement = (<div className="mx_MemberInfo_avatar">
                            <img src={httpUrl} />
                        </div>);
        }

        const groupRoomName = this.state.groupRoom.displayname;
        return (
            <div className="mx_MemberInfo" role="tabpanel">
                <AutoHideScrollbar>
                    <AccessibleButton className="mx_MemberInfo_cancel" onClick={this._onCancel}>
                        <img src={require("../../../../res/img/cancel.svg")} width="18" height="18" className="mx_filterFlipColor" />
                    </AccessibleButton>
                    { avatarElement }

                    <h2>{ groupRoomName }</h2>

                    <div className="mx_MemberInfo_profile">
                        <div className="mx_MemberInfo_profileField">
                            { this.state.groupRoom.canonicalAlias }
                        </div>
                    </div>

                    { adminTools }
                </AutoHideScrollbar>
            </div>
        );
    },
});
