/*
Copyright 2017 Vector Creations Ltd.
Copyright 2017, 2018 New Vector Ltd.
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
import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';
import {MatrixClientPeg} from '../../MatrixClientPeg';
import * as sdk from '../../index';
import dis from '../../dispatcher/dispatcher';
import { getHostingLink } from '../../utils/HostingLink';
import { sanitizedHtmlNode } from '../../HtmlUtils';
import { _t, _td } from '../../languageHandler';
import AccessibleButton from '../views/elements/AccessibleButton';
import GroupHeaderButtons from '../views/right_panel/GroupHeaderButtons';
import MainSplit from './MainSplit';
import RightPanel from './RightPanel';
import Modal from '../../Modal';
import classnames from 'classnames';

import GroupStore from '../../stores/GroupStore';
import FlairStore from '../../stores/FlairStore';
import { showGroupAddRoomDialog } from '../../GroupAddressPicker';
import {makeGroupPermalink, makeUserPermalink} from "../../utils/permalinks/Permalinks";
import {Group} from "matrix-js-sdk";
import {allSettled, sleep} from "../../utils/promise";
import RightPanelStore from "../../stores/RightPanelStore";
import AutoHideScrollbar from "./AutoHideScrollbar";

const LONG_DESC_PLACEHOLDER = _td(
`<h1>HTML for your community's page</h1>
<p>
    Use the long description to introduce new members to the community, or distribute
    some important <a href="foo">links</a>
</p>
<p>
    You can even use 'img' tags
</p>
`);

const RoomSummaryType = PropTypes.shape({
    room_id: PropTypes.string.isRequired,
    profile: PropTypes.shape({
        name: PropTypes.string,
        avatar_url: PropTypes.string,
        canonical_alias: PropTypes.string,
    }).isRequired,
});

const UserSummaryType = PropTypes.shape({
    summaryInfo: PropTypes.shape({
        user_id: PropTypes.string.isRequired,
        role_id: PropTypes.string,
        avatar_url: PropTypes.string,
        displayname: PropTypes.string,
    }).isRequired,
});

const CategoryRoomList = createReactClass({
    displayName: 'CategoryRoomList',

    props: {
        rooms: PropTypes.arrayOf(RoomSummaryType).isRequired,
        category: PropTypes.shape({
            profile: PropTypes.shape({
                name: PropTypes.string,
            }).isRequired,
        }),
        groupId: PropTypes.string.isRequired,

        // Whether the list should be editable
        editing: PropTypes.bool.isRequired,
    },

    onAddRoomsToSummaryClicked: function(ev) {
        ev.preventDefault();
        const AddressPickerDialog = sdk.getComponent("dialogs.AddressPickerDialog");
        Modal.createTrackedDialog('Add Rooms to Group Summary', '', AddressPickerDialog, {
            title: _t('Add rooms to the community summary'),
            description: _t("Which rooms would you like to add to this summary?"),
            placeholder: _t("Room name or address"),
            button: _t("Add to summary"),
            pickerType: 'room',
            validAddressTypes: ['mx-room-id'],
            groupId: this.props.groupId,
            onFinished: (success, addrs) => {
                if (!success) return;
                const errorList = [];
                allSettled(addrs.map((addr) => {
                    return GroupStore
                        .addRoomToGroupSummary(this.props.groupId, addr.address)
                        .catch(() => { errorList.push(addr.address); });
                })).then(() => {
                    if (errorList.length === 0) {
                        return;
                    }
                    const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                    Modal.createTrackedDialog(
                        'Failed to add the following room to the group summary',
                        '', ErrorDialog,
                    {
                        title: _t(
                            "Failed to add the following rooms to the summary of %(groupId)s:",
                            {groupId: this.props.groupId},
                        ),
                        description: errorList.join(", "),
                    });
                });
            },
        }, /*className=*/null, /*isPriority=*/false, /*isStatic=*/true);
    },

    render: function() {
        const TintableSvg = sdk.getComponent("elements.TintableSvg");
        const addButton = this.props.editing ?
            (<AccessibleButton className="mx_GroupView_featuredThings_addButton"
                onClick={this.onAddRoomsToSummaryClicked}
            >
                <TintableSvg src={require("../../../res/img/icons-create-room.svg")} width="64" height="64" />
                <div className="mx_GroupView_featuredThings_addButton_label">
                    { _t('Add a Room') }
                </div>
            </AccessibleButton>) : <div />;

        const roomNodes = this.props.rooms.map((r) => {
            return <FeaturedRoom
                key={r.room_id}
                groupId={this.props.groupId}
                editing={this.props.editing}
                summaryInfo={r} />;
        });

        let catHeader = <div />;
        if (this.props.category && this.props.category.profile) {
            catHeader = <div className="mx_GroupView_featuredThings_category">
            { this.props.category.profile.name }
        </div>;
        }
        return <div className="mx_GroupView_featuredThings_container">
            { catHeader }
            { roomNodes }
            { addButton }
        </div>;
    },
});

const FeaturedRoom = createReactClass({
    displayName: 'FeaturedRoom',

    props: {
        summaryInfo: RoomSummaryType.isRequired,
        editing: PropTypes.bool.isRequired,
        groupId: PropTypes.string.isRequired,
    },

    onClick: function(e) {
        e.preventDefault();
        e.stopPropagation();

        dis.dispatch({
            action: 'view_room',
            room_alias: this.props.summaryInfo.profile.canonical_alias,
            room_id: this.props.summaryInfo.room_id,
        });
    },

    onDeleteClicked: function(e) {
        e.preventDefault();
        e.stopPropagation();
        GroupStore.removeRoomFromGroupSummary(
            this.props.groupId,
            this.props.summaryInfo.room_id,
        ).catch((err) => {
            console.error('Error whilst removing room from group summary', err);
            const roomName = this.props.summaryInfo.name ||
                this.props.summaryInfo.canonical_alias ||
                this.props.summaryInfo.room_id;
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createTrackedDialog(
                'Failed to remove room from group summary',
                '', ErrorDialog,
            {
                title: _t(
                    "Failed to remove the room from the summary of %(groupId)s",
                    {groupId: this.props.groupId},
                ),
                description: _t("The room '%(roomName)s' could not be removed from the summary.", {roomName}),
            });
        });
    },

    render: function() {
        const RoomAvatar = sdk.getComponent("avatars.RoomAvatar");

        const roomName = this.props.summaryInfo.profile.name ||
            this.props.summaryInfo.profile.canonical_alias ||
            _t("Unnamed Room");

        const oobData = {
            roomId: this.props.summaryInfo.room_id,
            avatarUrl: this.props.summaryInfo.profile.avatar_url,
            name: roomName,
        };

        let permalink = null;
        if (this.props.summaryInfo.profile && this.props.summaryInfo.profile.canonical_alias) {
            permalink = makeGroupPermalink(this.props.summaryInfo.profile.canonical_alias);
        }

        let roomNameNode = null;
        if (permalink) {
            roomNameNode = <a href={permalink} onClick={this.onClick} >{ roomName }</a>;
        } else {
            roomNameNode = <span>{ roomName }</span>;
        }

        const deleteButton = this.props.editing ?
            <img
                className="mx_GroupView_featuredThing_deleteButton"
                src={require("../../../res/img/cancel-small.svg")}
                width="14"
                height="14"
                alt="Delete"
                onClick={this.onDeleteClicked} />
            : <div />;

        return <AccessibleButton className="mx_GroupView_featuredThing" onClick={this.onClick}>
            <RoomAvatar oobData={oobData} width={64} height={64} />
            <div className="mx_GroupView_featuredThing_name">{ roomNameNode }</div>
            { deleteButton }
        </AccessibleButton>;
    },
});

const RoleUserList = createReactClass({
    displayName: 'RoleUserList',

    props: {
        users: PropTypes.arrayOf(UserSummaryType).isRequired,
        role: PropTypes.shape({
            profile: PropTypes.shape({
                name: PropTypes.string,
            }).isRequired,
        }),
        groupId: PropTypes.string.isRequired,

        // Whether the list should be editable
        editing: PropTypes.bool.isRequired,
    },

    onAddUsersClicked: function(ev) {
        ev.preventDefault();
        const AddressPickerDialog = sdk.getComponent("dialogs.AddressPickerDialog");
        Modal.createTrackedDialog('Add Users to Group Summary', '', AddressPickerDialog, {
            title: _t('Add users to the community summary'),
            description: _t("Who would you like to add to this summary?"),
            placeholder: _t("Name or Matrix ID"),
            button: _t("Add to summary"),
            validAddressTypes: ['mx-user-id'],
            groupId: this.props.groupId,
            shouldOmitSelf: false,
            onFinished: (success, addrs) => {
                if (!success) return;
                const errorList = [];
                allSettled(addrs.map((addr) => {
                    return GroupStore
                        .addUserToGroupSummary(addr.address)
                        .catch(() => { errorList.push(addr.address); });
                })).then(() => {
                    if (errorList.length === 0) {
                        return;
                    }
                    const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                    Modal.createTrackedDialog(
                        'Failed to add the following users to the community summary',
                        '', ErrorDialog,
                    {
                        title: _t(
                            "Failed to add the following users to the summary of %(groupId)s:",
                            {groupId: this.props.groupId},
                        ),
                        description: errorList.join(", "),
                    });
                });
            },
        }, /*className=*/null, /*isPriority=*/false, /*isStatic=*/true);
    },

    render: function() {
        const TintableSvg = sdk.getComponent("elements.TintableSvg");
        const addButton = this.props.editing ?
            (<AccessibleButton className="mx_GroupView_featuredThings_addButton" onClick={this.onAddUsersClicked}>
                 <TintableSvg src={require("../../../res/img/icons-create-room.svg")} width="64" height="64" />
                 <div className="mx_GroupView_featuredThings_addButton_label">
                     { _t('Add a User') }
                 </div>
             </AccessibleButton>) : <div />;
        const userNodes = this.props.users.map((u) => {
            return <FeaturedUser
                key={u.user_id}
                summaryInfo={u}
                editing={this.props.editing}
                groupId={this.props.groupId} />;
        });
        let roleHeader = <div />;
        if (this.props.role && this.props.role.profile) {
            roleHeader = <div className="mx_GroupView_featuredThings_category">{ this.props.role.profile.name }</div>;
        }
        return <div className="mx_GroupView_featuredThings_container">
            { roleHeader }
            { userNodes }
            { addButton }
        </div>;
    },
});

const FeaturedUser = createReactClass({
    displayName: 'FeaturedUser',

    props: {
        summaryInfo: UserSummaryType.isRequired,
        editing: PropTypes.bool.isRequired,
        groupId: PropTypes.string.isRequired,
    },

    onClick: function(e) {
        e.preventDefault();
        e.stopPropagation();

        dis.dispatch({
            action: 'view_start_chat_or_reuse',
            user_id: this.props.summaryInfo.user_id,
        });
    },

    onDeleteClicked: function(e) {
        e.preventDefault();
        e.stopPropagation();
        GroupStore.removeUserFromGroupSummary(
            this.props.groupId,
            this.props.summaryInfo.user_id,
        ).catch((err) => {
            console.error('Error whilst removing user from group summary', err);
            const displayName = this.props.summaryInfo.displayname || this.props.summaryInfo.user_id;
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createTrackedDialog(
                'Failed to remove user from community summary',
                '', ErrorDialog,
            {
                title: _t(
                    "Failed to remove a user from the summary of %(groupId)s",
                    {groupId: this.props.groupId},
                ),
                description: _t("The user '%(displayName)s' could not be removed from the summary.", {displayName}),
            });
        });
    },

    render: function() {
        const BaseAvatar = sdk.getComponent("avatars.BaseAvatar");
        const name = this.props.summaryInfo.displayname || this.props.summaryInfo.user_id;

        const permalink = makeUserPermalink(this.props.summaryInfo.user_id);
        const userNameNode = <a href={permalink} onClick={this.onClick}>{ name }</a>;
        const httpUrl = MatrixClientPeg.get()
            .mxcUrlToHttp(this.props.summaryInfo.avatar_url, 64, 64);

        const deleteButton = this.props.editing ?
            <img
                className="mx_GroupView_featuredThing_deleteButton"
                src={require("../../../res/img/cancel-small.svg")}
                width="14"
                height="14"
                alt="Delete"
                onClick={this.onDeleteClicked} />
            : <div />;

        return <AccessibleButton className="mx_GroupView_featuredThing" onClick={this.onClick}>
            <BaseAvatar name={name} url={httpUrl} width={64} height={64} />
            <div className="mx_GroupView_featuredThing_name">{ userNameNode }</div>
            { deleteButton }
        </AccessibleButton>;
    },
});

const GROUP_JOINPOLICY_OPEN = "open";
const GROUP_JOINPOLICY_INVITE = "invite";

export default createReactClass({
    displayName: 'GroupView',

    propTypes: {
        groupId: PropTypes.string.isRequired,
        // Whether this is the first time the group admin is viewing the group
        groupIsNew: PropTypes.bool,
    },

    getInitialState: function() {
        return {
            summary: null,
            isGroupPublicised: null,
            isUserPrivileged: null,
            groupRooms: null,
            groupRoomsLoading: null,
            error: null,
            editing: false,
            saving: false,
            uploadingAvatar: false,
            avatarChanged: false,
            membershipBusy: false,
            publicityBusy: false,
            inviterProfile: null,
            showRightPanel: RightPanelStore.getSharedInstance().isOpenForGroup,
        };
    },

    componentDidMount: function() {
        this._unmounted = false;
        this._matrixClient = MatrixClientPeg.get();
        this._matrixClient.on("Group.myMembership", this._onGroupMyMembership);

        this._initGroupStore(this.props.groupId, true);

        this._dispatcherRef = dis.register(this._onAction);
        this._rightPanelStoreToken = RightPanelStore.getSharedInstance().addListener(this._onRightPanelStoreUpdate);
    },

    componentWillUnmount: function() {
        this._unmounted = true;
        this._matrixClient.removeListener("Group.myMembership", this._onGroupMyMembership);
        dis.unregister(this._dispatcherRef);

        // Remove RightPanelStore listener
        if (this._rightPanelStoreToken) {
            this._rightPanelStoreToken.remove();
        }
    },

    // TODO: [REACT-WARNING] Replace with appropriate lifecycle event
    UNSAFE_componentWillReceiveProps: function(newProps) {
        if (this.props.groupId !== newProps.groupId) {
            this.setState({
                summary: null,
                error: null,
            }, () => {
                this._initGroupStore(newProps.groupId);
            });
        }
    },

    _onRightPanelStoreUpdate: function() {
        this.setState({
            showRightPanel: RightPanelStore.getSharedInstance().isOpenForGroup,
        });
    },

    _onGroupMyMembership: function(group) {
        if (this._unmounted || group.groupId !== this.props.groupId) return;
        if (group.myMembership === 'leave') {
            // Leave settings - the user might have clicked the "Leave" button
            this._closeSettings();
        }
        this.setState({membershipBusy: false});
    },

    _initGroupStore: function(groupId, firstInit) {
        const group = this._matrixClient.getGroup(groupId);
        if (group && group.inviter && group.inviter.userId) {
            this._fetchInviterProfile(group.inviter.userId);
        }
        GroupStore.registerListener(groupId, this.onGroupStoreUpdated.bind(this, firstInit));
        let willDoOnboarding = false;
        // XXX: This should be more fluxy - let's get the error from GroupStore .getError or something
        GroupStore.on('error', (err, errorGroupId, stateKey) => {
            if (this._unmounted || groupId !== errorGroupId) return;
            if (err.errcode === 'M_GUEST_ACCESS_FORBIDDEN' && !willDoOnboarding) {
                dis.dispatch({
                    action: 'do_after_sync_prepared',
                    deferred_action: {
                        action: 'view_group',
                        group_id: groupId,
                    },
                });
                dis.dispatch({action: 'require_registration', screen_after: {screen: `group/${groupId}`}});
                willDoOnboarding = true;
            }
            if (stateKey === GroupStore.STATE_KEY.Summary) {
                this.setState({
                    summary: null,
                    error: err,
                    editing: false,
                });
            }
        });
    },

    onGroupStoreUpdated(firstInit) {
        if (this._unmounted) return;
        const summary = GroupStore.getSummary(this.props.groupId);
        if (summary.profile) {
            // Default profile fields should be "" for later sending to the server (which
            // requires that the fields are strings, not null)
            ["avatar_url", "long_description", "name", "short_description"].forEach((k) => {
                summary.profile[k] = summary.profile[k] || "";
            });
        }
        this.setState({
            summary,
            summaryLoading: !GroupStore.isStateReady(this.props.groupId, GroupStore.STATE_KEY.Summary),
            isGroupPublicised: GroupStore.getGroupPublicity(this.props.groupId),
            isUserPrivileged: GroupStore.isUserPrivileged(this.props.groupId),
            groupRooms: GroupStore.getGroupRooms(this.props.groupId),
            groupRoomsLoading: !GroupStore.isStateReady(this.props.groupId, GroupStore.STATE_KEY.GroupRooms),
            isUserMember: GroupStore.getGroupMembers(this.props.groupId).some(
                (m) => m.userId === this._matrixClient.credentials.userId,
            ),
        });
        // XXX: This might not work but this.props.groupIsNew unused anyway
        if (this.props.groupIsNew && firstInit) {
            this._onEditClick();
        }
    },

    _fetchInviterProfile(userId) {
        this.setState({
            inviterProfileBusy: true,
        });
        this._matrixClient.getProfileInfo(userId).then((resp) => {
            if (this._unmounted) return;
            this.setState({
                inviterProfile: {
                    avatarUrl: resp.avatar_url,
                    displayName: resp.displayname,
                },
            });
        }).catch((e) => {
            console.error('Error getting group inviter profile', e);
        }).finally(() => {
            if (this._unmounted) return;
            this.setState({
                inviterProfileBusy: false,
            });
        });
    },

    _onEditClick: function() {
        this.setState({
            editing: true,
            profileForm: Object.assign({}, this.state.summary.profile),
            joinableForm: {
                policyType:
                    this.state.summary.profile.is_openly_joinable ?
                        GROUP_JOINPOLICY_OPEN :
                        GROUP_JOINPOLICY_INVITE,
            },
        });
    },

    _onShareClick: function() {
        const ShareDialog = sdk.getComponent("dialogs.ShareDialog");
        Modal.createTrackedDialog('share community dialog', '', ShareDialog, {
            target: this._matrixClient.getGroup(this.props.groupId) || new Group(this.props.groupId),
        });
    },

    _onCancelClick: function() {
        this._closeSettings();
    },

    _onAction(payload) {
        switch (payload.action) {
            // NOTE: close_settings is an app-wide dispatch; as it is dispatched from MatrixChat
            case 'close_settings':
                this.setState({
                    editing: false,
                    profileForm: null,
                });
                break;
            default:
                break;
        }
    },

    _closeSettings() {
        dis.dispatch({action: 'close_settings'});
    },

    _onNameChange: function(value) {
        const newProfileForm = Object.assign(this.state.profileForm, { name: value });
        this.setState({
            profileForm: newProfileForm,
        });
    },

    _onShortDescChange: function(value) {
        const newProfileForm = Object.assign(this.state.profileForm, { short_description: value });
        this.setState({
            profileForm: newProfileForm,
        });
    },

    _onLongDescChange: function(e) {
        const newProfileForm = Object.assign(this.state.profileForm, { long_description: e.target.value });
        this.setState({
            profileForm: newProfileForm,
        });
    },

    _onAvatarSelected: function(ev) {
        const file = ev.target.files[0];
        if (!file) return;

        this.setState({uploadingAvatar: true});
        this._matrixClient.uploadContent(file).then((url) => {
            const newProfileForm = Object.assign(this.state.profileForm, { avatar_url: url });
            this.setState({
                uploadingAvatar: false,
                profileForm: newProfileForm,

                // Indicate that FlairStore needs to be poked to show this change
                // in TagTile (TagPanel), Flair and GroupTile (MyGroups).
                avatarChanged: true,
            });
        }).catch((e) => {
            this.setState({uploadingAvatar: false});
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            console.error("Failed to upload avatar image", e);
            Modal.createTrackedDialog('Failed to upload image', '', ErrorDialog, {
                title: _t('Error'),
                description: _t('Failed to upload image'),
            });
        });
    },

    _onJoinableChange: function(ev) {
        this.setState({
            joinableForm: { policyType: ev.target.value },
        });
    },

    _onSaveClick: function() {
        this.setState({saving: true});
        const savePromise = this.state.isUserPrivileged ? this._saveGroup() : Promise.resolve();
        savePromise.then((result) => {
            this.setState({
                saving: false,
                editing: false,
                summary: null,
            });
            dis.dispatch({action: 'panel_disable'});
            this._initGroupStore(this.props.groupId);

            if (this.state.avatarChanged) {
                // XXX: Evil - poking a store should be done from an async action
                FlairStore.refreshGroupProfile(this._matrixClient, this.props.groupId);
            }
        }).catch((e) => {
            this.setState({
                saving: false,
            });
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            console.error("Failed to save community profile", e);
            Modal.createTrackedDialog('Failed to update group', '', ErrorDialog, {
                title: _t('Error'),
                description: _t('Failed to update community'),
            });
        }).finally(() => {
            this.setState({
                avatarChanged: false,
            });
        });
    },

    _saveGroup: async function() {
        await this._matrixClient.setGroupProfile(this.props.groupId, this.state.profileForm);
        await this._matrixClient.setGroupJoinPolicy(this.props.groupId, {
            type: this.state.joinableForm.policyType,
        });
    },

    _onAcceptInviteClick: async function() {
        this.setState({membershipBusy: true});

        // Wait 500ms to prevent flashing. Do this before sending a request otherwise we risk the
        // spinner disappearing after we have fetched new group data.
        await sleep(500);

        GroupStore.acceptGroupInvite(this.props.groupId).then(() => {
            // don't reset membershipBusy here: wait for the membership change to come down the sync
        }).catch((e) => {
            this.setState({membershipBusy: false});
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createTrackedDialog('Error accepting invite', '', ErrorDialog, {
                title: _t("Error"),
                description: _t("Unable to accept invite"),
            });
        });
    },

    _onRejectInviteClick: async function() {
        this.setState({membershipBusy: true});

        // Wait 500ms to prevent flashing. Do this before sending a request otherwise we risk the
        // spinner disappearing after we have fetched new group data.
        await sleep(500);

        GroupStore.leaveGroup(this.props.groupId).then(() => {
            // don't reset membershipBusy here: wait for the membership change to come down the sync
        }).catch((e) => {
            this.setState({membershipBusy: false});
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createTrackedDialog('Error rejecting invite', '', ErrorDialog, {
                title: _t("Error"),
                description: _t("Unable to reject invite"),
            });
        });
    },

    _onJoinClick: async function() {
        if (this._matrixClient.isGuest()) {
            dis.dispatch({action: 'require_registration', screen_after: {screen: `group/${this.props.groupId}`}});
            return;
        }

        this.setState({membershipBusy: true});

        // Wait 500ms to prevent flashing. Do this before sending a request otherwise we risk the
        // spinner disappearing after we have fetched new group data.
        await sleep(500);

        GroupStore.joinGroup(this.props.groupId).then(() => {
            // don't reset membershipBusy here: wait for the membership change to come down the sync
        }).catch((e) => {
            this.setState({membershipBusy: false});
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createTrackedDialog('Error joining room', '', ErrorDialog, {
                title: _t("Error"),
                description: _t("Unable to join community"),
            });
        });
    },

    _leaveGroupWarnings: function() {
        const warnings = [];

        if (this.state.isUserPrivileged) {
            warnings.push((
                <span className="warning">
                    { " " /* Whitespace, otherwise the sentences get smashed together */ }
                    { _t("You are an administrator of this community. You will not be " +
                         "able to rejoin without an invite from another administrator.") }
                </span>
            ));
        }

        return warnings;
    },


    _onLeaveClick: function() {
        const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
        const warnings = this._leaveGroupWarnings();

        Modal.createTrackedDialog('Leave Group', '', QuestionDialog, {
            title: _t("Leave Community"),
            description: (
                <span>
                { _t("Leave %(groupName)s?", {groupName: this.props.groupId}) }
                { warnings }
                </span>
            ),
            button: _t("Leave"),
            danger: this.state.isUserPrivileged,
            onFinished: async (confirmed) => {
                if (!confirmed) return;

                this.setState({membershipBusy: true});

                // Wait 500ms to prevent flashing. Do this before sending a request otherwise we risk the
                // spinner disappearing after we have fetched new group data.
                await sleep(500);

                GroupStore.leaveGroup(this.props.groupId).then(() => {
                    // don't reset membershipBusy here: wait for the membership change to come down the sync
                }).catch((e) => {
                    this.setState({membershipBusy: false});
                    const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                    Modal.createTrackedDialog('Error leaving community', '', ErrorDialog, {
                        title: _t("Error"),
                        description: _t("Unable to leave community"),
                    });
                });
            },
        });
    },

    _onAddRoomsClick: function() {
        showGroupAddRoomDialog(this.props.groupId);
    },

    _getGroupSection: function() {
        const groupSettingsSectionClasses = classnames({
            "mx_GroupView_group": this.state.editing,
            "mx_GroupView_group_disabled": this.state.editing && !this.state.isUserPrivileged,
        });

        const header = this.state.editing ? <h2> { _t('Community Settings') } </h2> : <div />;

        const hostingSignupLink = getHostingLink('community-settings');
        let hostingSignup = null;
        if (hostingSignupLink && this.state.isUserPrivileged) {
            hostingSignup = <div className="mx_GroupView_hostingSignup">
                {_t(
                    "Want more than a community? <a>Get your own server</a>", {},
                    {
                        a: sub => <a href={hostingSignupLink} target="_blank" rel="noreferrer noopener">{sub}</a>,
                    },
                )}
                <a href={hostingSignupLink} target="_blank" rel="noreferrer noopener">
                    <img src={require("../../../res/img/external-link.svg")} width="11" height="10" alt='' />
                </a>
            </div>;
        }

        const changeDelayWarning = this.state.editing && this.state.isUserPrivileged ?
            <div className="mx_GroupView_changeDelayWarning">
                { _t(
                    'Changes made to your community <bold1>name</bold1> and <bold2>avatar</bold2> ' +
                    'might not be seen by other users for up to 30 minutes.',
                    {},
                    {
                        'bold1': (sub) => <b> { sub } </b>,
                        'bold2': (sub) => <b> { sub } </b>,
                    },
                ) }
            </div> : <div />;
        return <div className={groupSettingsSectionClasses}>
            { header }
            { hostingSignup }
            { changeDelayWarning }
            { this._getJoinableNode() }
            { this._getLongDescriptionNode() }
            { this._getRoomsNode() }
        </div>;
    },

    _getRoomsNode: function() {
        const RoomDetailList = sdk.getComponent('rooms.RoomDetailList');
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        const TintableSvg = sdk.getComponent('elements.TintableSvg');
        const Spinner = sdk.getComponent('elements.Spinner');
        const TooltipButton = sdk.getComponent('elements.TooltipButton');

        const roomsHelpNode = this.state.editing ? <TooltipButton helpText={
            _t(
                'These rooms are displayed to community members on the community page. '+
                'Community members can join the rooms by clicking on them.',
            )
        } /> : <div />;

        const addRoomRow = this.state.editing ?
            (<AccessibleButton className="mx_GroupView_rooms_header_addRow"
                onClick={this._onAddRoomsClick}
            >
                <div className="mx_GroupView_rooms_header_addRow_button">
                    <TintableSvg src={require("../../../res/img/icons-room-add.svg")} width="24" height="24" />
                </div>
                <div className="mx_GroupView_rooms_header_addRow_label">
                    { _t('Add rooms to this community') }
                </div>
            </AccessibleButton>) : <div />;
        const roomDetailListClassName = classnames({
            "mx_fadable": true,
            "mx_fadable_faded": this.state.editing,
        });
        return <div className="mx_GroupView_rooms">
            <div className="mx_GroupView_rooms_header">
                <h3>
                    { _t('Rooms') }
                    { roomsHelpNode }
                </h3>
                { addRoomRow }
            </div>
            { this.state.groupRoomsLoading ?
                <Spinner /> :
                <RoomDetailList
                    rooms={this.state.groupRooms}
                    className={roomDetailListClassName} />
            }
        </div>;
    },

    _getFeaturedRoomsNode: function() {
        const summary = this.state.summary;

        const defaultCategoryRooms = [];
        const categoryRooms = {};
        summary.rooms_section.rooms.forEach((r) => {
            if (r.category_id === null) {
                defaultCategoryRooms.push(r);
            } else {
                let list = categoryRooms[r.category_id];
                if (list === undefined) {
                    list = [];
                    categoryRooms[r.category_id] = list;
                }
                list.push(r);
            }
        });

        const defaultCategoryNode = <CategoryRoomList
            rooms={defaultCategoryRooms}
            groupId={this.props.groupId}
            editing={this.state.editing} />;
        const categoryRoomNodes = Object.keys(categoryRooms).map((catId) => {
            const cat = summary.rooms_section.categories[catId];
            return <CategoryRoomList
                key={catId}
                rooms={categoryRooms[catId]}
                category={cat}
                groupId={this.props.groupId}
                editing={this.state.editing} />;
        });

        return <div className="mx_GroupView_featuredThings">
            <div className="mx_GroupView_featuredThings_header">
                { _t('Featured Rooms:') }
            </div>
            { defaultCategoryNode }
            { categoryRoomNodes }
        </div>;
    },

    _getFeaturedUsersNode: function() {
        const summary = this.state.summary;

        const noRoleUsers = [];
        const roleUsers = {};
        summary.users_section.users.forEach((u) => {
            if (u.role_id === null) {
                noRoleUsers.push(u);
            } else {
                let list = roleUsers[u.role_id];
                if (list === undefined) {
                    list = [];
                    roleUsers[u.role_id] = list;
                }
                list.push(u);
            }
        });

        const noRoleNode = <RoleUserList
            users={noRoleUsers}
            groupId={this.props.groupId}
            editing={this.state.editing} />;
        const roleUserNodes = Object.keys(roleUsers).map((roleId) => {
            const role = summary.users_section.roles[roleId];
            return <RoleUserList
                key={roleId}
                users={roleUsers[roleId]}
                role={role}
                groupId={this.props.groupId}
                editing={this.state.editing} />;
        });

        return <div className="mx_GroupView_featuredThings">
            <div className="mx_GroupView_featuredThings_header">
                { _t('Featured Users:') }
            </div>
            { noRoleNode }
            { roleUserNodes }
        </div>;
    },

    _getMembershipSection: function() {
        const Spinner = sdk.getComponent("elements.Spinner");
        const BaseAvatar = sdk.getComponent("avatars.BaseAvatar");

        const group = this._matrixClient.getGroup(this.props.groupId);

        if (group && group.myMembership === 'invite') {
            if (this.state.membershipBusy || this.state.inviterProfileBusy) {
                return <div className="mx_GroupView_membershipSection">
                    <Spinner />
                </div>;
            }
            const httpInviterAvatar = this.state.inviterProfile ?
                this._matrixClient.mxcUrlToHttp(
                    this.state.inviterProfile.avatarUrl, 36, 36,
                ) : null;

            let inviterName = group.inviter.userId;
            if (this.state.inviterProfile) {
                inviterName = this.state.inviterProfile.displayName || group.inviter.userId;
            }
            return <div className="mx_GroupView_membershipSection mx_GroupView_membershipSection_invited">
                <div className="mx_GroupView_membershipSubSection">
                    <div className="mx_GroupView_membershipSection_description">
                        <BaseAvatar url={httpInviterAvatar}
                            name={inviterName}
                            width={36}
                            height={36}
                        />
                        { _t("%(inviter)s has invited you to join this community", {
                            inviter: inviterName,
                        }) }
                    </div>
                    <div className="mx_GroupView_membership_buttonContainer">
                        <AccessibleButton className="mx_GroupView_textButton mx_RoomHeader_textButton"
                            onClick={this._onAcceptInviteClick}
                        >
                            { _t("Accept") }
                        </AccessibleButton>
                        <AccessibleButton className="mx_GroupView_textButton mx_RoomHeader_textButton"
                            onClick={this._onRejectInviteClick}
                        >
                            { _t("Decline") }
                        </AccessibleButton>
                    </div>
                </div>
            </div>;
        }

        let membershipContainerExtraClasses;
        let membershipButtonExtraClasses;
        let membershipButtonTooltip;
        let membershipButtonText;
        let membershipButtonOnClick;

        // User is not in the group
        if ((!group || group.myMembership === 'leave') &&
            this.state.summary &&
            this.state.summary.profile &&
            Boolean(this.state.summary.profile.is_openly_joinable)
        ) {
            membershipButtonText = _t("Join this community");
            membershipButtonOnClick = this._onJoinClick;

            membershipButtonExtraClasses = 'mx_GroupView_joinButton';
            membershipContainerExtraClasses = 'mx_GroupView_membershipSection_leave';
        } else if (
            group &&
            group.myMembership === 'join' &&
            this.state.editing
        ) {
            membershipButtonText = _t("Leave this community");
            membershipButtonOnClick = this._onLeaveClick;
            membershipButtonTooltip = this.state.isUserPrivileged ?
                _t("You are an administrator of this community") :
                _t("You are a member of this community");

            membershipButtonExtraClasses = {
                'mx_GroupView_leaveButton': true,
                'mx_RoomHeader_textButton_danger': this.state.isUserPrivileged,
            };
            membershipContainerExtraClasses = 'mx_GroupView_membershipSection_joined';
        } else {
            return null;
        }

        const membershipButtonClasses = classnames([
            'mx_RoomHeader_textButton',
            'mx_GroupView_textButton',
        ],
            membershipButtonExtraClasses,
        );

        const membershipContainerClasses = classnames(
            'mx_GroupView_membershipSection',
            membershipContainerExtraClasses,
        );

        return <div className={membershipContainerClasses}>
            <div className="mx_GroupView_membershipSubSection">
                { /* The <div /> is for flex alignment */ }
                { this.state.membershipBusy ? <Spinner /> : <div /> }
                <div className="mx_GroupView_membership_buttonContainer">
                    <AccessibleButton
                        className={membershipButtonClasses}
                        onClick={membershipButtonOnClick}
                        title={membershipButtonTooltip}
                    >
                        { membershipButtonText }
                    </AccessibleButton>
                </div>
            </div>
        </div>;
    },

    _getJoinableNode: function() {
        const InlineSpinner = sdk.getComponent('elements.InlineSpinner');
        return this.state.editing ? <div>
            <h3>
                { _t('Who can join this community?') }
                { this.state.groupJoinableLoading ?
                    <InlineSpinner /> : <div />
                }
            </h3>
            <div>
                <label>
                    <input type="radio"
                        value={GROUP_JOINPOLICY_INVITE}
                        checked={this.state.joinableForm.policyType === GROUP_JOINPOLICY_INVITE}
                        onChange={this._onJoinableChange}
                    />
                    <div className="mx_GroupView_label_text">
                        { _t('Only people who have been invited') }
                    </div>
                </label>
            </div>
            <div>
                <label>
                    <input type="radio"
                        value={GROUP_JOINPOLICY_OPEN}
                        checked={this.state.joinableForm.policyType === GROUP_JOINPOLICY_OPEN}
                        onChange={this._onJoinableChange}
                    />
                    <div className="mx_GroupView_label_text">
                        { _t('Everyone') }
                    </div>
                </label>
            </div>
        </div> : null;
    },

    _getLongDescriptionNode: function() {
        const summary = this.state.summary;
        let description = null;
        if (summary.profile && summary.profile.long_description) {
            description = sanitizedHtmlNode(summary.profile.long_description);
        } else if (this.state.isUserPrivileged) {
            description = <div
                className="mx_GroupView_groupDesc_placeholder"
                onClick={this._onEditClick}
            >
                { _t(
                    'Your community hasn\'t got a Long Description, a HTML page to show to community members.<br />' +
                    'Click here to open settings and give it one!',
                    {},
                    { 'br': <br /> },
                ) }
            </div>;
        }
        const groupDescEditingClasses = classnames({
            "mx_GroupView_groupDesc": true,
            "mx_GroupView_groupDesc_disabled": !this.state.isUserPrivileged,
        });

        return this.state.editing ?
            <div className={groupDescEditingClasses}>
                <h3> { _t("Long Description (HTML)") } </h3>
                <textarea
                    value={this.state.profileForm.long_description}
                    placeholder={_t(LONG_DESC_PLACEHOLDER)}
                    onChange={this._onLongDescChange}
                    tabIndex="4"
                    key="editLongDesc"
                />
            </div> :
            <div className="mx_GroupView_groupDesc">
                { description }
            </div>;
    },

    render: function() {
        const GroupAvatar = sdk.getComponent("avatars.GroupAvatar");
        const Spinner = sdk.getComponent("elements.Spinner");

        if (this.state.summaryLoading && this.state.error === null || this.state.saving) {
            return <Spinner />;
        } else if (this.state.summary && !this.state.error) {
            const summary = this.state.summary;

            let avatarNode;
            let nameNode;
            let shortDescNode;
            const rightButtons = [];
            if (this.state.editing && this.state.isUserPrivileged) {
                let avatarImage;
                if (this.state.uploadingAvatar) {
                    avatarImage = <Spinner />;
                } else {
                    const GroupAvatar = sdk.getComponent('avatars.GroupAvatar');
                    avatarImage = <GroupAvatar groupId={this.props.groupId}
                        groupName={this.state.profileForm.name}
                        groupAvatarUrl={this.state.profileForm.avatar_url}
                        width={28} height={28} resizeMethod='crop'
                    />;
                }

                avatarNode = (
                    <div className="mx_GroupView_avatarPicker">
                        <label htmlFor="avatarInput" className="mx_GroupView_avatarPicker_label">
                            { avatarImage }
                        </label>
                        <div className="mx_GroupView_avatarPicker_edit">
                            <label htmlFor="avatarInput" className="mx_GroupView_avatarPicker_label">
                                <img src={require("../../../res/img/camera.svg")}
                                    alt={_t("Upload avatar")} title={_t("Upload avatar")}
                                    width="17" height="15" />
                            </label>
                            <input id="avatarInput" className="mx_GroupView_uploadInput" type="file" onChange={this._onAvatarSelected} />
                        </div>
                    </div>
                );

                const EditableText = sdk.getComponent("elements.EditableText");

                nameNode = <EditableText
                    className="mx_GroupView_editable"
                    placeholderClassName="mx_GroupView_placeholder"
                    placeholder={_t('Community Name')}
                    blurToCancel={false}
                    initialValue={this.state.profileForm.name}
                    onValueChanged={this._onNameChange}
                    tabIndex="0"
                    dir="auto" />;

                shortDescNode = <EditableText
                    className="mx_GroupView_editable"
                    placeholderClassName="mx_GroupView_placeholder"
                    placeholder={_t("Description")}
                    blurToCancel={false}
                    initialValue={this.state.profileForm.short_description}
                    onValueChanged={this._onShortDescChange}
                    tabIndex="0"
                    dir="auto" />;
            } else {
                const onGroupHeaderItemClick = this.state.isUserMember ? this._onEditClick : null;
                const groupAvatarUrl = summary.profile ? summary.profile.avatar_url : null;
                const groupName = summary.profile ? summary.profile.name : null;
                avatarNode = <GroupAvatar
                    groupId={this.props.groupId}
                    groupAvatarUrl={groupAvatarUrl}
                    groupName={groupName}
                    onClick={onGroupHeaderItemClick}
                    width={28} height={28}
                />;
                if (summary.profile && summary.profile.name) {
                    nameNode = <div onClick={onGroupHeaderItemClick}>
                        <span>{ summary.profile.name }</span>
                        <span className="mx_GroupView_header_groupid">
                            ({ this.props.groupId })
                        </span>
                    </div>;
                } else {
                    nameNode = <span onClick={onGroupHeaderItemClick}>{ this.props.groupId }</span>;
                }
                if (summary.profile && summary.profile.short_description) {
                    shortDescNode = <span onClick={onGroupHeaderItemClick}>{ summary.profile.short_description }</span>;
                }
            }

            if (this.state.editing) {
                rightButtons.push(
                    <AccessibleButton className="mx_GroupView_textButton mx_RoomHeader_textButton"
                        key="_saveButton"
                        onClick={this._onSaveClick}
                    >
                        { _t('Save') }
                    </AccessibleButton>,
                );
                rightButtons.push(
                    <AccessibleButton className="mx_RoomHeader_cancelButton"
                        key="_cancelButton"
                        onClick={this._onCancelClick}
                    >
                        <img src={require("../../../res/img/cancel.svg")} className="mx_filterFlipColor"
                            width="18" height="18" alt={_t("Cancel")} />
                    </AccessibleButton>,
                );
            } else {
                if (summary.user && summary.user.membership === 'join') {
                    rightButtons.push(
                        <AccessibleButton className="mx_GroupHeader_button mx_GroupHeader_editButton"
                            key="_editButton"
                            onClick={this._onEditClick}
                            title={_t("Community Settings")}
                        >
                        </AccessibleButton>,
                    );
                }
                rightButtons.push(
                    <AccessibleButton className="mx_GroupHeader_button mx_GroupHeader_shareButton"
                        key="_shareButton"
                        onClick={this._onShareClick}
                        title={_t('Share Community')}
                    >
                    </AccessibleButton>,
                );
            }

            const rightPanel = this.state.showRightPanel ? <RightPanel groupId={this.props.groupId} /> : undefined;

            const headerClasses = {
                "mx_GroupView_header": true,
                "light-panel": true,
                "mx_GroupView_header_view": !this.state.editing,
                "mx_GroupView_header_isUserMember": this.state.isUserMember,
            };

            return (
                <main className="mx_GroupView">
                    <div className={classnames(headerClasses)}>
                        <div className="mx_GroupView_header_leftCol">
                            <div className="mx_GroupView_header_avatar">
                                { avatarNode }
                            </div>
                            <div className="mx_GroupView_header_info">
                                <div className="mx_GroupView_header_name">
                                    { nameNode }
                                </div>
                                <div className="mx_GroupView_header_shortDesc">
                                    { shortDescNode }
                                </div>
                            </div>
                        </div>
                        <div className="mx_GroupView_header_rightCol">
                            { rightButtons }
                        </div>
                        <GroupHeaderButtons />
                    </div>
                    <MainSplit panel={rightPanel}>
                        <AutoHideScrollbar className="mx_GroupView_body">
                            { this._getMembershipSection() }
                            { this._getGroupSection() }
                        </AutoHideScrollbar>
                    </MainSplit>
                </main>
            );
        } else if (this.state.error) {
            if (this.state.error.httpStatus === 404) {
                return (
                    <div className="mx_GroupView_error">
                        { _t('Community %(groupId)s not found', {groupId: this.props.groupId}) }
                    </div>
                );
            } else {
                let extraText;
                if (this.state.error.errcode === 'M_UNRECOGNIZED') {
                    extraText = <div>{ _t('This homeserver does not support communities') }</div>;
                }
                return (
                    <div className="mx_GroupView_error">
                        { _t('Failed to load %(groupId)s', {groupId: this.props.groupId }) }
                        { extraText }
                    </div>
                );
            }
        } else {
            console.error("Invalid state for GroupView");
            return <div />;
        }
    },
});
