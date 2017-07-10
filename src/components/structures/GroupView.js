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


function categoryRoomListNode(rooms, categoryId, category) {
    const roomNodes = rooms.map((r) => {
        return <FeaturedRoom key={r.room_id} summaryInfo={r} />;
    });
    let catHeader = null;
    if (category && category.profile) {
        catHeader = <div className="mx_GroupView_featuredRooms_category">{category.profile.name}</div>;
    }
    return <div key={categoryId}>
        {catHeader}
        {roomNodes}
    </div>;
}

const FeaturedRoom = React.createClass({
    displayName: 'FeaturedRoom',

    props: {
        summaryInfo: PropTypes.object.isRequired,
    },

    onClick: function(e) {
        e.preventDefault();

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

        return <AccessibleButton className="mx_GroupView_featuredRoom" onClick={this.onClick}>
            <RoomAvatar oobData={oobData} width={64} height={64} />
            <div className="mx_GroupView_featuredRoom_name">{roomNameNode}</div>
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
        };
    },

    componentWillMount: function() {
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

    _onSettingsClick: function() {
        this.setState({editing: true});
    },

    render: function() {
        const GroupAvatar = sdk.getComponent("avatars.GroupAvatar");
        const Loader = sdk.getComponent("elements.Spinner");
        const TintableSvg = sdk.getComponent("elements.TintableSvg");

        if (this.state.summary === null && this.state.error === null) {
            return <Loader />;
        } else if (this.state.editing) {
            return <div />;
        } else if (this.state.summary) {
            const summary = this.state.summary;
            let description = null;
            if (summary.profile && summary.profile.long_description) {
                description = sanitizedHtmlNode(summary.profile.long_description);
            }

            let featuredRooms = null;
            if (summary.rooms_section.rooms.length > 0) {
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
                    defaultCategoryNode = categoryRoomListNode(defaultCategoryRooms);
                }
                const categoryRoomNodes = Object.keys(categoryRooms).map((catId) => {
                    const cat = summary.rooms_section.categories[catId];
                    return categoryRoomListNode(categoryRooms[catId], catId, cat);
                });

                featuredRooms = <div className="mx_GroupView_featuredRooms">
                    <div className="mx_GroupView_featuredRooms_header">
                        {_t('Featured Rooms:')}
                    </div>
                    {defaultCategoryNode}
                    {categoryRoomNodes}
                </div>;
            }
            const roomBody = <div>
                <div className="mx_GroupView_groupDesc">{description}</div>
                {featuredRooms}
            </div>;

            let nameNode;
            if (summary.profile && summary.profile.name) {
                nameNode = <div className="mx_RoomHeader_name">
                    <span>{summary.profile.name}</span>
                    <span className="mx_GroupView_header_groupid">
                        ({this.props.groupId})
                    </span>
                </div>;
            } else {
                nameNode = <div className="mx_RoomHeader_name">
                    <span>{this.props.groupId}</span>
                </div>;
            }

            const groupAvatarUrl = summary.profile ? summary.profile.avatar_url : null;

            return (
                <div className="mx_GroupView">
                    <div className="mx_RoomHeader">
                        <div className="mx_RoomHeader_wrapper">
                            <div className="mx_RoomHeader_avatar">
                                <GroupAvatar
                                    groupId={this.props.groupId}
                                    groupAvatarUrl={groupAvatarUrl}
                                    width={48} height={48}
                                />
                            </div>
                            <div className="mx_RoomHeader_info">
                                {nameNode}
                                <div className="mx_RoomHeader_topic">
                                    {summary.profile.short_description}
                                </div>
                            </div>
                            <AccessibleButton className="mx_RoomHeader_button" onClick={this._onSettingsClick} title={_t("Settings")}>
                                <TintableSvg src="img/icons-settings-room.svg" width="16" height="16"/>
                            </AccessibleButton>
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
