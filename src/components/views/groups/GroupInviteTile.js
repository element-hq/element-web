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

import React from 'react';
import PropTypes from 'prop-types';
import * as sdk from '../../../index';
import dis from '../../../dispatcher/dispatcher';
import {_t} from '../../../languageHandler';
import classNames from 'classnames';
import {MatrixClientPeg} from "../../../MatrixClientPeg";
import {ContextMenu, ContextMenuButton, toRightOf} from "../../structures/ContextMenu";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import {RovingTabIndexWrapper} from "../../../accessibility/RovingTabIndex";

// XXX this class copies a lot from RoomTile.js
export default class GroupInviteTile extends React.Component {
    static propTypes: {
        group: PropTypes.object.isRequired,
    };

    static contextType = MatrixClientContext;

    constructor(props, context) {
        super(props, context);

        this.state = {
            hover: false,
            badgeHover: false,
            menuDisplayed: false,
            selected: this.props.group.groupId === null, // XXX: this needs linking to LoggedInView/GroupView state
        };
    }

    onClick = e => {
        dis.dispatch({
            action: 'view_group',
            group_id: this.props.group.groupId,
        });
    };

    onMouseEnter = () => {
        const state = {hover: true};
        // Only allow non-guests to access the context menu
        if (!this.context.isGuest()) {
            state.badgeHover = true;
        }
        this.setState(state);
    };

    onMouseLeave = () => {
        this.setState({
            badgeHover: false,
            hover: false,
        });
    };

    _showContextMenu(boundingClientRect) {
        // Only allow non-guests to access the context menu
        if (MatrixClientPeg.get().isGuest()) return;

        const state = {
            contextMenuPosition: boundingClientRect,
        };

        // If the badge is clicked, then no longer show tooltip
        if (this.props.collapsed) {
            state.hover = false;
        }

        this.setState(state);
    }

    onContextMenuButtonClick = e => {
        // Prevent the RoomTile onClick event firing as well
        e.stopPropagation();
        e.preventDefault();

        this._showContextMenu(e.target.getBoundingClientRect());
    };

    onContextMenu = e => {
        // Prevent the native context menu
        e.preventDefault();

        this._showContextMenu({
            right: e.clientX,
            top: e.clientY,
            height: 0,
        });
    };

    closeMenu = () => {
        this.setState({
            contextMenuPosition: null,
        });
    };

    render() {
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        const BaseAvatar = sdk.getComponent('avatars.BaseAvatar');

        const groupName = this.props.group.name || this.props.group.groupId;
        const httpAvatarUrl = this.props.group.avatarUrl ?
            this.context.mxcUrlToHttp(this.props.group.avatarUrl, 24, 24) : null;

        const av = <BaseAvatar name={groupName} width={24} height={24} url={httpAvatarUrl} />;

        const isMenuDisplayed = Boolean(this.state.contextMenuPosition);
        const nameClasses = classNames('mx_RoomTile_name mx_RoomTile_invite mx_RoomTile_badgeShown', {
            'mx_RoomTile_badgeShown': this.state.badgeHover || isMenuDisplayed,
        });

        // XXX: this is a workaround for Firefox giving this div a tabstop :( [tabIndex]
        const label = <div title={this.props.group.groupId} className={nameClasses} tabIndex={-1} dir="auto">
            { groupName }
        </div>;

        const badgeEllipsis = this.state.badgeHover || isMenuDisplayed;
        const badgeClasses = classNames('mx_RoomTile_badge mx_RoomTile_highlight', {
            'mx_RoomTile_badgeButton': badgeEllipsis,
        });

        const badgeContent = badgeEllipsis ? '\u00B7\u00B7\u00B7' : '!';

        let tooltip;
        if (this.props.collapsed && this.state.hover) {
            const Tooltip = sdk.getComponent("elements.Tooltip");
            tooltip = <Tooltip className="mx_RoomTile_tooltip" label={groupName} dir="auto" />;
        }

        const classes = classNames('mx_RoomTile mx_RoomTile_highlight', {
            'mx_RoomTile_menuDisplayed': isMenuDisplayed,
            'mx_RoomTile_selected': this.state.selected,
            'mx_GroupInviteTile': true,
        });

        let contextMenu;
        if (isMenuDisplayed) {
            const GroupInviteTileContextMenu = sdk.getComponent('context_menus.GroupInviteTileContextMenu');
            contextMenu = (
                <ContextMenu {...toRightOf(this.state.contextMenuPosition)} onFinished={this.closeMenu}>
                    <GroupInviteTileContextMenu group={this.props.group} onFinished={this.closeMenu} />
                </ContextMenu>
            );
        }

        return <React.Fragment>
            <RovingTabIndexWrapper>
                {({onFocus, isActive, ref}) =>
                    <AccessibleButton
                        onFocus={onFocus}
                        tabIndex={isActive ? 0 : -1}
                        inputRef={ref}
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
                            <ContextMenuButton
                                className={badgeClasses}
                                onClick={this.onContextMenuButtonClick}
                                label={_t("Options")}
                                isExpanded={isMenuDisplayed}
                                tabIndex={isActive ? 0 : -1}
                            >
                                { badgeContent }
                            </ContextMenuButton>
                        </div>
                        { tooltip }
                    </AccessibleButton>
                }
            </RovingTabIndexWrapper>

            { contextMenu }
        </React.Fragment>;
    }
}
