/*
Copyright 2017, 2018 New Vector Ltd
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
import { MatrixClient } from 'matrix-js-sdk';
import sdk from '../../../index';
import dis from '../../../dispatcher';
import AccessibleButton from '../elements/AccessibleButton';
import classNames from 'classnames';
import MatrixClientPeg from "../../../MatrixClientPeg";
import {createMenu} from "../../structures/ContextualMenu";

export default createReactClass({
    displayName: 'GroupInviteTile',

    propTypes: {
        group: PropTypes.object.isRequired,
    },

    contextTypes: {
        matrixClient: PropTypes.instanceOf(MatrixClient),
    },

    getInitialState: function() {
        return ({
            hover: false,
            badgeHover: false,
            menuDisplayed: false,
            selected: this.props.group.groupId === null, // XXX: this needs linking to LoggedInView/GroupView state
        });
    },

    onClick: function(e) {
        dis.dispatch({
            action: 'view_group',
            group_id: this.props.group.groupId,
        });
    },

    onMouseEnter: function() {
        const state = {hover: true};
        // Only allow non-guests to access the context menu
        if (!this.context.matrixClient.isGuest()) {
            state.badgeHover = true;
        }
        this.setState(state);
    },

    onMouseLeave: function() {
        this.setState({
            badgeHover: false,
            hover: false,
        });
    },

    _showContextMenu: function(x, y, chevronOffset) {
        const GroupInviteTileContextMenu = sdk.getComponent('context_menus.GroupInviteTileContextMenu');

        createMenu(GroupInviteTileContextMenu, {
            chevronOffset,
            left: x,
            top: y,
            group: this.props.group,
            onFinished: () => {
                this.setState({ menuDisplayed: false });
            },
        });
        this.setState({ menuDisplayed: true });
    },

    onContextMenu: function(e) {
        // Prevent the RoomTile onClick event firing as well
        e.preventDefault();
        // Only allow non-guests to access the context menu
        if (MatrixClientPeg.get().isGuest()) return;

        const chevronOffset = 12;
        this._showContextMenu(e.clientX, e.clientY - (chevronOffset + 8), chevronOffset);
    },

    onBadgeClicked: function(e) {
        // Prevent the RoomTile onClick event firing as well
        e.stopPropagation();
        // Only allow non-guests to access the context menu
        if (MatrixClientPeg.get().isGuest()) return;

        // If the badge is clicked, then no longer show tooltip
        if (this.props.collapsed) {
            this.setState({ hover: false });
        }

        const elementRect = e.target.getBoundingClientRect();

        // The window X and Y offsets are to adjust position when zoomed in to page
        const x = elementRect.right + window.pageXOffset + 3;
        const chevronOffset = 12;
        let y = (elementRect.top + (elementRect.height / 2) + window.pageYOffset);
        y = y - (chevronOffset + 8); // where 8 is half the height of the chevron

        this._showContextMenu(x, y, chevronOffset);
    },

    render: function() {
        const BaseAvatar = sdk.getComponent('avatars.BaseAvatar');

        const groupName = this.props.group.name || this.props.group.groupId;
        const httpAvatarUrl = this.props.group.avatarUrl ?
            this.context.matrixClient.mxcUrlToHttp(this.props.group.avatarUrl, 24, 24) : null;

        const av = <BaseAvatar name={groupName} width={24} height={24} url={httpAvatarUrl} />;

        const nameClasses = classNames('mx_RoomTile_name mx_RoomTile_invite mx_RoomTile_badgeShown', {
            'mx_RoomTile_badgeShown': this.state.badgeHover || this.state.menuDisplayed,
        });

        const label = <div title={this.props.group.groupId} className={nameClasses} dir="auto">
            { groupName }
        </div>;

        const badgeEllipsis = this.state.badgeHover || this.state.menuDisplayed;
        const badgeClasses = classNames('mx_RoomTile_badge mx_RoomTile_highlight', {
            'mx_RoomTile_badgeButton': badgeEllipsis,
        });

        const badgeContent = badgeEllipsis ? '\u00B7\u00B7\u00B7' : '!';
        const badge = <div className={badgeClasses} onClick={this.onBadgeClicked}>{ badgeContent }</div>;

        let tooltip;
        if (this.props.collapsed && this.state.hover) {
            const Tooltip = sdk.getComponent("elements.Tooltip");
            tooltip = <Tooltip className="mx_RoomTile_tooltip" label={groupName} dir="auto" />;
        }

        const classes = classNames('mx_RoomTile mx_RoomTile_highlight', {
            'mx_RoomTile_menuDisplayed': this.state.menuDisplayed,
            'mx_RoomTile_selected': this.state.selected,
            'mx_GroupInviteTile': true,
        });

        return (
            <AccessibleButton className={classes}
                              onClick={this.onClick}
                              onMouseEnter={this.onMouseEnter}
                              onMouseLeave={this.onMouseLeave}
                              onContextMenu={this.onContextMenu}
            >
                <div className="mx_RoomTile_avatar">
                    { av }
                </div>
                <div className="mx_RoomTile_nameContainer">
                    { label }
                    { badge }
                </div>
                { tooltip }
            </AccessibleButton>
        );
    },
});
