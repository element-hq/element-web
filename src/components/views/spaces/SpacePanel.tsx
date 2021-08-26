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
    ComponentProps,
    Dispatch,
    ReactNode,
    SetStateAction,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";
import classNames from "classnames";
import { Room } from "matrix-js-sdk/src/models/room";

import { _t } from "../../../languageHandler";
import { useContextMenu } from "../../structures/ContextMenu";
import SpaceCreateMenu from "./SpaceCreateMenu";
import { SpaceButton, SpaceItem } from "./SpaceTreeLevel";
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import { useEventEmitterState } from "../../../hooks/useEventEmitter";
import SpaceStore, {
    HOME_SPACE,
    UPDATE_HOME_BEHAVIOUR,
    UPDATE_INVITED_SPACES,
    UPDATE_SELECTED_SPACE,
    UPDATE_TOP_LEVEL_SPACES,
} from "../../../stores/SpaceStore";
import AutoHideScrollbar from "../../structures/AutoHideScrollbar";
import { RovingTabIndexProvider } from "../../../accessibility/RovingTabIndex";
import { Key } from "../../../Keyboard";
import { RoomNotificationStateStore } from "../../../stores/notifications/RoomNotificationStateStore";
import SpaceContextMenu from "../context_menus/SpaceContextMenu";
import IconizedContextMenu, {
    IconizedContextMenuCheckbox,
    IconizedContextMenuOptionList,
} from "../context_menus/IconizedContextMenu";
import SettingsStore from "../../../settings/SettingsStore";
import { SettingLevel } from "../../../settings/SettingLevel";
import UIStore from "../../../stores/UIStore";

const useSpaces = (): [Room[], Room[], Room | null] => {
    const invites = useEventEmitterState<Room[]>(SpaceStore.instance, UPDATE_INVITED_SPACES, () => {
        return SpaceStore.instance.invitedSpaces;
    });
    const spaces = useEventEmitterState<Room[]>(SpaceStore.instance, UPDATE_TOP_LEVEL_SPACES, () => {
        return SpaceStore.instance.spacePanelSpaces;
    });
    const activeSpace = useEventEmitterState<Room>(SpaceStore.instance, UPDATE_SELECTED_SPACE, () => {
        return SpaceStore.instance.activeSpace;
    });
    return [invites, spaces, activeSpace];
};

interface IInnerSpacePanelProps {
    children?: ReactNode;
    isPanelCollapsed: boolean;
    setPanelCollapsed: Dispatch<SetStateAction<boolean>>;
}

const HomeButtonContextMenu = ({ onFinished, ...props }: ComponentProps<typeof SpaceContextMenu>) => {
    const allRoomsInHome = useEventEmitterState(SpaceStore.instance, UPDATE_HOME_BEHAVIOUR, () => {
        return SpaceStore.instance.allRoomsInHome;
    });

    return <IconizedContextMenu
        {...props}
        onFinished={onFinished}
        className="mx_SpacePanel_contextMenu"
        compact
    >
        <div className="mx_SpacePanel_contextMenu_header">
            { _t("Home") }
        </div>
        <IconizedContextMenuOptionList first>
            <IconizedContextMenuCheckbox
                iconClassName="mx_SpacePanel_noIcon"
                label={_t("Show all rooms")}
                active={allRoomsInHome}
                onClick={() => {
                    SettingsStore.setValue("Spaces.allRoomsInHome", null, SettingLevel.ACCOUNT, !allRoomsInHome);
                }}
            />
        </IconizedContextMenuOptionList>
    </IconizedContextMenu>;
};

interface IHomeButtonProps {
    selected: boolean;
    isPanelCollapsed: boolean;
}

const HomeButton = ({ selected, isPanelCollapsed }: IHomeButtonProps) => {
    const allRoomsInHome = useEventEmitterState(SpaceStore.instance, UPDATE_HOME_BEHAVIOUR, () => {
        return SpaceStore.instance.allRoomsInHome;
    });

    return <li
        className={classNames("mx_SpaceItem", {
            "collapsed": isPanelCollapsed,
        })}
        role="treeitem"
    >
        <SpaceButton
            className="mx_SpaceButton_home"
            onClick={() => SpaceStore.instance.setActiveSpace(null)}
            selected={selected}
            label={allRoomsInHome ? _t("All rooms") : _t("Home")}
            notificationState={allRoomsInHome
                ? RoomNotificationStateStore.instance.globalState
                : SpaceStore.instance.getNotificationState(HOME_SPACE)}
            isNarrow={isPanelCollapsed}
            ContextMenuComponent={HomeButtonContextMenu}
            contextMenuTooltip={_t("Options")}
        />
    </li>;
};

const CreateSpaceButton = ({
    isPanelCollapsed,
    setPanelCollapsed,
}: Pick<IInnerSpacePanelProps, "isPanelCollapsed" | "setPanelCollapsed">) => {
    // We don't need the handle as we position the menu in a constant location
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [menuDisplayed, handle, openMenu, closeMenu] = useContextMenu<void>();

    useEffect(() => {
        if (!isPanelCollapsed && menuDisplayed) {
            closeMenu();
        }
    }, [isPanelCollapsed]); // eslint-disable-line react-hooks/exhaustive-deps

    let contextMenu = null;
    if (menuDisplayed) {
        contextMenu = <SpaceCreateMenu onFinished={closeMenu} />;
    }

    const onNewClick = menuDisplayed ? closeMenu : () => {
        if (!isPanelCollapsed) setPanelCollapsed(true);
        openMenu();
    };

    return <li
        className={classNames("mx_SpaceItem", {
            "collapsed": isPanelCollapsed,
        })}
        role="treeitem"
    >
        <SpaceButton
            className={classNames("mx_SpaceButton_new", {
                mx_SpaceButton_newCancel: menuDisplayed,
            })}
            label={menuDisplayed ? _t("Cancel") : _t("Create a space")}
            onClick={onNewClick}
            isNarrow={isPanelCollapsed}
        />

        { contextMenu }
    </li>;
};

// Optimisation based on https://github.com/atlassian/react-beautiful-dnd/blob/master/docs/api/droppable.md#recommended-droppable--performance-optimisation
const InnerSpacePanel = React.memo<IInnerSpacePanelProps>(({ children, isPanelCollapsed, setPanelCollapsed }) => {
    const [invites, spaces, activeSpace] = useSpaces();
    const activeSpaces = activeSpace ? [activeSpace] : [];

    return <div className="mx_SpaceTreeLevel">
        <HomeButton selected={!activeSpace} isPanelCollapsed={isPanelCollapsed} />
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
                { (provided, snapshot) => (
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
                ) }
            </Draggable>
        )) }
        { children }
        <CreateSpaceButton isPanelCollapsed={isPanelCollapsed} setPanelCollapsed={setPanelCollapsed} />
    </div>;
});

const SpacePanel = () => {
    const [isPanelCollapsed, setPanelCollapsed] = useState(true);
    const ref = useRef<HTMLUListElement>();
    useLayoutEffect(() => {
        UIStore.instance.trackElementDimensions("SpacePanel", ref.current);
        return () => UIStore.instance.stopTrackingElementDimensions("SpacePanel");
    }, []);

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

    return (
        <DragDropContext onDragEnd={result => {
            if (!result.destination) return; // dropped outside the list
            SpaceStore.instance.moveRootSpace(result.source.index, result.destination.index);
        }}>
            <RovingTabIndexProvider handleHomeEnd={true} onKeyDown={onKeyDown}>
                { ({ onKeyDownHandler }) => (
                    <ul
                        className={classNames("mx_SpacePanel", { collapsed: isPanelCollapsed })}
                        onKeyDown={onKeyDownHandler}
                        role="tree"
                        aria-label={_t("Spaces")}
                        ref={ref}
                    >
                        <Droppable droppableId="top-level-spaces">
                            { (provided, snapshot) => (
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
                                </AutoHideScrollbar>
                            ) }
                        </Droppable>
                        <AccessibleTooltipButton
                            className={classNames("mx_SpacePanel_toggleCollapse", { expanded: !isPanelCollapsed })}
                            onClick={() => setPanelCollapsed(!isPanelCollapsed)}
                            title={isPanelCollapsed ? _t("Expand space panel") : _t("Collapse space panel")}
                        />
                    </ul>
                ) }
            </RovingTabIndexProvider>
        </DragDropContext>
    );
};

export default SpacePanel;
