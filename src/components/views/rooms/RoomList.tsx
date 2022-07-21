/*
Copyright 2015-2018, 2020, 2021 The Matrix.org Foundation C.I.C.

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

import * as fbEmitter from "fbemitter";
import { EventType, RoomType } from "matrix-js-sdk/src/@types/event";
import { Room } from "matrix-js-sdk/src/models/room";
import React, { ComponentType, createRef, ReactComponentElement, RefObject } from "react";

import { IState as IRovingTabIndexState, RovingTabIndexProvider } from "../../../accessibility/RovingTabIndex";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { shouldShowComponent } from "../../../customisations/helpers/UIComponents";
import { Action } from "../../../dispatcher/actions";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { ActionPayload } from "../../../dispatcher/payloads";
import { ViewRoomDeltaPayload } from "../../../dispatcher/payloads/ViewRoomDeltaPayload";
import { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { useEventEmitterState } from "../../../hooks/useEventEmitter";
import { _t, _td } from "../../../languageHandler";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import PosthogTrackers from "../../../PosthogTrackers";
import SettingsStore from "../../../settings/SettingsStore";
import { UIComponent } from "../../../settings/UIFeature";
import { RoomNotificationStateStore } from "../../../stores/notifications/RoomNotificationStateStore";
import { ITagMap } from "../../../stores/room-list/algorithms/models";
import { DefaultTagID, TagID } from "../../../stores/room-list/models";
import RoomListStore, { LISTS_UPDATE_EVENT } from "../../../stores/room-list/RoomListStore";
import { RoomViewStore } from "../../../stores/RoomViewStore";
import {
    isMetaSpace,
    ISuggestedRoom,
    MetaSpace,
    SpaceKey,
    UPDATE_SELECTED_SPACE,
    UPDATE_SUGGESTED_ROOMS,
} from "../../../stores/spaces";
import SpaceStore from "../../../stores/spaces/SpaceStore";
import { arrayFastClone, arrayHasDiff } from "../../../utils/arrays";
import { objectShallowClone, objectWithOnly } from "../../../utils/objects";
import ResizeNotifier from "../../../utils/ResizeNotifier";
import { shouldShowSpaceInvite, showAddExistingRooms, showCreateNewRoom, showSpaceInvite } from "../../../utils/space";
import { ChevronFace, ContextMenuTooltipButton, useContextMenu } from "../../structures/ContextMenu";
import RoomAvatar from "../avatars/RoomAvatar";
import { BetaPill } from "../beta/BetaCard";
import IconizedContextMenu, {
    IconizedContextMenuOption,
    IconizedContextMenuOptionList,
} from "../context_menus/IconizedContextMenu";
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import ExtraTile from "./ExtraTile";
import RoomSublist, { IAuxButtonProps } from "./RoomSublist";

interface IProps {
    onKeyDown: (ev: React.KeyboardEvent, state: IRovingTabIndexState) => void;
    onFocus: (ev: React.FocusEvent) => void;
    onBlur: (ev: React.FocusEvent) => void;
    onResize: () => void;
    onListCollapse?: (isExpanded: boolean) => void;
    resizeNotifier: ResizeNotifier;
    isMinimized: boolean;
    activeSpace: SpaceKey;
}

interface IState {
    sublists: ITagMap;
    currentRoomId?: string;
    suggestedRooms: ISuggestedRoom[];
    feature_favourite_messages: boolean;
}

export const TAG_ORDER: TagID[] = [
    DefaultTagID.Invite,
    DefaultTagID.SavedItems,
    DefaultTagID.Favourite,
    DefaultTagID.DM,
    DefaultTagID.Untagged,
    DefaultTagID.LowPriority,
    DefaultTagID.ServerNotice,
    DefaultTagID.Suggested,
    DefaultTagID.Archived,
];
const ALWAYS_VISIBLE_TAGS: TagID[] = [
    DefaultTagID.DM,
    DefaultTagID.Untagged,
];

interface ITagAesthetics {
    sectionLabel: string;
    sectionLabelRaw?: string;
    AuxButtonComponent?: ComponentType<IAuxButtonProps>;
    isInvite: boolean;
    defaultHidden: boolean;
}

interface ITagAestheticsMap {
    // @ts-ignore - TS wants this to be a string but we know better
    [tagId: TagID]: ITagAesthetics;
}

const auxButtonContextMenuPosition = (handle: RefObject<HTMLDivElement>) => {
    const rect = handle.current.getBoundingClientRect();
    return {
        chevronFace: ChevronFace.None,
        left: rect.left - 7,
        top: rect.top + rect.height,
    };
};

const DmAuxButton = ({ tabIndex, dispatcher = defaultDispatcher }: IAuxButtonProps) => {
    const [menuDisplayed, handle, openMenu, closeMenu] = useContextMenu<HTMLDivElement>();
    const activeSpace: Room = useEventEmitterState(SpaceStore.instance, UPDATE_SELECTED_SPACE, () => {
        return SpaceStore.instance.activeSpaceRoom;
    });

    const showCreateRooms = shouldShowComponent(UIComponent.CreateRooms);
    const showInviteUsers = shouldShowComponent(UIComponent.InviteUsers);

    if (activeSpace && (showCreateRooms || showInviteUsers)) {
        let contextMenu: JSX.Element;
        if (menuDisplayed) {
            const canInvite = shouldShowSpaceInvite(activeSpace);

            contextMenu = <IconizedContextMenu {...auxButtonContextMenuPosition(handle)} onFinished={closeMenu} compact>
                <IconizedContextMenuOptionList first>
                    { showCreateRooms && <IconizedContextMenuOption
                        label={_t("Start new chat")}
                        iconClassName="mx_RoomList_iconStartChat"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            closeMenu();
                            defaultDispatcher.dispatch({ action: "view_create_chat" });
                            PosthogTrackers.trackInteraction("WebRoomListRoomsSublistPlusMenuCreateChatItem", e);
                        }}
                    /> }
                    { showInviteUsers && <IconizedContextMenuOption
                        label={_t("Invite to space")}
                        iconClassName="mx_RoomList_iconInvite"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            closeMenu();
                            showSpaceInvite(activeSpace);
                        }}
                        disabled={!canInvite}
                        tooltip={canInvite ? undefined
                            : _t("You do not have permissions to invite people to this space")}
                    /> }
                </IconizedContextMenuOptionList>
            </IconizedContextMenu>;
        }

        return <>
            <ContextMenuTooltipButton
                tabIndex={tabIndex}
                onClick={openMenu}
                className="mx_RoomSublist_auxButton"
                tooltipClassName="mx_RoomSublist_addRoomTooltip"
                aria-label={_t("Add people")}
                title={_t("Add people")}
                isExpanded={menuDisplayed}
                inputRef={handle}
            />

            { contextMenu }
        </>;
    } else if (!activeSpace && showCreateRooms) {
        return <AccessibleTooltipButton
            tabIndex={tabIndex}
            onClick={(e) => {
                dispatcher.dispatch({ action: 'view_create_chat' });
                PosthogTrackers.trackInteraction("WebRoomListRoomsSublistPlusMenuCreateChatItem", e);
            }}
            className="mx_RoomSublist_auxButton"
            tooltipClassName="mx_RoomSublist_addRoomTooltip"
            aria-label={_t("Start chat")}
            title={_t("Start chat")}
        />;
    }

    return null;
};

const UntaggedAuxButton = ({ tabIndex }: IAuxButtonProps) => {
    const [menuDisplayed, handle, openMenu, closeMenu] = useContextMenu<HTMLDivElement>();
    const activeSpace = useEventEmitterState<Room>(SpaceStore.instance, UPDATE_SELECTED_SPACE, () => {
        return SpaceStore.instance.activeSpaceRoom;
    });

    const showCreateRoom = shouldShowComponent(UIComponent.CreateRooms);

    let contextMenuContent: JSX.Element;
    if (menuDisplayed && activeSpace) {
        const canAddRooms = activeSpace.currentState.maySendStateEvent(EventType.SpaceChild,
            MatrixClientPeg.get().getUserId());

        contextMenuContent = <IconizedContextMenuOptionList first>
            <IconizedContextMenuOption
                label={_t("Explore rooms")}
                iconClassName="mx_RoomList_iconExplore"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    closeMenu();
                    defaultDispatcher.dispatch<ViewRoomPayload>({
                        action: Action.ViewRoom,
                        room_id: activeSpace.roomId,
                        metricsTrigger: undefined, // other
                    });
                    PosthogTrackers.trackInteraction("WebRoomListRoomsSublistPlusMenuExploreRoomsItem", e);
                }}
            />
            {
                showCreateRoom
                    ? (<>
                        <IconizedContextMenuOption
                            label={_t("New room")}
                            iconClassName="mx_RoomList_iconNewRoom"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                closeMenu();
                                showCreateNewRoom(activeSpace);
                                PosthogTrackers.trackInteraction("WebRoomListRoomsSublistPlusMenuCreateRoomItem", e);
                            }}
                            disabled={!canAddRooms}
                            tooltip={canAddRooms ? undefined
                                : _t("You do not have permissions to create new rooms in this space")}
                        />
                        { SettingsStore.getValue("feature_video_rooms") && (
                            <IconizedContextMenuOption
                                label={_t("New video room")}
                                iconClassName="mx_RoomList_iconNewVideoRoom"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    closeMenu();
                                    showCreateNewRoom(activeSpace, RoomType.ElementVideo);
                                }}
                                disabled={!canAddRooms}
                                tooltip={canAddRooms ? undefined
                                    : _t("You do not have permissions to create new rooms in this space")}
                            >
                                <BetaPill />
                            </IconizedContextMenuOption>
                        ) }
                        <IconizedContextMenuOption
                            label={_t("Add existing room")}
                            iconClassName="mx_RoomList_iconAddExistingRoom"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                closeMenu();
                                showAddExistingRooms(activeSpace);
                            }}
                            disabled={!canAddRooms}
                            tooltip={canAddRooms ? undefined
                                : _t("You do not have permissions to add rooms to this space")}
                        />
                    </>)
                    : null
            }
        </IconizedContextMenuOptionList>;
    } else if (menuDisplayed) {
        contextMenuContent = <IconizedContextMenuOptionList first>
            { showCreateRoom && <>
                <IconizedContextMenuOption
                    label={_t("New room")}
                    iconClassName="mx_RoomList_iconNewRoom"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        closeMenu();
                        defaultDispatcher.dispatch({ action: "view_create_room" });
                        PosthogTrackers.trackInteraction("WebRoomListRoomsSublistPlusMenuCreateRoomItem", e);
                    }}
                />
                { SettingsStore.getValue("feature_video_rooms") && (
                    <IconizedContextMenuOption
                        label={_t("New video room")}
                        iconClassName="mx_RoomList_iconNewVideoRoom"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            closeMenu();
                            defaultDispatcher.dispatch({
                                action: "view_create_room",
                                type: RoomType.ElementVideo,
                            });
                        }}
                    >
                        <BetaPill />
                    </IconizedContextMenuOption>
                ) }
            </> }
            <IconizedContextMenuOption
                label={_t("Explore public rooms")}
                iconClassName="mx_RoomList_iconExplore"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    closeMenu();
                    PosthogTrackers.trackInteraction("WebRoomListRoomsSublistPlusMenuExploreRoomsItem", e);
                    defaultDispatcher.fire(Action.ViewRoomDirectory);
                }}
            />
        </IconizedContextMenuOptionList>;
    }

    let contextMenu: JSX.Element;
    if (menuDisplayed) {
        contextMenu = <IconizedContextMenu {...auxButtonContextMenuPosition(handle)} onFinished={closeMenu} compact>
            { contextMenuContent }
        </IconizedContextMenu>;
    }

    return <>
        <ContextMenuTooltipButton
            tabIndex={tabIndex}
            onClick={openMenu}
            className="mx_RoomSublist_auxButton"
            tooltipClassName="mx_RoomSublist_addRoomTooltip"
            aria-label={_t("Add room")}
            title={_t("Add room")}
            isExpanded={menuDisplayed}
            inputRef={handle}
        />

        { contextMenu }
    </>;
};

const TAG_AESTHETICS: ITagAestheticsMap = {
    [DefaultTagID.Invite]: {
        sectionLabel: _td("Invites"),
        isInvite: true,
        defaultHidden: false,
    },
    [DefaultTagID.Favourite]: {
        sectionLabel: _td("Favourites"),
        isInvite: false,
        defaultHidden: false,
    },
    [DefaultTagID.SavedItems]: {
        sectionLabel: _td("Saved Items"),
        isInvite: false,
        defaultHidden: false,
    },
    [DefaultTagID.DM]: {
        sectionLabel: _td("People"),
        isInvite: false,
        defaultHidden: false,
        AuxButtonComponent: DmAuxButton,
    },
    [DefaultTagID.Untagged]: {
        sectionLabel: _td("Rooms"),
        isInvite: false,
        defaultHidden: false,
        AuxButtonComponent: UntaggedAuxButton,
    },
    [DefaultTagID.LowPriority]: {
        sectionLabel: _td("Low priority"),
        isInvite: false,
        defaultHidden: false,
    },
    [DefaultTagID.ServerNotice]: {
        sectionLabel: _td("System Alerts"),
        isInvite: false,
        defaultHidden: false,
    },

    // TODO: Replace with archived view: https://github.com/vector-im/element-web/issues/14038
    [DefaultTagID.Archived]: {
        sectionLabel: _td("Historical"),
        isInvite: false,
        defaultHidden: true,
    },

    [DefaultTagID.Suggested]: {
        sectionLabel: _td("Suggested Rooms"),
        isInvite: false,
        defaultHidden: false,
    },
};

export default class RoomList extends React.PureComponent<IProps, IState> {
    private dispatcherRef;
    private roomStoreToken: fbEmitter.EventSubscription;
    private treeRef = createRef<HTMLDivElement>();
    private favouriteMessageWatcher: string;

    static contextType = MatrixClientContext;
    public context!: React.ContextType<typeof MatrixClientContext>;

    constructor(props: IProps) {
        super(props);

        this.state = {
            sublists: {},
            suggestedRooms: SpaceStore.instance.suggestedRooms,
            feature_favourite_messages: SettingsStore.getValue("feature_favourite_messages"),
        };
    }

    public componentDidMount(): void {
        this.dispatcherRef = defaultDispatcher.register(this.onAction);
        this.roomStoreToken = RoomViewStore.instance.addListener(this.onRoomViewStoreUpdate);
        SpaceStore.instance.on(UPDATE_SUGGESTED_ROOMS, this.updateSuggestedRooms);
        RoomListStore.instance.on(LISTS_UPDATE_EVENT, this.updateLists);
        this.favouriteMessageWatcher =
            SettingsStore.watchSetting("feature_favourite_messages", null, (...[,,, value]) => {
                this.setState({ feature_favourite_messages: value });
            });
        this.updateLists(); // trigger the first update
    }

    public componentWillUnmount() {
        SpaceStore.instance.off(UPDATE_SUGGESTED_ROOMS, this.updateSuggestedRooms);
        RoomListStore.instance.off(LISTS_UPDATE_EVENT, this.updateLists);
        SettingsStore.unwatchSetting(this.favouriteMessageWatcher);
        defaultDispatcher.unregister(this.dispatcherRef);
        if (this.roomStoreToken) this.roomStoreToken.remove();
    }

    private onRoomViewStoreUpdate = () => {
        this.setState({
            currentRoomId: RoomViewStore.instance.getRoomId(),
        });
    };

    private onAction = (payload: ActionPayload) => {
        if (payload.action === Action.ViewRoomDelta) {
            const viewRoomDeltaPayload = payload as ViewRoomDeltaPayload;
            const currentRoomId = RoomViewStore.instance.getRoomId();
            const room = this.getRoomDelta(currentRoomId, viewRoomDeltaPayload.delta, viewRoomDeltaPayload.unread);
            if (room) {
                defaultDispatcher.dispatch<ViewRoomPayload>({
                    action: Action.ViewRoom,
                    room_id: room.roomId,
                    show_room_tile: true, // to make sure the room gets scrolled into view
                    metricsTrigger: "WebKeyboardShortcut",
                    metricsViaKeyboard: true,
                });
            }
        } else if (payload.action === Action.PstnSupportUpdated) {
            this.updateLists();
        }
    };

    private getRoomDelta = (roomId: string, delta: number, unread = false) => {
        const lists = RoomListStore.instance.orderedLists;
        const rooms: Room[] = [];
        TAG_ORDER.forEach(t => {
            let listRooms = lists[t];

            if (unread) {
                // filter to only notification rooms (and our current active room so we can index properly)
                listRooms = listRooms.filter(r => {
                    const state = RoomNotificationStateStore.instance.getRoomState(r);
                    return state.room.roomId === roomId || state.isUnread;
                });
            }

            rooms.push(...listRooms);
        });

        const currentIndex = rooms.findIndex(r => r.roomId === roomId);
        // use slice to account for looping around the start
        const [room] = rooms.slice((currentIndex + delta) % rooms.length);
        return room;
    };

    private updateSuggestedRooms = (suggestedRooms: ISuggestedRoom[]) => {
        this.setState({ suggestedRooms });
    };

    private updateLists = () => {
        const newLists = RoomListStore.instance.orderedLists;
        const previousListIds = Object.keys(this.state.sublists);
        const newListIds = Object.keys(newLists);

        let doUpdate = arrayHasDiff(previousListIds, newListIds);
        if (!doUpdate) {
            // so we didn't have the visible sublists change, but did the contents of those
            // sublists change significantly enough to break the sticky headers? Probably, so
            // let's check the length of each.
            for (const tagId of newListIds) {
                const oldRooms = this.state.sublists[tagId];
                const newRooms = newLists[tagId];
                if (oldRooms.length !== newRooms.length) {
                    doUpdate = true;
                    break;
                }
            }
        }

        if (doUpdate) {
            // We have to break our reference to the room list store if we want to be able to
            // diff the object for changes, so do that.
            // @ts-ignore - ITagMap is ts-ignored so this will have to be too
            const newSublists = objectWithOnly(newLists, newListIds);
            const sublists = objectShallowClone(newSublists, (k, v) => arrayFastClone(v));

            this.setState({ sublists }, () => {
                this.props.onResize();
            });
        }
    };

    private renderSuggestedRooms(): ReactComponentElement<typeof ExtraTile>[] {
        return this.state.suggestedRooms.map(room => {
            const name = room.name || room.canonical_alias || room.aliases?.[0] || _t("Empty room");
            const avatar = (
                <RoomAvatar
                    oobData={{
                        name,
                        avatarUrl: room.avatar_url,
                    }}
                    width={32}
                    height={32}
                    resizeMethod="crop"
                />
            );
            const viewRoom = (ev) => {
                defaultDispatcher.dispatch<ViewRoomPayload>({
                    action: Action.ViewRoom,
                    room_alias: room.canonical_alias || room.aliases?.[0],
                    room_id: room.room_id,
                    via_servers: room.viaServers,
                    oob_data: {
                        avatarUrl: room.avatar_url,
                        name,
                    },
                    metricsTrigger: "RoomList",
                    metricsViaKeyboard: ev.type !== "click",
                });
            };
            return (
                <ExtraTile
                    isMinimized={this.props.isMinimized}
                    isSelected={this.state.currentRoomId === room.room_id}
                    displayName={name}
                    avatar={avatar}
                    onClick={viewRoom}
                    key={`suggestedRoomTile_${room.room_id}`}
                />
            );
        });
    }
    private renderFavoriteMessagesList(): ReactComponentElement<typeof ExtraTile>[] {
        const avatar = (
            <RoomAvatar
                oobData={{
                    name: "Favourites",
                }}
                width={32}
                height={32}
                resizeMethod="crop"
            />);

        return [
            <ExtraTile
                isMinimized={this.props.isMinimized}
                isSelected={false}
                displayName="Favourite Messages"
                avatar={avatar}
                onClick={() => ""}
                key="favMessagesTile_key"
            />,
        ];
    }

    private renderSublists(): React.ReactElement[] {
        // show a skeleton UI if the user is in no rooms and they are not filtering and have no suggested rooms
        const showSkeleton = !this.state.suggestedRooms?.length &&
            Object.values(RoomListStore.instance.orderedLists).every(list => !list?.length);

        return TAG_ORDER
            .map(orderedTagId => {
                let extraTiles = null;
                if (orderedTagId === DefaultTagID.Suggested) {
                    extraTiles = this.renderSuggestedRooms();
                }

                if (this.state.feature_favourite_messages && orderedTagId === DefaultTagID.SavedItems) {
                    extraTiles = this.renderFavoriteMessagesList();
                } else {
                    extraTiles = null;
                }

                const aesthetics = TAG_AESTHETICS[orderedTagId];
                if (!aesthetics) throw new Error(`Tag ${orderedTagId} does not have aesthetics`);

                let alwaysVisible = ALWAYS_VISIBLE_TAGS.includes(orderedTagId);
                if (
                    (this.props.activeSpace === MetaSpace.Favourites && orderedTagId !== DefaultTagID.Favourite) ||
                    (this.props.activeSpace === MetaSpace.People && orderedTagId !== DefaultTagID.DM) ||
                    (this.props.activeSpace === MetaSpace.Orphans && orderedTagId === DefaultTagID.DM) ||
                    (
                        !isMetaSpace(this.props.activeSpace) &&
                        orderedTagId === DefaultTagID.DM &&
                        !SettingsStore.getValue("Spaces.showPeopleInSpace", this.props.activeSpace)
                    )
                ) {
                    alwaysVisible = false;
                }

                let forceExpanded = false;
                if (
                    (this.props.activeSpace === MetaSpace.Favourites && orderedTagId === DefaultTagID.Favourite) ||
                    (this.props.activeSpace === MetaSpace.People && orderedTagId === DefaultTagID.DM)
                ) {
                    forceExpanded = true;
                }
                // The cost of mounting/unmounting this component offsets the cost
                // of keeping it in the DOM and hiding it when it is not required
                return <RoomSublist
                    key={`sublist-${orderedTagId}`}
                    tagId={orderedTagId}
                    forRooms={true}
                    startAsHidden={aesthetics.defaultHidden}
                    label={aesthetics.sectionLabelRaw ? aesthetics.sectionLabelRaw : _t(aesthetics.sectionLabel)}
                    AuxButtonComponent={aesthetics.AuxButtonComponent}
                    isMinimized={this.props.isMinimized}
                    showSkeleton={showSkeleton}
                    extraTiles={extraTiles}
                    resizeNotifier={this.props.resizeNotifier}
                    alwaysVisible={alwaysVisible}
                    onListCollapse={this.props.onListCollapse}
                    forceExpanded={forceExpanded}
                />;
            });
    }

    public focus(): void {
        // focus the first focusable element in this aria treeview widget
        const treeItems = this.treeRef.current?.querySelectorAll<HTMLElement>('[role="treeitem"]');
        if (!treeItems) return;
        [...treeItems].find(e => e.offsetParent !== null)?.focus();
    }

    public render() {
        const sublists = this.renderSublists();
        return (
            <RovingTabIndexProvider handleHomeEnd handleUpDown onKeyDown={this.props.onKeyDown}>
                { ({ onKeyDownHandler }) => (
                    <div
                        onFocus={this.props.onFocus}
                        onBlur={this.props.onBlur}
                        onKeyDown={onKeyDownHandler}
                        className="mx_RoomList"
                        role="tree"
                        aria-label={_t("Rooms")}
                        ref={this.treeRef}
                    >
                        { sublists }
                    </div>
                ) }
            </RovingTabIndexProvider>
        );
    }
}
