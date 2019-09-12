/*
Copyright 2017 New Vector Ltd.
Copyright 2018 Michael Telatynski <7t3chguy@gmail.com>

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
import classNames from 'classnames';
import { MatrixClient } from 'matrix-js-sdk';
import sdk from '../../../index';
import dis from '../../../dispatcher';
import { isOnlyCtrlOrCmdIgnoreShiftKeyEvent } from '../../../Keyboard';
import * as ContextualMenu from '../../structures/ContextualMenu';
import * as FormattingUtils from '../../../utils/FormattingUtils';

import FlairStore from '../../../stores/FlairStore';
import GroupStore from '../../../stores/GroupStore';
import TagOrderStore from '../../../stores/TagOrderStore';

// A class for a child of TagPanel (possibly wrapped in a DNDTagTile) that represents
// a thing to click on for the user to filter the visible rooms in the RoomList to:
//  - Rooms that are part of the group
//  - Direct messages with members of the group
// with the intention that this could be expanded to arbitrary tags in future.
export default createReactClass({
    displayName: 'TagTile',

    propTypes: {
        // A string tag such as "m.favourite" or a group ID such as "+groupid:domain.bla"
        // For now, only group IDs are handled.
        tag: PropTypes.string,
    },

    contextTypes: {
        matrixClient: PropTypes.instanceOf(MatrixClient).isRequired,
    },

    getInitialState() {
        return {
            // Whether the mouse is over the tile
            hover: false,
            // The profile data of the group if this.props.tag is a group ID
            profile: null,
        };
    },

    componentWillMount() {
        this.unmounted = false;
        if (this.props.tag[0] === '+') {
            FlairStore.addListener('updateGroupProfile', this._onFlairStoreUpdated);
            this._onFlairStoreUpdated();
            // New rooms or members may have been added to the group, fetch async
            this._refreshGroup(this.props.tag);
        }
    },

    componentWillUnmount() {
        this.unmounted = true;
        if (this.props.tag[0] === '+') {
            FlairStore.removeListener('updateGroupProfile', this._onFlairStoreUpdated);
        }
    },

    _onFlairStoreUpdated() {
        if (this.unmounted) return;
        FlairStore.getGroupProfileCached(
            this.context.matrixClient,
            this.props.tag,
        ).then((profile) => {
            if (this.unmounted) return;
            this.setState({profile});
        }).catch((err) => {
            console.warn('Could not fetch group profile for ' + this.props.tag, err);
        });
    },

    _refreshGroup(groupId) {
        GroupStore.refreshGroupRooms(groupId);
        GroupStore.refreshGroupMembers(groupId);
    },

    onClick: function(e) {
        e.preventDefault();
        e.stopPropagation();
        dis.dispatch({
            action: 'select_tag',
            tag: this.props.tag,
            ctrlOrCmdKey: isOnlyCtrlOrCmdIgnoreShiftKeyEvent(e),
            shiftKey: e.shiftKey,
        });
        if (this.props.tag[0] === '+') {
            // New rooms or members may have been added to the group, fetch async
            this._refreshGroup(this.props.tag);
        }
    },

    _openContextMenu: function(x, y, chevronOffset) {
        // Hide the (...) immediately
        this.setState({ hover: false });

        const TagTileContextMenu = sdk.getComponent('context_menus.TagTileContextMenu');
        ContextualMenu.createMenu(TagTileContextMenu, {
            chevronOffset: chevronOffset,
            left: x,
            top: y,
            tag: this.props.tag,
            onFinished: () => {
                this.setState({ menuDisplayed: false });
            },
        });
        this.setState({ menuDisplayed: true });
    },

    onContextButtonClick: function(e) {
        e.preventDefault();
        e.stopPropagation();

        const elementRect = e.target.getBoundingClientRect();

        // The window X and Y offsets are to adjust position when zoomed in to page
        const x = elementRect.right + window.pageXOffset + 3;
        const chevronOffset = 12;
        let y = (elementRect.top + (elementRect.height / 2) + window.pageYOffset);
        y = y - (chevronOffset + 8); // where 8 is half the height of the chevron

        this._openContextMenu(x, y, chevronOffset);
    },

    onContextMenu: function(e) {
        e.preventDefault();

        const chevronOffset = 12;
        this._openContextMenu(e.clientX, e.clientY - (chevronOffset + 8), chevronOffset);
    },

    onMouseOver: function() {
        this.setState({hover: true});
    },

    onMouseOut: function() {
        this.setState({hover: false});
    },

    render: function() {
        const BaseAvatar = sdk.getComponent('avatars.BaseAvatar');
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        const Tooltip = sdk.getComponent('elements.Tooltip');
        const profile = this.state.profile || {};
        const name = profile.name || this.props.tag;
        const avatarHeight = 40;

        const httpUrl = profile.avatarUrl ? this.context.matrixClient.mxcUrlToHttp(
            profile.avatarUrl, avatarHeight, avatarHeight, "crop",
        ) : null;

        const className = classNames({
            mx_TagTile: true,
            mx_TagTile_selected: this.props.selected,
        });

        const badge = TagOrderStore.getGroupBadge(this.props.tag);
        let badgeElement;
        if (badge && !this.state.hover) {
            const badgeClasses = classNames({
                "mx_TagTile_badge": true,
                "mx_TagTile_badgeHighlight": badge.highlight,
            });
            badgeElement = (<div className={badgeClasses}>{FormattingUtils.formatCount(badge.count)}</div>);
        }

        const tip = this.state.hover ?
            <Tooltip className="mx_TagTile_tooltip" label={name} /> :
            <div />;
        const contextButton = this.state.hover || this.state.menuDisplayed ?
            <div className="mx_TagTile_context_button" onClick={this.onContextButtonClick}>
                { "\u00B7\u00B7\u00B7" }
            </div> : <div />;
        return <AccessibleButton className={className} onClick={this.onClick} onContextMenu={this.onContextMenu}>
            <div className="mx_TagTile_avatar" onMouseOver={this.onMouseOver} onMouseOut={this.onMouseOut}>
                <BaseAvatar
                    name={name}
                    idName={this.props.tag}
                    url={httpUrl}
                    width={avatarHeight}
                    height={avatarHeight}
                />
                { tip }
                { contextButton }
                { badgeElement }
            </div>
        </AccessibleButton>;
    },
});
