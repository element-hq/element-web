/*
Copyright 2017, 2018 New Vector Ltd
Copyright 2018 Michael Telatynski <7t3chguy@gmail.com>
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

import React, {createRef} from 'react';
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';
import { MatrixClient } from 'matrix-js-sdk';
import sdk from '../../../index';
import dis from '../../../dispatcher';
import {_t} from '../../../languageHandler';
import classNames from 'classnames';
import MatrixClientPeg from "../../../MatrixClientPeg";
import {ContextMenu, ContextMenuButton, toRightOf} from "../../structures/ContextualMenu";

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

    componentDidMount: function() {
        this._contextMenuButton = createRef();
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

    openMenu: function(e) {
        // Only allow non-guests to access the context menu
        if (MatrixClientPeg.get().isGuest()) return;

        // Prevent the GroupInviteTile onClick event firing as well
        e.stopPropagation();
        e.preventDefault();

        const state = {
            menuDisplayed: true,
        };

        // If the badge is clicked, then no longer show tooltip
        if (this.props.collapsed) {
            state.hover = false;
        }

        this.setState(state);
    },

    closeMenu: function() {
        this.setState({
            menuDisplayed: false,
        });
    },

    render: function() {
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
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
        const badge = (
            <ContextMenuButton
                className={badgeClasses}
                inputRef={this._contextMenuButton}
                onClick={this.openMenu}
                label={_t("Options")}
                isExpanded={this.state.menuDisplayed}
            >
                { badgeContent }
            </ContextMenuButton>
        );

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

        let contextMenu;
        if (this.state.menuDisplayed) {
            const elementRect = this._contextMenuButton.current.getBoundingClientRect();
            const GroupInviteTileContextMenu = sdk.getComponent('context_menus.GroupInviteTileContextMenu');
            contextMenu = (
                <ContextMenu {...toRightOf(elementRect)} onFinished={this.closeMenu}>
                    <GroupInviteTileContextMenu group={this.props.group} onFinished={this.closeMenu} />
                </ContextMenu>
            );
        }

        return <React.Fragment>
            <AccessibleButton
                className={classes}
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

            { contextMenu }
        </React.Fragment>;
    },
});
