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

import React from "react";
import classNames from "classnames";
import {Room} from "matrix-js-sdk/src/models/room";

import RoomAvatar from "../avatars/RoomAvatar";
import SpaceStore from "../../../stores/SpaceStore";
import NotificationBadge from "../rooms/NotificationBadge";
import {RovingAccessibleButton} from "../../../accessibility/roving/RovingAccessibleButton";
import {RovingAccessibleTooltipButton} from "../../../accessibility/roving/RovingAccessibleTooltipButton";
import IconizedContextMenu, {
    IconizedContextMenuOption,
    IconizedContextMenuOptionList,
} from "../context_menus/IconizedContextMenu";
import {_t} from "../../../languageHandler";
import {ContextMenuTooltipButton} from "../../../accessibility/context_menu/ContextMenuTooltipButton";
import {toRightOf} from "../../structures/ContextMenu";
import {
    shouldShowSpaceSettings,
    showAddExistingRooms,
    showCreateNewRoom,
    showSpaceInvite,
    showSpaceSettings,
} from "../../../utils/space";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import AccessibleButton, {ButtonEvent} from "../elements/AccessibleButton";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import {Action} from "../../../dispatcher/actions";
import RoomViewStore from "../../../stores/RoomViewStore";
import {SetRightPanelPhasePayload} from "../../../dispatcher/payloads/SetRightPanelPhasePayload";
import {RightPanelPhases} from "../../../stores/RightPanelStorePhases";
import {EventType} from "matrix-js-sdk/src/@types/event";

interface IItemProps {
    space?: Room;
    activeSpaces: Room[];
    isNested?: boolean;
    isPanelCollapsed?: boolean;
    onExpand?: Function;
    parents?: Set<string>;
}

interface IItemState {
    collapsed: boolean;
    contextMenuPosition: Pick<DOMRect, "right" | "top" | "height">;
}

export class SpaceItem extends React.PureComponent<IItemProps, IItemState> {
    static contextType = MatrixClientContext;

    constructor(props) {
        super(props);

        this.state = {
            collapsed: !props.isNested,   // default to collapsed for root items
            contextMenuPosition: null,
        };
    }

    private toggleCollapse(evt) {
        if (this.props.onExpand && this.state.collapsed) {
            this.props.onExpand();
        }
        this.setState({collapsed: !this.state.collapsed});
        // don't bubble up so encapsulating button for space
        // doesn't get triggered
        evt.stopPropagation();
    }

    private onContextMenu = (ev: React.MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
        this.setState({
            contextMenuPosition: {
                right: ev.clientX,
                top: ev.clientY,
                height: 0,
            },
        });
    }

    private onClick = (ev: React.MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
        SpaceStore.instance.setActiveSpace(this.props.space);
    };

    private onMenuOpenClick = (ev: React.MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
        const target = ev.target as HTMLButtonElement;
        this.setState({contextMenuPosition: target.getBoundingClientRect()});
    };

    private onMenuClose = () => {
        this.setState({contextMenuPosition: null});
    };

    private onInviteClick = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        showSpaceInvite(this.props.space);
        this.setState({contextMenuPosition: null}); // also close the menu
    };

    private onSettingsClick = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        showSpaceSettings(this.context, this.props.space);
        this.setState({contextMenuPosition: null}); // also close the menu
    };

    private onLeaveClick = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        defaultDispatcher.dispatch({
            action: "leave_room",
            room_id: this.props.space.roomId,
        });
        this.setState({contextMenuPosition: null}); // also close the menu
    };

    private onNewRoomClick = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        showCreateNewRoom(this.context, this.props.space);
        this.setState({contextMenuPosition: null}); // also close the menu
    };

    private onAddExistingRoomClick = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        showAddExistingRooms(this.context, this.props.space);
        this.setState({contextMenuPosition: null}); // also close the menu
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
        this.setState({contextMenuPosition: null}); // also close the menu
    };

    private onExploreRoomsClick = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        defaultDispatcher.dispatch({
            action: "view_room",
            room_id: this.props.space.roomId,
        });
        this.setState({contextMenuPosition: null}); // also close the menu
    };

    private renderContextMenu(): React.ReactElement {
        let contextMenu = null;
        if (this.state.contextMenuPosition) {
            const userId = this.context.getUserId();

            let inviteOption;
            if (this.props.space.canInvite(userId)) {
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
        const {space, activeSpaces, isNested} = this.props;

        const forceCollapsed = this.props.isPanelCollapsed;
        const isNarrow = this.props.isPanelCollapsed;
        const collapsed = this.state.collapsed || forceCollapsed;

        const childSpaces = SpaceStore.instance.getChildSpaces(space.roomId)
            .filter(s => !this.props.parents?.has(s.roomId));
        const isActive = activeSpaces.includes(space);
        const itemClasses = classNames({
            "mx_SpaceItem": true,
            "collapsed": collapsed,
            "hasSubSpaces": childSpaces && childSpaces.length,
        });
        const classes = classNames("mx_SpaceButton", {
            mx_SpaceButton_active: isActive,
            mx_SpaceButton_hasMenuOpen: !!this.state.contextMenuPosition,
            mx_SpaceButton_narrow: isNarrow,
        });
        const notificationState = SpaceStore.instance.getNotificationState(space.roomId);

        let childItems;
        if (childSpaces && !collapsed) {
            childItems = <SpaceTreeLevel
                spaces={childSpaces}
                activeSpaces={activeSpaces}
                isNested={true}
                parents={new Set(this.props.parents).add(this.props.space.roomId)}
            />;
        }

        let notifBadge;
        if (notificationState) {
            notifBadge = <div className="mx_SpacePanel_badgeContainer">
                <NotificationBadge forceCount={false} notification={notificationState} />
            </div>;
        }

        const avatarSize = isNested ? 24 : 32;

        const toggleCollapseButton = childSpaces && childSpaces.length ?
            <AccessibleButton
                className="mx_SpaceButton_toggleCollapse"
                onClick={evt => this.toggleCollapse(evt)}
            /> : null;

        let button;
        if (isNarrow) {
            button = (
                <RovingAccessibleTooltipButton
                    className={classes}
                    title={space.name}
                    onClick={this.onClick}
                    onContextMenu={this.onContextMenu}
                    forceHide={!!this.state.contextMenuPosition}
                    role="treeitem"
                >
                    { toggleCollapseButton }
                    <div className="mx_SpaceButton_selectionWrapper">
                        <RoomAvatar width={avatarSize} height={avatarSize} room={space} />
                        { notifBadge }
                        { this.renderContextMenu() }
                    </div>
                </RovingAccessibleTooltipButton>
            );
        } else {
            button = (
                <RovingAccessibleButton
                    className={classes}
                    onClick={this.onClick}
                    onContextMenu={this.onContextMenu}
                    role="treeitem"
                >
                    { toggleCollapseButton }
                    <div className="mx_SpaceButton_selectionWrapper">
                        <RoomAvatar width={avatarSize} height={avatarSize} room={space} />
                        <span className="mx_SpaceButton_name">{ space.name }</span>
                        { notifBadge }
                        { this.renderContextMenu() }
                    </div>
                </RovingAccessibleButton>
            );
        }

        return (
            <li className={itemClasses}>
                { button }
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
}

export default SpaceTreeLevel;
