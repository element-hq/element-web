/*
Copyright 2026 Element Creations Ltd.
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
    type JSX,
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    useContext,
} from "react";
import { DragDropContext, Draggable, Droppable, type DroppableProvidedProps } from "react-beautiful-dnd";
import classNames from "classnames";
import { type Room } from "matrix-js-sdk/src/matrix";
import {
    HomeSolidIcon,
    RoomIcon,
    VideoCallSolidIcon,
    PlusIcon,
    ChevronRightIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import { useCreateAutoDisposedViewModel, UserMenu } from "@element-hq/web-shared-components";

import { _t } from "../../../languageHandler";
import { useContextMenu } from "../../structures/ContextMenu";
import SpaceCreateMenu from "./SpaceCreateMenu";
import { SpaceButton, SpaceItem } from "./SpaceTreeLevel";
import { useEventEmitter, useEventEmitterState } from "../../../hooks/useEventEmitter";
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
import { UPDATE_STATUS_INDICATOR } from "../../../stores/notifications/RoomNotificationStateStore";
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
import { ModuleApi } from "../../../modules/Api.ts";
import { useModuleSpacePanelItems } from "../../../modules/ExtrasApi.ts";
import { UserMenuViewModel } from "../../../viewmodels/menus/UserMenuViewModel.ts";
import { SDKContext } from "../../../contexts/SDKContext.ts";
import { OwnProfileStore } from "../../../stores/OwnProfileStore.ts";
import { type SDKContextClass } from "../../../contexts/SDKContextClass.ts";

const useSpaces = (): [Room[], MetaSpace[], Room[], SpaceKey] => {
    const sdkContext = useContext(SDKContext);
    const invites = useEventEmitterState<Room[]>(sdkContext.spaceStore, UPDATE_INVITED_SPACES, () => {
        return sdkContext.spaceStore.invitedSpaces;
    });
    const [metaSpaces, actualSpaces] = useEventEmitterState<[MetaSpace[], Room[]]>(
        sdkContext.spaceStore,
        UPDATE_TOP_LEVEL_SPACES,
        () => [sdkContext.spaceStore.enabledMetaSpaces, sdkContext.spaceStore.spacePanelSpaces],
    );
    const activeSpace = useEventEmitterState<SpaceKey>(sdkContext.spaceStore, UPDATE_SELECTED_SPACE, () => {
        return sdkContext.spaceStore.activeSpace;
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
    icon: JSX.Element;
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

const getHomeNotificationState = (sdkContext: SDKContextClass): NotificationState => {
    return sdkContext.spaceStore.allRoomsInHome
        ? sdkContext.roomNotificationStateStore.globalState
        : sdkContext.spaceStore.getNotificationState(MetaSpace.Home);
};

const HomeButton: React.FC<MetaSpaceButtonProps> = ({ selected, isPanelCollapsed }) => {
    const sdkContext = useContext(SDKContext);
    const allRoomsInHome = useEventEmitterState(sdkContext.spaceStore, UPDATE_HOME_BEHAVIOUR, () => {
        return sdkContext.spaceStore.allRoomsInHome;
    });
    const [notificationState, setNotificationState] = useState(getHomeNotificationState(sdkContext));
    const updateNotificationState = useCallback(() => {
        setNotificationState(getHomeNotificationState(sdkContext));
    }, [sdkContext]);
    useEffect(updateNotificationState, [updateNotificationState, allRoomsInHome]);
    useEventEmitter(sdkContext.roomNotificationStateStore, UPDATE_STATUS_INDICATOR, updateNotificationState);

    return (
        <MetaSpaceButton
            spaceKey={MetaSpace.Home}
            selected={selected}
            isPanelCollapsed={isPanelCollapsed}
            label={getMetaSpaceName(MetaSpace.Home, allRoomsInHome)}
            notificationState={notificationState}
            ContextMenuComponent={HomeButtonContextMenu}
            contextMenuTooltip={_t("common|options")}
            size="32px"
            icon={<HomeSolidIcon />}
        />
    );
};

const OrphansButton: React.FC<MetaSpaceButtonProps> = ({ selected, isPanelCollapsed }) => {
    const sdkContext = useContext(SDKContext);
    return (
        <MetaSpaceButton
            spaceKey={MetaSpace.Orphans}
            selected={selected}
            isPanelCollapsed={isPanelCollapsed}
            label={getMetaSpaceName(MetaSpace.Orphans)}
            notificationState={sdkContext.spaceStore.getNotificationState(MetaSpace.Orphans)}
            size="32px"
            icon={<RoomIcon />}
        />
    );
};

const VideoRoomsButton: React.FC<MetaSpaceButtonProps> = ({ selected, isPanelCollapsed }) => {
    const sdkContext = useContext(SDKContext);
    return (
        <MetaSpaceButton
            spaceKey={MetaSpace.VideoRooms}
            selected={selected}
            isPanelCollapsed={isPanelCollapsed}
            label={getMetaSpaceName(MetaSpace.VideoRooms)}
            notificationState={sdkContext.spaceStore.getNotificationState(MetaSpace.VideoRooms)}
            size="32px"
            icon={<VideoCallSolidIcon />}
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
                icon={<PlusIcon />}
            />

            {contextMenu}
        </li>
    );
};

const metaSpaceComponentMap: Record<MetaSpace, typeof HomeButton> = {
    [MetaSpace.Home]: HomeButton,
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
        const sdkContext = useContext(SDKContext);
        const [invites, metaSpaces, actualSpaces, activeSpace] = useSpaces();
        const activeSpaces = activeSpace ? [activeSpace] : [];

        const moduleSpaceItems = useModuleSpacePanelItems(ModuleApi.instance.extras);

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
                as="ul"
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
                {moduleSpaceItems.map((item) => (
                    <li
                        key={item.spaceKey}
                        className={classNames("mx_SpaceItem", {
                            collapsed: isPanelCollapsed,
                        })}
                        role="treeitem"
                        aria-selected={false} // TODO
                    >
                        <SpaceButton
                            {...item}
                            isNarrow={isPanelCollapsed}
                            size="32px"
                            selected={activeSpace === item.spaceKey}
                            onClick={() => {
                                sdkContext.spaceStore.setActiveSpace(item.spaceKey);
                                item.onSelected?.();
                            }}
                        />
                    </li>
                ))}
                {shouldShowComponent(UIComponent.CreateSpaces) && (
                    <CreateSpaceButton isPanelCollapsed={isPanelCollapsed} setPanelCollapsed={setPanelCollapsed} />
                )}
            </IndicatorScrollbar>
        );
    },
);

const SpacePanel: React.FC = () => {
    const sdkContext = useContext(SDKContext);
    const client = sdkContext.client!;
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

    const userMenuVm = useCreateAutoDisposedViewModel(
        () =>
            new UserMenuViewModel(
                { ownProfileStore: OwnProfileStore.instance },
                defaultDispatcher,
                client,
                isPanelCollapsed,
            ),
    );

    useDispatcher(defaultDispatcher, (payload) => {
        if (payload.action === Action.ToggleUserMenu) {
            userMenuVm.setOpen(!userMenuVm.getSnapshot().open);
        }
    });

    useEffect(() => {
        userMenuVm.setExpanded(!isPanelCollapsed);
    }, [userMenuVm, isPanelCollapsed]);

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
                        sdkContext.spaceStore.moveRootSpace(result.source.index, result.destination.index);
                        onDragEndHandler();
                    }}
                >
                    <nav
                        className={classNames("mx_SpacePanel", {
                            collapsed: isPanelCollapsed,
                        })}
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
                        <UserMenu vm={userMenuVm} className="mx_UserMenu" />
                        <AccessibleButton
                            className={classNames("mx_SpacePanel_toggleCollapse", {
                                expanded: !isPanelCollapsed,
                            })}
                            onClick={() => setPanelCollapsed(!isPanelCollapsed)}
                            title={isPanelCollapsed ? _t("action|expand") : _t("action|collapse")}
                            caption={
                                <KeyboardShortcut
                                    value={{ ctrlOrCmdKey: true, shiftKey: true, key: "d" }}
                                    className="mx_SpacePanel_Tooltip_KeyboardShortcut"
                                />
                            }
                        >
                            <ChevronRightIcon />
                        </AccessibleButton>
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
