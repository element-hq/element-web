/*
Copyright 2017 Vector Creations Ltd.

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
import MatrixClientPeg from '../../MatrixClientPeg';
import sdk from '../../index';
import dis from '../../dispatcher';
import { sanitizedHtmlNode } from '../../HtmlUtils';
import { _t } from '../../languageHandler';
import AccessibleButton from '../views/elements/AccessibleButton';
import Modal from '../../Modal';
import classnames from 'classnames';

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
    },

    render: function() {
        const roomNodes = this.props.rooms.map((r) => {
            return <FeaturedRoom key={r.room_id} summaryInfo={r} />;
        });
        let catHeader = null;
        if (this.props.category && this.props.category.profile) {
            catHeader = <div className="mx_GroupView_featuredThings_category">{this.props.category.profile.name}</div>;
        }
        return <div>
            {catHeader}
            {roomNodes}
        </div>;
    },
});

const FeaturedRoom = React.createClass({
    displayName: 'FeaturedRoom',

    props: {
        summaryInfo: RoomSummaryType.isRequired,
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

    render: function() {
        const RoomAvatar = sdk.getComponent("avatars.RoomAvatar");

        const oobData = {
            roomId: this.props.summaryInfo.room_id,
            avatarUrl: this.props.summaryInfo.profile.avatar_url,
            name: this.props.summaryInfo.profile.name,
        };
        let permalink = null;
        if (this.props.summaryInfo.profile && this.props.summaryInfo.profile.canonical_alias) {
            permalink = 'https://matrix.to/#/' + this.props.summaryInfo.profile.canonical_alias;
        }
        let roomNameNode = null;
        if (permalink) {
            roomNameNode = <a href={permalink} onClick={this.onClick} >{this.props.summaryInfo.profile.name}</a>;
        } else {
            roomNameNode = <span>{this.props.summaryInfo.profile.name}</span>;
        }

        return <AccessibleButton className="mx_GroupView_featuredThing" onClick={this.onClick}>
            <RoomAvatar oobData={oobData} width={64} height={64} />
            <div className="mx_GroupView_featuredThing_name">{roomNameNode}</div>
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
    },

    render: function() {
        const userNodes = this.props.users.map((u) => {
            return <FeaturedUser key={u.user_id} summaryInfo={u} />;
        });
        let roleHeader = null;
        if (this.props.role && this.props.role.profile) {
            roleHeader = <div className="mx_GroupView_featuredThings_category">{this.props.role.profile.name}</div>;
        }
        return <div>
            {roleHeader}
            {userNodes}
        </div>;
    },
});

const FeaturedUser = React.createClass({
    displayName: 'FeaturedUser',

    props: {
        summaryInfo: UserSummaryType.isRequired,
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

    render: function() {
        // Add avatar once we get profile info inline in the summary response
        //const BaseAvatar = sdk.getComponent("avatars.BaseAvatar");

        const permalink = 'https://matrix.to/#/' + this.props.summaryInfo.user_id;
        const userNameNode = <a href={permalink} onClick={this.onClick} >{this.props.summaryInfo.user_id}</a>;

        return <AccessibleButton className="mx_GroupView_featuredThing" onClick={this.onClick}>
            <div className="mx_GroupView_featuredThing_name">{userNameNode}</div>
        </AccessibleButton>;
    },
});

export default React.createClass({
    displayName: 'GroupView',

    propTypes: {
        groupId: PropTypes.string.isRequired,
    },

    getInitialState: function() {
        return {
            summary: null,
            error: null,
            editing: false,
            saving: false,
            uploadingAvatar: false,
        };
    },

    componentWillMount: function() {
        this._changeAvatarComponent = null;
        this._loadGroupFromServer(this.props.groupId);
    },

    componentWillReceiveProps: function(newProps) {
        if (this.props.groupId != newProps.groupId) {
            this.setState({
                summary: null,
                error: null,
            }, () => {
                this._loadGroupFromServer(newProps.groupId);
            });
        }
    },

    _loadGroupFromServer: function(groupId) {
        MatrixClientPeg.get().getGroupSummary(groupId).done((res) => {
            this.setState({
                summary: res,
                error: null,
            });
        }, (err) => {
            this.setState({
                summary: null,
                error: err,
            });
        });
    },

    _onEditClick: function() {
        this.setState({
            editing: true,
            profileForm: Object.assign({}, this.state.summary.profile),
        });
    },

    _onCancelClick: function() {
        this.setState({
            editing: false,
            profileForm: null,
        });
    },

    _onNameChange: function(e) {
        const newProfileForm = Object.assign(this.state.profileForm, { name: e.target.value });
        this.setState({
            profileForm: newProfileForm,
        });
    },

    _onShortDescChange: function(e) {
        const newProfileForm = Object.assign(this.state.profileForm, { short_description: e.target.value });
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
        MatrixClientPeg.get().setGroupProfile(this.props.groupId, this.state.profileForm).then((result) => {
            this.setState({
                saving: false,
                editing: false,
                summary: null,
            });
            this._loadGroupFromServer(this.props.groupId);
        }).catch((e) => {
            this.setState({
                saving: false,
            });
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            console.error("Failed to save group profile", e);
            Modal.createTrackedDialog('Failed to update group', '', ErrorDialog, {
                title: _t('Error'),
                description: _t('Failed to update group'),
            });
        }).done();
    },

    _getFeaturedRoomsNode() {
        const summary = this.state.summary;

        if (summary.rooms_section.rooms.length == 0) return null;

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

        let defaultCategoryNode = null;
        if (defaultCategoryRooms.length > 0) {
            defaultCategoryNode = <CategoryRoomList rooms={defaultCategoryRooms} />;
        }
        const categoryRoomNodes = Object.keys(categoryRooms).map((catId) => {
            const cat = summary.rooms_section.categories[catId];
            return <CategoryRoomList key={catId} rooms={categoryRooms[catId]} category={cat} />;
        });

        return <div className="mx_GroupView_featuredThings">
            <div className="mx_GroupView_featuredThings_header">
                {_t('Featured Rooms:')}
            </div>
            {defaultCategoryNode}
            {categoryRoomNodes}
        </div>;
    },

    _getFeaturedUsersNode() {
        const summary = this.state.summary;

        if (summary.users_section.users.length == 0) return null;

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

        let noRoleNode = null;
        if (noRoleUsers.length > 0) {
            noRoleNode = <RoleUserList users={noRoleUsers} />;
        }
        const roleUserNodes = Object.keys(roleUsers).map((roleId) => {
            const role = summary.users_section.roles[roleId];
            return <RoleUserList key={roleId} users={roleUsers[roleId]} role={role} />;
        });

        return <div className="mx_GroupView_featuredThings">
            <div className="mx_GroupView_featuredThings_header">
                {_t('Featured Users:')}
            </div>
            {noRoleNode}
            {roleUserNodes}
        </div>;
    },

    render: function() {
        const GroupAvatar = sdk.getComponent("avatars.GroupAvatar");
        const Loader = sdk.getComponent("elements.Spinner");
        const TintableSvg = sdk.getComponent("elements.TintableSvg");

        if (this.state.summary === null && this.state.error === null || this.state.saving) {
            return <Loader />;
        } else if (this.state.summary) {
            const summary = this.state.summary;

            let avatarNode;
            let nameNode;
            let shortDescNode;
            let rightButtons;
            let roomBody;
            const headerClasses = {
                mx_GroupView_header: true,
            };
            if (this.state.editing) {
                let avatarImage;
                if (this.state.uploadingAvatar) {
                    avatarImage = <Loader />;
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
                            {avatarImage}
                        </label>
                        <div className="mx_GroupView_avatarPicker_edit">
                            <label htmlFor="avatarInput" className="mx_GroupView_avatarPicker_label">
                                <img src="img/camera.svg"
                                    alt={ _t("Upload avatar") } title={ _t("Upload avatar") }
                                    width="17" height="15" />
                            </label>
                            <input id="avatarInput" className="mx_GroupView_uploadInput" type="file" onChange={this._onAvatarSelected}/>
                        </div>
                    </div>
                );
                nameNode = <input type="text"
                    value={this.state.profileForm.name}
                    onChange={this._onNameChange}
                    placeholder={_t('Group Name')}
                    tabIndex="1"
                />;
                shortDescNode = <input type="text"
                    value={this.state.profileForm.short_description}
                    onChange={this._onShortDescChange}
                    placeholder={_t('Description')}
                    tabIndex="2"
                />;
                rightButtons = <span>
                    <AccessibleButton className="mx_GroupView_saveButton mx_RoomHeader_textButton" onClick={this._onSaveClick}>
                        {_t('Save')}
                    </AccessibleButton>
                    <AccessibleButton className='mx_GroupView_cancelButton' onClick={this._onCancelClick}>
                        <img src="img/cancel.svg" className='mx_filterFlipColor'
                            width="18" height="18" alt={_t("Cancel")}/>
                    </AccessibleButton>
                </span>;
                roomBody = <div>
                    <textarea className="mx_GroupView_editLongDesc" value={this.state.profileForm.long_description}
                        onChange={this._onLongDescChange}
                        tabIndex="3"
                    />
                </div>;
            } else {
                const groupAvatarUrl = summary.profile ? summary.profile.avatar_url : null;
                avatarNode = <GroupAvatar
                    groupId={this.props.groupId}
                    groupAvatarUrl={groupAvatarUrl}
                    width={48} height={48}
                />;
                if (summary.profile && summary.profile.name) {
                    nameNode = <div>
                        <span>{summary.profile.name}</span>
                        <span className="mx_GroupView_header_groupid">
                            ({this.props.groupId})
                        </span>
                    </div>;
                } else {
                    nameNode = <span>{this.props.groupId}</span>;
                }
                shortDescNode = <span>{summary.profile.short_description}</span>;

                let description = null;
                if (summary.profile && summary.profile.long_description) {
                    description = sanitizedHtmlNode(summary.profile.long_description);
                }
                roomBody = <div>
                    <div className="mx_GroupView_groupDesc">{description}</div>
                    {this._getFeaturedRoomsNode()}
                    {this._getFeaturedUsersNode()}
                </div>;
                // disabled until editing works
                rightButtons = <AccessibleButton className="mx_GroupHeader_button"
                    onClick={this._onEditClick} title={_t("Edit Group")}
                >
                    <TintableSvg src="img/icons-settings-room.svg" width="16" height="16"/>
                </AccessibleButton>;

                headerClasses.mx_GroupView_header_view = true;
            }

            return (
                <div className="mx_GroupView">
                    <div className={classnames(headerClasses)}>
                        <div className="mx_GroupView_header_leftCol">
                            <div className="mx_GroupView_header_avatar">
                                {avatarNode}
                            </div>
                            <div className="mx_GroupView_header_info">
                                <div className="mx_GroupView_header_name">
                                    {nameNode}
                                </div>
                                <div className="mx_GroupView_header_shortDesc">
                                    {shortDescNode}
                                </div>
                            </div>
                        </div>
                        <div className="mx_GroupView_header_rightCol">
                            {rightButtons}
                        </div>
                    </div>
                    {roomBody}
                </div>
            );
        } else if (this.state.error) {
            if (this.state.error.httpStatus === 404) {
                return (
                    <div className="mx_GroupView_error">
                        Group {this.props.groupId} not found
                    </div>
                );
            } else {
                let extraText;
                if (this.state.error.errcode === 'M_UNRECOGNIZED') {
                    extraText = <div>{_t('This Home server does not support groups')}</div>;
                }
                return (
                    <div className="mx_GroupView_error">
                        Failed to load {this.props.groupId}
                        {extraText}
                    </div>
                );
            }
        } else {
            console.error("Invalid state for GroupView");
            return <div />;
        }
    },
});
