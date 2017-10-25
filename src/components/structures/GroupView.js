/*
Copyright 2017 Vector Creations Ltd.
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
import PropTypes from 'prop-types';
import Promise from 'bluebird';
import MatrixClientPeg from '../../MatrixClientPeg';
import sdk from '../../index';
import dis from '../../dispatcher';
import { sanitizedHtmlNode } from '../../HtmlUtils';
import { _t } from '../../languageHandler';
import AccessibleButton from '../views/elements/AccessibleButton';
import Modal from '../../Modal';
import classnames from 'classnames';

import GroupStoreCache from '../../stores/GroupStoreCache';
import GroupStore from '../../stores/GroupStore';
import { showGroupAddRoomDialog } from '../../GroupAddressPicker';
import GeminiScrollbar from 'react-gemini-scrollbar';

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

const CategoryRoomList = React.createClass({
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
            placeholder: _t("Room name or alias"),
            button: _t("Add to summary"),
            pickerType: 'room',
            validAddressTypes: ['mx-room-id'],
            groupId: this.props.groupId,
            onFinished: (success, addrs) => {
                if (!success) return;
                const errorList = [];
                Promise.all(addrs.map((addr) => {
                    return this.context.groupStore
                        .addRoomToGroupSummary(addr.address)
                        .catch(() => { errorList.push(addr.address); })
                        .reflect();
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
        });
    },

    render: function() {
        const TintableSvg = sdk.getComponent("elements.TintableSvg");
        const addButton = this.props.editing ?
            (<AccessibleButton className="mx_GroupView_featuredThings_addButton"
                onClick={this.onAddRoomsToSummaryClicked}
            >
                <TintableSvg src="img/icons-create-room.svg" width="64" height="64" />
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

const FeaturedRoom = React.createClass({
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
        this.context.groupStore.removeRoomFromGroupSummary(
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
            permalink = 'https://matrix.to/#/' + this.props.summaryInfo.profile.canonical_alias;
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
                src="img/cancel-small.svg"
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

const RoleUserList = React.createClass({
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
            placeholder: _t("Name or matrix ID"),
            button: _t("Add to summary"),
            validAddressTypes: ['mx-user-id'],
            groupId: this.props.groupId,
            shouldOmitSelf: false,
            onFinished: (success, addrs) => {
                if (!success) return;
                const errorList = [];
                Promise.all(addrs.map((addr) => {
                    return this.context.groupStore
                        .addUserToGroupSummary(addr.address)
                        .catch(() => { errorList.push(addr.address); })
                        .reflect();
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
        });
    },

    render: function() {
        const TintableSvg = sdk.getComponent("elements.TintableSvg");
        const addButton = this.props.editing ?
            (<AccessibleButton className="mx_GroupView_featuredThings_addButton" onClick={this.onAddUsersClicked}>
                 <TintableSvg src="img/icons-create-room.svg" width="64" height="64" />
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

const FeaturedUser = React.createClass({
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
            go_home_on_cancel: false,
        });
    },

    onDeleteClicked: function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.context.groupStore.removeUserFromGroupSummary(
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

        const permalink = 'https://matrix.to/#/' + this.props.summaryInfo.user_id;
        const userNameNode = <a href={permalink} onClick={this.onClick}>{ name }</a>;
        const httpUrl = MatrixClientPeg.get()
            .mxcUrlToHttp(this.props.summaryInfo.avatar_url, 64, 64);

        const deleteButton = this.props.editing ?
            <img
                className="mx_GroupView_featuredThing_deleteButton"
                src="img/cancel-small.svg"
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

const GroupContext = {
    groupStore: React.PropTypes.instanceOf(GroupStore).isRequired,
};

CategoryRoomList.contextTypes = GroupContext;
FeaturedRoom.contextTypes = GroupContext;
RoleUserList.contextTypes = GroupContext;
FeaturedUser.contextTypes = GroupContext;

export default React.createClass({
    displayName: 'GroupView',

    propTypes: {
        groupId: PropTypes.string.isRequired,
    },

    childContextTypes: {
        groupStore: React.PropTypes.instanceOf(GroupStore),
    },

    getChildContext: function() {
        return {
            groupStore: this._groupStore,
        };
    },

    getInitialState: function() {
        return {
            summary: null,
            error: null,
            editing: false,
            saving: false,
            uploadingAvatar: false,
            membershipBusy: false,
            publicityBusy: false,
        };
    },

    componentWillMount: function() {
        this._changeAvatarComponent = null;
        this._initGroupStore(this.props.groupId);

        MatrixClientPeg.get().on("Group.myMembership", this._onGroupMyMembership);
    },

    componentWillUnmount: function() {
        MatrixClientPeg.get().removeListener("Group.myMembership", this._onGroupMyMembership);
        this._groupStore.removeAllListeners();
    },

    componentWillReceiveProps: function(newProps) {
        if (this.props.groupId != newProps.groupId) {
            this.setState({
                summary: null,
                error: null,
            }, () => {
                this._initGroupStore(newProps.groupId);
            });
        }
    },

    _onGroupMyMembership: function(group) {
        if (group.groupId !== this.props.groupId) return;

        this.setState({membershipBusy: false});
    },

    _initGroupStore: function(groupId) {
        this._groupStore = GroupStoreCache.getGroupStore(MatrixClientPeg.get(), groupId);
        this._groupStore.on('update', () => {
            const summary = this._groupStore.getSummary();
            if (summary.profile) {
                // Default profile fields should be "" for later sending to the server (which
                // requires that the fields are strings, not null)
                ["avatar_url", "long_description", "name", "short_description"].forEach((k) => {
                    summary.profile[k] = summary.profile[k] || "";
                });
            }
            this.setState({
                summary,
                isGroupPublicised: this._groupStore.getGroupPublicity(),
                isUserPrivileged: this._groupStore.isUserPrivileged(),
                error: null,
            });
        });
        this._groupStore.on('error', (err) => {
            console.error(err);
            this.setState({
                summary: null,
                error: err,
            });
        });
    },

    _onShowRhsClick: function(ev) {
        dis.dispatch({ action: 'show_right_panel' });
    },

    _onEditClick: function() {
        this.setState({
            editing: true,
            profileForm: Object.assign({}, this.state.summary.profile),
        });
        dis.dispatch({
            action: 'panel_disable',
            sideDisabled: true,
        });
    },

    _onCancelClick: function() {
        this.setState({
            editing: false,
            profileForm: null,
        });
        dis.dispatch({action: 'panel_disable'});
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
        MatrixClientPeg.get().uploadContent(file).then((url) => {
            const newProfileForm = Object.assign(this.state.profileForm, { avatar_url: url });
            this.setState({
                uploadingAvatar: false,
                profileForm: newProfileForm,
            });
        }).catch((e) => {
            this.setState({uploadingAvatar: false});
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            console.error("Failed to upload avatar image", e);
            Modal.createTrackedDialog('Failed to upload image', '', ErrorDialog, {
                title: _t('Error'),
                description: _t('Failed to upload image'),
            });
        }).done();
    },

    _onSaveClick: function() {
        this.setState({saving: true});
        const savePromise = this.state.isUserPrivileged ?
            MatrixClientPeg.get().setGroupProfile(this.props.groupId, this.state.profileForm) :
            Promise.resolve();
        savePromise.then((result) => {
            this.setState({
                saving: false,
                editing: false,
                summary: null,
            });
            dis.dispatch({action: 'panel_disable'});
            this._initGroupStore(this.props.groupId);
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
        }).done();
    },

    _onAcceptInviteClick: function() {
        this.setState({membershipBusy: true});
        MatrixClientPeg.get().acceptGroupInvite(this.props.groupId).then(() => {
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

    _onRejectInviteClick: function() {
        this.setState({membershipBusy: true});
        MatrixClientPeg.get().leaveGroup(this.props.groupId).then(() => {
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

    _onLeaveClick: function() {
        const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
        Modal.createTrackedDialog('Leave Group', '', QuestionDialog, {
            title: _t("Leave Community"),
            description: _t("Leave %(groupName)s?", {groupName: this.props.groupId}),
            button: _t("Leave"),
            danger: true,
            onFinished: (confirmed) => {
                if (!confirmed) return;

                this.setState({membershipBusy: true});
                MatrixClientPeg.get().leaveGroup(this.props.groupId).then(() => {
                    // don't reset membershipBusy here: wait for the membership change to come down the sync
                }).catch((e) => {
                    this.setState({membershipBusy: false});
                    const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                    Modal.createTrackedDialog('Error leaving room', '', ErrorDialog, {
                        title: _t("Error"),
                        description: _t("Unable to leave room"),
                    });
                });
            },
        });
    },

    _onAddRoomsClick: function() {
        showGroupAddRoomDialog(this.props.groupId);
    },

    _onPublicityToggle: function() {
        this.setState({
            publicityBusy: true,
        });
        const publicity = !this.state.isGroupPublicised;
        this._groupStore.setGroupPublicity(publicity).then(() => {
            this.setState({
                publicityBusy: false,
            });
        });
    },

    _getGroupSection: function() {
        const groupSettingsSectionClasses = classnames({
            "mx_GroupView_group": this.state.editing,
            "mx_GroupView_group_disabled": this.state.editing && !this.state.isUserPrivileged,
        });

        const header = this.state.editing ? <h2> { _t('Community Settings') } </h2> : <div />;
        return <div className={groupSettingsSectionClasses}>
            { header }
            { this._getLongDescriptionNode() }
            { this._getRoomsNode() }
        </div>;
    },

    _getRoomsNode: function() {
        const RoomDetailList = sdk.getComponent('rooms.RoomDetailList');
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        const TintableSvg = sdk.getComponent('elements.TintableSvg');

        const addRoomRow = this.state.editing ?
            (<AccessibleButton className="mx_GroupView_rooms_header_addRow"
                onClick={this._onAddRoomsClick}
            >
                <div className="mx_GroupView_rooms_header_addRow_button">
                    <TintableSvg src="img/icons-room-add.svg" width="24" height="24" />
                </div>
                <div className="mx_GroupView_rooms_header_addRow_label">
                    { _t('Add rooms to this community') }
                </div>
            </AccessibleButton>) : <div />;
        return <div className="mx_GroupView_rooms">
            <div className="mx_GroupView_rooms_header">
                <h3>{ _t('Rooms') }</h3>
                { addRoomRow }
            </div>
            <RoomDetailList rooms={this._groupStore.getGroupRooms()} />
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

        const group = MatrixClientPeg.get().getGroup(this.props.groupId);
        if (!group) return null;

        if (group.myMembership === 'invite') {
            if (this.state.membershipBusy) {
                return <div className="mx_GroupView_membershipSection">
                    <Spinner />
                </div>;
            }
            return <div className="mx_GroupView_membershipSection mx_GroupView_membershipSection_invited">
                <div className="mx_GroupView_membershipSubSection">
                    <div className="mx_GroupView_membershipSection_description">
                        { _t("%(inviter)s has invited you to join this community", {inviter: group.inviter.userId}) }
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
        } else if (group.myMembership === 'join' && this.state.editing) {
            const leaveButtonTooltip = this.state.isUserPrivileged ?
                _t("You are an administrator of this community") :
                _t("You are a member of this community");
            const leaveButtonClasses = classnames({
                "mx_RoomHeader_textButton": true,
                "mx_GroupView_textButton": true,
                "mx_GroupView_leaveButton": true,
                "mx_RoomHeader_textButton_danger": this.state.isUserPrivileged,
            });
            return <div className="mx_GroupView_membershipSection mx_GroupView_membershipSection_joined">
                <div className="mx_GroupView_membershipSubSection">
                    { /* Empty div for flex alignment */ }
                    <div />
                    <div className="mx_GroupView_membership_buttonContainer">
                        <AccessibleButton
                            className={leaveButtonClasses}
                            onClick={this._onLeaveClick}
                            title={leaveButtonTooltip}
                        >
                            { _t("Leave") }
                        </AccessibleButton>
                    </div>
                </div>
            </div>;
        }
        return null;
    },

    _getMemberSettingsSection: function() {
        return <div className="mx_GroupView_memberSettings">
            <h2> { _t("Community Member Settings") } </h2>
            <div className="mx_GroupView_memberSettings_toggle">
                <input type="checkbox"
                    onClick={this._onPublicityToggle}
                    checked={this.state.isGroupPublicised}
                    tabIndex="3"
                    id="isGroupPublicised"
                />
                <label htmlFor="isGroupPublicised"
                    onClick={this._onPublicityToggle}
                >
                    { _t("Publish this community on your profile") }
                </label>
            </div>
        </div>;
    },

    _getLongDescriptionNode: function() {
        const summary = this.state.summary;
        let description = null;
        if (summary.profile && summary.profile.long_description) {
            description = sanitizedHtmlNode(summary.profile.long_description);
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
        const TintableSvg = sdk.getComponent("elements.TintableSvg");

        if (this.state.summary === null && this.state.error === null || this.state.saving) {
            return <Spinner />;
        } else if (this.state.summary) {
            const summary = this.state.summary;

            let avatarNode;
            let nameNode;
            let shortDescNode;
            const bodyNodes = [
                this._getMembershipSection(),
                this.state.editing ? this._getMemberSettingsSection() : null,
                this._getGroupSection(),
            ];
            const rightButtons = [];
            if (this.state.editing && this.state.isUserPrivileged) {
                let avatarImage;
                if (this.state.uploadingAvatar) {
                    avatarImage = <Spinner />;
                } else {
                    const GroupAvatar = sdk.getComponent('avatars.GroupAvatar');
                    avatarImage = <GroupAvatar groupId={this.props.groupId}
                        groupAvatarUrl={this.state.profileForm.avatar_url}
                        width={48} height={48} resizeMethod='crop'
                    />;
                }

                avatarNode = (
                    <div className="mx_GroupView_avatarPicker">
                        <label htmlFor="avatarInput" className="mx_GroupView_avatarPicker_label">
                            { avatarImage }
                        </label>
                        <div className="mx_GroupView_avatarPicker_edit">
                            <label htmlFor="avatarInput" className="mx_GroupView_avatarPicker_label">
                                <img src="img/camera.svg"
                                    alt={_t("Upload avatar")} title={_t("Upload avatar")}
                                    width="17" height="15" />
                            </label>
                            <input id="avatarInput" className="mx_GroupView_uploadInput" type="file" onChange={this._onAvatarSelected} />
                        </div>
                    </div>
                );

                const EditableText = sdk.getComponent("elements.EditableText");

                nameNode = <EditableText ref="nameEditor"
                     className="mx_GroupView_editable"
                     placeholderClassName="mx_GroupView_placeholder"
                     placeholder={_t('Community Name')}
                     blurToCancel={false}
                     initialValue={this.state.profileForm.name}
                     onValueChanged={this._onNameChange}
                     tabIndex="1"
                     dir="auto" />;

                shortDescNode = <EditableText ref="descriptionEditor"
                     className="mx_GroupView_editable"
                     placeholderClassName="mx_GroupView_placeholder"
                     placeholder={_t("Description")}
                     blurToCancel={false}
                     initialValue={this.state.profileForm.short_description}
                     onValueChanged={this._onShortDescChange}
                     tabIndex="2"
                     dir="auto" />;
            } else {
                const groupAvatarUrl = summary.profile ? summary.profile.avatar_url : null;
                avatarNode = <GroupAvatar
                    groupId={this.props.groupId}
                    groupAvatarUrl={groupAvatarUrl}
                    onClick={this._onEditClick}
                    width={48} height={48}
                />;
                if (summary.profile && summary.profile.name) {
                    nameNode = <div onClick={this._onEditClick}>
                        <span>{ summary.profile.name }</span>
                        <span className="mx_GroupView_header_groupid">
                            ({ this.props.groupId })
                        </span>
                    </div>;
                } else {
                    nameNode = <span onClick={this._onEditClick}>{ this.props.groupId }</span>;
                }
                if (summary.profile && summary.profile.short_description) {
                    shortDescNode = <span onClick={this._onEditClick}>{ summary.profile.short_description }</span>;
                }
            }
            if (this.state.editing) {
                rightButtons.push(
                    <AccessibleButton className="mx_GroupView_textButton mx_RoomHeader_textButton"
                        onClick={this._onSaveClick} key="_saveButton"
                    >
                        { _t('Save') }
                    </AccessibleButton>,
                );
                rightButtons.push(
                    <AccessibleButton className="mx_RoomHeader_cancelButton" onClick={this._onCancelClick} key="_cancelButton">
                        <img src="img/cancel.svg" className="mx_filterFlipColor"
                            width="18" height="18" alt={_t("Cancel")} />
                    </AccessibleButton>,
                );
            } else {
                rightButtons.push(
                    <AccessibleButton className="mx_GroupHeader_button"
                        onClick={this._onEditClick} title={_t("Community Settings")} key="_editButton"
                    >
                        <TintableSvg src="img/icons-settings-room.svg" width="16" height="16" />
                    </AccessibleButton>,
                );
                if (this.props.collapsedRhs) {
                    rightButtons.push(
                        <AccessibleButton className="mx_GroupHeader_button"
                            onClick={this._onShowRhsClick} title={_t('Show panel')} key="_maximiseButton"
                        >
                            <TintableSvg src="img/maximise.svg" width="10" height="16" />
                        </AccessibleButton>,
                    );
                }
            }

            const headerClasses = {
                mx_GroupView_header: true,
                mx_GroupView_header_view: !this.state.editing,
            };

            return (
                <div className="mx_GroupView">
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
                    </div>
                    <GeminiScrollbar className="mx_GroupView_body">
                        { bodyNodes }
                    </GeminiScrollbar>
                </div>
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
                    extraText = <div>{ _t('This Home server does not support communities') }</div>;
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
