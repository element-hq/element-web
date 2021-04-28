/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import {sortBy, throttle} from "lodash";
import {EventType, RoomType} from "matrix-js-sdk/src/@types/event";
import {Room} from "matrix-js-sdk/src/models/room";
import {MatrixEvent} from "matrix-js-sdk/src/models/event";

import {AsyncStoreWithClient} from "./AsyncStoreWithClient";
import defaultDispatcher from "../dispatcher/dispatcher";
import {ActionPayload} from "../dispatcher/payloads";
import RoomListStore from "./room-list/RoomListStore";
import SettingsStore from "../settings/SettingsStore";
import DMRoomMap from "../utils/DMRoomMap";
import {FetchRoomFn} from "./notifications/ListNotificationState";
import {SpaceNotificationState} from "./notifications/SpaceNotificationState";
import {RoomNotificationStateStore} from "./notifications/RoomNotificationStateStore";
import {DefaultTagID} from "./room-list/models";
import {EnhancedMap, mapDiff} from "../utils/maps";
import {setHasDiff} from "../utils/sets";
import {objectDiff} from "../utils/objects";
import {arrayHasDiff} from "../utils/arrays";
import {ISpaceSummaryEvent, ISpaceSummaryRoom} from "../components/structures/SpaceRoomDirectory";
import RoomViewStore from "./RoomViewStore";

type SpaceKey = string | symbol;

interface IState {}

const ACTIVE_SPACE_LS_KEY = "mx_active_space";

export const HOME_SPACE = Symbol("home-space");
export const SUGGESTED_ROOMS = Symbol("suggested-rooms");

export const UPDATE_TOP_LEVEL_SPACES = Symbol("top-level-spaces");
export const UPDATE_INVITED_SPACES = Symbol("invited-spaces");
export const UPDATE_SELECTED_SPACE = Symbol("selected-space");
// Space Room ID/HOME_SPACE will be emitted when a Space's children change

const MAX_SUGGESTED_ROOMS = 20;

const getSpaceContextKey = (space?: Room) => `mx_space_context_${space?.roomId || "home_space"}`;

const partitionSpacesAndRooms = (arr: Room[]): [Room[], Room[]] => { // [spaces, rooms]
    return arr.reduce((result, room: Room) => {
        result[room.isSpaceRoom() ? 0 : 1].push(room);
        return result;
    }, [[], []]);
};

const getOrder = (ev: MatrixEvent): string | null => {
    const content = ev.getContent();
    if (typeof content.order === "string" && Array.from(content.order).every((c: string) => {
        const charCode = c.charCodeAt(0);
        return charCode >= 0x20 && charCode <= 0x7F;
    })) {
        return content.order;
    }
    return null;
}

const getRoomFn: FetchRoomFn = (room: Room) => {
    return RoomNotificationStateStore.instance.getRoomState(room);
};

export class SpaceStoreClass extends AsyncStoreWithClient<IState> {
    constructor() {
        super(defaultDispatcher, {});
    }

    // The spaces representing the roots of the various tree-like hierarchies
    private rootSpaces: Room[] = [];
    // The list of rooms not present in any currently joined spaces
    private orphanedRooms = new Set<string>();
    // Map from room ID to set of spaces which list it as a child
    private parentMap = new EnhancedMap<string, Set<string>>();
    // Map from space key to SpaceNotificationState instance representing that space
    private notificationStateMap = new Map<SpaceKey, SpaceNotificationState>();
    // Map from space key to Set of room IDs that should be shown as part of that space's filter
    private spaceFilteredRooms = new Map<string | symbol, Set<string>>();
    // The space currently selected in the Space Panel - if null then `Home` is selected
    private _activeSpace?: Room = null;
    private _suggestedRooms: ISpaceSummaryRoom[] = [];
    private _invitedSpaces = new Set<Room>();

    public get invitedSpaces(): Room[] {
        return Array.from(this._invitedSpaces);
    }

    public get spacePanelSpaces(): Room[] {
        return this.rootSpaces;
    }

    public get activeSpace(): Room | null {
        return this._activeSpace || null;
    }

    public get suggestedRooms(): ISpaceSummaryRoom[] {
        return this._suggestedRooms;
    }

    public async setActiveSpace(space: Room | null, contextSwitch = true) {
        if (space === this.activeSpace || (space && !space?.isSpaceRoom())) return;

        this._activeSpace = space;
        this.emit(UPDATE_SELECTED_SPACE, this.activeSpace);
        this.emit(SUGGESTED_ROOMS, this._suggestedRooms = []);

        if (contextSwitch) {
            // view last selected room from space
            const roomId = window.localStorage.getItem(getSpaceContextKey(this.activeSpace));

            // if the space being selected is an invite then always view that invite
            // else if the last viewed room in this space is joined then view that
            // else view space home or home depending on what is being clicked on
            if (space?.getMyMembership !== "invite" &&
                this.matrixClient?.getRoom(roomId)?.getMyMembership() === "join"
            ) {
                defaultDispatcher.dispatch({
                    action: "view_room",
                    room_id: roomId,
                    context_switch: true,
                });
            } else if (space) {
                defaultDispatcher.dispatch({
                    action: "view_room",
                    room_id: space.roomId,
                    context_switch: true,
                });
            } else {
                defaultDispatcher.dispatch({
                    action: "view_home_page",
                });
            }
        }

        // persist space selected
        if (space) {
            window.localStorage.setItem(ACTIVE_SPACE_LS_KEY, space.roomId);
        } else {
            window.localStorage.removeItem(ACTIVE_SPACE_LS_KEY);
        }

        if (space) {
            const data = await this.fetchSuggestedRooms(space);
            if (this._activeSpace === space) {
                this._suggestedRooms = data.rooms.filter(roomInfo => {
                    return roomInfo.room_type !== RoomType.Space
                        && this.matrixClient.getRoom(roomInfo.room_id)?.getMyMembership() !== "join";
                });
                this.emit(SUGGESTED_ROOMS, this._suggestedRooms);
            }
        }
    }

    public fetchSuggestedRooms = async (space: Room, limit = MAX_SUGGESTED_ROOMS) => {
        try {
            const data: {
                rooms: ISpaceSummaryRoom[];
                events: ISpaceSummaryEvent[];
            } = await this.matrixClient.getSpaceSummary(space.roomId, 0, true, false, limit);
            return data;
        } catch (e) {
            console.error(e);
        }
        return {
            rooms: [],
            events: [],
        };
    };

    public addRoomToSpace(space: Room, roomId: string, via: string[], suggested = false, autoJoin = false) {
        return this.matrixClient.sendStateEvent(space.roomId, EventType.SpaceChild, {
            via,
            suggested,
            auto_join: autoJoin,
        }, roomId);
    }

    private getChildren(spaceId: string): Room[] {
        const room = this.matrixClient?.getRoom(spaceId);
        const childEvents = room?.currentState.getStateEvents(EventType.SpaceChild).filter(ev => ev.getContent()?.via);
        return sortBy(childEvents, getOrder)
            .map(ev => this.matrixClient.getRoom(ev.getStateKey()))
            .filter(room => room?.getMyMembership() === "join" || room?.getMyMembership() === "invite") || [];
    }

    public getChildRooms(spaceId: string): Room[] {
        return this.getChildren(spaceId).filter(r => !r.isSpaceRoom());
    }

    public getChildSpaces(spaceId: string): Room[] {
        // don't show invited subspaces as they surface at the top level for better visibility
        return this.getChildren(spaceId).filter(r => r.isSpaceRoom() && r.getMyMembership() === "join");
    }

    public getParents(roomId: string, canonicalOnly = false): Room[] {
        const room = this.matrixClient?.getRoom(roomId);
        return room?.currentState.getStateEvents(EventType.SpaceParent)
            .filter(ev => {
                const content = ev.getContent();
                if (!content?.via) return false;
                // TODO apply permissions check to verify that the parent mapping is valid
                if (canonicalOnly && !content?.canonical) return false;
                return true;
            })
            .map(ev => this.matrixClient.getRoom(ev.getStateKey()))
            .filter(Boolean) || [];
    }

    public getCanonicalParent(roomId: string): Room | null {
        const parents = this.getParents(roomId, true);
        return sortBy(parents, r => r.roomId)?.[0] || null;
    }

    public getSpaceFilteredRoomIds = (space: Room | null): Set<string> => {
        return this.spaceFilteredRooms.get(space?.roomId || HOME_SPACE) || new Set();
    };

    private rebuild = throttle(() => {
        const [visibleSpaces, visibleRooms] = partitionSpacesAndRooms(this.matrixClient.getVisibleRooms());
        const [joinedSpaces, invitedSpaces] = visibleSpaces.reduce((arr, s) => {
            if (s.getMyMembership() === "join") {
                arr[0].push(s);
            } else if (s.getMyMembership() === "invite") {
                arr[1].push(s);
            }
            return arr;
        }, [[], []]);

        // exclude invited spaces from unseenChildren as they will be forcibly shown at the top level of the treeview
        const unseenChildren = new Set<Room>([...visibleRooms, ...joinedSpaces]);
        const backrefs = new EnhancedMap<string, Set<string>>();

        // Sort spaces by room ID to force the cycle breaking to be deterministic
        const spaces = sortBy(joinedSpaces, space => space.roomId);

        // TODO handle cleaning up links when a Space is removed
        spaces.forEach(space => {
            const children = this.getChildren(space.roomId);
            children.forEach(child => {
                unseenChildren.delete(child);

                backrefs.getOrCreate(child.roomId, new Set()).add(space.roomId);
            });
        });

        const [rootSpaces, orphanedRooms] = partitionSpacesAndRooms(Array.from(unseenChildren));

        // somewhat algorithm to handle full-cycles
        const detachedNodes = new Set<Room>(spaces);

        const markTreeChildren = (rootSpace: Room, unseen: Set<Room>) => {
            const stack = [rootSpace];
            while (stack.length) {
                const op = stack.pop();
                unseen.delete(op);
                this.getChildSpaces(op.roomId).forEach(space => {
                    if (unseen.has(space)) {
                        stack.push(space);
                    }
                });
            }
        };

        rootSpaces.forEach(rootSpace => {
            markTreeChildren(rootSpace, detachedNodes);
        });

        // Handle spaces forming fully cyclical relationships.
        // In order, assume each detachedNode is a root unless it has already
        // been claimed as the child of prior detached node.
        // Work from a copy of the detachedNodes set as it will be mutated as part of this operation.
        Array.from(detachedNodes).forEach(detachedNode => {
            if (!detachedNodes.has(detachedNode)) return;
            // declare this detached node a new root, find its children, without ever looping back to it
            detachedNodes.delete(detachedNode);
            rootSpaces.push(detachedNode);
            markTreeChildren(detachedNode, detachedNodes);

            // TODO only consider a detached node a root space if it has no *parents other than the ones forming cycles
        });

        // TODO neither of these handle an A->B->C->A with an additional C->D
        // detachedNodes.forEach(space => {
        //     rootSpaces.push(space);
        // });

        this.orphanedRooms = new Set(orphanedRooms);
        this.rootSpaces = rootSpaces;
        this.parentMap = backrefs;

        // if the currently selected space no longer exists, remove its selection
        if (this._activeSpace && detachedNodes.has(this._activeSpace)) {
            this.setActiveSpace(null);
        }

        this.onRoomsUpdate(); // TODO only do this if a change has happened
        this.emit(UPDATE_TOP_LEVEL_SPACES, this.spacePanelSpaces);

        // build initial state of invited spaces as we would have missed the emitted events about the room at launch
        this._invitedSpaces = new Set(invitedSpaces);
        this.emit(UPDATE_INVITED_SPACES, this.invitedSpaces);
    }, 100, {trailing: true, leading: true});

    onSpaceUpdate = () => {
        this.rebuild();
    }

    private showInHomeSpace = (room: Room) => {
        if (room.isSpaceRoom()) return false;
        return !this.parentMap.get(room.roomId)?.size // put all orphaned rooms in the Home Space
            || DMRoomMap.shared().getUserIdForRoomId(room.roomId) // put all DMs in the Home Space
            || RoomListStore.instance.getTagsForRoom(room).includes(DefaultTagID.Favourite) // show all favourites
    };

    // Update a given room due to its tag changing (e.g DM-ness or Fav-ness)
    // This can only change whether it shows up in the HOME_SPACE or not
    private onRoomUpdate = (room: Room) => {
        if (this.showInHomeSpace(room)) {
            this.spaceFilteredRooms.get(HOME_SPACE)?.add(room.roomId);
            this.emit(HOME_SPACE);
        } else if (!this.orphanedRooms.has(room.roomId)) {
            this.spaceFilteredRooms.get(HOME_SPACE)?.delete(room.roomId);
            this.emit(HOME_SPACE);
        }
    };

    private onSpaceMembersChange = (ev: MatrixEvent) => {
        // skip this update if we do not have a DM with this user
        if (DMRoomMap.shared().getDMRoomsForUserId(ev.getStateKey()).length < 1) return;
        this.onRoomsUpdate();
    };

    private onRoomsUpdate = throttle(() => {
        // TODO resolve some updates as deltas
        const visibleRooms = this.matrixClient.getVisibleRooms();

        const oldFilteredRooms = this.spaceFilteredRooms;
        this.spaceFilteredRooms = new Map();

        // put all room invites in the Home Space
        const invites = visibleRooms.filter(r => !r.isSpaceRoom() && r.getMyMembership() === "invite");
        this.spaceFilteredRooms.set(HOME_SPACE, new Set<string>(invites.map(room => room.roomId)));

        visibleRooms.forEach(room => {
            if (this.showInHomeSpace(room)) {
                this.spaceFilteredRooms.get(HOME_SPACE).add(room.roomId);
            }
        });

        this.rootSpaces.forEach(s => {
            // traverse each space tree in DFS to build up the supersets as you go up,
            // reusing results from like subtrees.
            const fn = (spaceId: string, parentPath: Set<string>): Set<string> => {
                if (parentPath.has(spaceId)) return; // prevent cycles

                // reuse existing results if multiple similar branches exist
                if (this.spaceFilteredRooms.has(spaceId)) {
                    return this.spaceFilteredRooms.get(spaceId);
                }

                const [childSpaces, childRooms] = partitionSpacesAndRooms(this.getChildren(spaceId));
                const roomIds = new Set(childRooms.map(r => r.roomId));
                const space = this.matrixClient?.getRoom(spaceId);

                // Add relevant DMs
                space?.getJoinedMembers().forEach(member => {
                    DMRoomMap.shared().getDMRoomsForUserId(member.userId).forEach(roomId => {
                        roomIds.add(roomId);
                    });
                });

                const newPath = new Set(parentPath).add(spaceId);
                childSpaces.forEach(childSpace => {
                    fn(childSpace.roomId, newPath)?.forEach(roomId => {
                        roomIds.add(roomId);
                    });
                });
                this.spaceFilteredRooms.set(spaceId, roomIds);
                return roomIds;
            };

            fn(s.roomId, new Set());
        });

        const diff = mapDiff(oldFilteredRooms, this.spaceFilteredRooms);
        // filter out keys which changed by reference only by checking whether the sets differ
        const changed = diff.changed.filter(k => setHasDiff(oldFilteredRooms.get(k), this.spaceFilteredRooms.get(k)));
        [...diff.added, ...diff.removed, ...changed].forEach(k => {
            this.emit(k);
        });

        this.spaceFilteredRooms.forEach((roomIds, s) => {
            // Update NotificationStates
            this.getNotificationState(s)?.setRooms(visibleRooms.filter(room => roomIds.has(room.roomId)));
        });
    }, 100, {trailing: true, leading: true});

    private onRoom = (room: Room, newMembership?: string, oldMembership?: string) => {
        const membership = newMembership || room.getMyMembership();

        if (!room.isSpaceRoom()) {
            // this.onRoomUpdate(room);
            this.onRoomsUpdate();

            if (membership === "join") {
                // the user just joined a room, remove it from the suggested list if it was there
                const numSuggestedRooms = this._suggestedRooms.length;
                this._suggestedRooms = this._suggestedRooms.filter(r => r.room_id !== room.roomId);
                if (numSuggestedRooms !== this._suggestedRooms.length) {
                    this.emit(SUGGESTED_ROOMS, this._suggestedRooms);
                }
            }
            return;
        }

        // Space
        if (membership === "invite") {
            this._invitedSpaces.add(room);
            this.emit(UPDATE_INVITED_SPACES, this.invitedSpaces);
        } else if (oldMembership === "invite" && membership !== "join") {
            this._invitedSpaces.delete(room);
            this.emit(UPDATE_INVITED_SPACES, this.invitedSpaces);
        } else {
            this.onSpaceUpdate();
            this.emit(room.roomId);
        }

        if (membership === "join" && room.roomId === RoomViewStore.getRoomId()) {
            // if the user was looking at the space and then joined: select that space
            this.setActiveSpace(room);
        }
    };

    private onRoomState = (ev: MatrixEvent) => {
        const room = this.matrixClient.getRoom(ev.getRoomId());
        if (!room) return;

        switch (ev.getType()) {
            case EventType.SpaceChild:
                if (room.isSpaceRoom()) {
                    this.onSpaceUpdate();
                    this.emit(room.roomId);
                }
                break;

            case EventType.SpaceParent:
                // TODO rebuild the space parent and not the room - check permissions?
                // TODO confirm this after implementing parenting behaviour
                if (room.isSpaceRoom()) {
                    this.onSpaceUpdate();
                } else {
                    this.onRoomUpdate(room);
                }
                this.emit(room.roomId);
                break;

            case EventType.RoomMember:
                if (room.isSpaceRoom()) {
                    this.onSpaceMembersChange(ev);
                }
                break;
        }
    };

    private onRoomAccountData = (ev: MatrixEvent, room: Room, lastEvent?: MatrixEvent) => {
        if (ev.getType() === EventType.Tag && !room.isSpaceRoom()) {
            // If the room was in favourites and now isn't or the opposite then update its position in the trees
            const oldTags = lastEvent?.getContent()?.tags || {};
            const newTags = ev.getContent()?.tags || {};
            if (!!oldTags[DefaultTagID.Favourite] !== !!newTags[DefaultTagID.Favourite]) {
                this.onRoomUpdate(room);
            }
        }
    }

    private onAccountData = (ev: MatrixEvent, lastEvent: MatrixEvent) => {
        if (ev.getType() === EventType.Direct) {
            const lastContent = lastEvent.getContent();
            const content = ev.getContent();

            const diff = objectDiff<Record<string, string[]>>(lastContent, content);
            // filter out keys which changed by reference only by checking whether the sets differ
            const changed = diff.changed.filter(k => arrayHasDiff(lastContent[k], content[k]));
            // DM tag changes, refresh relevant rooms
            new Set([...diff.added, ...diff.removed, ...changed]).forEach(roomId => {
                const room = this.matrixClient?.getRoom(roomId);
                if (room) {
                    this.onRoomUpdate(room);
                }
            });
        }
    };

    protected async reset() {
        this.rootSpaces = [];
        this.orphanedRooms = new Set();
        this.parentMap = new EnhancedMap();
        this.notificationStateMap = new Map();
        this.spaceFilteredRooms = new Map();
        this._activeSpace = null;
        this._suggestedRooms = [];
        this._invitedSpaces = new Set();
    }

    protected async onNotReady() {
        if (!SettingsStore.getValue("feature_spaces")) return;
        if (this.matrixClient) {
            this.matrixClient.removeListener("Room", this.onRoom);
            this.matrixClient.removeListener("Room.myMembership", this.onRoom);
            this.matrixClient.removeListener("RoomState.events", this.onRoomState);
            this.matrixClient.removeListener("Room.accountData", this.onRoomAccountData);
            this.matrixClient.removeListener("accountData", this.onAccountData);
        }
        await this.reset();
    }

    protected async onReady() {
        if (!SettingsStore.getValue("feature_spaces")) return;
        this.matrixClient.on("Room", this.onRoom);
        this.matrixClient.on("Room.myMembership", this.onRoom);
        this.matrixClient.on("RoomState.events", this.onRoomState);
        this.matrixClient.on("Room.accountData", this.onRoomAccountData);
        this.matrixClient.on("accountData", this.onAccountData);

        await this.onSpaceUpdate(); // trigger an initial update

        // restore selected state from last session if any and still valid
        const lastSpaceId = window.localStorage.getItem(ACTIVE_SPACE_LS_KEY);
        if (lastSpaceId) {
            const space = this.rootSpaces.find(s => s.roomId === lastSpaceId);
            if (space) {
                this.setActiveSpace(space);
            }
        }
    }

    protected async onAction(payload: ActionPayload) {
        if (!SettingsStore.getValue("feature_spaces")) return;
        switch (payload.action) {
            case "view_room": {
                const room = this.matrixClient?.getRoom(payload.room_id);

                // Don't auto-switch rooms when reacting to a context-switch
                // as this is not helpful and can create loops of rooms/space switching
                if (!room || payload.context_switch) break;

                if (room.isSpaceRoom()) {
                    // Don't context switch when navigating to the space room
                    // as it will cause you to end up in the wrong room
                    this.setActiveSpace(room, false);
                } else if (!this.getSpaceFilteredRoomIds(this.activeSpace).has(room.roomId)) {
                    let parent = this.getCanonicalParent(room.roomId);
                    if (!parent) {
                        parent = this.rootSpaces.find(s => this.spaceFilteredRooms.get(s.roomId)?.has(room.roomId));
                    }
                    if (!parent) {
                        const parents = Array.from(this.parentMap.get(room.roomId) || []);
                        parent = parents.find(p => this.matrixClient.getRoom(p));
                    }
                    // don't trigger a context switch when we are switching a space to match the chosen room
                    this.setActiveSpace(parent || null, false);
                }

                // Persist last viewed room from a space
                // we don't await setActiveSpace above as we only care about this.activeSpace being up to date
                // synchronously for the below code - everything else can and should be async.
                window.localStorage.setItem(getSpaceContextKey(this.activeSpace), payload.room_id);
                break;
            }
            case "after_leave_room":
                if (this._activeSpace && payload.room_id === this._activeSpace.roomId) {
                    this.setActiveSpace(null);
                }
                break;
        }
    }

    public getNotificationState(key: SpaceKey): SpaceNotificationState {
        if (this.notificationStateMap.has(key)) {
            return this.notificationStateMap.get(key);
        }

        const state = new SpaceNotificationState(key, getRoomFn);
        this.notificationStateMap.set(key, state);
        return state;
    }

    // traverse space tree with DFS calling fn on each space including the given root one,
    // if includeRooms is true then fn will be called on each leaf room, if it is present in multiple sub-spaces
    // then fn will be called with it multiple times.
    public traverseSpace(
        spaceId: string,
        fn: (roomId: string) => void,
        includeRooms = false,
        parentPath?: Set<string>,
    ) {
        if (parentPath && parentPath.has(spaceId)) return; // prevent cycles

        fn(spaceId);

        const newPath = new Set(parentPath).add(spaceId);
        const [childSpaces, childRooms] = partitionSpacesAndRooms(this.getChildren(spaceId));

        if (includeRooms) {
            childRooms.forEach(r => fn(r.roomId));
        }
        childSpaces.forEach(s => this.traverseSpace(s.roomId, fn, includeRooms, newPath));
    }
}

export default class SpaceStore {
    private static internalInstance = new SpaceStoreClass();

    public static get instance(): SpaceStoreClass {
        return SpaceStore.internalInstance;
    }
}

window.mxSpaceStore = SpaceStore.instance;
