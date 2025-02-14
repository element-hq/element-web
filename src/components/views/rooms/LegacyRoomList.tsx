/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2018 , 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventType, type Room, RoomType } from "matrix-js-sdk/src/matrix";
import React, { type ComponentType, createRef, type ReactComponentElement, type SyntheticEvent } from "react";

import { type IState as IRovingTabIndexState, RovingTabIndexProvider } from "../../../accessibility/RovingTabIndex.tsx";
import MatrixClientContext from "../../../contexts/MatrixClientContext.tsx";
import { shouldShowComponent } from "../../../customisations/helpers/UIComponents.ts";
import { Action } from "../../../dispatcher/actions.ts";
import defaultDispatcher from "../../../dispatcher/dispatcher.ts";
import { type ActionPayload } from "../../../dispatcher/payloads.ts";
import { type ViewRoomDeltaPayload } from "../../../dispatcher/payloads/ViewRoomDeltaPayload.ts";
import { type ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload.ts";
import { useEventEmitterState } from "../../../hooks/useEventEmitter.ts";
import { _t, _td, type TranslationKey } from "../../../languageHandler.tsx";
import { MatrixClientPeg } from "../../../MatrixClientPeg.ts";
import PosthogTrackers from "../../../PosthogTrackers.ts";
import SettingsStore from "../../../settings/SettingsStore.ts";
import { useFeatureEnabled } from "../../../hooks/useSettings.ts";
import { UIComponent } from "../../../settings/UIFeature.ts";
import { RoomNotificationStateStore } from "../../../stores/notifications/RoomNotificationStateStore.ts";
import { type ITagMap } from "../../../stores/room-list/algorithms/models.ts";
import { DefaultTagID, type TagID } from "../../../stores/room-list/models.ts";
import { UPDATE_EVENT } from "../../../stores/AsyncStore.ts";
import RoomListStore, { LISTS_UPDATE_EVENT } from "../../../stores/room-list/RoomListStore.ts";
import {
    isMetaSpace,
    type ISuggestedRoom,
    MetaSpace,
    type SpaceKey,
    UPDATE_SELECTED_SPACE,
    UPDATE_SUGGESTED_ROOMS,
} from "../../../stores/spaces/index.ts";
import SpaceStore from "../../../stores/spaces/SpaceStore.ts";
import { arrayFastClone, arrayHasDiff } from "../../../utils/arrays.ts";
import { objectShallowClone, objectWithOnly } from "../../../utils/objects.ts";
import type ResizeNotifier from "../../../utils/ResizeNotifier.ts";
import {
    shouldShowSpaceInvite,
    showAddExistingRooms,
    showCreateNewRoom,
    showSpaceInvite,
} from "../../../utils/space.tsx";
import {
    ChevronFace,
    ContextMenuTooltipButton,
    type MenuProps,
    useContextMenu,
} from "../../structures/ContextMenu.tsx";
import RoomAvatar from "../avatars/RoomAvatar.tsx";
import { BetaPill } from "../beta/BetaCard.tsx";
import IconizedContextMenu, {
    IconizedContextMenuOption,
    IconizedContextMenuOptionList,
} from "../context_menus/IconizedContextMenu.tsx";
import ExtraTile from "./ExtraTile.tsx";
import RoomSublist, { type IAuxButtonProps } from "./RoomSublist.tsx";
import { SdkContextClass } from "../../../contexts/SDKContext.ts";
import { KeyBindingAction } from "../../../accessibility/KeyboardShortcuts.ts";
import { getKeyBindingsManager } from "../../../KeyBindingsManager.ts";
import AccessibleButton from "../elements/AccessibleButton.tsx";
import { Landmark, LandmarkNavigation } from "../../../accessibility/LandmarkNavigation.ts";
import LegacyCallHandler, { LegacyCallHandlerEvent } from "../../../LegacyCallHandler.tsx";

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
}

export const TAG_ORDER: TagID[] = [
    DefaultTagID.Invite,
    DefaultTagID.Favourite,
    DefaultTagID.DM,
    DefaultTagID.Untagged,
    DefaultTagID.Conference,
    DefaultTagID.LowPriority,
    DefaultTagID.ServerNotice,
    DefaultTagID.Suggested,
    // DefaultTagID.Archived isn't here any more: we don't show it at all.
    // The section still exists in the code as a place for rooms that we know
    // about but aren't joined. At some point it could be removed entirely
    // but we'd have to make sure that rooms you weren't in were hidden.
];
const ALWAYS_VISIBLE_TAGS: TagID[] = [DefaultTagID.DM, DefaultTagID.Untagged];

interface ITagAesthetics {
    sectionLabel: TranslationKey;
    sectionLabelRaw?: string;
    AuxButtonComponent?: ComponentType<IAuxButtonProps>;
    isInvite: boolean;
    defaultHidden: boolean;
}

type TagAestheticsMap = Partial<{
    [tagId in TagID]: ITagAesthetics;
}>;

const auxButtonContextMenuPosition = (handle: HTMLDivElement): MenuProps => {
    const rect = handle.getBoundingClientRect();
    return {
        chevronFace: ChevronFace.None,
        left: rect.left - 7,
        top: rect.top + rect.height,
    };
};

const DmAuxButton: React.FC<IAuxButtonProps> = ({ tabIndex, dispatcher = defaultDispatcher }) => {
    const [menuDisplayed, handle, openMenu, closeMenu] = useContextMenu<HTMLDivElement>();
    const activeSpace = useEventEmitterState(SpaceStore.instance, UPDATE_SELECTED_SPACE, () => {
        return SpaceStore.instance.activeSpaceRoom;
    });

    const showCreateRooms = shouldShowComponent(UIComponent.CreateRooms);
    const showInviteUsers = shouldShowComponent(UIComponent.InviteUsers);

    if (activeSpace && (showCreateRooms || showInviteUsers)) {
        let contextMenu: JSX.Element | undefined;
        if (menuDisplayed && handle.current) {
            const canInvite = shouldShowSpaceInvite(activeSpace);

            contextMenu = (
                <IconizedContextMenu {...auxButtonContextMenuPosition(handle.current)} onFinished={closeMenu} compact>
                    <IconizedContextMenuOptionList first>
                        {showCreateRooms && (
                            <IconizedContextMenuOption
                                label={_t("action|start_new_chat")}
                                iconClassName="mx_RoomList_iconStartChat"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    closeMenu();
                                    defaultDispatcher.dispatch({ action: "view_create_chat" });
                                    PosthogTrackers.trackInteraction(
                                        "WebRoomListRoomsSublistPlusMenuCreateChatItem",
                                        e,
                                    );
                                }}
                            />
                        )}
                        {showInviteUsers && (
                            <IconizedContextMenuOption
                                label={_t("action|invite_to_space")}
                                iconClassName="mx_RoomList_iconInvite"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    closeMenu();
                                    showSpaceInvite(activeSpace);
                                }}
                                disabled={!canInvite}
                                title={canInvite ? undefined : _t("spaces|error_no_permission_invite")}
                            />
                        )}
                    </IconizedContextMenuOptionList>
                </IconizedContextMenu>
            );
        }

        return (
            <>
                <ContextMenuTooltipButton
                    tabIndex={tabIndex}
                    onClick={openMenu}
                    className="mx_RoomSublist_auxButton"
                    aria-label={_t("action|add_people")}
                    title={_t("action|add_people")}
                    isExpanded={menuDisplayed}
                    ref={handle}
                />

                {contextMenu}
            </>
        );
    } else if (!activeSpace && showCreateRooms) {
        return (
            <AccessibleButton
                tabIndex={tabIndex}
                onClick={(e) => {
                    dispatcher.dispatch({ action: "view_create_chat" });
                    PosthogTrackers.trackInteraction("WebRoomListRoomsSublistPlusMenuCreateChatItem", e);
                }}
                className="mx_RoomSublist_auxButton"
                aria-label={_t("action|start_chat")}
                title={_t("action|start_chat")}
            />
        );
    }

    return null;
};

const UntaggedAuxButton: React.FC<IAuxButtonProps> = ({ tabIndex }) => {
    const [menuDisplayed, handle, openMenu, closeMenu] = useContextMenu<HTMLDivElement>();
    const activeSpace = useEventEmitterState<Room | null>(SpaceStore.instance, UPDATE_SELECTED_SPACE, () => {
        return SpaceStore.instance.activeSpaceRoom;
    });

    const showCreateRoom = shouldShowComponent(UIComponent.CreateRooms);
    const showExploreRooms = shouldShowComponent(UIComponent.ExploreRooms);

    const videoRoomsEnabled = useFeatureEnabled("feature_video_rooms");
    const elementCallVideoRoomsEnabled = useFeatureEnabled("feature_element_call_video_rooms");

    let contextMenuContent: JSX.Element | undefined;
    if (menuDisplayed && activeSpace) {
        const canAddRooms = activeSpace.currentState.maySendStateEvent(
            EventType.SpaceChild,
            MatrixClientPeg.safeGet().getSafeUserId(),
        );

        contextMenuContent = (
            <IconizedContextMenuOptionList first>
                <IconizedContextMenuOption
                    label={_t("action|explore_rooms")}
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
                {showCreateRoom ? (
                    <>
                        <IconizedContextMenuOption
                            label={_t("action|new_room")}
                            iconClassName="mx_RoomList_iconNewRoom"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                closeMenu();
                                showCreateNewRoom(activeSpace);
                                PosthogTrackers.trackInteraction("WebRoomListRoomsSublistPlusMenuCreateRoomItem", e);
                            }}
                            disabled={!canAddRooms}
                            title={canAddRooms ? undefined : _t("spaces|error_no_permission_create_room")}
                        />
                        {videoRoomsEnabled && (
                            <IconizedContextMenuOption
                                label={_t("action|new_video_room")}
                                iconClassName="mx_RoomList_iconNewVideoRoom"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    closeMenu();
                                    showCreateNewRoom(
                                        activeSpace,
                                        elementCallVideoRoomsEnabled ? RoomType.UnstableCall : RoomType.ElementVideo,
                                    );
                                }}
                                disabled={!canAddRooms}
                                title={canAddRooms ? undefined : _t("spaces|error_no_permission_create_room")}
                            >
                                <BetaPill />
                            </IconizedContextMenuOption>
                        )}
                        <IconizedContextMenuOption
                            label={_t("action|add_existing_room")}
                            iconClassName="mx_RoomList_iconAddExistingRoom"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                closeMenu();
                                showAddExistingRooms(activeSpace);
                            }}
                            disabled={!canAddRooms}
                            title={canAddRooms ? undefined : _t("spaces|error_no_permission_add_room")}
                        />
                    </>
                ) : null}
            </IconizedContextMenuOptionList>
        );
    } else if (menuDisplayed) {
        contextMenuContent = (
            <IconizedContextMenuOptionList first>
                {showCreateRoom && (
                    <>
                        <IconizedContextMenuOption
                            label={_t("action|new_room")}
                            iconClassName="mx_RoomList_iconNewRoom"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                closeMenu();
                                defaultDispatcher.dispatch({ action: "view_create_room" });
                                PosthogTrackers.trackInteraction("WebRoomListRoomsSublistPlusMenuCreateRoomItem", e);
                            }}
                        />
                        {videoRoomsEnabled && (
                            <IconizedContextMenuOption
                                label={_t("action|new_video_room")}
                                iconClassName="mx_RoomList_iconNewVideoRoom"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    closeMenu();
                                    defaultDispatcher.dispatch({
                                        action: "view_create_room",
                                        type: elementCallVideoRoomsEnabled
                                            ? RoomType.UnstableCall
                                            : RoomType.ElementVideo,
                                    });
                                }}
                            >
                                <BetaPill />
                            </IconizedContextMenuOption>
                        )}
                    </>
                )}
                {showExploreRooms ? (
                    <IconizedContextMenuOption
                        label={_t("action|explore_public_rooms")}
                        iconClassName="mx_RoomList_iconExplore"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            closeMenu();
                            PosthogTrackers.trackInteraction("WebRoomListRoomsSublistPlusMenuExploreRoomsItem", e);
                            defaultDispatcher.fire(Action.ViewRoomDirectory);
                        }}
                    />
                ) : null}
            </IconizedContextMenuOptionList>
        );
    }

    let contextMenu: JSX.Element | null = null;
    if (menuDisplayed && handle.current) {
        contextMenu = (
            <IconizedContextMenu {...auxButtonContextMenuPosition(handle.current)} onFinished={closeMenu} compact>
                {contextMenuContent}
            </IconizedContextMenu>
        );
    }

    if (showCreateRoom || showExploreRooms) {
        return (
            <>
                <ContextMenuTooltipButton
                    tabIndex={tabIndex}
                    onClick={openMenu}
                    className="mx_RoomSublist_auxButton"
                    aria-label={_t("room_list|add_room_label")}
                    title={_t("room_list|add_room_label")}
                    isExpanded={menuDisplayed}
                    ref={handle}
                />

                {contextMenu}
            </>
        );
    }

    return null;
};

const TAG_AESTHETICS: TagAestheticsMap = {
    [DefaultTagID.Invite]: {
        sectionLabel: _td("action|invites_list"),
        isInvite: true,
        defaultHidden: false,
    },
    [DefaultTagID.Favourite]: {
        sectionLabel: _td("common|favourites"),
        isInvite: false,
        defaultHidden: false,
    },
    [DefaultTagID.DM]: {
        sectionLabel: _td("common|people"),
        isInvite: false,
        defaultHidden: false,
        AuxButtonComponent: DmAuxButton,
    },
    [DefaultTagID.Conference]: {
        sectionLabel: _td("voip|metaspace_video_rooms|conference_room_section"),
        isInvite: false,
        defaultHidden: false,
    },
    [DefaultTagID.Untagged]: {
        sectionLabel: _td("common|rooms"),
        isInvite: false,
        defaultHidden: false,
        AuxButtonComponent: UntaggedAuxButton,
    },
    [DefaultTagID.LowPriority]: {
        sectionLabel: _td("common|low_priority"),
        isInvite: false,
        defaultHidden: false,
    },
    [DefaultTagID.ServerNotice]: {
        sectionLabel: _td("common|system_alerts"),
        isInvite: false,
        defaultHidden: false,
    },

    // TODO: Replace with archived view: https://github.com/vector-im/element-web/issues/14038
    [DefaultTagID.Archived]: {
        sectionLabel: _td("common|historical"),
        isInvite: false,
        defaultHidden: true,
    },

    [DefaultTagID.Suggested]: {
        sectionLabel: _td("room_list|suggested_rooms_heading"),
        isInvite: false,
        defaultHidden: false,
    },
};

export default class LegacyRoomList extends React.PureComponent<IProps, IState> {
    private dispatcherRef?: string;
    private treeRef = createRef<HTMLDivElement>();

    public static contextType = MatrixClientContext;
    declare public context: React.ContextType<typeof MatrixClientContext>;

    public constructor(props: IProps, context: React.ContextType<typeof MatrixClientContext>) {
        super(props, context);

        this.state = {
            sublists: {},
            suggestedRooms: SpaceStore.instance.suggestedRooms,
        };
    }

    public componentDidMount(): void {
        this.dispatcherRef = defaultDispatcher.register(this.onAction);
        SdkContextClass.instance.roomViewStore.on(UPDATE_EVENT, this.onRoomViewStoreUpdate);
        SpaceStore.instance.on(UPDATE_SUGGESTED_ROOMS, this.updateSuggestedRooms);
        RoomListStore.instance.on(LISTS_UPDATE_EVENT, this.updateLists);
        LegacyCallHandler.instance.on(LegacyCallHandlerEvent.ProtocolSupport, this.updateProtocolSupport);
        this.updateLists(); // trigger the first update
    }

    public componentWillUnmount(): void {
        SpaceStore.instance.off(UPDATE_SUGGESTED_ROOMS, this.updateSuggestedRooms);
        RoomListStore.instance.off(LISTS_UPDATE_EVENT, this.updateLists);
        defaultDispatcher.unregister(this.dispatcherRef);
        SdkContextClass.instance.roomViewStore.off(UPDATE_EVENT, this.onRoomViewStoreUpdate);
        LegacyCallHandler.instance.off(LegacyCallHandlerEvent.ProtocolSupport, this.updateProtocolSupport);
    }

    private updateProtocolSupport = (): void => {
        this.updateLists();
    };

    private onRoomViewStoreUpdate = (): void => {
        this.setState({
            currentRoomId: SdkContextClass.instance.roomViewStore.getRoomId() ?? undefined,
        });
    };

    private onAction = (payload: ActionPayload): void => {
        if (payload.action === Action.ViewRoomDelta) {
            const viewRoomDeltaPayload = payload as ViewRoomDeltaPayload;
            const currentRoomId = SdkContextClass.instance.roomViewStore.getRoomId();
            if (!currentRoomId) return;
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
        }
    };

    private getRoomDelta = (roomId: string, delta: number, unread = false): Room => {
        const lists = RoomListStore.instance.orderedLists;
        const rooms: Room[] = [];
        TAG_ORDER.forEach((t) => {
            let listRooms = lists[t];

            if (unread) {
                // filter to only notification rooms (and our current active room so we can index properly)
                listRooms = listRooms.filter((r) => {
                    const state = RoomNotificationStateStore.instance.getRoomState(r);
                    return state.room.roomId === roomId || state.isUnread;
                });
            }

            rooms.push(...listRooms);
        });

        const currentIndex = rooms.findIndex((r) => r.roomId === roomId);
        // use slice to account for looping around the start
        const [room] = rooms.slice((currentIndex + delta) % rooms.length);
        return room;
    };

    private updateSuggestedRooms = (suggestedRooms: ISuggestedRoom[]): void => {
        this.setState({ suggestedRooms });
    };

    private updateLists = (): void => {
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
        return this.state.suggestedRooms.map((room) => {
            const name = room.name || room.canonical_alias || room.aliases?.[0] || _t("empty_room");
            const avatar = (
                <RoomAvatar
                    oobData={{
                        name,
                        avatarUrl: room.avatar_url,
                    }}
                    size="32px"
                />
            );
            const viewRoom = (ev: SyntheticEvent): void => {
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

    private renderSublists(): React.ReactElement[] {
        // show a skeleton UI if the user is in no rooms and they are not filtering and have no suggested rooms
        const showSkeleton =
            !this.state.suggestedRooms?.length &&
            Object.values(RoomListStore.instance.orderedLists).every((list) => !list?.length);

        return TAG_ORDER.map((orderedTagId) => {
            let extraTiles: ReactComponentElement<typeof ExtraTile>[] | undefined;
            if (orderedTagId === DefaultTagID.Suggested) {
                extraTiles = this.renderSuggestedRooms();
            }

            const aesthetics = TAG_AESTHETICS[orderedTagId];
            if (!aesthetics) throw new Error(`Tag ${orderedTagId} does not have aesthetics`);

            let alwaysVisible = ALWAYS_VISIBLE_TAGS.includes(orderedTagId);
            if (
                (this.props.activeSpace === MetaSpace.Favourites && orderedTagId !== DefaultTagID.Favourite) ||
                (this.props.activeSpace === MetaSpace.People && orderedTagId !== DefaultTagID.DM) ||
                (this.props.activeSpace === MetaSpace.Orphans && orderedTagId === DefaultTagID.DM) ||
                (this.props.activeSpace === MetaSpace.VideoRooms && orderedTagId === DefaultTagID.DM) ||
                (!isMetaSpace(this.props.activeSpace) &&
                    orderedTagId === DefaultTagID.DM &&
                    !SettingsStore.getValue("Spaces.showPeopleInSpace", this.props.activeSpace))
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
            return (
                <RoomSublist
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
                />
            );
        });
    }

    public focus(): void {
        // focus the first focusable element in this aria treeview widget
        const treeItems = this.treeRef.current?.querySelectorAll<HTMLElement>('[role="treeitem"]');
        if (!treeItems) return;
        [...treeItems].find((e) => e.offsetParent !== null)?.focus();
    }

    public render(): React.ReactNode {
        const sublists = this.renderSublists();
        return (
            <RovingTabIndexProvider handleHomeEnd handleUpDown onKeyDown={this.props.onKeyDown}>
                {({ onKeyDownHandler }) => (
                    <div
                        onFocus={this.props.onFocus}
                        onBlur={this.props.onBlur}
                        onKeyDown={(ev) => {
                            const navAction = getKeyBindingsManager().getNavigationAction(ev);
                            if (
                                navAction === KeyBindingAction.NextLandmark ||
                                navAction === KeyBindingAction.PreviousLandmark
                            ) {
                                LandmarkNavigation.findAndFocusNextLandmark(
                                    Landmark.ROOM_LIST,
                                    navAction === KeyBindingAction.PreviousLandmark,
                                );
                                ev.stopPropagation();
                                ev.preventDefault();
                                return;
                            }
                            onKeyDownHandler(ev);
                        }}
                        className="mx_RoomList"
                        role="tree"
                        aria-label={_t("common|rooms")}
                        ref={this.treeRef}
                    >
                        {sublists}
                    </div>
                )}
            </RovingTabIndexProvider>
        );
    }
}
