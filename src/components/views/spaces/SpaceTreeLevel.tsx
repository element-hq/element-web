/*
Copyright 2024 New Vector Ltd.
Copyright 2021-2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, {
    type MouseEvent,
    type ComponentProps,
    type ComponentType,
    createRef,
    type InputHTMLAttributes,
    type LegacyRef,
    type RefObject,
} from "react";
import classNames from "classnames";
import { type Room, RoomEvent } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { type DraggableProvidedDragHandleProps } from "react-beautiful-dnd";

import RoomAvatar from "../avatars/RoomAvatar";
import SpaceStore from "../../../stores/spaces/SpaceStore";
import { type SpaceKey } from "../../../stores/spaces";
import SpaceTreeLevelLayoutStore from "../../../stores/spaces/SpaceTreeLevelLayoutStore";
import NotificationBadge from "../rooms/NotificationBadge";
import { _t } from "../../../languageHandler";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { ContextMenuTooltipButton } from "../../../accessibility/context_menu/ContextMenuTooltipButton";
import { toRightOf, useContextMenu } from "../../structures/ContextMenu";
import AccessibleButton, {
    type ButtonEvent,
    type ButtonProps as AccessibleButtonProps,
} from "../elements/AccessibleButton";
import { StaticNotificationState } from "../../../stores/notifications/StaticNotificationState";
import { NotificationLevel } from "../../../stores/notifications/NotificationLevel";
import { getKeyBindingsManager } from "../../../KeyBindingsManager";
import { type NotificationState } from "../../../stores/notifications/NotificationState";
import SpaceContextMenu from "../context_menus/SpaceContextMenu";
import { useRovingTabIndex } from "../../../accessibility/RovingTabIndex";
import { KeyBindingAction } from "../../../accessibility/KeyboardShortcuts";

type ButtonProps<T extends keyof HTMLElementTagNameMap> = Omit<
    AccessibleButtonProps<T>,
    "title" | "onClick" | "size" | "element"
> & {
    space?: Room;
    spaceKey?: SpaceKey;
    className?: string;
    selected?: boolean;
    label: string;
    contextMenuTooltip?: string;
    notificationState?: NotificationState;
    isNarrow?: boolean;
    size: string;
    innerRef?: RefObject<HTMLDivElement>;
    ContextMenuComponent?: ComponentType<ComponentProps<typeof SpaceContextMenu>>;
    onClick?(ev?: ButtonEvent): void;
};

export const SpaceButton = <T extends keyof HTMLElementTagNameMap>({
    space,
    spaceKey: _spaceKey,
    className,
    selected,
    label,
    contextMenuTooltip,
    notificationState,
    size,
    isNarrow,
    children,
    innerRef,
    ContextMenuComponent,
    ...props
}: ButtonProps<T>): JSX.Element => {
    const [menuDisplayed, handle, openMenu, closeMenu] = useContextMenu<HTMLDivElement>(innerRef);
    const [onFocus, isActive, ref] = useRovingTabIndex<HTMLDivElement>(handle);
    const tabIndex = isActive ? 0 : -1;

    const spaceKey = _spaceKey ?? space?.roomId;

    let avatar = (
        <div className="mx_SpaceButton_avatarPlaceholder">
            <div className="mx_SpaceButton_icon" />
        </div>
    );
    if (space) {
        avatar = <RoomAvatar size={size} room={space} type="square" />;
    }

    let notifBadge;
    if (spaceKey && notificationState) {
        let ariaLabel = _t("a11y_jump_first_unread_room");
        if (space?.getMyMembership() === KnownMembership.Invite) {
            ariaLabel = _t("a11y|jump_first_invite");
        }

        const jumpToNotification = (ev: MouseEvent): void => {
            ev.stopPropagation();
            ev.preventDefault();
            SpaceStore.instance.setActiveRoomInSpace(spaceKey);
        };

        notifBadge = (
            <div className="mx_SpacePanel_badgeContainer">
                <NotificationBadge
                    onClick={jumpToNotification}
                    notification={notificationState}
                    aria-label={ariaLabel}
                    tabIndex={tabIndex}
                    showUnsentTooltip={true}
                />
            </div>
        );
    }

    let contextMenu: JSX.Element | undefined;
    if (menuDisplayed && handle.current && ContextMenuComponent) {
        contextMenu = (
            <ContextMenuComponent
                {...toRightOf(handle.current.getBoundingClientRect(), 0)}
                space={space}
                onFinished={closeMenu}
            />
        );
    }

    const viewSpaceHome = (): void =>
        // space is set here because of the assignment condition of onClick
        defaultDispatcher.dispatch({ action: Action.ViewRoom, room_id: space!.roomId });
    const activateSpace = (): void => {
        if (spaceKey) SpaceStore.instance.setActiveSpace(spaceKey);
    };
    const onClick = props.onClick ?? (selected && space ? viewSpaceHome : activateSpace);

    return (
        <AccessibleButton
            {...props}
            className={classNames("mx_SpaceButton", className, {
                mx_SpaceButton_active: selected,
                mx_SpaceButton_hasMenuOpen: menuDisplayed,
                mx_SpaceButton_narrow: isNarrow,
            })}
            aria-label={label}
            title={!isNarrow || menuDisplayed ? undefined : label}
            onClick={onClick}
            onContextMenu={openMenu}
            ref={ref}
            tabIndex={tabIndex}
            onFocus={onFocus}
        >
            {children}
            <div className="mx_SpaceButton_selectionWrapper">
                <div className="mx_SpaceButton_avatarWrapper">
                    {avatar}
                    {notifBadge}
                </div>
                {!isNarrow && <span className="mx_SpaceButton_name">{label}</span>}

                {ContextMenuComponent && (
                    <ContextMenuTooltipButton
                        className="mx_SpaceButton_menuButton"
                        onClick={openMenu}
                        title={contextMenuTooltip}
                        isExpanded={menuDisplayed}
                    />
                )}

                {contextMenu}
            </div>
        </AccessibleButton>
    );
};

interface IItemProps extends InputHTMLAttributes<HTMLLIElement> {
    space: Room;
    activeSpaces: SpaceKey[];
    isNested?: boolean;
    isPanelCollapsed?: boolean;
    onExpand?: () => void;
    parents?: Set<string>;
    innerRef?: LegacyRef<HTMLLIElement>;
    dragHandleProps?: DraggableProvidedDragHandleProps | null;
}

interface IItemState {
    name: string;
    collapsed: boolean;
    childSpaces: Room[];
}

export class SpaceItem extends React.PureComponent<IItemProps, IItemState> {
    private buttonRef = createRef<HTMLDivElement>();

    public constructor(props: IItemProps) {
        super(props);

        const collapsed = SpaceTreeLevelLayoutStore.instance.getSpaceCollapsedState(
            props.space.roomId,
            this.props.parents,
            !props.isNested, // default to collapsed for root items
        );

        this.state = {
            name: this.props.space.name,
            collapsed,
            childSpaces: this.childSpaces,
        };
    }

    public componentDidMount(): void {
        SpaceStore.instance.on(this.props.space.roomId, this.onSpaceUpdate);
        this.props.space.on(RoomEvent.Name, this.onRoomNameChange);
    }

    public componentWillUnmount(): void {
        SpaceStore.instance.off(this.props.space.roomId, this.onSpaceUpdate);
        this.props.space.off(RoomEvent.Name, this.onRoomNameChange);
    }

    private onSpaceUpdate = (): void => {
        this.setState({
            childSpaces: this.childSpaces,
        });
    };

    private onRoomNameChange = (): void => {
        this.setState({
            name: this.props.space.name,
        });
    };

    private get childSpaces(): Room[] {
        return SpaceStore.instance
            .getChildSpaces(this.props.space.roomId)
            .filter((s) => !this.props.parents?.has(s.roomId));
    }

    private get isCollapsed(): boolean {
        return this.state.collapsed || !!this.props.isPanelCollapsed;
    }

    private toggleCollapse = (evt: ButtonEvent): void => {
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

    private onKeyDown = (ev: React.KeyboardEvent): void => {
        let handled = true;
        const action = getKeyBindingsManager().getRoomListAction(ev);
        const hasChildren = this.state.childSpaces?.length;
        switch (action) {
            case KeyBindingAction.CollapseRoomListSection:
                if (hasChildren && !this.isCollapsed) {
                    this.toggleCollapse(ev);
                } else {
                    const parentItem = this.buttonRef?.current?.parentElement?.parentElement;
                    const parentButton = parentItem?.previousElementSibling as HTMLElement;
                    parentButton?.focus();
                }
                break;

            case KeyBindingAction.ExpandRoomListSection:
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

    public render(): React.ReactNode {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const {
            space,
            activeSpaces,
            isNested,
            isPanelCollapsed,
            onExpand,
            parents,
            innerRef,
            dragHandleProps,
            ...otherProps
        } = this.props;

        const collapsed = this.isCollapsed;

        const itemClasses = classNames(this.props.className, {
            mx_SpaceItem: true,
            mx_SpaceItem_narrow: isPanelCollapsed,
            collapsed: collapsed,
            hasSubSpaces: this.state.childSpaces?.length,
        });

        const isInvite = space.getMyMembership() === KnownMembership.Invite;

        const notificationState = isInvite
            ? StaticNotificationState.forSymbol("!", NotificationLevel.Highlight)
            : SpaceStore.instance.getNotificationState(space.roomId);

        const hasChildren = this.state.childSpaces?.length;

        let childItems;
        if (hasChildren && !collapsed) {
            childItems = (
                <SpaceTreeLevel
                    spaces={this.state.childSpaces}
                    activeSpaces={activeSpaces}
                    isNested={true}
                    parents={new Set(parents).add(space.roomId)}
                />
            );
        }

        const toggleCollapseButton = hasChildren ? (
            <AccessibleButton
                className="mx_SpaceButton_toggleCollapse"
                onClick={this.toggleCollapse}
                tabIndex={-1}
                aria-label={collapsed ? _t("action|expand") : _t("action|collapse")}
            />
        ) : null;

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { tabIndex, ...restDragHandleProps } = dragHandleProps || {};
        const selected = activeSpaces.includes(space.roomId);

        return (
            <li
                {...otherProps}
                className={itemClasses}
                ref={innerRef}
                aria-expanded={hasChildren ? !collapsed : undefined}
                aria-selected={selected}
                role="treeitem"
            >
                <SpaceButton
                    {...restDragHandleProps}
                    space={space}
                    className={isInvite ? "mx_SpaceButton_invite" : undefined}
                    selected={selected}
                    label={this.state.name}
                    contextMenuTooltip={_t("space|context_menu|options")}
                    notificationState={notificationState}
                    isNarrow={isPanelCollapsed}
                    size={isNested ? "24px" : "32px"}
                    onKeyDown={this.onKeyDown}
                    ContextMenuComponent={
                        this.props.space.getMyMembership() === KnownMembership.Join ? SpaceContextMenu : undefined
                    }
                >
                    {toggleCollapseButton}
                </SpaceButton>

                {childItems}
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

const SpaceTreeLevel: React.FC<ITreeLevelProps> = ({ spaces, activeSpaces, isNested, parents }) => {
    return (
        <ul className="mx_SpaceTreeLevel" role="group">
            {spaces.map((s) => {
                return (
                    <SpaceItem
                        key={s.roomId}
                        activeSpaces={activeSpaces}
                        space={s}
                        isNested={isNested}
                        parents={parents}
                    />
                );
            })}
        </ul>
    );
};
