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

import React, { Dispatch, ReactNode, SetStateAction, useEffect, useState } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import classNames from "classnames";
import { Room } from "matrix-js-sdk/src/models/room";

import { _t } from "../../../languageHandler";
import RoomAvatar from "../avatars/RoomAvatar";
import { useContextMenu } from "../../structures/ContextMenu";
import SpaceCreateMenu from "./SpaceCreateMenu";
import { SpaceItem } from "./SpaceTreeLevel";
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import { useEventEmitter } from "../../../hooks/useEventEmitter";
import SpaceStore, {
    HOME_SPACE,
    UPDATE_INVITED_SPACES,
    UPDATE_SELECTED_SPACE,
    UPDATE_TOP_LEVEL_SPACES,
} from "../../../stores/SpaceStore";
import AutoHideScrollbar from "../../structures/AutoHideScrollbar";
import NotificationBadge from "../rooms/NotificationBadge";
import {
    RovingAccessibleButton,
    RovingAccessibleTooltipButton,
    RovingTabIndexProvider,
} from "../../../accessibility/RovingTabIndex";
import { Key } from "../../../Keyboard";
import { RoomNotificationStateStore } from "../../../stores/notifications/RoomNotificationStateStore";
import { NotificationState } from "../../../stores/notifications/NotificationState";
import SettingsStore from "../../../settings/SettingsStore";

interface IButtonProps {
    space?: Room;
    className?: string;
    selected?: boolean;
    tooltip?: string;
    notificationState?: NotificationState;
    isNarrow?: boolean;
    onClick(): void;
}

const SpaceButton: React.FC<IButtonProps> = ({
    space,
    className,
    selected,
    onClick,
    tooltip,
    notificationState,
    isNarrow,
    children,
}) => {
    const classes = classNames("mx_SpaceButton", className, {
        mx_SpaceButton_active: selected,
        mx_SpaceButton_narrow: isNarrow,
    });

    let avatar = <div className="mx_SpaceButton_avatarPlaceholder"><div className="mx_SpaceButton_icon" /></div>;
    if (space) {
        avatar = <RoomAvatar width={32} height={32} room={space} />;
    }

    let notifBadge;
    if (notificationState) {
        notifBadge = <div className="mx_SpacePanel_badgeContainer">
            <NotificationBadge forceCount={false} notification={notificationState} />
        </div>;
    }

    let button;
    if (isNarrow) {
        button = (
            <RovingAccessibleTooltipButton className={classes} title={tooltip} onClick={onClick} role="treeitem">
                <div className="mx_SpaceButton_selectionWrapper">
                    { avatar }
                    { notifBadge }
                    { children }
                </div>
            </RovingAccessibleTooltipButton>
        );
    } else {
        button = (
            <RovingAccessibleButton className={classes} onClick={onClick} role="treeitem">
                <div className="mx_SpaceButton_selectionWrapper">
                    { avatar }
                    <span className="mx_SpaceButton_name">{ tooltip }</span>
                    { notifBadge }
                    { children }
                </div>
            </RovingAccessibleButton>
        );
    }

    return <li className={classNames({
        "mx_SpaceItem": true,
        "collapsed": isNarrow,
    })}>
        { button }
    </li>;
};

const useSpaces = (): [Room[], Room[], Room | null] => {
    const [invites, setInvites] = useState<Room[]>(SpaceStore.instance.invitedSpaces);
    useEventEmitter(SpaceStore.instance, UPDATE_INVITED_SPACES, setInvites);
    const [spaces, setSpaces] = useState<Room[]>(SpaceStore.instance.spacePanelSpaces);
    useEventEmitter(SpaceStore.instance, UPDATE_TOP_LEVEL_SPACES, setSpaces);
    const [activeSpace, setActiveSpace] = useState<Room>(SpaceStore.instance.activeSpace);
    useEventEmitter(SpaceStore.instance, UPDATE_SELECTED_SPACE, setActiveSpace);
    return [invites, spaces, activeSpace];
};

interface IInnerSpacePanelProps {
    children?: ReactNode;
    isPanelCollapsed: boolean;
    setPanelCollapsed: Dispatch<SetStateAction<boolean>>;
}

// Optimisation based on https://github.com/atlassian/react-beautiful-dnd/blob/master/docs/api/droppable.md#recommended-droppable--performance-optimisation
const InnerSpacePanel = React.memo<IInnerSpacePanelProps>(({ children, isPanelCollapsed, setPanelCollapsed }) => {
    const [invites, spaces, activeSpace] = useSpaces();
    const activeSpaces = activeSpace ? [activeSpace] : [];

    const homeNotificationState = SettingsStore.getValue("feature_spaces.all_rooms")
        ? RoomNotificationStateStore.instance.globalState : SpaceStore.instance.getNotificationState(HOME_SPACE);

    return <div className="mx_SpaceTreeLevel">
        <SpaceButton
            className="mx_SpaceButton_home"
            onClick={() => SpaceStore.instance.setActiveSpace(null)}
            selected={!activeSpace}
            tooltip={SettingsStore.getValue("feature_spaces.all_rooms") ? _t("All rooms") : _t("Home")}
            notificationState={homeNotificationState}
            isNarrow={isPanelCollapsed}
        />
        { invites.map(s => (
            <SpaceItem
                key={s.roomId}
                space={s}
                activeSpaces={activeSpaces}
                isPanelCollapsed={isPanelCollapsed}
                onExpand={() => setPanelCollapsed(false)}
            />
        )) }
        { spaces.map((s, i) => (
            <Draggable key={s.roomId} draggableId={s.roomId} index={i}>
                {(provided, snapshot) => (
                    <SpaceItem
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        key={s.roomId}
                        innerRef={provided.innerRef}
                        className={snapshot.isDragging
                            ? "mx_SpaceItem_dragging"
                            : undefined}
                        space={s}
                        activeSpaces={activeSpaces}
                        isPanelCollapsed={isPanelCollapsed}
                        onExpand={() => setPanelCollapsed(false)}
                    />
                )}
            </Draggable>
        )) }
        { children }
    </div>;
});

const SpacePanel = () => {
    // We don't need the handle as we position the menu in a constant location
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [menuDisplayed, handle, openMenu, closeMenu] = useContextMenu<void>();
    const [isPanelCollapsed, setPanelCollapsed] = useState(true);

    useEffect(() => {
        if (!isPanelCollapsed && menuDisplayed) {
            closeMenu();
        }
    }, [isPanelCollapsed]); // eslint-disable-line react-hooks/exhaustive-deps

    let contextMenu = null;
    if (menuDisplayed) {
        contextMenu = <SpaceCreateMenu onFinished={closeMenu} />;
    }

    const onKeyDown = (ev: React.KeyboardEvent) => {
        let handled = true;

        switch (ev.key) {
            case Key.ARROW_UP:
                onMoveFocus(ev.target as Element, true);
                break;
            case Key.ARROW_DOWN:
                onMoveFocus(ev.target as Element, false);
                break;
            default:
                handled = false;
        }

        if (handled) {
            // consume all other keys in context menu
            ev.stopPropagation();
            ev.preventDefault();
        }
    };

    const onMoveFocus = (element: Element, up: boolean) => {
        let descending = false; // are we currently descending or ascending through the DOM tree?
        let classes: DOMTokenList;

        do {
            const child = up ? element.lastElementChild : element.firstElementChild;
            const sibling = up ? element.previousElementSibling : element.nextElementSibling;

            if (descending) {
                if (child) {
                    element = child;
                } else if (sibling) {
                    element = sibling;
                } else {
                    descending = false;
                    element = element.parentElement;
                }
            } else {
                if (sibling) {
                    element = sibling;
                    descending = true;
                } else {
                    element = element.parentElement;
                }
            }

            if (element) {
                if (element.classList.contains("mx_ContextualMenu")) { // we hit the top
                    element = up ? element.lastElementChild : element.firstElementChild;
                    descending = true;
                }
                classes = element.classList;
            }
        } while (element && !classes.contains("mx_SpaceButton"));

        if (element) {
            (element as HTMLElement).focus();
        }
    };

    const onNewClick = menuDisplayed ? closeMenu : () => {
        if (!isPanelCollapsed) setPanelCollapsed(true);
        openMenu();
    };

    return (
        <DragDropContext onDragEnd={result => {
            if (!result.destination) return; // dropped outside the list
            SpaceStore.instance.moveRootSpace(result.source.index, result.destination.index);
        }}>
            <RovingTabIndexProvider handleHomeEnd={true} onKeyDown={onKeyDown}>
                {({ onKeyDownHandler }) => (
                    <ul
                        className={classNames("mx_SpacePanel", { collapsed: isPanelCollapsed })}
                        onKeyDown={onKeyDownHandler}
                    >
                        <Droppable droppableId="top-level-spaces">
                            {(provided, snapshot) => (
                                <AutoHideScrollbar
                                    {...provided.droppableProps}
                                    wrappedRef={provided.innerRef}
                                    className="mx_SpacePanel_spaceTreeWrapper"
                                    style={snapshot.isDraggingOver ? {
                                        pointerEvents: "none",
                                    } : undefined}
                                >
                                    <InnerSpacePanel
                                        isPanelCollapsed={isPanelCollapsed}
                                        setPanelCollapsed={setPanelCollapsed}
                                    >
                                        { provided.placeholder }
                                    </InnerSpacePanel>

                                    <SpaceButton
                                        className={classNames("mx_SpaceButton_new", {
                                            mx_SpaceButton_newCancel: menuDisplayed,
                                        })}
                                        tooltip={menuDisplayed ? _t("Cancel") : _t("Create a space")}
                                        onClick={onNewClick}
                                        isNarrow={isPanelCollapsed}
                                    />
                                </AutoHideScrollbar>
                            )}
                        </Droppable>
                        <AccessibleTooltipButton
                            className={classNames("mx_SpacePanel_toggleCollapse", { expanded: !isPanelCollapsed })}
                            onClick={() => setPanelCollapsed(!isPanelCollapsed)}
                            title={isPanelCollapsed ? _t("Expand space panel") : _t("Collapse space panel")}
                        />
                        { contextMenu }
                    </ul>
                )}
            </RovingTabIndexProvider>
        </DragDropContext>
    );
};

export default SpacePanel;
