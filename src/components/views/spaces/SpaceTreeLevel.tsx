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

import React, {
    createRef,
    InputHTMLAttributes,
    LegacyRef,
    ComponentProps,
    ComponentType,
} from "react";
import classNames from "classnames";
import { Room } from "matrix-js-sdk/src/models/room";

import RoomAvatar from "../avatars/RoomAvatar";
import SpaceStore from "../../../stores/spaces/SpaceStore";
import { SpaceKey } from "../../../stores/spaces";
import SpaceTreeLevelLayoutStore from "../../../stores/spaces/SpaceTreeLevelLayoutStore";
import NotificationBadge from "../rooms/NotificationBadge";
import { _t } from "../../../languageHandler";
import { ContextMenuTooltipButton } from "../../../accessibility/context_menu/ContextMenuTooltipButton";
import { toRightOf, useContextMenu } from "../../structures/ContextMenu";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import AccessibleButton, { ButtonEvent } from "../elements/AccessibleButton";
import { StaticNotificationState } from "../../../stores/notifications/StaticNotificationState";
import { NotificationColor } from "../../../stores/notifications/NotificationColor";
import { getKeyBindingsManager, RoomListAction } from "../../../KeyBindingsManager";
import { NotificationState } from "../../../stores/notifications/NotificationState";
import SpaceContextMenu from "../context_menus/SpaceContextMenu";
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import { DraggableProvidedDragHandleProps } from "react-beautiful-dnd";
import { useRovingTabIndex } from "../../../accessibility/RovingTabIndex";

interface IButtonProps extends Omit<ComponentProps<typeof AccessibleTooltipButton>, "title" | "onClick"> {
    space?: Room;
    spaceKey?: SpaceKey;
    className?: string;
    selected?: boolean;
    label: string;
    contextMenuTooltip?: string;
    notificationState?: NotificationState;
    isNarrow?: boolean;
    avatarSize?: number;
    ContextMenuComponent?: ComponentType<ComponentProps<typeof SpaceContextMenu>>;
    onClick?(ev?: ButtonEvent): void;
}

export const SpaceButton: React.FC<IButtonProps> = ({
    space,
    spaceKey,
    className,
    selected,
    label,
    contextMenuTooltip,
    notificationState,
    avatarSize,
    isNarrow,
    children,
    ContextMenuComponent,
    ...props
}) => {
    const [menuDisplayed, ref, openMenu, closeMenu] = useContextMenu<HTMLElement>();
    const [onFocus, isActive, handle] = useRovingTabIndex(ref);
    const tabIndex = isActive ? 0 : -1;

    let avatar = <div className="mx_SpaceButton_avatarPlaceholder"><div className="mx_SpaceButton_icon" /></div>;
    if (space) {
        avatar = <RoomAvatar width={avatarSize} height={avatarSize} room={space} />;
    }

    let notifBadge;
    if (notificationState) {
        let ariaLabel = _t("Jump to first unread room.");
        if (space?.getMyMembership() === "invite") {
            ariaLabel = _t("Jump to first invite.");
        }

        notifBadge = <div className="mx_SpacePanel_badgeContainer">
            <NotificationBadge
                onClick={() => SpaceStore.instance.setActiveRoomInSpace(spaceKey ?? space.roomId)}
                forceCount={false}
                notification={notificationState}
                aria-label={ariaLabel}
                tabIndex={tabIndex}
                showUnsentTooltip={true}
            />
        </div>;
    }

    let contextMenu: JSX.Element;
    if (menuDisplayed && ContextMenuComponent) {
        contextMenu = <ContextMenuComponent
            {...toRightOf(handle.current?.getBoundingClientRect(), 0)}
            space={space}
            onFinished={closeMenu}
        />;
    }

    return (
        <AccessibleTooltipButton
            {...props}
            className={classNames("mx_SpaceButton", className, {
                mx_SpaceButton_active: selected,
                mx_SpaceButton_hasMenuOpen: menuDisplayed,
                mx_SpaceButton_narrow: isNarrow,
            })}
            title={label}
            onClick={spaceKey ? () => SpaceStore.instance.setActiveSpace(spaceKey) : props.onClick}
            onContextMenu={openMenu}
            forceHide={!isNarrow || menuDisplayed}
            inputRef={handle}
            tabIndex={tabIndex}
            onFocus={onFocus}
        >
            { children }
            <div className="mx_SpaceButton_selectionWrapper">
                <div className="mx_SpaceButton_avatarWrapper">
                    { avatar }
                    { notifBadge }
                </div>
                { !isNarrow && <span className="mx_SpaceButton_name">{ label }</span> }

                { ContextMenuComponent && <ContextMenuTooltipButton
                    className="mx_SpaceButton_menuButton"
                    onClick={openMenu}
                    title={contextMenuTooltip}
                    isExpanded={menuDisplayed}
                /> }

                { contextMenu }
            </div>
        </AccessibleTooltipButton>
    );
};

interface IItemProps extends InputHTMLAttributes<HTMLLIElement> {
    space?: Room;
    activeSpaces: SpaceKey[];
    isNested?: boolean;
    isPanelCollapsed?: boolean;
    onExpand?: Function;
    parents?: Set<string>;
    innerRef?: LegacyRef<HTMLLIElement>;
    dragHandleProps?: DraggableProvidedDragHandleProps;
}

interface IItemState {
    collapsed: boolean;
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
        SpaceStore.instance.setActiveSpace(this.props.space.roomId);
    };

    render() {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { space, activeSpaces, isNested, isPanelCollapsed, onExpand, parents, innerRef, dragHandleProps,
            ...otherProps } = this.props;

        const collapsed = this.isCollapsed;

        const itemClasses = classNames(this.props.className, {
            "mx_SpaceItem": true,
            "mx_SpaceItem_narrow": isPanelCollapsed,
            "collapsed": collapsed,
            "hasSubSpaces": this.state.childSpaces?.length,
        });

        const isInvite = space.getMyMembership() === "invite";

        const notificationState = isInvite
            ? StaticNotificationState.forSymbol("!", NotificationColor.Red)
            : SpaceStore.instance.getNotificationState(space.roomId);

        const hasChildren = this.state.childSpaces?.length;

        let childItems;
        if (hasChildren && !collapsed) {
            childItems = <SpaceTreeLevel
                spaces={this.state.childSpaces}
                activeSpaces={activeSpaces}
                isNested={true}
                parents={new Set(parents).add(space.roomId)}
            />;
        }

        const toggleCollapseButton = hasChildren ?
            <AccessibleButton
                className="mx_SpaceButton_toggleCollapse"
                onClick={this.toggleCollapse}
                tabIndex={-1}
                aria-label={collapsed ? _t("Expand") : _t("Collapse")}
            /> : null;

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { tabIndex, ...restDragHandleProps } = dragHandleProps || {};

        return (
            <li
                {...otherProps}
                className={itemClasses}
                ref={innerRef}
                aria-expanded={hasChildren ? !collapsed : undefined}
                role="treeitem"
            >
                <SpaceButton
                    {...restDragHandleProps}
                    space={space}
                    className={isInvite ? "mx_SpaceButton_invite" : undefined}
                    selected={activeSpaces.includes(space.roomId)}
                    label={space.name}
                    contextMenuTooltip={_t("Space options")}
                    notificationState={notificationState}
                    isNarrow={isPanelCollapsed}
                    avatarSize={isNested ? 24 : 32}
                    onClick={this.onClick}
                    onKeyDown={this.onKeyDown}
                    ContextMenuComponent={this.props.space.getMyMembership() === "join" ? SpaceContextMenu : undefined}
                >
                    { toggleCollapseButton }
                </SpaceButton>

                { childItems }
            </li>
        );
    }
}

interface ITreeLevelProps {
    spaces: Room[];
    activeSpaces: SpaceKey[];
    isNested?: boolean;
    parents: Set<string>;
}

const SpaceTreeLevel: React.FC<ITreeLevelProps> = ({
    spaces,
    activeSpaces,
    isNested,
    parents,
}) => {
    return <ul className="mx_SpaceTreeLevel" role="group">
        { spaces.map(s => {
            return (<SpaceItem
                key={s.roomId}
                activeSpaces={activeSpaces}
                space={s}
                isNested={isNested}
                parents={parents}
            />);
        }) }
    </ul>;
};

export default SpaceTreeLevel;
