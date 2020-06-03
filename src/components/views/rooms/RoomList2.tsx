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
import { _t, _td } from "../../../languageHandler";
import { Layout } from '../../../resizer/distributors/roomsublist2';
import { RovingTabIndexProvider } from "../../../accessibility/RovingTabIndex";
import { ResizeNotifier } from "../../../utils/ResizeNotifier";
import RoomListStore, { LISTS_UPDATE_EVENT, RoomListStore2 } from "../../../stores/room-list/RoomListStore2";
import { ITagMap } from "../../../stores/room-list/algorithms/models";
import { DefaultTagID, TagID } from "../../../stores/room-list/models";
import { Dispatcher } from "flux";
import dis from "../../../dispatcher/dispatcher";
import RoomSublist2 from "./RoomSublist2";
import { ActionPayload } from "../../../dispatcher/payloads";
import { NameFilterCondition } from "../../../stores/room-list/filters/NameFilterCondition";

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
    resizeNotifier: ResizeNotifier;
    collapsed: boolean;
    searchFilter: string;
}

interface IState {
    sublists: ITagMap;
    heights: Map<TagID, number>;
}

const TAG_ORDER: TagID[] = [
    // -- Community Invites Placeholder --

    DefaultTagID.Invite,
    DefaultTagID.Favourite,
    DefaultTagID.DM,
    DefaultTagID.Untagged,

    // -- Custom Tags Placeholder --

    DefaultTagID.LowPriority,
    DefaultTagID.ServerNotice,
    DefaultTagID.Archived,
];
const COMMUNITY_TAGS_BEFORE_TAG = DefaultTagID.Invite;
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
        sectionLabel: _td("Direct Messages"),
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
    [DefaultTagID.Archived]: {
        sectionLabel: _td("Historical"),
        isInvite: false,
        defaultHidden: true,
    },
};

export default class RoomList2 extends React.Component<IProps, IState> {
    private sublistRefs: { [tagId: string]: React.RefObject<RoomSublist2> } = {};
    private sublistSizes: { [tagId: string]: number } = {};
    private sublistCollapseStates: { [tagId: string]: boolean } = {};
    private unfilteredLayout: Layout;
    private filteredLayout: Layout;
    private searchFilter: NameFilterCondition = new NameFilterCondition();
    private currentTagResize: TagID = null;

    constructor(props: IProps) {
        super(props);

        this.state = {
            sublists: {},
            heights: new Map<TagID, number>(),
        };
        this.loadSublistSizes();
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
        RoomListStore.instance.on(LISTS_UPDATE_EVENT, (store: RoomListStore2) => {
            const newLists = store.orderedLists;
            console.log("new lists", newLists);

            const heightMap = new Map<TagID, number>();
            for (const tagId of Object.keys(newLists)) {
                heightMap.set(tagId, store.layout.getPixelHeight(tagId));
            }

            this.setState({sublists: newLists, heights: heightMap});
        });
    }

    private loadSublistSizes() {
        const sizesJson = window.localStorage.getItem("mx_roomlist_sizes");
        if (sizesJson) this.sublistSizes = JSON.parse(sizesJson);

        const collapsedJson = window.localStorage.getItem("mx_roomlist_collapsed");
        if (collapsedJson) this.sublistCollapseStates = JSON.parse(collapsedJson);
    }

    private saveSublistSizes() {
        window.localStorage.setItem("mx_roomlist_sizes", JSON.stringify(this.sublistSizes));
        window.localStorage.setItem("mx_roomlist_collapsed", JSON.stringify(this.sublistCollapseStates));
    }

    private onResizerMouseDown = (ev: React.MouseEvent) => {
        const hr = ev.target as HTMLHRElement;
        this.currentTagResize = hr.getAttribute("data-id");
    };

    private onResizerMouseUp = (ev: React.MouseEvent) => {
        this.currentTagResize = null;
    };

    private onMouseMove = (ev: React.MouseEvent) => {
        ev.preventDefault();
        if (this.currentTagResize) {
            const pixelHeight = this.state.heights.get(this.currentTagResize);
            RoomListStore.instance.layout.setPixelHeight(this.currentTagResize, pixelHeight + ev.movementY);
            this.state.heights.set(this.currentTagResize, RoomListStore.instance.layout.getPixelHeight(this.currentTagResize));
            this.forceUpdate();
        }
    };

    private renderSublists(): React.ReactElement[] {
        const components: React.ReactElement[] = [];

        for (const orderedTagId of TAG_ORDER) {
            if (COMMUNITY_TAGS_BEFORE_TAG === orderedTagId) {
                // Populate community invites if we have the chance
                // TODO
            }
            if (CUSTOM_TAGS_BEFORE_TAG === orderedTagId) {
                // Populate custom tags if needed
                // TODO
            }

            const orderedRooms = this.state.sublists[orderedTagId] || [];
            if (orderedRooms.length === 0 && !ALWAYS_VISIBLE_TAGS.includes(orderedTagId)) {
                continue; // skip tag - not needed
            }

            const aesthetics: ITagAesthetics = TAG_AESTHETICS[orderedTagId];
            if (!aesthetics) throw new Error(`Tag ${orderedTagId} does not have aesthetics`);

            const onAddRoomFn = aesthetics.onAddRoom ? () => aesthetics.onAddRoom(dis) : null;
            components.push(<RoomSublist2
                key={`sublist-${orderedTagId}`}
                forRooms={true}
                rooms={orderedRooms}
                startAsHidden={aesthetics.defaultHidden}
                label={_t(aesthetics.sectionLabel)}
                onAddRoom={onAddRoomFn}
                addRoomLabel={aesthetics.addRoomLabel}
                isInvite={aesthetics.isInvite}
                height={this.state.heights.get(orderedTagId)}
            />);
            components.push(<hr
                key={`resizer-${orderedTagId}`}
                data-id={orderedTagId}
                className="mx_RoomList2_resizer"
                onMouseDown={this.onResizerMouseDown}
                onMouseUp={this.onResizerMouseUp}
            />);
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
                        onMouseUp={this.onResizerMouseUp}
                        onMouseMove={this.onMouseMove}
                        className="mx_RoomList mx_RoomList2"
                        role="tree"
                        aria-label={_t("Rooms")}
                        // Firefox sometimes makes this element focusable due to
                        // overflow:scroll;, so force it out of tab order.
                        tabIndex={-1}
                    >{sublists}</div>
                )}
            </RovingTabIndexProvider>
        );
    }
}
