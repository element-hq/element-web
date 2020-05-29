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

import SettingsStore from "../../../settings/SettingsStore";
import Timer from "../../../utils/Timer";
import React from "react";
import ReactDOM from "react-dom";
import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';
import * as utils from "matrix-js-sdk/src/utils";
import { _t } from '../../../languageHandler';
import {MatrixClientPeg} from "../../../MatrixClientPeg";
import rate_limited_func from "../../../ratelimitedfunc";
import * as Rooms from '../../../Rooms';
import DMRoomMap from '../../../utils/DMRoomMap';
import TagOrderStore from '../../../stores/TagOrderStore';
import CustomRoomTagStore from '../../../stores/CustomRoomTagStore';
import GroupStore from '../../../stores/GroupStore';
import RoomSubList from '../../structures/RoomSubList';
import ResizeHandle from '../elements/ResizeHandle';
import CallHandler from "../../../CallHandler";
import dis from "../../../dispatcher/dispatcher";
import * as sdk from "../../../index";
import * as Receipt from "../../../utils/Receipt";
import {Resizer} from '../../../resizer';
import {Layout, Distributor} from '../../../resizer/distributors/roomsublist2';
import {RovingTabIndexProvider} from "../../../accessibility/RovingTabIndex";
import {RoomListStoreTempProxy} from "../../../stores/room-list/RoomListStoreTempProxy";
import {DefaultTagID} from "../../../stores/room-list/models";
import * as Unread from "../../../Unread";
import RoomViewStore from "../../../stores/RoomViewStore";
import {TAG_DM} from "../../../stores/RoomListStore";

const HIDE_CONFERENCE_CHANS = true;
const STANDARD_TAGS_REGEX = /^(m\.(favourite|lowpriority|server_notice)|im\.vector\.fake\.(invite|recent|direct|archived))$/;
const HOVER_MOVE_TIMEOUT = 1000;

function labelForTagName(tagName) {
    if (tagName.startsWith('u.')) return tagName.slice(2);
    return tagName;
}

export default createReactClass({
    displayName: 'RoomList',

    propTypes: {
        ConferenceHandler: PropTypes.any,
        collapsed: PropTypes.bool.isRequired,
        searchFilter: PropTypes.string,
    },

    getInitialState: function() {

        this._hoverClearTimer = null;
        this._subListRefs = {
            // key => RoomSubList ref
        };

        const sizesJson = window.localStorage.getItem("mx_roomlist_sizes");
        const collapsedJson = window.localStorage.getItem("mx_roomlist_collapsed");
        this.subListSizes = sizesJson ? JSON.parse(sizesJson) : {};
        this.collapsedState = collapsedJson ? JSON.parse(collapsedJson) : {};
        this._layoutSections = [];

        const unfilteredOptions = {
            allowWhitespace: false,
            handleHeight: 1,
        };
        this._unfilteredlayout = new Layout((key, size) => {
            const subList = this._subListRefs[key];
            if (subList) {
                subList.setHeight(size);
            }
            // update overflow indicators
            this._checkSubListsOverflow();
            // don't store height for collapsed sublists
            if (!this.collapsedState[key]) {
                this.subListSizes[key] = size;
                window.localStorage.setItem("mx_roomlist_sizes",
                    JSON.stringify(this.subListSizes));
            }
        }, this.subListSizes, this.collapsedState, unfilteredOptions);

        this._filteredLayout = new Layout((key, size) => {
            const subList = this._subListRefs[key];
            if (subList) {
                subList.setHeight(size);
            }
        }, null, null, {
            allowWhitespace: false,
            handleHeight: 0,
        });

        this._layout = this._unfilteredlayout;

        return {
            isLoadingLeftRooms: false,
            totalRoomCount: null,
            lists: {},
            incomingCallTag: null,
            incomingCall: null,
            selectedTags: [],
            hover: false,
            customTags: CustomRoomTagStore.getTags(),
        };
    },

    // TODO: [REACT-WARNING] Replace component with real class, put this in the constructor.
    UNSAFE_componentWillMount: function() {
        this.mounted = false;

        const cli = MatrixClientPeg.get();

        cli.on("Room", this.onRoom);
        cli.on("deleteRoom", this.onDeleteRoom);
        cli.on("Room.receipt", this.onRoomReceipt);
        cli.on("RoomMember.name", this.onRoomMemberName);
        cli.on("Event.decrypted", this.onEventDecrypted);
        cli.on("accountData", this.onAccountData);
        cli.on("Group.myMembership", this._onGroupMyMembership);
        cli.on("RoomState.events", this.onRoomStateEvents);

        const dmRoomMap = DMRoomMap.shared();
        // A map between tags which are group IDs and the room IDs of rooms that should be kept
        // in the room list when filtering by that tag.
        this._visibleRoomsForGroup = {
            // $groupId: [$roomId1, $roomId2, ...],
        };
        // All rooms that should be kept in the room list when filtering.
        // By default, show all rooms.
        this._visibleRooms = MatrixClientPeg.get().getVisibleRooms();

        // Listen to updates to group data. RoomList cares about members and rooms in order
        // to filter the room list when group tags are selected.
        this._groupStoreToken = GroupStore.registerListener(null, () => {
            (TagOrderStore.getOrderedTags() || []).forEach((tag) => {
                if (tag[0] !== '+') {
                    return;
                }
                // This group's rooms or members may have updated, update rooms for its tag
                this.updateVisibleRoomsForTag(dmRoomMap, tag);
                this.updateVisibleRooms();
            });
        });

        this._tagStoreToken = TagOrderStore.addListener(() => {
            // Filters themselves have changed
            this.updateVisibleRooms();
        });

        this._roomListStoreToken = RoomListStoreTempProxy.addListener(() => {
            this._delayedRefreshRoomList();
        });


        if (SettingsStore.isFeatureEnabled("feature_custom_tags")) {
            this._customTagStoreToken = CustomRoomTagStore.addListener(() => {
                this.setState({
                    customTags: CustomRoomTagStore.getTags(),
                });
            });
        }

        this.refreshRoomList();

        // order of the sublists
        //this.listOrder = [];

        // loop count to stop a stack overflow if the user keeps waggling the
        // mouse for >30s in a row, or if running under mocha
        this._delayedRefreshRoomListLoopCount = 0;
    },

    componentDidMount: function() {
        this.dispatcherRef = dis.register(this.onAction);
        const cfg = {
            getLayout: () => this._layout,
        };
        this.resizer = new Resizer(this.resizeContainer, Distributor, cfg);
        this.resizer.setClassNames({
            handle: "mx_ResizeHandle",
            vertical: "mx_ResizeHandle_vertical",
            reverse: "mx_ResizeHandle_reverse",
        });
        this._layout.update(
            this._layoutSections,
            this.resizeContainer && this.resizeContainer.offsetHeight,
        );
        this._checkSubListsOverflow();

        this.resizer.attach();
        if (this.props.resizeNotifier) {
            this.props.resizeNotifier.on("leftPanelResized", this.onResize);
        }
        this.mounted = true;
    },

    componentDidUpdate: function(prevProps) {
        let forceLayoutUpdate = false;
        this._repositionIncomingCallBox(undefined, false);
        if (!this.props.searchFilter && prevProps.searchFilter) {
            this._layout = this._unfilteredlayout;
            forceLayoutUpdate = true;
        } else if (this.props.searchFilter && !prevProps.searchFilter) {
            this._layout = this._filteredLayout;
            forceLayoutUpdate = true;
        }
        this._layout.update(
            this._layoutSections,
            this.resizeContainer && this.resizeContainer.clientHeight,
            forceLayoutUpdate,
        );
        this._checkSubListsOverflow();
    },

    onAction: function(payload) {
        switch (payload.action) {
            case 'view_tooltip':
                this.tooltip = payload.tooltip;
                break;
            case 'call_state':
                var call = CallHandler.getCall(payload.room_id);
                if (call && call.call_state === 'ringing') {
                    this.setState({
                        incomingCall: call,
                        incomingCallTag: this.getTagNameForRoomId(payload.room_id),
                    });
                    this._repositionIncomingCallBox(undefined, true);
                } else {
                    this.setState({
                        incomingCall: null,
                        incomingCallTag: null,
                    });
                }
                break;
            case 'view_room_delta': {
                const currentRoomId = RoomViewStore.getRoomId();
                const {
                    "im.vector.fake.invite": inviteRooms,
                    "m.favourite": favouriteRooms,
                    [TAG_DM]: dmRooms,
                    "im.vector.fake.recent": recentRooms,
                    "m.lowpriority": lowPriorityRooms,
                    "im.vector.fake.archived": historicalRooms,
                    "m.server_notice": serverNoticeRooms,
                    ...tags
                } = this.state.lists;

                const shownCustomTagRooms = Object.keys(tags).filter(tagName => {
                    return (!this.state.customTags || this.state.customTags[tagName]) &&
                        !tagName.match(STANDARD_TAGS_REGEX);
                }).map(tagName => tags[tagName]);

                // this order matches the one when generating the room sublists below.
                let rooms = this._applySearchFilter([
                    ...inviteRooms,
                    ...favouriteRooms,
                    ...dmRooms,
                    ...recentRooms,
                    ...[].concat.apply([], shownCustomTagRooms), // eslint-disable-line prefer-spread
                    ...lowPriorityRooms,
                    ...historicalRooms,
                    ...serverNoticeRooms,
                ], this.props.searchFilter);

                if (payload.unread) {
                    // filter to only notification rooms (and our current active room so we can index properly)
                    rooms = rooms.filter(room => {
                        return room.roomId === currentRoomId || Unread.doesRoomHaveUnreadMessages(room);
                    });
                }

                const currentIndex = rooms.findIndex(room => room.roomId === currentRoomId);
                // use slice to account for looping around the start
                const [room] = rooms.slice((currentIndex + payload.delta) % rooms.length);
                if (room) {
                    dis.dispatch({
                        action: 'view_room',
                        room_id: room.roomId,
                        show_room_tile: true, // to make sure the room gets scrolled into view
                    });
                }
                break;
            }
        }
    },

    componentWillUnmount: function() {
        this.mounted = false;

        dis.unregister(this.dispatcherRef);
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener("Room", this.onRoom);
            MatrixClientPeg.get().removeListener("deleteRoom", this.onDeleteRoom);
            MatrixClientPeg.get().removeListener("Room.receipt", this.onRoomReceipt);
            MatrixClientPeg.get().removeListener("RoomMember.name", this.onRoomMemberName);
            MatrixClientPeg.get().removeListener("Event.decrypted", this.onEventDecrypted);
            MatrixClientPeg.get().removeListener("accountData", this.onAccountData);
            MatrixClientPeg.get().removeListener("Group.myMembership", this._onGroupMyMembership);
            MatrixClientPeg.get().removeListener("RoomState.events", this.onRoomStateEvents);
        }

        if (this.props.resizeNotifier) {
            this.props.resizeNotifier.removeListener("leftPanelResized", this.onResize);
        }


        if (this._tagStoreToken) {
            this._tagStoreToken.remove();
        }

        if (this._roomListStoreToken) {
            this._roomListStoreToken.remove();
        }
        if (this._customTagStoreToken) {
            this._customTagStoreToken.remove();
        }

        // NB: GroupStore is not a Flux.Store
        if (this._groupStoreToken) {
            this._groupStoreToken.unregister();
        }

        // cancel any pending calls to the rate_limited_funcs
        this._delayedRefreshRoomList.cancelPendingCall();
    },


    onResize: function() {
        if (this.mounted && this._layout && this.resizeContainer &&
            Array.isArray(this._layoutSections)
        ) {
            this._layout.update(
                this._layoutSections,
                this.resizeContainer.offsetHeight,
            );
        }
    },

    onRoom: function(room) {
        this.updateVisibleRooms();
    },

    onRoomStateEvents: function(ev, state) {
        if (ev.getType() === "m.room.create" || ev.getType() === "m.room.tombstone") {
            this.updateVisibleRooms();
        }
    },

    onDeleteRoom: function(roomId) {
        this.updateVisibleRooms();
    },

    onArchivedHeaderClick: function(isHidden, scrollToPosition) {
        if (!isHidden) {
            const self = this;
            this.setState({ isLoadingLeftRooms: true });
            // we don't care about the response since it comes down via "Room"
            // events.
            MatrixClientPeg.get().syncLeftRooms().catch(function(err) {
                console.error("Failed to sync left rooms: %s", err);
                console.error(err);
            }).finally(function() {
                self.setState({ isLoadingLeftRooms: false });
            });
        }
    },

    onRoomReceipt: function(receiptEvent, room) {
        // because if we read a notification, it will affect notification count
        // only bother updating if there's a receipt from us
        if (Receipt.findReadReceiptFromUserId(receiptEvent, MatrixClientPeg.get().credentials.userId)) {
            this._delayedRefreshRoomList();
        }
    },

    onRoomMemberName: function(ev, member) {
        this._delayedRefreshRoomList();
    },

    onEventDecrypted: function(ev) {
        // An event being decrypted may mean we need to re-order the room list
        this._delayedRefreshRoomList();
    },

    onAccountData: function(ev) {
        if (ev.getType() == 'm.direct') {
            this._delayedRefreshRoomList();
        }
    },

    _onGroupMyMembership: function(group) {
        this.forceUpdate();
    },

    onMouseMove: async function(ev) {
        if (!this._hoverClearTimer) {
            this.setState({hover: true});
            this._hoverClearTimer = new Timer(HOVER_MOVE_TIMEOUT);
            this._hoverClearTimer.start();
            let finished = true;
            try {
                await this._hoverClearTimer.finished();
            } catch (err) {
                finished = false;
            }
            this._hoverClearTimer = null;
            if (finished) {
                this.setState({hover: false});
                this._delayedRefreshRoomList();
            }
        } else {
            this._hoverClearTimer.restart();
        }
    },

    onMouseLeave: function(ev) {
        if (this._hoverClearTimer) {
            this._hoverClearTimer.abort();
            this._hoverClearTimer = null;
        }
        this.setState({hover: false});

        // Refresh the room list just in case the user missed something.
        this._delayedRefreshRoomList();
    },

    _delayedRefreshRoomList: rate_limited_func(function() {
        this.refreshRoomList();
    }, 500),

    // Update which rooms and users should appear in RoomList for a given group tag
    updateVisibleRoomsForTag: function(dmRoomMap, tag) {
        if (!this.mounted) return;
        // For now, only handle group tags
        if (tag[0] !== '+') return;

        this._visibleRoomsForGroup[tag] = [];
        GroupStore.getGroupRooms(tag).forEach((room) => this._visibleRoomsForGroup[tag].push(room.roomId));
        GroupStore.getGroupMembers(tag).forEach((member) => {
            if (member.userId === MatrixClientPeg.get().credentials.userId) return;
            dmRoomMap.getDMRoomsForUserId(member.userId).forEach(
                (roomId) => this._visibleRoomsForGroup[tag].push(roomId),
            );
        });
        // TODO: Check if room has been tagged to the group by the user
    },

    // Update which rooms and users should appear according to which tags are selected
    updateVisibleRooms: function() {
        const selectedTags = TagOrderStore.getSelectedTags();
        const visibleGroupRooms = [];
        selectedTags.forEach((tag) => {
            (this._visibleRoomsForGroup[tag] || []).forEach(
                (roomId) => visibleGroupRooms.push(roomId),
            );
        });

        // If there are any tags selected, constrain the rooms listed to the
        // visible rooms as determined by visibleGroupRooms. Here, we
        // de-duplicate and filter out rooms that the client doesn't know
        // about (hence the Set and the null-guard on `room`).
        if (selectedTags.length > 0) {
            const roomSet = new Set();
            visibleGroupRooms.forEach((roomId) => {
                const room = MatrixClientPeg.get().getRoom(roomId);
                if (room) {
                    roomSet.add(room);
                }
            });
            this._visibleRooms = Array.from(roomSet);
        } else {
            // Show all rooms
            this._visibleRooms = MatrixClientPeg.get().getVisibleRooms();
        }
        this._delayedRefreshRoomList();
    },

    refreshRoomList: function() {
        if (this.state.hover) {
            // Don't re-sort the list if we're hovering over the list
            return;
        }

        // TODO: ideally we'd calculate this once at start, and then maintain
        // any changes to it incrementally, updating the appropriate sublists
        // as needed.
        // Alternatively we'd do something magical with Immutable.js or similar.
        const lists = this.getRoomLists();
        let totalRooms = 0;
        for (const l of Object.values(lists)) {
            totalRooms += l.length;
        }
        this.setState({
            lists,
            totalRoomCount: totalRooms,
            // Do this here so as to not render every time the selected tags
            // themselves change.
            selectedTags: TagOrderStore.getSelectedTags(),
        }, () => {
            // we don't need to restore any size here, do we?
            // i guess we could have triggered a new group to appear
            // that already an explicit size the last time it appeared ...
            this._checkSubListsOverflow();
        });

        // this._lastRefreshRoomListTs = Date.now();
    },

    getTagNameForRoomId: function(roomId) {
        const lists = RoomListStoreTempProxy.getRoomLists();
        for (const tagName of Object.keys(lists)) {
            for (const room of lists[tagName]) {
                // Should be impossible, but guard anyways.
                if (!room) {
                    continue;
                }
                const myUserId = MatrixClientPeg.get().getUserId();
                if (HIDE_CONFERENCE_CHANS && Rooms.isConfCallRoom(room, myUserId, this.props.ConferenceHandler)) {
                    continue;
                }

                if (room.roomId === roomId) return tagName;
            }
        }

        return null;
    },

    getRoomLists: function() {
        const lists = RoomListStoreTempProxy.getRoomLists();

        const filteredLists = {};

        const isRoomVisible = {
            // $roomId: true,
        };

        this._visibleRooms.forEach((r) => {
            isRoomVisible[r.roomId] = true;
        });

        Object.keys(lists).forEach((tagName) => {
            const filteredRooms = lists[tagName].filter((taggedRoom) => {
                // Somewhat impossible, but guard against it anyway
                if (!taggedRoom) {
                    return;
                }
                const myUserId = MatrixClientPeg.get().getUserId();
                if (HIDE_CONFERENCE_CHANS && Rooms.isConfCallRoom(taggedRoom, myUserId, this.props.ConferenceHandler)) {
                    return;
                }

                return Boolean(isRoomVisible[taggedRoom.roomId]);
            });

            if (filteredRooms.length > 0 || tagName.match(STANDARD_TAGS_REGEX)) {
                filteredLists[tagName] = filteredRooms;
            }
        });

        return filteredLists;
    },

    _getScrollNode: function() {
        if (!this.mounted) return null;
        const panel = ReactDOM.findDOMNode(this);
        if (!panel) return null;

        if (panel.classList.contains('gm-prevented')) {
            return panel;
        } else {
            return panel.children[2]; // XXX: Fragile!
        }
    },

    _whenScrolling: function(e) {
        this._hideTooltip(e);
        this._repositionIncomingCallBox(e, false);
    },

    _hideTooltip: function(e) {
        // Hide tooltip when scrolling, as we'll no longer be over the one we were on
        if (this.tooltip && this.tooltip.style.display !== "none") {
            this.tooltip.style.display = "none";
        }
    },

    _repositionIncomingCallBox: function(e, firstTime) {
        const incomingCallBox = document.getElementById("incomingCallBox");
        if (incomingCallBox && incomingCallBox.parentElement) {
            const scrollArea = this._getScrollNode();
            if (!scrollArea) return;
            // Use the offset of the top of the scroll area from the window
            // as this is used to calculate the CSS fixed top position for the stickies
            const scrollAreaOffset = scrollArea.getBoundingClientRect().top + window.pageYOffset;
            // Use the offset of the top of the component from the window
            // as this is used to calculate the CSS fixed top position for the stickies
            const scrollAreaHeight = ReactDOM.findDOMNode(this).getBoundingClientRect().height;

            let top = (incomingCallBox.parentElement.getBoundingClientRect().top + window.pageYOffset);
            // Make sure we don't go too far up, if the headers aren't sticky
            top = (top < scrollAreaOffset) ? scrollAreaOffset : top;
            // make sure we don't go too far down, if the headers aren't sticky
            const bottomMargin = scrollAreaOffset + (scrollAreaHeight - 45);
            top = (top > bottomMargin) ? bottomMargin : top;

            incomingCallBox.style.top = top + "px";
            incomingCallBox.style.left = scrollArea.offsetLeft + scrollArea.offsetWidth + 12 + "px";
        }
    },

    _makeGroupInviteTiles(filter) {
        const ret = [];
        const lcFilter = filter && filter.toLowerCase();

        const GroupInviteTile = sdk.getComponent('groups.GroupInviteTile');
        for (const group of MatrixClientPeg.get().getGroups()) {
            const {groupId, name, myMembership} = group;
            // filter to only groups in invite state and group_id starts with filter or group name includes it
            if (myMembership !== 'invite') continue;
            if (lcFilter && !groupId.toLowerCase().startsWith(lcFilter) &&
                !(name && name.toLowerCase().includes(lcFilter))) continue;
            ret.push(<GroupInviteTile key={groupId} group={group} collapsed={this.props.collapsed} />);
        }

        return ret;
    },

    _applySearchFilter: function(list, filter) {
        if (filter === "") return list;
        const lcFilter = filter.toLowerCase();
        // apply toLowerCase before and after removeHiddenChars because different rules get applied
        // e.g M -> M but m -> n, yet some unicode homoglyphs come out as uppercase, e.g 𝚮 -> H
        const fuzzyFilter = utils.removeHiddenChars(lcFilter).toLowerCase();
        // case insensitive if room name includes filter,
        // or if starts with `#` and one of room's aliases starts with filter
        return list.filter((room) => {
            if (filter[0] === "#") {
                if (room.getCanonicalAlias() && room.getCanonicalAlias().toLowerCase().startsWith(lcFilter)) {
                    return true;
                }
                if (room.getAltAliases().some((alias) => alias.toLowerCase().startsWith(lcFilter))) {
                    return true;
                }
            }
            return room.name && utils.removeHiddenChars(room.name.toLowerCase()).toLowerCase().includes(fuzzyFilter);
        });
    },

    _handleCollapsedState: function(key, collapsed) {
        // persist collapsed state
        this.collapsedState[key] = collapsed;
        window.localStorage.setItem("mx_roomlist_collapsed", JSON.stringify(this.collapsedState));
        // load the persisted size configuration of the expanded sub list
        if (collapsed) {
            this._layout.collapseSection(key);
        } else {
            this._layout.expandSection(key, this.subListSizes[key]);
        }
        // check overflow, as sub lists sizes have changed
        // important this happens after calling resize above
        this._checkSubListsOverflow();
    },

    // check overflow for scroll indicator gradient
    _checkSubListsOverflow() {
        Object.values(this._subListRefs).forEach(l => l.checkOverflow());
    },

    _subListRef: function(key, ref) {
        if (!ref) {
            delete this._subListRefs[key];
        } else {
            this._subListRefs[key] = ref;
        }
    },

    _mapSubListProps: function(subListsProps) {
        this._layoutSections = [];
        const defaultProps = {
            collapsed: this.props.collapsed,
            isFiltered: !!this.props.searchFilter,
        };

        subListsProps.forEach((p) => {
            p.list = this._applySearchFilter(p.list, this.props.searchFilter);
        });

        subListsProps = subListsProps.filter((props => {
            const len = props.list.length + (props.extraTiles ? props.extraTiles.length : 0);
            return len !== 0 || props.onAddRoom;
        }));

        return subListsProps.reduce((components, props, i) => {
            props = {...defaultProps, ...props};
            const isLast = i === subListsProps.length - 1;
            const len = props.list.length + (props.extraTiles ? props.extraTiles.length : 0);
            const {key, label, onHeaderClick, ...otherProps} = props;
            const chosenKey = key || label;
            const onSubListHeaderClick = (collapsed) => {
                this._handleCollapsedState(chosenKey, collapsed);
                if (onHeaderClick) {
                    onHeaderClick(collapsed);
                }
            };
            const startAsHidden = props.startAsHidden || this.collapsedState[chosenKey];
            this._layoutSections.push({
                id: chosenKey,
                count: len,
            });
            const subList = (<RoomSubList
                ref={this._subListRef.bind(this, chosenKey)}
                startAsHidden={startAsHidden}
                forceExpand={!!this.props.searchFilter}
                onHeaderClick={onSubListHeaderClick}
                key={chosenKey}
                label={label}
                {...otherProps} />);

            if (!isLast) {
                return components.concat(
                    subList,
                    <ResizeHandle key={chosenKey+"-resizer"} vertical={true} id={chosenKey} />
                );
            } else {
                return components.concat(subList);
            }
        }, []);
    },

    _collectResizeContainer: function(el) {
        this.resizeContainer = el;
    },

    render: function() {
        const incomingCallIfTaggedAs = (tagName) => {
            if (!this.state.incomingCall) return null;
            if (this.state.incomingCallTag !== tagName) return null;
            return this.state.incomingCall;
        };

        let subLists = [
            {
                list: [],
                extraTiles: this._makeGroupInviteTiles(this.props.searchFilter),
                label: _t('Community Invites'),
                isInvite: true,
            },
            {
                list: this.state.lists['im.vector.fake.invite'],
                label: _t('Invites'),
                incomingCall: incomingCallIfTaggedAs('im.vector.fake.invite'),
                isInvite: true,
            },
            {
                list: this.state.lists['m.favourite'],
                label: _t('Favourites'),
                tagName: "m.favourite",
                incomingCall: incomingCallIfTaggedAs('m.favourite'),
            },
            {
                list: this.state.lists[DefaultTagID.DM],
                label: _t('Direct Messages'),
                tagName: DefaultTagID.DM,
                incomingCall: incomingCallIfTaggedAs(DefaultTagID.DM),
                onAddRoom: () => {dis.dispatch({action: 'view_create_chat'});},
                addRoomLabel: _t("Start chat"),
            },
            {
                list: this.state.lists['im.vector.fake.recent'],
                label: _t('Rooms'),
                incomingCall: incomingCallIfTaggedAs('im.vector.fake.recent'),
                onAddRoom: () => {dis.dispatch({action: 'view_create_room'});},
                addRoomLabel: _t("Create room"),
            },
        ];
        const tagSubLists = Object.keys(this.state.lists)
            .filter((tagName) => {
                return (!this.state.customTags || this.state.customTags[tagName]) &&
                    !tagName.match(STANDARD_TAGS_REGEX);
            }).map((tagName) => {
                return {
                    list: this.state.lists[tagName],
                    key: tagName,
                    label: labelForTagName(tagName),
                    tagName: tagName,
                    incomingCall: incomingCallIfTaggedAs(tagName),
                };
            });
        subLists = subLists.concat(tagSubLists);
        subLists = subLists.concat([
            {
                list: this.state.lists['m.lowpriority'],
                label: _t('Low priority'),
                tagName: "m.lowpriority",
                incomingCall: incomingCallIfTaggedAs('m.lowpriority'),
            },
            {
                list: this.state.lists['im.vector.fake.archived'],
                label: _t('Historical'),
                incomingCall: incomingCallIfTaggedAs('im.vector.fake.archived'),
                startAsHidden: true,
                showSpinner: this.state.isLoadingLeftRooms,
                onHeaderClick: this.onArchivedHeaderClick,
            },
            {
                list: this.state.lists['m.server_notice'],
                label: _t('System Alerts'),
                tagName: "m.lowpriority",
                incomingCall: incomingCallIfTaggedAs('m.server_notice'),
            },
        ]);

        const subListComponents = this._mapSubListProps(subLists);

        const {resizeNotifier, collapsed, searchFilter, ConferenceHandler, onKeyDown, ...props} = this.props; // eslint-disable-line
        return (
            <RovingTabIndexProvider handleHomeEnd={true} onKeyDown={onKeyDown}>
                {({onKeyDownHandler}) => <div
                    {...props}
                    onKeyDown={onKeyDownHandler}
                    ref={this._collectResizeContainer}
                    className="mx_RoomList"
                    role="tree"
                    aria-label={_t("Rooms")}
                    // Firefox sometimes makes this element focusable due to
                    // overflow:scroll;, so force it out of tab order.
                    tabIndex="-1"
                    onMouseMove={this.onMouseMove}
                    onMouseLeave={this.onMouseLeave}
                >
                    { subListComponents }
                </div> }
            </RovingTabIndexProvider>
        );
    },
});
