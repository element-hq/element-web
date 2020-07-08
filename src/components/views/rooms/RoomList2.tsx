/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017, 2018 Vector Creations Ltd
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import * as React from "react";
import { Dispatcher } from "flux";
import { Room } from "matrix-js-sdk/src/models/room";

import { _t, _td } from "../../../languageHandler";
import { RovingTabIndexProvider } from "../../../accessibility/RovingTabIndex";
import { ResizeNotifier } from "../../../utils/ResizeNotifier";
import RoomListStore, { LISTS_UPDATE_EVENT } from "../../../stores/room-list/RoomListStore2";
import RoomViewStore from "../../../stores/RoomViewStore";
import { ITagMap } from "../../../stores/room-list/algorithms/models";
import { DefaultTagID, TagID } from "../../../stores/room-list/models";
import dis from "../../../dispatcher/dispatcher";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import RoomSublist2 from "./RoomSublist2";
import { ActionPayload } from "../../../dispatcher/payloads";
import { NameFilterCondition } from "../../../stores/room-list/filters/NameFilterCondition";
import { ListLayout } from "../../../stores/room-list/ListLayout";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import GroupAvatar from "../avatars/GroupAvatar";
import TemporaryTile from "./TemporaryTile";
import { StaticNotificationState } from "../../../stores/notifications/StaticNotificationState";
import { NotificationColor } from "../../../stores/notifications/NotificationColor";
import { TagSpecificNotificationState } from "../../../stores/notifications/TagSpecificNotificationState";
import { Action } from "../../../dispatcher/actions";
import { ViewRoomDeltaPayload } from "../../../dispatcher/payloads/ViewRoomDeltaPayload";

// TODO: Remove banner on launch: https://github.com/vector-im/riot-web/issues/14231
// TODO: Rename on launch: https://github.com/vector-im/riot-web/issues/14231

/*******************************************************************
 *   CAUTION                                                       *
 *******************************************************************
 * This is a work in progress implementation and isn't complete or *
 * even useful as a component. Please avoid using it until this    *
 * warning disappears.                                             *
 *******************************************************************/

interface IProps {
    onKeyDown: (ev: React.KeyboardEvent) => void;
    onFocus: (ev: React.FocusEvent) => void;
    onBlur: (ev: React.FocusEvent) => void;
    onResize: () => void;
    resizeNotifier: ResizeNotifier;
    collapsed: boolean;
    searchFilter: string;
    isMinimized: boolean;
}

interface IState {
    sublists: ITagMap;
    layouts: Map<TagID, ListLayout>;
}

const TAG_ORDER: TagID[] = [
    DefaultTagID.Invite,
    DefaultTagID.Favourite,
    DefaultTagID.DM,
    DefaultTagID.Untagged,

    // -- Custom Tags Placeholder --

    DefaultTagID.LowPriority,
    DefaultTagID.ServerNotice,
    DefaultTagID.Archived,
];
const CUSTOM_TAGS_BEFORE_TAG = DefaultTagID.LowPriority;
const ALWAYS_VISIBLE_TAGS: TagID[] = [
    DefaultTagID.DM,
    DefaultTagID.Untagged,
];

interface ITagAesthetics {
    sectionLabel: string;
    addRoomLabel?: string;
    onAddRoom?: (dispatcher: Dispatcher<ActionPayload>) => void;
    isInvite: boolean;
    defaultHidden: boolean;
}

const TAG_AESTHETICS: {
    // @ts-ignore - TS wants this to be a string but we know better
    [tagId: TagID]: ITagAesthetics;
} = {
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
        addRoomLabel: _td("Start chat"),
        onAddRoom: (dispatcher: Dispatcher<ActionPayload>) => dispatcher.dispatch({action: 'view_create_chat'}),
    },
    [DefaultTagID.Untagged]: {
        sectionLabel: _td("Rooms"),
        isInvite: false,
        defaultHidden: false,
        addRoomLabel: _td("Create room"),
        onAddRoom: (dispatcher: Dispatcher<ActionPayload>) => dispatcher.dispatch({action: 'view_create_room'}),
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

    // TODO: Replace with archived view: https://github.com/vector-im/riot-web/issues/14038
    [DefaultTagID.Archived]: {
        sectionLabel: _td("Historical"),
        isInvite: false,
        defaultHidden: true,
    },
};

export default class RoomList2 extends React.Component<IProps, IState> {
    private searchFilter: NameFilterCondition = new NameFilterCondition();
    private dispatcherRef;

    constructor(props: IProps) {
        super(props);

        this.state = {
            sublists: {},
            layouts: new Map<TagID, ListLayout>(),
        };

        this.dispatcherRef = defaultDispatcher.register(this.onAction);
    }

    public componentDidUpdate(prevProps: Readonly<IProps>): void {
        if (prevProps.searchFilter !== this.props.searchFilter) {
            const hadSearch = !!this.searchFilter.search.trim();
            const haveSearch = !!this.props.searchFilter.trim();
            this.searchFilter.search = this.props.searchFilter;
            if (!hadSearch && haveSearch) {
                // started a new filter - add the condition
                RoomListStore.instance.addFilter(this.searchFilter);
            } else if (hadSearch && !haveSearch) {
                // cleared a filter - remove the condition
                RoomListStore.instance.removeFilter(this.searchFilter);
            } // else the filter hasn't changed enough for us to care here
        }
    }

    public componentDidMount(): void {
        RoomListStore.instance.on(LISTS_UPDATE_EVENT, this.updateLists);
        this.updateLists(); // trigger the first update
    }

    public componentWillUnmount() {
        RoomListStore.instance.off(LISTS_UPDATE_EVENT, this.updateLists);
        defaultDispatcher.unregister(this.dispatcherRef);
    }

    private onAction = (payload: ActionPayload) => {
        if (payload.action === Action.ViewRoomDelta) {
            const viewRoomDeltaPayload = payload as ViewRoomDeltaPayload;
            const currentRoomId = RoomViewStore.getRoomId();
            const room = this.getRoomDelta(currentRoomId, viewRoomDeltaPayload.delta, viewRoomDeltaPayload.unread);
            if (room) {
                dis.dispatch({
                    action: 'view_room',
                    room_id: room.roomId,
                    show_room_tile: true, // to make sure the room gets scrolled into view
                });
            }
        }
    };

    private getRoomDelta = (roomId: string, delta: number, unread = false) => {
        const lists = RoomListStore.instance.orderedLists;
        let rooms: Room = [];
        TAG_ORDER.forEach(t => {
            let listRooms = lists[t];

            if (unread) {
                // TODO Be smarter and not spin up a bunch of wasted listeners just to kill them 4 lines later
                // https://github.com/vector-im/riot-web/issues/14035
                const notificationStates = rooms.map(r => new TagSpecificNotificationState(r, t));
                // filter to only notification rooms (and our current active room so we can index properly)
                listRooms = notificationStates.filter(state => {
                    return state.room.roomId === roomId || state.color >= NotificationColor.Bold;
                });
                notificationStates.forEach(state => state.destroy());
            }

            rooms.push(...listRooms);
        });

        const currentIndex = rooms.findIndex(r => r.roomId === roomId);
        // use slice to account for looping around the start
        const [room] = rooms.slice((currentIndex + delta) % rooms.length);
        return room;
    };

    private updateLists = () => {
        const newLists = RoomListStore.instance.orderedLists;
        console.log("new lists", newLists);

        const layoutMap = new Map<TagID, ListLayout>();
        for (const tagId of Object.keys(newLists)) {
            layoutMap.set(tagId, new ListLayout(tagId));
        }

        this.setState({sublists: newLists, layouts: layoutMap}, () => {
            this.props.onResize();
        });
    };

    private renderCommunityInvites(): React.ReactElement[] {
        // TODO: Put community invites in a more sensible place (not in the room list)
        return MatrixClientPeg.get().getGroups().filter(g => {
           if (g.myMembership !== 'invite') return false;
           return !this.searchFilter || this.searchFilter.matches(g.name || "");
        }).map(g => {
            const avatar = (
                <GroupAvatar
                    groupId={g.groupId}
                    groupName={g.name}
                    groupAvatarUrl={g.avatarUrl}
                    width={32} height={32} resizeMethod='crop'
                />
            );
            const openGroup = () => {
                defaultDispatcher.dispatch({
                    action: 'view_group',
                    group_id: g.groupId,
                });
            };
            return (
                <TemporaryTile
                    isMinimized={this.props.isMinimized}
                    isSelected={false}
                    displayName={g.name}
                    avatar={avatar}
                    notificationState={StaticNotificationState.forSymbol("!", NotificationColor.Red)}
                    onClick={openGroup}
                    key={`temporaryGroupTile_${g.groupId}`}
                />
            );
        });
    }

    private renderSublists(): React.ReactElement[] {
        const components: React.ReactElement[] = [];

        for (const orderedTagId of TAG_ORDER) {
            if (CUSTOM_TAGS_BEFORE_TAG === orderedTagId) {
                // Populate custom tags if needed
                // TODO: Custom tags: https://github.com/vector-im/riot-web/issues/14091
            }

            const orderedRooms = this.state.sublists[orderedTagId] || [];
            const extraTiles = orderedTagId === DefaultTagID.Invite ? this.renderCommunityInvites() : null;
            const totalTiles = orderedRooms.length + (extraTiles ? extraTiles.length : 0);
            if (totalTiles === 0 && !ALWAYS_VISIBLE_TAGS.includes(orderedTagId)) {
                continue; // skip tag - not needed
            }

            const aesthetics: ITagAesthetics = TAG_AESTHETICS[orderedTagId];
            if (!aesthetics) throw new Error(`Tag ${orderedTagId} does not have aesthetics`);

            const onAddRoomFn = aesthetics.onAddRoom ? () => aesthetics.onAddRoom(dis) : null;
            components.push(
                <RoomSublist2
                    key={`sublist-${orderedTagId}`}
                    tagId={orderedTagId}
                    forRooms={true}
                    rooms={orderedRooms}
                    startAsHidden={aesthetics.defaultHidden}
                    label={_t(aesthetics.sectionLabel)}
                    onAddRoom={onAddRoomFn}
                    addRoomLabel={aesthetics.addRoomLabel}
                    isInvite={aesthetics.isInvite}
                    layout={this.state.layouts.get(orderedTagId)}
                    isMinimized={this.props.isMinimized}
                    onResize={this.props.onResize}
                    extraBadTilesThatShouldntExist={extraTiles}
                />
            );
        }

        return components;
    }

    public render() {
        const sublists = this.renderSublists();
        return (
            <RovingTabIndexProvider handleHomeEnd={true} onKeyDown={this.props.onKeyDown}>
                {({onKeyDownHandler}) => (
                    <div
                        onFocus={this.props.onFocus}
                        onBlur={this.props.onBlur}
                        onKeyDown={onKeyDownHandler}
                        className="mx_RoomList2"
                        role="tree"
                        aria-label={_t("Rooms")}
                    >{sublists}</div>
                )}
            </RovingTabIndexProvider>
        );
    }
}
