/*
Copyright 2021 - 2022 The Matrix.org Foundation C.I.C.

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

import classNames from "classnames";
import { Room } from "matrix-js-sdk/src/matrix";
import { IS_MAC, Key } from "matrix-react-sdk/src/Keyboard";
import { ALTERNATE_KEY_NAME } from "matrix-react-sdk/src/accessibility/KeyboardShortcuts";
import { RovingTabIndexProvider } from "matrix-react-sdk/src/accessibility/RovingTabIndex";
import { useContextMenu } from "matrix-react-sdk/src/components/structures/ContextMenu";
import IndicatorScrollbar from "matrix-react-sdk/src/components/structures/IndicatorScrollbar";
import UserMenu from "matrix-react-sdk/src/components/structures/UserMenu";
import IconizedContextMenu, {
    IconizedContextMenuCheckbox,
    IconizedContextMenuOptionList,
} from "matrix-react-sdk/src/components/views/context_menus/IconizedContextMenu";
import SpaceContextMenu from "matrix-react-sdk/src/components/views/context_menus/SpaceContextMenu";
import AccessibleTooltipButton from "matrix-react-sdk/src/components/views/elements/AccessibleTooltipButton";
import QuickSettingsButton from "matrix-react-sdk/src/components/views/spaces/QuickSettingsButton";
import SpaceCreateMenu from "matrix-react-sdk/src/components/views/spaces/SpaceCreateMenu";
import { SpaceButton, SpaceItem } from "matrix-react-sdk/src/components/views/spaces/SpaceTreeLevel";
import { shouldShowComponent } from "matrix-react-sdk/src/customisations/helpers/UIComponents";
import { Action } from "matrix-react-sdk/src/dispatcher/actions";
import defaultDispatcher from "matrix-react-sdk/src/dispatcher/dispatcher";
import { ActionPayload } from "matrix-react-sdk/src/dispatcher/payloads";
import { useDispatcher } from "matrix-react-sdk/src/hooks/useDispatcher";
import { useEventEmitter, useEventEmitterState } from "matrix-react-sdk/src/hooks/useEventEmitter";
import { useSettingValue } from "matrix-react-sdk/src/hooks/useSettings";
import { _t } from "matrix-react-sdk/src/languageHandler";
import { SettingLevel } from "matrix-react-sdk/src/settings/SettingLevel";
import SettingsStore from "matrix-react-sdk/src/settings/SettingsStore";
import { UIComponent } from "matrix-react-sdk/src/settings/UIFeature";
import UIStore from "matrix-react-sdk/src/stores/UIStore";
import { NotificationState } from "matrix-react-sdk/src/stores/notifications/NotificationState";
import {
    RoomNotificationStateStore,
    UPDATE_STATUS_INDICATOR,
} from "matrix-react-sdk/src/stores/notifications/RoomNotificationStateStore";
import {
    MetaSpace,
    SpaceKey,
    UPDATE_HOME_BEHAVIOUR,
    UPDATE_INVITED_SPACES,
    UPDATE_SELECTED_SPACE,
    UPDATE_TOP_LEVEL_SPACES,
    getMetaSpaceName,
} from "matrix-react-sdk/src/stores/spaces";
import SpaceStore from "matrix-react-sdk/src/stores/spaces/SpaceStore";
import React, {
    ComponentProps,
    Dispatch,
    ReactElement,
    ReactNode,
    RefCallback,
    SetStateAction,
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";
import { DragDropContext, Draggable, Droppable, DroppableProvidedProps } from "react-beautiful-dnd";

import SuperheroDexButton from "./SuperheroDexButton";

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
    const allRoomsInHome = useSettingValue<boolean>("Spaces.allRoomsInHome");

    return (
        <IconizedContextMenu {...props} onFinished={onFinished} className="mx_SpacePanel_contextMenu" compact>
            {!hideHeader && <div className="mx_SpacePanel_contextMenu_header">{_t("common|home")}</div>}
            <IconizedContextMenuOptionList first>
                <IconizedContextMenuCheckbox
                    iconClassName="mx_SpacePanel_noIcon"
                    label={_t("settings|sidebar|metaspaces_home_all_rooms")}
                    active={allRoomsInHome}
                    onClick={(): void => {
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
    const [menuDisplayed, handle, openMenu, closeMenu] = useContextMenu<HTMLElement>();

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
        : (): void => {
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

        const metaSpacesSection = metaSpaces.map((key) => {
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
                        onExpand={(): void => setPanelCollapsed(false)}
                    />
                ))}
                {actualSpaces.map((s, i) => (
                    <Draggable key={s.roomId} draggableId={s.roomId} index={i}>
                        {(provided, snapshot): ReactElement => (
                            <SpaceItem
                                {...provided.draggableProps}
                                dragHandleProps={provided.dragHandleProps}
                                key={s.roomId}
                                innerRef={provided.innerRef}
                                className={snapshot.isDragging ? "mx_SpaceItem_dragging" : undefined}
                                space={s}
                                activeSpaces={activeSpaces}
                                isPanelCollapsed={isPanelCollapsed}
                                onExpand={(): void => setPanelCollapsed(false)}
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
            {({ onKeyDownHandler, onDragEndHandler }): ReactElement => (
                <DragDropContext
                    onDragStart={(): void => {
                        setDragging(true);
                    }}
                    onDragEnd={(result): void => {
                        setDragging(false);
                        if (!result.destination) return; // dropped outside the list
                        SpaceStore.instance.moveRootSpace(result.source.index, result.destination.index);
                        onDragEndHandler();
                    }}
                >
                    <div
                        className={classNames("mx_SpacePanel", { collapsed: isPanelCollapsed })}
                        onKeyDown={onKeyDownHandler}
                        ref={ref}
                    >
                        <UserMenu isPanelCollapsed={isPanelCollapsed}>
                            <AccessibleTooltipButton
                                className={classNames("mx_SpacePanel_toggleCollapse", { expanded: !isPanelCollapsed })}
                                onClick={(): void => setPanelCollapsed(!isPanelCollapsed)}
                                title={isPanelCollapsed ? _t("action|expand") : _t("action|collapse")}
                                tooltip={
                                    <div>
                                        <div className="mx_Tooltip_title">
                                            {isPanelCollapsed ? _t("action|expand") : _t("action|collapse")}
                                        </div>
                                        <div className="mx_Tooltip_sub">
                                            {IS_MAC
                                                ? "⌘ + ⇧ + D"
                                                : _t(ALTERNATE_KEY_NAME[Key.CONTROL]) +
                                                  " + " +
                                                  _t(ALTERNATE_KEY_NAME[Key.SHIFT]) +
                                                  " + D"}
                                        </div>
                                    </div>
                                }
                            />
                        </UserMenu>
                        <Droppable droppableId="top-level-spaces">
                            {(provided, snapshot): ReactElement => (
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

                        <SuperheroDexButton isPanelCollapsed={isPanelCollapsed} />
                        <QuickSettingsButton isPanelCollapsed={isPanelCollapsed} />
                    </div>
                </DragDropContext>
            )}
        </RovingTabIndexProvider>
    );
};

export default SpacePanel;
