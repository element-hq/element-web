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

import React, { ComponentType, createRef, ReactComponentElement, RefObject } from "react";
import { Room } from "matrix-js-sdk/src/models/room";
import * as fbEmitter from "fbemitter";
import { EventType } from "matrix-js-sdk/src/@types/event";

import { _t, _td } from "../../../languageHandler";
import { IState as IRovingTabIndexState, RovingTabIndexProvider } from "../../../accessibility/RovingTabIndex";
import ResizeNotifier from "../../../utils/ResizeNotifier";
import RoomListStore, { LISTS_UPDATE_EVENT } from "../../../stores/room-list/RoomListStore";
import RoomViewStore from "../../../stores/RoomViewStore";
import { ITagMap } from "../../../stores/room-list/algorithms/models";
import { DefaultTagID, isCustomTag, TagID } from "../../../stores/room-list/models";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import RoomSublist, { IAuxButtonProps } from "./RoomSublist";
import { ActionPayload } from "../../../dispatcher/payloads";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import GroupAvatar from "../avatars/GroupAvatar";
import ExtraTile from "./ExtraTile";
import { StaticNotificationState } from "../../../stores/notifications/StaticNotificationState";
import { Action } from "../../../dispatcher/actions";
import { ViewRoomDeltaPayload } from "../../../dispatcher/payloads/ViewRoomDeltaPayload";
import { RoomNotificationStateStore } from "../../../stores/notifications/RoomNotificationStateStore";
import CustomRoomTagStore from "../../../stores/CustomRoomTagStore";
import { arrayFastClone, arrayHasDiff } from "../../../utils/arrays";
import { objectShallowClone, objectWithOnly } from "../../../utils/objects";
import IconizedContextMenu, {
    IconizedContextMenuOption,
    IconizedContextMenuOptionList,
} from "../context_menus/IconizedContextMenu";
import AccessibleButton from "../elements/AccessibleButton";
import { CommunityPrototypeStore } from "../../../stores/CommunityPrototypeStore";
import SpaceStore from "../../../stores/spaces/SpaceStore";
import {
    ISuggestedRoom,
    MetaSpace,
    SpaceKey,
    UPDATE_SUGGESTED_ROOMS,
    UPDATE_SELECTED_SPACE,
    isMetaSpace,
} from "../../../stores/spaces";
import { shouldShowSpaceInvite, showAddExistingRooms, showCreateNewRoom, showSpaceInvite } from "../../../utils/space";
import { replaceableComponent } from "../../../utils/replaceableComponent";
import RoomAvatar from "../avatars/RoomAvatar";
import { shouldShowComponent } from "../../../customisations/helpers/UIComponents";
import { UIComponent } from "../../../settings/UIFeature";
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import { useEventEmitterState } from "../../../hooks/useEventEmitter";
import { ChevronFace, ContextMenuTooltipButton, useContextMenu } from "../../structures/ContextMenu";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import SettingsStore from "../../../settings/SettingsStore";

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
    isNameFiltering: boolean;
    currentRoomId?: string;
    suggestedRooms: ISuggestedRoom[];
}

export const TAG_ORDER: TagID[] = [
    DefaultTagID.Invite,
    DefaultTagID.Favourite,
    DefaultTagID.DM,
    DefaultTagID.Untagged,

    // -- Custom Tags Placeholder --

    DefaultTagID.LowPriority,
    DefaultTagID.ServerNotice,
    DefaultTagID.Suggested,
    DefaultTagID.Archived,
];
const CUSTOM_TAGS_BEFORE_TAG = DefaultTagID.LowPriority;
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
    const activeSpace = useEventEmitterState<Room>(SpaceStore.instance, UPDATE_SELECTED_SPACE, () => {
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
            onClick={() => dispatcher.dispatch({ action: 'view_create_chat' })}
            className="mx_RoomSublist_auxButton"
            tooltipClassName="mx_RoomSublist_addRoomTooltip"
            aria-label={_t("Start chat")}
            title={_t("Start chat")}
        />;
    }
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
                    defaultDispatcher.dispatch({
                        action: "view_room",
                        room_id: activeSpace.roomId,
                    });
                }}
            />
            {
                showCreateRoom
                    ? (<>
                        <IconizedContextMenuOption
                            label={_t("Create new room")}
                            iconClassName="mx_RoomList_iconCreateNewRoom"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                closeMenu();
                                showCreateNewRoom(activeSpace);
                            }}
                            disabled={!canAddRooms}
                            tooltip={canAddRooms ? undefined
                                : _t("You do not have permissions to create new rooms in this space")}
                        />
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
            { showCreateRoom && <IconizedContextMenuOption
                label={_t("Create new room")}
                iconClassName="mx_RoomList_iconCreateNewRoom"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    closeMenu();
                    defaultDispatcher.dispatch({ action: "view_create_room" });
                }}
            /> }
            <IconizedContextMenuOption
                label={CommunityPrototypeStore.instance.getSelectedCommunityId()
                    ? _t("Explore community rooms")
                    : _t("Explore public rooms")}
                iconClassName="mx_RoomList_iconExplore"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    closeMenu();
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
            aria-label={_td("Add room")}
            title={_td("Add room")}
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

function customTagAesthetics(tagId: TagID): ITagAesthetics {
    if (tagId.startsWith("u.")) {
        tagId = tagId.substring(2);
    }
    return {
        sectionLabel: _td("Custom Tag"),
        sectionLabelRaw: tagId,
        isInvite: false,
        defaultHidden: false,
    };
}

@replaceableComponent("views.rooms.RoomList")
export default class RoomList extends React.PureComponent<IProps, IState> {
    private dispatcherRef;
    private customTagStoreRef;
    private roomStoreToken: fbEmitter.EventSubscription;
    private treeRef = createRef<HTMLDivElement>();

    static contextType = MatrixClientContext;
    public context!: React.ContextType<typeof MatrixClientContext>;

    constructor(props: IProps) {
        super(props);

        this.state = {
            sublists: {},
            isNameFiltering: !!RoomListStore.instance.getFirstNameFilterCondition(),
            suggestedRooms: SpaceStore.instance.suggestedRooms,
        };
    }

    public componentDidMount(): void {
        this.dispatcherRef = defaultDispatcher.register(this.onAction);
        this.roomStoreToken = RoomViewStore.addListener(this.onRoomViewStoreUpdate);
        SpaceStore.instance.on(UPDATE_SUGGESTED_ROOMS, this.updateSuggestedRooms);
        RoomListStore.instance.on(LISTS_UPDATE_EVENT, this.updateLists);
        this.customTagStoreRef = CustomRoomTagStore.addListener(this.updateLists);
        this.updateLists(); // trigger the first update
    }

    public componentWillUnmount() {
        SpaceStore.instance.off(UPDATE_SUGGESTED_ROOMS, this.updateSuggestedRooms);
        RoomListStore.instance.off(LISTS_UPDATE_EVENT, this.updateLists);
        defaultDispatcher.unregister(this.dispatcherRef);
        if (this.customTagStoreRef) this.customTagStoreRef.remove();
        if (this.roomStoreToken) this.roomStoreToken.remove();
    }

    private onRoomViewStoreUpdate = () => {
        this.setState({
            currentRoomId: RoomViewStore.getRoomId(),
        });
    };

    private onAction = (payload: ActionPayload) => {
        if (payload.action === Action.ViewRoomDelta) {
            const viewRoomDeltaPayload = payload as ViewRoomDeltaPayload;
            const currentRoomId = RoomViewStore.getRoomId();
            const room = this.getRoomDelta(currentRoomId, viewRoomDeltaPayload.delta, viewRoomDeltaPayload.unread);
            if (room) {
                defaultDispatcher.dispatch({
                    action: Action.ViewRoom,
                    room_id: room.roomId,
                    show_room_tile: true, // to make sure the room gets scrolled into view
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
        const newListIds = Object.keys(newLists).filter(t => {
            if (!isCustomTag(t)) return true; // always include non-custom tags

            // if the tag is custom though, only include it if it is enabled
            return CustomRoomTagStore.getTags()[t];
        });

        const isNameFiltering = !!RoomListStore.instance.getFirstNameFilterCondition();
        let doUpdate = this.state.isNameFiltering !== isNameFiltering || arrayHasDiff(previousListIds, newListIds);
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

            this.setState({ sublists, isNameFiltering }, () => {
                this.props.onResize();
            });
        }
    };

    private onStartChat = () => {
        const initialText = RoomListStore.instance.getFirstNameFilterCondition()?.search;
        defaultDispatcher.dispatch({ action: "view_create_chat", initialText });
    };

    private onExplore = () => {
        if (!isMetaSpace(this.props.activeSpace)) {
            defaultDispatcher.dispatch({
                action: "view_room",
                room_id: this.props.activeSpace,
            });
        } else {
            const initialText = RoomListStore.instance.getFirstNameFilterCondition()?.search;
            defaultDispatcher.dispatch({ action: Action.ViewRoomDirectory, initialText });
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
            const viewRoom = () => {
                defaultDispatcher.dispatch({
                    action: "view_room",
                    room_alias: room.canonical_alias || room.aliases?.[0],
                    room_id: room.room_id,
                    via_servers: room.viaServers,
                    oobData: {
                        avatarUrl: room.avatar_url,
                        name,
                    },
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

    private renderCommunityInvites(): ReactComponentElement<typeof ExtraTile>[] {
        if (SpaceStore.spacesEnabled) return [];
        // TODO: Put community invites in a more sensible place (not in the room list)
        // See https://github.com/vector-im/element-web/issues/14456
        return MatrixClientPeg.get().getGroups().filter(g => {
            return g.myMembership === 'invite';
        }).map(g => {
            const avatar = (
                <GroupAvatar
                    groupId={g.groupId}
                    groupName={g.name}
                    groupAvatarUrl={g.avatarUrl}
                    width={32}
                    height={32}
                    resizeMethod='crop'
                />
            );
            const openGroup = () => {
                defaultDispatcher.dispatch({
                    action: 'view_group',
                    group_id: g.groupId,
                });
            };
            return (
                <ExtraTile
                    isMinimized={this.props.isMinimized}
                    isSelected={false}
                    displayName={g.name}
                    avatar={avatar}
                    notificationState={StaticNotificationState.RED_EXCLAMATION}
                    onClick={openGroup}
                    key={`temporaryGroupTile_${g.groupId}`}
                />
            );
        });
    }

    private renderSublists(): React.ReactElement[] {
        // show a skeleton UI if the user is in no rooms and they are not filtering and have no suggested rooms
        const showSkeleton = !this.state.isNameFiltering && !this.state.suggestedRooms?.length &&
            Object.values(RoomListStore.instance.unfilteredLists).every(list => !list?.length);

        return TAG_ORDER.reduce((tags, tagId) => {
            if (tagId === CUSTOM_TAGS_BEFORE_TAG) {
                const customTags = Object.keys(this.state.sublists)
                    .filter(tagId => isCustomTag(tagId));
                tags.push(...customTags);
            }
            tags.push(tagId);
            return tags;
        }, [] as TagID[])
            .map(orderedTagId => {
                let extraTiles = null;
                if (orderedTagId === DefaultTagID.Invite) {
                    extraTiles = this.renderCommunityInvites();
                } else if (orderedTagId === DefaultTagID.Suggested) {
                    extraTiles = this.renderSuggestedRooms();
                }

                const aesthetics: ITagAesthetics = isCustomTag(orderedTagId)
                    ? customTagAesthetics(orderedTagId)
                    : TAG_AESTHETICS[orderedTagId];
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
        [...this.treeRef.current?.querySelectorAll<HTMLElement>('[role="treeitem"]')]
            .find(e => e.offsetParent !== null)?.focus();
    }

    public render() {
        let explorePrompt: JSX.Element;
        if (!this.props.isMinimized) {
            if (this.state.isNameFiltering) {
                explorePrompt = <div className="mx_RoomList_explorePrompt">
                    <div>{ _t("Can't see what you're looking for?") }</div>
                    <AccessibleButton
                        className="mx_RoomList_explorePrompt_startChat"
                        kind="link"
                        onClick={this.onStartChat}
                    >
                        { _t("Start a new chat") }
                    </AccessibleButton>
                    <AccessibleButton
                        className="mx_RoomList_explorePrompt_explore"
                        kind="link"
                        onClick={this.onExplore}
                    >
                        { !isMetaSpace(this.props.activeSpace) ? _t("Explore rooms") : _t("Explore all public rooms") }
                    </AccessibleButton>
                </div>;
            }
        }

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
                        { explorePrompt }
                    </div>
                ) }
            </RovingTabIndexProvider>
        );
    }
}
