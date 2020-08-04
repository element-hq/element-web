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
import RoomListStore, { LISTS_UPDATE_EVENT } from "../../../stores/room-list/RoomListStore";
import RoomViewStore from "../../../stores/RoomViewStore";
import { ITagMap } from "../../../stores/room-list/algorithms/models";
import { DefaultTagID, isCustomTag, TagID } from "../../../stores/room-list/models";
import dis from "../../../dispatcher/dispatcher";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import RoomSublist from "./RoomSublist";
import { ActionPayload } from "../../../dispatcher/payloads";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import GroupAvatar from "../avatars/GroupAvatar";
import TemporaryTile from "./TemporaryTile";
import { StaticNotificationState } from "../../../stores/notifications/StaticNotificationState";
import { NotificationColor } from "../../../stores/notifications/NotificationColor";
import { Action } from "../../../dispatcher/actions";
import { ViewRoomDeltaPayload } from "../../../dispatcher/payloads/ViewRoomDeltaPayload";
import { RoomNotificationStateStore } from "../../../stores/notifications/RoomNotificationStateStore";
import SettingsStore from "../../../settings/SettingsStore";
import CustomRoomTagStore from "../../../stores/CustomRoomTagStore";
import { arrayFastClone, arrayHasDiff } from "../../../utils/arrays";
import { objectShallowClone, objectWithOnly } from "../../../utils/objects";

interface IProps {
    onKeyDown: (ev: React.KeyboardEvent) => void;
    onFocus: (ev: React.FocusEvent) => void;
    onBlur: (ev: React.FocusEvent) => void;
    onResize: () => void;
    resizeNotifier: ResizeNotifier;
    collapsed: boolean;
    isMinimized: boolean;
}

interface IState {
    sublists: ITagMap;
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
    sectionLabelRaw?: string;
    addRoomLabel?: string;
    onAddRoom?: (dispatcher?: Dispatcher<ActionPayload>) => void;
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
        onAddRoom: (dispatcher?: Dispatcher<ActionPayload>) => {
            (dispatcher || defaultDispatcher).dispatch({action: 'view_create_chat'});
        },
    },
    [DefaultTagID.Untagged]: {
        sectionLabel: _td("Rooms"),
        isInvite: false,
        defaultHidden: false,
        addRoomLabel: _td("Create room"),
        onAddRoom: (dispatcher?: Dispatcher<ActionPayload>) => {
            (dispatcher || defaultDispatcher).dispatch({action: 'view_create_room'})
        },
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

export default class RoomList extends React.PureComponent<IProps, IState> {
    private dispatcherRef;
    private customTagStoreRef;

    constructor(props: IProps) {
        super(props);

        this.state = {
            sublists: {},
        };

        this.dispatcherRef = defaultDispatcher.register(this.onAction);
    }

    public componentDidMount(): void {
        RoomListStore.instance.on(LISTS_UPDATE_EVENT, this.updateLists);
        this.customTagStoreRef = CustomRoomTagStore.addListener(this.updateLists);
        this.updateLists(); // trigger the first update
    }

    public componentWillUnmount() {
        RoomListStore.instance.off(LISTS_UPDATE_EVENT, this.updateLists);
        defaultDispatcher.unregister(this.dispatcherRef);
        if (this.customTagStoreRef) this.customTagStoreRef.remove();
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

    private updateLists = () => {
        const newLists = RoomListStore.instance.orderedLists;
        if (SettingsStore.getValue("advancedRoomListLogging")) {
            // TODO: Remove debug: https://github.com/vector-im/riot-web/issues/14602
            console.log("new lists", newLists);
        }

        const previousListIds = Object.keys(this.state.sublists);
        const newListIds = Object.keys(newLists).filter(t => {
            if (!isCustomTag(t)) return true; // always include non-custom tags

            // if the tag is custom though, only include it if it is enabled
            return CustomRoomTagStore.getTags()[t];
        });

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
            const newSublists = objectWithOnly(newLists, newListIds);
            const sublists = objectShallowClone(newSublists, (k, v) => arrayFastClone(v));

            this.setState({sublists}, () => {
                this.props.onResize();
            });
        }
    };

    private renderCommunityInvites(): TemporaryTile[] {
        // TODO: Put community invites in a more sensible place (not in the room list)
        // See https://github.com/vector-im/riot-web/issues/14456
        return MatrixClientPeg.get().getGroups().filter(g => {
           return g.myMembership === 'invite';
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

        const tagOrder = TAG_ORDER.reduce((p, c) => {
            if (c === CUSTOM_TAGS_BEFORE_TAG) {
                const customTags = Object.keys(this.state.sublists)
                    .filter(t => isCustomTag(t));
                p.push(...customTags);
            }
            p.push(c);
            return p;
        }, [] as TagID[]);

        for (const orderedTagId of tagOrder) {
            const orderedRooms = this.state.sublists[orderedTagId] || [];
            const extraTiles = orderedTagId === DefaultTagID.Invite ? this.renderCommunityInvites() : null;
            const totalTiles = orderedRooms.length + (extraTiles ? extraTiles.length : 0);
            if (totalTiles === 0 && !ALWAYS_VISIBLE_TAGS.includes(orderedTagId)) {
                continue; // skip tag - not needed
            }

            const aesthetics: ITagAesthetics = isCustomTag(orderedTagId)
                ? customTagAesthetics(orderedTagId)
                : TAG_AESTHETICS[orderedTagId];
            if (!aesthetics) throw new Error(`Tag ${orderedTagId} does not have aesthetics`);

            components.push(
                <RoomSublist
                    key={`sublist-${orderedTagId}`}
                    tagId={orderedTagId}
                    forRooms={true}
                    startAsHidden={aesthetics.defaultHidden}
                    label={aesthetics.sectionLabelRaw ? aesthetics.sectionLabelRaw : _t(aesthetics.sectionLabel)}
                    onAddRoom={aesthetics.onAddRoom}
                    addRoomLabel={aesthetics.addRoomLabel ? _t(aesthetics.addRoomLabel) : aesthetics.addRoomLabel}
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
                        className="mx_RoomList"
                        role="tree"
                        aria-label={_t("Rooms")}
                    >{sublists}</div>
                )}
            </RovingTabIndexProvider>
        );
    }
}
