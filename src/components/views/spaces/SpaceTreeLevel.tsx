/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import React, { createRef, InputHTMLAttributes, LegacyRef } from "react";
import classNames from "classnames";
import { Room } from "matrix-js-sdk/src/models/room";

import RoomAvatar from "../avatars/RoomAvatar";
import SpaceStore from "../../../stores/SpaceStore";
import SpaceTreeLevelLayoutStore from "../../../stores/SpaceTreeLevelLayoutStore";
import NotificationBadge from "../rooms/NotificationBadge";
import { RovingAccessibleTooltipButton } from "../../../accessibility/roving/RovingAccessibleTooltipButton";
import IconizedContextMenu, {
    IconizedContextMenuOption,
    IconizedContextMenuOptionList,
} from "../context_menus/IconizedContextMenu";
import { _t } from "../../../languageHandler";
import { ContextMenuTooltipButton } from "../../../accessibility/context_menu/ContextMenuTooltipButton";
import { toRightOf } from "../../structures/ContextMenu";
import {
    shouldShowSpaceSettings,
    showAddExistingRooms,
    showCreateNewRoom,
    showSpaceInvite,
    showSpaceSettings,
} from "../../../utils/space";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import AccessibleButton, { ButtonEvent } from "../elements/AccessibleButton";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import RoomViewStore from "../../../stores/RoomViewStore";
import { SetRightPanelPhasePayload } from "../../../dispatcher/payloads/SetRightPanelPhasePayload";
import { RightPanelPhases } from "../../../stores/RightPanelStorePhases";
import { EventType } from "matrix-js-sdk/src/@types/event";
import { StaticNotificationState } from "../../../stores/notifications/StaticNotificationState";
import { NotificationColor } from "../../../stores/notifications/NotificationColor";
import { getKeyBindingsManager, RoomListAction } from "../../../KeyBindingsManager";

interface IItemProps extends InputHTMLAttributes<HTMLLIElement> {
    space?: Room;
    activeSpaces: Room[];
    isNested?: boolean;
    isPanelCollapsed?: boolean;
    onExpand?: Function;
    parents?: Set<string>;
    innerRef?: LegacyRef<HTMLLIElement>;
}

interface IItemState {
    collapsed: boolean;
    contextMenuPosition: Pick<DOMRect, "right" | "top" | "height">;
    childSpaces: Room[];
}

export class SpaceItem extends React.PureComponent<IItemProps, IItemState> {
    static contextType = MatrixClientContext;

    private buttonRef = createRef<HTMLDivElement>();

    constructor(props) {
        super(props);

        const collapsed = SpaceTreeLevelLayoutStore.instance.getSpaceCollapsedState(
            props.space.roomId,
            this.props.parents,
            !props.isNested, // default to collapsed for root items
        );

        this.state = {
            collapsed: collapsed,
            contextMenuPosition: null,
            childSpaces: this.childSpaces,
        };

        SpaceStore.instance.on(this.props.space.roomId, this.onSpaceUpdate);
    }

    componentWillUnmount() {
        SpaceStore.instance.off(this.props.space.roomId, this.onSpaceUpdate);
    }

    private onSpaceUpdate = () => {
        this.setState({
            childSpaces: this.childSpaces,
        });
    };

    private get childSpaces() {
        return SpaceStore.instance.getChildSpaces(this.props.space.roomId)
            .filter(s => !this.props.parents?.has(s.roomId));
    }

    private get isCollapsed() {
        return this.state.collapsed || this.props.isPanelCollapsed;
    }

    private toggleCollapse = evt => {
        if (this.props.onExpand && this.isCollapsed) {
            this.props.onExpand();
        }
        const newCollapsedState = !this.isCollapsed;

        SpaceTreeLevelLayoutStore.instance.setSpaceCollapsedState(
            this.props.space.roomId,
            this.props.parents,
            newCollapsedState,
        );
        this.setState({ collapsed: newCollapsedState });
        // don't bubble up so encapsulating button for space
        // doesn't get triggered
        evt.stopPropagation();
    };

    private onContextMenu = (ev: React.MouseEvent) => {
        if (this.props.space.getMyMembership() !== "join") return;
        ev.preventDefault();
        ev.stopPropagation();
        this.setState({
            contextMenuPosition: {
                right: ev.clientX,
                top: ev.clientY,
                height: 0,
            },
        });
    };

    private onKeyDown = (ev: React.KeyboardEvent) => {
        let handled = true;
        const action = getKeyBindingsManager().getRoomListAction(ev);
        const hasChildren = this.state.childSpaces?.length;
        switch (action) {
            case RoomListAction.CollapseSection:
                if (hasChildren && !this.isCollapsed) {
                    this.toggleCollapse(ev);
                } else {
                    const parentItem = this.buttonRef?.current?.parentElement?.parentElement;
                    const parentButton = parentItem?.previousElementSibling as HTMLElement;
                    parentButton?.focus();
                }
                break;

            case RoomListAction.ExpandSection:
                if (hasChildren) {
                    if (this.isCollapsed) {
                        this.toggleCollapse(ev);
                    } else {
                        const childLevel = this.buttonRef?.current?.nextElementSibling;
                        const firstSpaceItemChild = childLevel?.querySelector<HTMLLIElement>(".mx_SpaceItem");
                        firstSpaceItemChild?.querySelector<HTMLDivElement>(".mx_SpaceButton")?.focus();
                    }
                }
                break;

            default:
                handled = false;
        }

        if (handled) {
            ev.stopPropagation();
            ev.preventDefault();
        }
    };

    private onClick = (ev: React.MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
        SpaceStore.instance.setActiveSpace(this.props.space);
    };

    private onMenuOpenClick = (ev: React.MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
        const target = ev.target as HTMLButtonElement;
        this.setState({ contextMenuPosition: target.getBoundingClientRect() });
    };

    private onMenuClose = () => {
        this.setState({ contextMenuPosition: null });
    };

    private onInviteClick = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        showSpaceInvite(this.props.space);
        this.setState({ contextMenuPosition: null }); // also close the menu
    };

    private onSettingsClick = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        showSpaceSettings(this.context, this.props.space);
        this.setState({ contextMenuPosition: null }); // also close the menu
    };

    private onLeaveClick = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        defaultDispatcher.dispatch({
            action: "leave_room",
            room_id: this.props.space.roomId,
        });
        this.setState({ contextMenuPosition: null }); // also close the menu
    };

    private onNewRoomClick = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        showCreateNewRoom(this.context, this.props.space);
        this.setState({ contextMenuPosition: null }); // also close the menu
    };

    private onAddExistingRoomClick = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        showAddExistingRooms(this.context, this.props.space);
        this.setState({ contextMenuPosition: null }); // also close the menu
    };

    private onMembersClick = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        if (!RoomViewStore.getRoomId()) {
            defaultDispatcher.dispatch({
                action: "view_room",
                room_id: this.props.space.roomId,
            }, true);
        }

        defaultDispatcher.dispatch<SetRightPanelPhasePayload>({
            action: Action.SetRightPanelPhase,
            phase: RightPanelPhases.SpaceMemberList,
            refireParams: { space: this.props.space },
        });
        this.setState({ contextMenuPosition: null }); // also close the menu
    };

    private onExploreRoomsClick = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        defaultDispatcher.dispatch({
            action: "view_room",
            room_id: this.props.space.roomId,
        });
        this.setState({ contextMenuPosition: null }); // also close the menu
    };

    private renderContextMenu(): React.ReactElement {
        if (this.props.space.getMyMembership() !== "join") return null;

        let contextMenu = null;
        if (this.state.contextMenuPosition) {
            const userId = this.context.getUserId();

            let inviteOption;
            if (this.props.space.getJoinRule() === "public" || this.props.space.canInvite(userId)) {
                inviteOption = (
                    <IconizedContextMenuOption
                        className="mx_SpacePanel_contextMenu_inviteButton"
                        iconClassName="mx_SpacePanel_iconInvite"
                        label={_t("Invite people")}
                        onClick={this.onInviteClick}
                    />
                );
            }

            let settingsOption;
            let leaveSection;
            if (shouldShowSpaceSettings(this.context, this.props.space)) {
                settingsOption = (
                    <IconizedContextMenuOption
                        iconClassName="mx_SpacePanel_iconSettings"
                        label={_t("Settings")}
                        onClick={this.onSettingsClick}
                    />
                );
            } else {
                leaveSection = <IconizedContextMenuOptionList red first>
                    <IconizedContextMenuOption
                        iconClassName="mx_SpacePanel_iconLeave"
                        label={_t("Leave space")}
                        onClick={this.onLeaveClick}
                    />
                </IconizedContextMenuOptionList>;
            }

            const canAddRooms = this.props.space.currentState.maySendStateEvent(EventType.SpaceChild, userId);

            let newRoomSection;
            if (this.props.space.currentState.maySendStateEvent(EventType.SpaceChild, userId)) {
                newRoomSection = <IconizedContextMenuOptionList first>
                    <IconizedContextMenuOption
                        iconClassName="mx_SpacePanel_iconPlus"
                        label={_t("Create new room")}
                        onClick={this.onNewRoomClick}
                    />
                    <IconizedContextMenuOption
                        iconClassName="mx_SpacePanel_iconHash"
                        label={_t("Add existing room")}
                        onClick={this.onAddExistingRoomClick}
                    />
                </IconizedContextMenuOptionList>;
            }

            contextMenu = <IconizedContextMenu
                {...toRightOf(this.state.contextMenuPosition, 0)}
                onFinished={this.onMenuClose}
                className="mx_SpacePanel_contextMenu"
                compact
            >
                <div className="mx_SpacePanel_contextMenu_header">
                    { this.props.space.name }
                </div>
                <IconizedContextMenuOptionList first>
                    { inviteOption }
                    <IconizedContextMenuOption
                        iconClassName="mx_SpacePanel_iconMembers"
                        label={_t("Members")}
                        onClick={this.onMembersClick}
                    />
                    { settingsOption }
                    <IconizedContextMenuOption
                        iconClassName="mx_SpacePanel_iconExplore"
                        label={canAddRooms ? _t("Manage & explore rooms") : _t("Explore rooms")}
                        onClick={this.onExploreRoomsClick}
                    />
                </IconizedContextMenuOptionList>
                { newRoomSection }
                { leaveSection }
            </IconizedContextMenu>;
        }

        return (
            <React.Fragment>
                <ContextMenuTooltipButton
                    className="mx_SpaceButton_menuButton"
                    onClick={this.onMenuOpenClick}
                    title={_t("Space options")}
                    isExpanded={!!this.state.contextMenuPosition}
                />
                { contextMenu }
            </React.Fragment>
        );
    }

    render() {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { space, activeSpaces, isNested, isPanelCollapsed, onExpand, parents, innerRef,
            ...otherProps } = this.props;

        const collapsed = this.isCollapsed;

        const isActive = activeSpaces.includes(space);
        const itemClasses = classNames(this.props.className, {
            "mx_SpaceItem": true,
            "mx_SpaceItem_narrow": isPanelCollapsed,
            "collapsed": collapsed,
            "hasSubSpaces": this.state.childSpaces?.length,
        });

        const isInvite = space.getMyMembership() === "invite";
        const classes = classNames("mx_SpaceButton", {
            mx_SpaceButton_active: isActive,
            mx_SpaceButton_hasMenuOpen: !!this.state.contextMenuPosition,
            mx_SpaceButton_narrow: isPanelCollapsed,
            mx_SpaceButton_invite: isInvite,
        });
        const notificationState = isInvite
            ? StaticNotificationState.forSymbol("!", NotificationColor.Red)
            : SpaceStore.instance.getNotificationState(space.roomId);

        let childItems;
        if (this.state.childSpaces?.length && !collapsed) {
            childItems = <SpaceTreeLevel
                spaces={this.state.childSpaces}
                activeSpaces={activeSpaces}
                isNested={true}
                parents={new Set(parents).add(space.roomId)}
            />;
        }

        let notifBadge;
        if (notificationState) {
            notifBadge = <div className="mx_SpacePanel_badgeContainer">
                <NotificationBadge forceCount={false} notification={notificationState} />
            </div>;
        }

        const avatarSize = isNested ? 24 : 32;

        const toggleCollapseButton = this.state.childSpaces?.length ?
            <AccessibleButton
                className="mx_SpaceButton_toggleCollapse"
                onClick={this.toggleCollapse}
                tabIndex={-1}
                aria-label={collapsed ? _t("Expand") : _t("Collapse")}
            /> : null;

        return (
            <li {...otherProps} className={itemClasses} ref={innerRef}>
                <RovingAccessibleTooltipButton
                    className={classes}
                    title={space.name}
                    onClick={this.onClick}
                    onContextMenu={this.onContextMenu}
                    forceHide={!isPanelCollapsed || !!this.state.contextMenuPosition}
                    role="treeitem"
                    aria-expanded={!collapsed}
                    inputRef={this.buttonRef}
                    onKeyDown={this.onKeyDown}
                >
                    { toggleCollapseButton }
                    <div className="mx_SpaceButton_selectionWrapper">
                        <RoomAvatar width={avatarSize} height={avatarSize} room={space} />
                        { !isPanelCollapsed && <span className="mx_SpaceButton_name">{ space.name }</span> }
                        { notifBadge }
                        { this.renderContextMenu() }
                    </div>
                </RovingAccessibleTooltipButton>

                { childItems }
            </li>
        );
    }
}

interface ITreeLevelProps {
    spaces: Room[];
    activeSpaces: Room[];
    isNested?: boolean;
    parents: Set<string>;
}

const SpaceTreeLevel: React.FC<ITreeLevelProps> = ({
    spaces,
    activeSpaces,
    isNested,
    parents,
}) => {
    return <ul className="mx_SpaceTreeLevel">
        {spaces.map(s => {
            return (<SpaceItem
                key={s.roomId}
                activeSpaces={activeSpaces}
                space={s}
                isNested={isNested}
                parents={parents}
            />);
        })}
    </ul>;
};

export default SpaceTreeLevel;
