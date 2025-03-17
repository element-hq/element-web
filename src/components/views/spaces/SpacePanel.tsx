/*
Copyright 2024 New Vector Ltd.
Copyright 2021, 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, {
    type ComponentProps,
    type Dispatch,
    type ReactNode,
    type RefCallback,
    type SetStateAction,
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";
import { DragDropContext, Draggable, Droppable, type DroppableProvidedProps } from "react-beautiful-dnd";
import classNames from "classnames";
import { type Room } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../languageHandler";
import { useContextMenu } from "../../structures/ContextMenu";
import SpaceCreateMenu from "./SpaceCreateMenu";
import { SpaceButton, SpaceItem } from "./SpaceTreeLevel";
import { useEventEmitter, useEventEmitterState } from "../../../hooks/useEventEmitter";
import SpaceStore from "../../../stores/spaces/SpaceStore";
import {
    getMetaSpaceName,
    MetaSpace,
    type SpaceKey,
    UPDATE_HOME_BEHAVIOUR,
    UPDATE_INVITED_SPACES,
    UPDATE_SELECTED_SPACE,
    UPDATE_TOP_LEVEL_SPACES,
} from "../../../stores/spaces";
import { RovingTabIndexProvider } from "../../../accessibility/RovingTabIndex";
import {
    RoomNotificationStateStore,
    UPDATE_STATUS_INDICATOR,
} from "../../../stores/notifications/RoomNotificationStateStore";
import type SpaceContextMenu from "../context_menus/SpaceContextMenu";
import IconizedContextMenu, {
    IconizedContextMenuCheckbox,
    IconizedContextMenuOptionList,
} from "../context_menus/IconizedContextMenu";
import SettingsStore from "../../../settings/SettingsStore";
import { SettingLevel } from "../../../settings/SettingLevel";
import UIStore from "../../../stores/UIStore";
import QuickSettingsButton from "./QuickSettingsButton";
import { useSettingValue } from "../../../hooks/useSettings";
import UserMenu from "../../structures/UserMenu";
import IndicatorScrollbar from "../../structures/IndicatorScrollbar";
import { useDispatcher } from "../../../hooks/useDispatcher";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { type ActionPayload } from "../../../dispatcher/payloads";
import { Action } from "../../../dispatcher/actions";
import { type NotificationState } from "../../../stores/notifications/NotificationState";
import { KeyBindingAction } from "../../../accessibility/KeyboardShortcuts";
import { getKeyBindingsManager } from "../../../KeyBindingsManager";
import { shouldShowComponent } from "../../../customisations/helpers/UIComponents";
import { UIComponent } from "../../../settings/UIFeature";
import { ThreadsActivityCentre } from "./threads-activity-centre/";
import AccessibleButton from "../elements/AccessibleButton";
import { Landmark, LandmarkNavigation } from "../../../accessibility/LandmarkNavigation";
import { KeyboardShortcut } from "../settings/KeyboardShortcut";

const useSpaces = (): [Room[], MetaSpace[], Room[], SpaceKey] => {
    const invites = useEventEmitterState<Room[]>(SpaceStore.instance, UPDATE_INVITED_SPACES, () => {
        return SpaceStore.instance.invitedSpaces;
    });
    const [metaSpaces, actualSpaces] = useEventEmitterState<[MetaSpace[], Room[]]>(
        SpaceStore.instance,
        UPDATE_TOP_LEVEL_SPACES,
        () => [SpaceStore.instance.enabledMetaSpaces, SpaceStore.instance.spacePanelSpaces],
    );
    const activeSpace = useEventEmitterState<SpaceKey>(SpaceStore.instance, UPDATE_SELECTED_SPACE, () => {
        return SpaceStore.instance.activeSpace;
    });
    return [invites, metaSpaces, actualSpaces, activeSpace];
};

export const HomeButtonContextMenu: React.FC<ComponentProps<typeof SpaceContextMenu>> = ({
    onFinished,
    hideHeader,
    ...props
}) => {
    const allRoomsInHome = useSettingValue("Spaces.allRoomsInHome");

    return (
        <IconizedContextMenu {...props} onFinished={onFinished} className="mx_SpacePanel_contextMenu" compact>
            {!hideHeader && <div className="mx_SpacePanel_contextMenu_header">{_t("common|home")}</div>}
            <IconizedContextMenuOptionList first>
                <IconizedContextMenuCheckbox
                    iconClassName="mx_SpacePanel_noIcon"
                    label={_t("settings|sidebar|metaspaces_home_all_rooms")}
                    active={allRoomsInHome}
                    onClick={() => {
                        onFinished();
                        SettingsStore.setValue("Spaces.allRoomsInHome", null, SettingLevel.ACCOUNT, !allRoomsInHome);
                    }}
                />
            </IconizedContextMenuOptionList>
        </IconizedContextMenu>
    );
};

interface IMetaSpaceButtonProps extends ComponentProps<typeof SpaceButton> {
    selected: boolean;
    isPanelCollapsed: boolean;
}

type MetaSpaceButtonProps = Pick<IMetaSpaceButtonProps, "selected" | "isPanelCollapsed">;

const MetaSpaceButton: React.FC<IMetaSpaceButtonProps> = ({ selected, isPanelCollapsed, size = "32px", ...props }) => {
    return (
        <li
            className={classNames("mx_SpaceItem", {
                collapsed: isPanelCollapsed,
            })}
            role="treeitem"
            aria-selected={selected}
        >
            <SpaceButton {...props} selected={selected} isNarrow={isPanelCollapsed} size={size} />
        </li>
    );
};

const getHomeNotificationState = (): NotificationState => {
    return SpaceStore.instance.allRoomsInHome
        ? RoomNotificationStateStore.instance.globalState
        : SpaceStore.instance.getNotificationState(MetaSpace.Home);
};

const HomeButton: React.FC<MetaSpaceButtonProps> = ({ selected, isPanelCollapsed }) => {
    const allRoomsInHome = useEventEmitterState(SpaceStore.instance, UPDATE_HOME_BEHAVIOUR, () => {
        return SpaceStore.instance.allRoomsInHome;
    });
    const [notificationState, setNotificationState] = useState(getHomeNotificationState());
    const updateNotificationState = useCallback(() => {
        setNotificationState(getHomeNotificationState());
    }, []);
    useEffect(updateNotificationState, [updateNotificationState, allRoomsInHome]);
    useEventEmitter(RoomNotificationStateStore.instance, UPDATE_STATUS_INDICATOR, updateNotificationState);

    return (
        <MetaSpaceButton
            spaceKey={MetaSpace.Home}
            className="mx_SpaceButton_home"
            selected={selected}
            isPanelCollapsed={isPanelCollapsed}
            label={getMetaSpaceName(MetaSpace.Home, allRoomsInHome)}
            notificationState={notificationState}
            ContextMenuComponent={HomeButtonContextMenu}
            contextMenuTooltip={_t("common|options")}
            size="32px"
        />
    );
};

const FavouritesButton: React.FC<MetaSpaceButtonProps> = ({ selected, isPanelCollapsed }) => {
    return (
        <MetaSpaceButton
            spaceKey={MetaSpace.Favourites}
            className="mx_SpaceButton_favourites"
            selected={selected}
            isPanelCollapsed={isPanelCollapsed}
            label={getMetaSpaceName(MetaSpace.Favourites)}
            notificationState={SpaceStore.instance.getNotificationState(MetaSpace.Favourites)}
            size="32px"
        />
    );
};

const PeopleButton: React.FC<MetaSpaceButtonProps> = ({ selected, isPanelCollapsed }) => {
    return (
        <MetaSpaceButton
            spaceKey={MetaSpace.People}
            className="mx_SpaceButton_people"
            selected={selected}
            isPanelCollapsed={isPanelCollapsed}
            label={getMetaSpaceName(MetaSpace.People)}
            notificationState={SpaceStore.instance.getNotificationState(MetaSpace.People)}
            size="32px"
        />
    );
};

const OrphansButton: React.FC<MetaSpaceButtonProps> = ({ selected, isPanelCollapsed }) => {
    return (
        <MetaSpaceButton
            spaceKey={MetaSpace.Orphans}
            className="mx_SpaceButton_orphans"
            selected={selected}
            isPanelCollapsed={isPanelCollapsed}
            label={getMetaSpaceName(MetaSpace.Orphans)}
            notificationState={SpaceStore.instance.getNotificationState(MetaSpace.Orphans)}
            size="32px"
        />
    );
};

const VideoRoomsButton: React.FC<MetaSpaceButtonProps> = ({ selected, isPanelCollapsed }) => {
    return (
        <MetaSpaceButton
            spaceKey={MetaSpace.VideoRooms}
            className="mx_SpaceButton_videoRooms"
            selected={selected}
            isPanelCollapsed={isPanelCollapsed}
            label={getMetaSpaceName(MetaSpace.VideoRooms)}
            notificationState={SpaceStore.instance.getNotificationState(MetaSpace.VideoRooms)}
            size="32px"
        />
    );
};

const CreateSpaceButton: React.FC<Pick<IInnerSpacePanelProps, "isPanelCollapsed" | "setPanelCollapsed">> = ({
    isPanelCollapsed,
    setPanelCollapsed,
}) => {
    const [menuDisplayed, handle, openMenu, closeMenu] = useContextMenu<HTMLDivElement>();

    useEffect(() => {
        if (!isPanelCollapsed && menuDisplayed) {
            closeMenu();
        }
    }, [isPanelCollapsed]); // eslint-disable-line react-hooks/exhaustive-deps

    let contextMenu: JSX.Element | undefined;
    if (menuDisplayed) {
        contextMenu = <SpaceCreateMenu onFinished={closeMenu} />;
    }

    const onNewClick = menuDisplayed
        ? closeMenu
        : () => {
              if (!isPanelCollapsed) setPanelCollapsed(true);
              openMenu();
          };

    return (
        <li
            className={classNames("mx_SpaceItem mx_SpaceItem_new", {
                collapsed: isPanelCollapsed,
            })}
            role="treeitem"
            aria-selected={false}
        >
            <SpaceButton
                data-testid="create-space-button"
                className={classNames("mx_SpaceButton_new", {
                    mx_SpaceButton_newCancel: menuDisplayed,
                })}
                label={menuDisplayed ? _t("action|cancel") : _t("create_space|label")}
                onClick={onNewClick}
                isNarrow={isPanelCollapsed}
                innerRef={handle}
                size="32px"
            />

            {contextMenu}
        </li>
    );
};

const metaSpaceComponentMap: Record<MetaSpace, typeof HomeButton> = {
    [MetaSpace.Home]: HomeButton,
    [MetaSpace.Favourites]: FavouritesButton,
    [MetaSpace.People]: PeopleButton,
    [MetaSpace.Orphans]: OrphansButton,
    [MetaSpace.VideoRooms]: VideoRoomsButton,
};

interface IInnerSpacePanelProps extends DroppableProvidedProps {
    children?: ReactNode;
    isPanelCollapsed: boolean;
    setPanelCollapsed: Dispatch<SetStateAction<boolean>>;
    isDraggingOver: boolean;
    innerRef: RefCallback<HTMLElement>;
}

// Optimisation based on https://github.com/atlassian/react-beautiful-dnd/blob/master/docs/api/droppable.md#recommended-droppable--performance-optimisation
const InnerSpacePanel = React.memo<IInnerSpacePanelProps>(
    ({ children, isPanelCollapsed, setPanelCollapsed, isDraggingOver, innerRef, ...props }) => {
        const [invites, metaSpaces, actualSpaces, activeSpace] = useSpaces();
        const activeSpaces = activeSpace ? [activeSpace] : [];

        const metaSpacesSection = metaSpaces
            .filter((key) => !(key === MetaSpace.VideoRooms && !SettingsStore.getValue("feature_video_rooms")))
            .map((key) => {
                const Component = metaSpaceComponentMap[key];
                return <Component key={key} selected={activeSpace === key} isPanelCollapsed={isPanelCollapsed} />;
            });

        return (
            <IndicatorScrollbar
                {...props}
                wrappedRef={innerRef}
                className="mx_SpaceTreeLevel"
                style={
                    isDraggingOver
                        ? {
                              pointerEvents: "none",
                          }
                        : undefined
                }
                element="ul"
                role="tree"
                aria-label={_t("common|spaces")}
            >
                {metaSpacesSection}
                {invites.map((s) => (
                    <SpaceItem
                        key={s.roomId}
                        space={s}
                        activeSpaces={activeSpaces}
                        isPanelCollapsed={isPanelCollapsed}
                        onExpand={() => setPanelCollapsed(false)}
                    />
                ))}
                {actualSpaces.map((s, i) => (
                    <Draggable key={s.roomId} draggableId={s.roomId} index={i}>
                        {(provided, snapshot) => (
                            <SpaceItem
                                {...provided.draggableProps}
                                dragHandleProps={provided.dragHandleProps}
                                key={s.roomId}
                                innerRef={provided.innerRef}
                                className={snapshot.isDragging ? "mx_SpaceItem_dragging" : undefined}
                                space={s}
                                activeSpaces={activeSpaces}
                                isPanelCollapsed={isPanelCollapsed}
                                onExpand={() => setPanelCollapsed(false)}
                            />
                        )}
                    </Draggable>
                ))}
                {children}
                {shouldShowComponent(UIComponent.CreateSpaces) && (
                    <CreateSpaceButton isPanelCollapsed={isPanelCollapsed} setPanelCollapsed={setPanelCollapsed} />
                )}
            </IndicatorScrollbar>
        );
    },
);

const SpacePanel: React.FC = () => {
    const [dragging, setDragging] = useState(false);
    const [isPanelCollapsed, setPanelCollapsed] = useState(true);
    const ref = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        if (ref.current) UIStore.instance.trackElementDimensions("SpacePanel", ref.current);
        return () => UIStore.instance.stopTrackingElementDimensions("SpacePanel");
    }, []);

    useDispatcher(defaultDispatcher, (payload: ActionPayload) => {
        if (payload.action === Action.ToggleSpacePanel) {
            setPanelCollapsed(!isPanelCollapsed);
        }
    });

    return (
        <RovingTabIndexProvider handleHomeEnd handleUpDown={!dragging}>
            {({ onKeyDownHandler, onDragEndHandler }) => (
                <DragDropContext
                    onDragStart={() => {
                        setDragging(true);
                    }}
                    onDragEnd={(result) => {
                        setDragging(false);
                        if (!result.destination) return; // dropped outside the list
                        SpaceStore.instance.moveRootSpace(result.source.index, result.destination.index);
                        onDragEndHandler();
                    }}
                >
                    <nav
                        className={classNames("mx_SpacePanel", { collapsed: isPanelCollapsed })}
                        onKeyDown={(ev) => {
                            const navAction = getKeyBindingsManager().getNavigationAction(ev);
                            if (
                                navAction === KeyBindingAction.NextLandmark ||
                                navAction === KeyBindingAction.PreviousLandmark
                            ) {
                                LandmarkNavigation.findAndFocusNextLandmark(
                                    Landmark.ACTIVE_SPACE_BUTTON,
                                    navAction === KeyBindingAction.PreviousLandmark,
                                );
                                ev.stopPropagation();
                                ev.preventDefault();
                                return;
                            }
                            onKeyDownHandler(ev);
                        }}
                        ref={ref}
                        aria-label={_t("common|spaces")}
                    >
                        <UserMenu isPanelCollapsed={isPanelCollapsed}>
                            <AccessibleButton
                                className={classNames("mx_SpacePanel_toggleCollapse", { expanded: !isPanelCollapsed })}
                                onClick={() => setPanelCollapsed(!isPanelCollapsed)}
                                title={isPanelCollapsed ? _t("action|expand") : _t("action|collapse")}
                                caption={
                                    <KeyboardShortcut
                                        value={{ ctrlOrCmdKey: true, shiftKey: true, key: "d" }}
                                        className="mx_SpacePanel_Tooltip_KeyboardShortcut"
                                    />
                                }
                            />
                        </UserMenu>
                        <Droppable droppableId="top-level-spaces">
                            {(provided, snapshot) => (
                                <InnerSpacePanel
                                    {...provided.droppableProps}
                                    isPanelCollapsed={isPanelCollapsed}
                                    setPanelCollapsed={setPanelCollapsed}
                                    isDraggingOver={snapshot.isDraggingOver}
                                    innerRef={provided.innerRef}
                                >
                                    {provided.placeholder}
                                </InnerSpacePanel>
                            )}
                        </Droppable>

                        <ThreadsActivityCentre displayButtonLabel={!isPanelCollapsed} />

                        <QuickSettingsButton isPanelCollapsed={isPanelCollapsed} />
                    </nav>
                </DragDropContext>
            )}
        </RovingTabIndexProvider>
    );
};

export default SpacePanel;
