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

import { ListIteratee, Many, sortBy, throttle } from "lodash";
import { EventType, RoomType } from "matrix-js-sdk/src/@types/event";
import { Room } from "matrix-js-sdk/src/models/room";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { IRoomCapability } from "matrix-js-sdk/src/client";
import { logger } from "matrix-js-sdk/src/logger";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";

import { AsyncStoreWithClient } from "../AsyncStoreWithClient";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { ActionPayload } from "../../dispatcher/payloads";
import RoomListStore from "../room-list/RoomListStore";
import SettingsStore from "../../settings/SettingsStore";
import DMRoomMap from "../../utils/DMRoomMap";
import { FetchRoomFn } from "../notifications/ListNotificationState";
import { SpaceNotificationState } from "../notifications/SpaceNotificationState";
import { RoomNotificationStateStore } from "../notifications/RoomNotificationStateStore";
import { DefaultTagID } from "../room-list/models";
import { EnhancedMap, mapDiff } from "../../utils/maps";
import { setDiff, setHasDiff } from "../../utils/sets";
import RoomViewStore from "../RoomViewStore";
import { Action } from "../../dispatcher/actions";
import { arrayHasDiff, arrayHasOrderChange } from "../../utils/arrays";
import { reorderLexicographically } from "../../utils/stringOrderField";
import { TAG_ORDER } from "../../components/views/rooms/RoomList";
import { SettingUpdatedPayload } from "../../dispatcher/payloads/SettingUpdatedPayload";
import {
    isMetaSpace,
    ISuggestedRoom,
    MetaSpace,
    SpaceKey,
    UPDATE_HOME_BEHAVIOUR,
    UPDATE_INVITED_SPACES,
    UPDATE_SELECTED_SPACE,
    UPDATE_SUGGESTED_ROOMS,
    UPDATE_TOP_LEVEL_SPACES,
} from ".";
import { getCachedRoomIDForAlias } from "../../RoomAliasCache";
import { EffectiveMembership, getEffectiveMembership } from "../../utils/membership";

interface IState {}

const ACTIVE_SPACE_LS_KEY = "mx_active_space";

const metaSpaceOrder: MetaSpace[] = [MetaSpace.Home, MetaSpace.Favourites, MetaSpace.People, MetaSpace.Orphans];

const MAX_SUGGESTED_ROOMS = 20;

// This setting causes the page to reload and can be costly if read frequently, so read it here only
const spacesEnabled = !SettingsStore.getValue("showCommunitiesInsteadOfSpaces");

const getSpaceContextKey = (space: SpaceKey) => `mx_space_context_${space}`;

const partitionSpacesAndRooms = (arr: Room[]): [Room[], Room[]] => { // [spaces, rooms]
    return arr.reduce((result, room: Room) => {
        result[room.isSpaceRoom() ? 0 : 1].push(room);
        return result;
    }, [[], []]);
};

const validOrder = (order: string): string | undefined => {
    if (typeof order === "string" && order.length <= 50 && Array.from(order).every((c: string) => {
        const charCode = c.charCodeAt(0);
        return charCode >= 0x20 && charCode <= 0x7E;
    })) {
        return order;
    }
};

// For sorting space children using a validated `order`, `m.room.create`'s `origin_server_ts`, `room_id`
export const getChildOrder = (order: string, creationTs: number, roomId: string): Array<Many<ListIteratee<any>>> => {
    return [validOrder(order) ?? NaN, creationTs, roomId]; // NaN has lodash sort it at the end in asc
};

const getRoomFn: FetchRoomFn = (room: Room) => {
    return RoomNotificationStateStore.instance.getRoomState(room);
};

export class SpaceStoreClass extends AsyncStoreWithClient<IState> {
    // The spaces representing the roots of the various tree-like hierarchies
    private rootSpaces: Room[] = [];
    // Map from room ID to set of spaces which list it as a child
    private parentMap = new EnhancedMap<string, Set<string>>();
    // Map from SpaceKey to SpaceNotificationState instance representing that space
    private notificationStateMap = new Map<SpaceKey, SpaceNotificationState>();
    // Map from space key to Set of room IDs that should be shown as part of that space's filter
    private spaceFilteredRooms = new Map<SpaceKey, Set<string>>(); // won't contain MetaSpace.People
    // Map from space ID to Set of user IDs that should be shown as part of that space's filter
    private spaceFilteredUsers = new Map<Room["roomId"], Set<string>>();
    // The space currently selected in the Space Panel
    private _activeSpace?: SpaceKey = MetaSpace.Home; // set properly by onReady
    private _suggestedRooms: ISuggestedRoom[] = [];
    private _invitedSpaces = new Set<Room>();
    private spaceOrderLocalEchoMap = new Map<string, string>();
    private _restrictedJoinRuleSupport?: IRoomCapability;
    // The following properties are set by onReady as they live in account_data
    private _allRoomsInHome = false;
    private _enabledMetaSpaces: MetaSpace[] = [];

    constructor() {
        super(defaultDispatcher, {});

        SettingsStore.monitorSetting("Spaces.allRoomsInHome", null);
        SettingsStore.monitorSetting("Spaces.enabledMetaSpaces", null);
        SettingsStore.monitorSetting("Spaces.showPeopleInSpace", null);
    }

    public get invitedSpaces(): Room[] {
        return Array.from(this._invitedSpaces);
    }

    public get enabledMetaSpaces(): MetaSpace[] {
        return this._enabledMetaSpaces;
    }

    public get spacePanelSpaces(): Room[] {
        return this.rootSpaces;
    }

    public get activeSpace(): SpaceKey {
        return this._activeSpace;
    }

    public get activeSpaceRoom(): Room | null {
        if (isMetaSpace(this._activeSpace)) return null;
        return this.matrixClient?.getRoom(this._activeSpace);
    }

    public get suggestedRooms(): ISuggestedRoom[] {
        return this._suggestedRooms;
    }

    public get allRoomsInHome(): boolean {
        return this._allRoomsInHome;
    }

    public setActiveRoomInSpace(space: SpaceKey): void {
        if (!isMetaSpace(space) && !this.matrixClient?.getRoom(space)?.isSpaceRoom()) return;
        if (space !== this.activeSpace) this.setActiveSpace(space);

        if (space) {
            const roomId = this.getNotificationState(space).getFirstRoomWithNotifications();
            defaultDispatcher.dispatch({
                action: "view_room",
                room_id: roomId,
                context_switch: true,
            });
        } else {
            const lists = RoomListStore.instance.unfilteredLists;
            for (let i = 0; i < TAG_ORDER.length; i++) {
                const t = TAG_ORDER[i];
                const listRooms = lists[t];
                const unreadRoom = listRooms.find((r: Room) => {
                    if (this.showInHomeSpace(r)) {
                        const state = RoomNotificationStateStore.instance.getRoomState(r);
                        return state.isUnread;
                    }
                });
                if (unreadRoom) {
                    defaultDispatcher.dispatch({
                        action: "view_room",
                        room_id: unreadRoom.roomId,
                        context_switch: true,
                    });
                    break;
                }
            }
        }
    }

    public get restrictedJoinRuleSupport(): IRoomCapability {
        return this._restrictedJoinRuleSupport;
    }

    /**
     * Sets the active space, updates room list filters,
     * optionally switches the user's room back to where they were when they last viewed that space.
     * @param space which space to switch to.
     * @param contextSwitch whether to switch the user's context,
     * should not be done when the space switch is done implicitly due to another event like switching room.
     */
    public setActiveSpace(space: SpaceKey, contextSwitch = true) {
        if (!space || !this.matrixClient || space === this.activeSpace) return;

        let cliSpace: Room;
        if (!isMetaSpace(space)) {
            cliSpace = this.matrixClient.getRoom(space);
            if (!cliSpace?.isSpaceRoom()) return;
        } else if (!this.enabledMetaSpaces.includes(space as MetaSpace)) {
            return;
        }

        this._activeSpace = space;
        this.emit(UPDATE_SELECTED_SPACE, this.activeSpace);
        this.emit(UPDATE_SUGGESTED_ROOMS, this._suggestedRooms = []);

        if (contextSwitch) {
            // view last selected room from space
            const roomId = window.localStorage.getItem(getSpaceContextKey(this.activeSpace));

            // if the space being selected is an invite then always view that invite
            // else if the last viewed room in this space is joined then view that
            // else view space home or home depending on what is being clicked on
            if (cliSpace?.getMyMembership() !== "invite" &&
                this.matrixClient.getRoom(roomId)?.getMyMembership() === "join" &&
                this.isRoomInSpace(space, roomId)
            ) {
                defaultDispatcher.dispatch({
                    action: "view_room",
                    room_id: roomId,
                    context_switch: true,
                });
            } else if (cliSpace) {
                defaultDispatcher.dispatch({
                    action: "view_room",
                    room_id: space,
                    context_switch: true,
                });
            } else {
                defaultDispatcher.dispatch({
                    action: "view_home_page",
                    context_switch: true,
                });
            }
        }

        // persist space selected
        window.localStorage.setItem(ACTIVE_SPACE_LS_KEY, space);

        if (cliSpace) {
            this.loadSuggestedRooms(cliSpace);
        }
    }

    private async loadSuggestedRooms(space: Room): Promise<void> {
        const suggestedRooms = await this.fetchSuggestedRooms(space);
        if (this._activeSpace === space.roomId) {
            this._suggestedRooms = suggestedRooms;
            this.emit(UPDATE_SUGGESTED_ROOMS, this._suggestedRooms);
        }
    }

    public fetchSuggestedRooms = async (space: Room, limit = MAX_SUGGESTED_ROOMS): Promise<ISuggestedRoom[]> => {
        try {
            const { rooms } = await this.matrixClient.getRoomHierarchy(space.roomId, limit, 1, true);

            const viaMap = new EnhancedMap<string, Set<string>>();
            rooms.forEach(room => {
                room.children_state.forEach(ev => {
                    if (ev.type === EventType.SpaceChild && ev.content.via?.length) {
                        ev.content.via.forEach(via => {
                            viaMap.getOrCreate(ev.state_key, new Set()).add(via);
                        });
                    }
                });
            });

            return rooms.filter(roomInfo => {
                return roomInfo.room_type !== RoomType.Space
                    && this.matrixClient.getRoom(roomInfo.room_id)?.getMyMembership() !== "join";
            }).map(roomInfo => ({
                ...roomInfo,
                viaServers: Array.from(viaMap.get(roomInfo.room_id) || []),
            }));
        } catch (e) {
            logger.error(e);
        }
        return [];
    };

    public addRoomToSpace(space: Room, roomId: string, via: string[], suggested = false, autoJoin = false) {
        return this.matrixClient.sendStateEvent(space.roomId, EventType.SpaceChild, {
            via,
            suggested,
            auto_join: autoJoin,
        }, roomId);
    }

    public getChildren(spaceId: string): Room[] {
        const room = this.matrixClient?.getRoom(spaceId);
        const childEvents = room?.currentState.getStateEvents(EventType.SpaceChild).filter(ev => ev.getContent()?.via);
        return sortBy(childEvents, ev => {
            const roomId = ev.getStateKey();
            const childRoom = this.matrixClient?.getRoom(roomId);
            const createTs = childRoom?.currentState.getStateEvents(EventType.RoomCreate, "")?.getTs();
            return getChildOrder(ev.getContent().order, createTs, roomId);
        }).map(ev => {
            const history = this.matrixClient.getRoomUpgradeHistory(ev.getStateKey(), true);
            return history[history.length - 1];
        }).filter(room => {
            return room?.getMyMembership() === "join" || room?.getMyMembership() === "invite";
        }) || [];
    }

    public getChildRooms(spaceId: string): Room[] {
        return this.getChildren(spaceId).filter(r => !r.isSpaceRoom());
    }

    public getChildSpaces(spaceId: string): Room[] {
        // don't show invited subspaces as they surface at the top level for better visibility
        return this.getChildren(spaceId).filter(r => r.isSpaceRoom() && r.getMyMembership() === "join");
    }

    public getParents(roomId: string, canonicalOnly = false): Room[] {
        const userId = this.matrixClient?.getUserId();
        const room = this.matrixClient?.getRoom(roomId);
        return room?.currentState.getStateEvents(EventType.SpaceParent)
            .map(ev => {
                const content = ev.getContent();
                if (!Array.isArray(content.via) || (canonicalOnly && !content.canonical)) {
                    return; // skip
                }

                // only respect the relationship if the sender has sufficient permissions in the parent to set
                // child relations, as per MSC1772.
                // https://github.com/matrix-org/matrix-doc/blob/main/proposals/1772-groups-as-rooms.md#relationship-between-rooms-and-spaces
                const parent = this.matrixClient.getRoom(ev.getStateKey());
                const relation = parent?.currentState.getStateEvents(EventType.SpaceChild, roomId);
                if (!parent?.currentState.maySendStateEvent(EventType.SpaceChild, userId) ||
                    // also skip this relation if the parent had this child added but then since removed it
                    (relation && !Array.isArray(relation.getContent().via))
                ) {
                    return; // skip
                }

                return parent;
            })
            .filter(Boolean) || [];
    }

    public getCanonicalParent(roomId: string): Room | null {
        const parents = this.getParents(roomId, true);
        return sortBy(parents, r => r.roomId)?.[0] || null;
    }

    public getKnownParents(roomId: string): Set<string> {
        return this.parentMap.get(roomId) || new Set();
    }

    public isRoomInSpace(space: SpaceKey, roomId: string): boolean {
        if (space === MetaSpace.Home && this.allRoomsInHome) {
            return true;
        }

        if (this.spaceFilteredRooms.get(space)?.has(roomId)) {
            return true;
        }

        const dmPartner = DMRoomMap.shared().getUserIdForRoomId(roomId);
        if (!dmPartner) {
            return false;
        }
        // beyond this point we know this is a DM

        if (space === MetaSpace.Home || space === MetaSpace.People) {
            // these spaces contain all DMs
            return true;
        }

        if (!isMetaSpace(space) &&
            this.spaceFilteredUsers.get(space)?.has(dmPartner) &&
            SettingsStore.getValue("Spaces.showPeopleInSpace", space)
        ) {
            return true;
        }

        return false;
    }

    public getSpaceFilteredRoomIds = (space: SpaceKey): Set<string> => {
        if (space === MetaSpace.Home && this.allRoomsInHome) {
            return new Set(this.matrixClient.getVisibleRooms().map(r => r.roomId));
        }
        return this.spaceFilteredRooms.get(space) || new Set();
    };

    public getSpaceFilteredUserIds = (space: SpaceKey): Set<string> => {
        if (space === MetaSpace.Home && this.allRoomsInHome) {
            return undefined;
        }
        if (isMetaSpace(space)) return undefined;
        return this.spaceFilteredUsers.get(space) || new Set();
    };

    private markTreeChildren = (rootSpace: Room, unseen: Set<Room>): void => {
        const stack = [rootSpace];
        while (stack.length) {
            const space = stack.pop();
            unseen.delete(space);
            this.getChildSpaces(space.roomId).forEach(space => {
                if (unseen.has(space)) {
                    stack.push(space);
                }
            });
        }
    };

    private findRootSpaces = (joinedSpaces: Room[]): Room[] => {
        // exclude invited spaces from unseenChildren as they will be forcibly shown at the top level of the treeview
        const unseenSpaces = new Set(joinedSpaces);

        joinedSpaces.forEach(space => {
            this.getChildSpaces(space.roomId).forEach(subspace => {
                unseenSpaces.delete(subspace);
            });
        });

        // Consider any spaces remaining in unseenSpaces as root,
        // given they are not children of any known spaces.
        // The hierarchy from these roots may not yet be exhaustive due to the possibility of full-cycles.
        const rootSpaces = Array.from(unseenSpaces);

        // Next we need to determine the roots of any remaining full-cycles.
        // We sort spaces by room ID to force the cycle breaking to be deterministic.
        const detachedNodes = new Set<Room>(sortBy(joinedSpaces, space => space.roomId));

        // Mark any nodes which are children of our existing root spaces as attached.
        rootSpaces.forEach(rootSpace => {
            this.markTreeChildren(rootSpace, detachedNodes);
        });

        // Handle spaces forming fully cyclical relationships.
        // In order, assume each remaining detachedNode is a root unless it has already
        // been claimed as the child of prior detached node.
        // Work from a copy of the detachedNodes set as it will be mutated as part of this operation.
        // TODO consider sorting by number of in-refs to favour nodes with fewer parents.
        Array.from(detachedNodes).forEach(detachedNode => {
            if (!detachedNodes.has(detachedNode)) return; // already claimed, skip
            // declare this detached node a new root, find its children, without ever looping back to it
            rootSpaces.push(detachedNode); // consider this node a new root space
            this.markTreeChildren(detachedNode, detachedNodes); // declare this node and its children attached
        });

        return rootSpaces;
    };

    private rebuildSpaceHierarchy = () => {
        const visibleSpaces = this.matrixClient.getVisibleRooms().filter(r => r.isSpaceRoom());
        const [joinedSpaces, invitedSpaces] = visibleSpaces.reduce(([joined, invited], s) => {
            switch (getEffectiveMembership(s.getMyMembership())) {
                case EffectiveMembership.Join:
                    joined.push(s);
                    break;
                case EffectiveMembership.Invite:
                    invited.push(s);
                    break;
            }
            return [joined, invited];
        }, [[], []] as [Room[], Room[]]);

        const rootSpaces = this.findRootSpaces(joinedSpaces);
        const oldRootSpaces = this.rootSpaces;
        this.rootSpaces = this.sortRootSpaces(rootSpaces);

        this.onRoomsUpdate();

        if (arrayHasOrderChange(oldRootSpaces, this.rootSpaces)) {
            this.emit(UPDATE_TOP_LEVEL_SPACES, this.spacePanelSpaces, this.enabledMetaSpaces);
        }

        const oldInvitedSpaces = this._invitedSpaces;
        this._invitedSpaces = new Set(this.sortRootSpaces(invitedSpaces));
        if (setHasDiff(oldInvitedSpaces, this._invitedSpaces)) {
            this.emit(UPDATE_INVITED_SPACES, this.invitedSpaces);
        }
    };

    private rebuildParentMap = () => {
        const joinedSpaces = this.matrixClient.getVisibleRooms().filter(r => {
            return r.isSpaceRoom() && r.getMyMembership() === "join";
        });

        this.parentMap = new EnhancedMap<string, Set<string>>();
        joinedSpaces.forEach(space => {
            const children = this.getChildren(space.roomId);
            children.forEach(child => {
                this.parentMap.getOrCreate(child.roomId, new Set()).add(space.roomId);
            });
        });
    };

    private rebuildHomeSpace = () => {
        if (this.allRoomsInHome) {
            // this is a special-case to not have to maintain a set of all rooms
            this.spaceFilteredRooms.delete(MetaSpace.Home);
        } else {
            const rooms = new Set(this.matrixClient.getVisibleRooms().filter(this.showInHomeSpace).map(r => r.roomId));
            this.spaceFilteredRooms.set(MetaSpace.Home, rooms);
        }

        if (this.activeSpace === MetaSpace.Home) {
            this.switchSpaceIfNeeded();
        }
    };

    private rebuildMetaSpaces = () => {
        const enabledMetaSpaces = new Set(this.enabledMetaSpaces);
        const visibleRooms = this.matrixClient.getVisibleRooms();

        if (enabledMetaSpaces.has(MetaSpace.Home)) {
            this.rebuildHomeSpace();
        } else {
            this.spaceFilteredRooms.delete(MetaSpace.Home);
        }

        if (enabledMetaSpaces.has(MetaSpace.Favourites)) {
            const favourites = visibleRooms.filter(r => r.tags[DefaultTagID.Favourite]);
            this.spaceFilteredRooms.set(MetaSpace.Favourites, new Set(favourites.map(r => r.roomId)));
        } else {
            this.spaceFilteredRooms.delete(MetaSpace.Favourites);
        }

        // The People metaspace doesn't need maintaining

        // Populate the orphans space if the Home space is enabled as it is a superset of it.
        // Home is effectively a super set of People + Orphans with the addition of having all invites too.
        if (enabledMetaSpaces.has(MetaSpace.Orphans) || enabledMetaSpaces.has(MetaSpace.Home)) {
            const orphans = visibleRooms.filter(r => {
                // filter out DMs and rooms with >0 parents
                return !this.parentMap.get(r.roomId)?.size && !DMRoomMap.shared().getUserIdForRoomId(r.roomId);
            });
            this.spaceFilteredRooms.set(MetaSpace.Orphans, new Set(orphans.map(r => r.roomId)));
        }

        if (isMetaSpace(this.activeSpace)) {
            this.switchSpaceIfNeeded();
        }
    };

    private updateNotificationStates = (spaces?: SpaceKey[]) => {
        const enabledMetaSpaces = new Set(this.enabledMetaSpaces);
        const visibleRooms = this.matrixClient.getVisibleRooms();

        let dmBadgeSpace: MetaSpace;
        // only show badges on dms on the most relevant space if such exists
        if (enabledMetaSpaces.has(MetaSpace.People)) {
            dmBadgeSpace = MetaSpace.People;
        } else if (enabledMetaSpaces.has(MetaSpace.Home)) {
            dmBadgeSpace = MetaSpace.Home;
        }

        if (!spaces) {
            spaces = [...this.spaceFilteredRooms.keys()];
            if (dmBadgeSpace === MetaSpace.People) {
                spaces.push(MetaSpace.People);
            }
            if (enabledMetaSpaces.has(MetaSpace.Home) && !this.allRoomsInHome) {
                spaces.push(MetaSpace.Home);
            }
        }

        spaces.forEach((s) => {
            if (this.allRoomsInHome && s === MetaSpace.Home) return; // we'll be using the global notification state, skip

            // Update NotificationStates
            this.getNotificationState(s).setRooms(visibleRooms.filter(room => {
                if (s === MetaSpace.People) {
                    return this.isRoomInSpace(MetaSpace.People, room.roomId);
                }

                if (room.isSpaceRoom() || !this.spaceFilteredRooms.get(s).has(room.roomId)) return false;

                if (dmBadgeSpace && DMRoomMap.shared().getUserIdForRoomId(room.roomId)) {
                    return s === dmBadgeSpace;
                }

                return true;
            }));
        });

        if (dmBadgeSpace !== MetaSpace.People) {
            this.notificationStateMap.delete(MetaSpace.People);
        }
    };

    private showInHomeSpace = (room: Room): boolean => {
        if (this.allRoomsInHome) return true;
        if (room.isSpaceRoom()) return false;
        return !this.parentMap.get(room.roomId)?.size // put all orphaned rooms in the Home Space
            || !!DMRoomMap.shared().getUserIdForRoomId(room.roomId) || // put all DMs in the Home Space
            room.getMyMembership() === "invite"; // put all invites in the Home Space
    };

    private static isInSpace(member: RoomMember): boolean {
        return member.membership === "join" || member.membership === "invite";
    }

    private static getSpaceMembers(space: Room): string[] {
        return space.getMembers().filter(SpaceStoreClass.isInSpace).map(m => m.userId);
    }

    // Method for resolving the impact of a single user's membership change in the given Space and its hierarchy
    private onMemberUpdate = (space: Room, userId: string) => {
        const inSpace = SpaceStoreClass.isInSpace(space.getMember(userId));

        if (this.spaceFilteredUsers.get(space.roomId).has(userId)) {
            if (inSpace) return; // nothing to do, user was already joined to subspace
            if (this.getChildSpaces(space.roomId).some(s => this.spaceFilteredUsers.get(s.roomId).has(userId))) {
                return; // nothing to do, this user leaving will have no effect as they are in a subspace
            }
        } else if (!inSpace) {
            return; // nothing to do, user already not in the list
        }

        const seen = new Set<string>();
        const stack = [space.roomId];
        while (stack.length) {
            const spaceId = stack.pop();
            seen.add(spaceId);

            if (inSpace) {
                // add to our list and to that of all of our parents
                this.spaceFilteredUsers.get(spaceId).add(userId);
            } else {
                // remove from our list and that of all of our parents until we hit a parent with this user
                this.spaceFilteredUsers.get(spaceId).delete(userId);
            }

            this.getKnownParents(spaceId).forEach(parentId => {
                if (seen.has(parentId)) return;
                const parent = this.matrixClient.getRoom(parentId);
                // because spaceFilteredUsers is cumulative, if we are removing from lower in the hierarchy,
                // but the member is present higher in the hierarchy we must take care not to wrongly over-remove them.
                if (inSpace || !SpaceStoreClass.isInSpace(parent.getMember(userId))) {
                    stack.push(parentId);
                }
            });
        }

        this.switchSpaceIfNeeded();
    };

    private onMembersUpdate = (space: Room, seen = new Set<string>()) => {
        // Update this space's membership list
        const userIds = new Set(SpaceStoreClass.getSpaceMembers(space));
        // We only need to look one level with children
        // as any further descendants will already be in their parent's superset
        this.getChildSpaces(space.roomId).forEach(subspace => {
            SpaceStoreClass.getSpaceMembers(subspace).forEach(userId => {
                userIds.add(userId);
            });
        });
        this.spaceFilteredUsers.set(space.roomId, userIds);
        this.emit(space.roomId);

        // Traverse all parents and update them too
        this.getKnownParents(space.roomId).forEach(parentId => {
            if (seen.has(parentId)) return;
            const parent = this.matrixClient.getRoom(parentId);
            if (parent) {
                const newSeen = new Set(seen);
                newSeen.add(parentId);
                this.onMembersUpdate(parent, newSeen);
            }
        });
    };

    private onRoomsUpdate = () => {
        const visibleRooms = this.matrixClient.getVisibleRooms();

        const oldFilteredRooms = this.spaceFilteredRooms;
        const oldFilteredUsers = this.spaceFilteredUsers;
        this.spaceFilteredRooms = new Map();
        this.spaceFilteredUsers = new Map();

        this.rebuildParentMap();
        this.rebuildMetaSpaces();

        const hiddenChildren = new EnhancedMap<string, Set<string>>();
        visibleRooms.forEach(room => {
            if (room.getMyMembership() !== "join") return;
            this.getParents(room.roomId).forEach(parent => {
                hiddenChildren.getOrCreate(parent.roomId, new Set()).add(room.roomId);
            });
        });

        this.rootSpaces.forEach(s => {
            // traverse each space tree in DFS to build up the supersets as you go up,
            // reusing results from like subtrees.
            const fn = (spaceId: string, parentPath: Set<string>): [Set<string>, Set<string>] => {
                if (parentPath.has(spaceId)) return; // prevent cycles

                // reuse existing results if multiple similar branches exist
                if (this.spaceFilteredRooms.has(spaceId) && this.spaceFilteredUsers.has(spaceId)) {
                    return [this.spaceFilteredRooms.get(spaceId), this.spaceFilteredUsers.get(spaceId)];
                }

                const [childSpaces, childRooms] = partitionSpacesAndRooms(this.getChildren(spaceId));
                const roomIds = new Set(childRooms.map(r => r.roomId));
                const space = this.matrixClient?.getRoom(spaceId);
                const userIds = new Set(space?.getMembers().filter(m => {
                    return m.membership === "join" || m.membership === "invite";
                }).map(m => m.userId));

                const newPath = new Set(parentPath).add(spaceId);
                childSpaces.forEach(childSpace => {
                    const [rooms, users] = fn(childSpace.roomId, newPath) ?? [];
                    rooms?.forEach(roomId => roomIds.add(roomId));
                    users?.forEach(userId => userIds.add(userId));
                });
                hiddenChildren.get(spaceId)?.forEach(roomId => {
                    roomIds.add(roomId);
                });

                // Expand room IDs to all known versions of the given rooms
                const expandedRoomIds = new Set(Array.from(roomIds).flatMap(roomId => {
                    return this.matrixClient.getRoomUpgradeHistory(roomId, true).map(r => r.roomId);
                }));
                this.spaceFilteredRooms.set(spaceId, expandedRoomIds);
                this.spaceFilteredUsers.set(spaceId, userIds);
                return [expandedRoomIds, userIds];
            };

            fn(s.roomId, new Set());
        });

        const roomDiff = mapDiff(oldFilteredRooms, this.spaceFilteredRooms);
        const userDiff = mapDiff(oldFilteredUsers, this.spaceFilteredUsers);
        // filter out keys which changed by reference only by checking whether the sets differ
        const roomsChanged = roomDiff.changed.filter(k => {
            return setHasDiff(oldFilteredRooms.get(k), this.spaceFilteredRooms.get(k));
        });
        const usersChanged = userDiff.changed.filter(k => {
            return setHasDiff(oldFilteredUsers.get(k), this.spaceFilteredUsers.get(k));
        });

        const changeSet = new Set([
            ...roomDiff.added,
            ...userDiff.added,
            ...roomDiff.removed,
            ...userDiff.removed,
            ...roomsChanged,
            ...usersChanged,
        ]);

        changeSet.forEach(k => {
            this.emit(k);
        });

        if (changeSet.has(this.activeSpace)) {
            this.switchSpaceIfNeeded();
        }

        const notificationStatesToUpdate = [...changeSet];
        if (this.enabledMetaSpaces.includes(MetaSpace.People) &&
            userDiff.added.length + userDiff.removed.length + usersChanged.length > 0
        ) {
            notificationStatesToUpdate.push(MetaSpace.People);
        }
        this.updateNotificationStates(notificationStatesToUpdate);
    };

    private switchSpaceIfNeeded = throttle(() => {
        const roomId = RoomViewStore.getRoomId();
        if (this.isRoomInSpace(this.activeSpace, roomId)) return;

        if (this.matrixClient.getRoom(roomId)?.isSpaceRoom()) {
            this.goToFirstSpace(true);
        } else {
            this.switchToRelatedSpace(roomId);
        }
    }, 100, { leading: true, trailing: true });

    private switchToRelatedSpace = (roomId: string) => {
        if (this.suggestedRooms.find(r => r.room_id === roomId)) return;

        // try to find the canonical parent first
        let parent: SpaceKey = this.getCanonicalParent(roomId)?.roomId;

        // otherwise, try to find a root space which contains this room
        if (!parent) {
            parent = this.rootSpaces.find(s => this.spaceFilteredRooms.get(s.roomId)?.has(roomId))?.roomId;
        }

        // otherwise, try to find a metaspace which contains this room
        if (!parent) {
            // search meta spaces in reverse as Home is the first and least specific one
            parent = [...this.enabledMetaSpaces].reverse().find(s => this.isRoomInSpace(s, roomId));
        }

        // don't trigger a context switch when we are switching a space to match the chosen room
        if (parent) {
            this.setActiveSpace(parent, false);
        } else {
            this.goToFirstSpace();
        }
    };

    private onRoom = (room: Room, newMembership?: string, oldMembership?: string) => {
        const roomMembership = room.getMyMembership();
        if (!roomMembership) {
            // room is still being baked in the js-sdk, we'll process it at Room.myMembership instead
            return;
        }
        const membership = newMembership || roomMembership;

        if (!room.isSpaceRoom()) {
            this.onRoomsUpdate();

            if (membership === "join") {
                // the user just joined a room, remove it from the suggested list if it was there
                const numSuggestedRooms = this._suggestedRooms.length;
                this._suggestedRooms = this._suggestedRooms.filter(r => r.room_id !== room.roomId);
                if (numSuggestedRooms !== this._suggestedRooms.length) {
                    this.emit(UPDATE_SUGGESTED_ROOMS, this._suggestedRooms);
                }

                // if the room currently being viewed was just joined then switch to its related space
                if (newMembership === "join" && room.roomId === RoomViewStore.getRoomId()) {
                    this.switchToRelatedSpace(room.roomId);
                }
            }
            return;
        }

        // Space
        if (membership === "invite") {
            const len = this._invitedSpaces.size;
            this._invitedSpaces.add(room);
            if (len !== this._invitedSpaces.size) {
                this.emit(UPDATE_INVITED_SPACES, this.invitedSpaces);
            }
        } else if (oldMembership === "invite" && membership !== "join") {
            if (this._invitedSpaces.delete(room)) {
                this.emit(UPDATE_INVITED_SPACES, this.invitedSpaces);
            }
        } else {
            this.rebuildSpaceHierarchy();
            // fire off updates to all parent listeners
            this.parentMap.get(room.roomId)?.forEach((parentId) => {
                this.emit(parentId);
            });
            this.emit(room.roomId);
        }

        if (membership === "join" && room.roomId === RoomViewStore.getRoomId()) {
            // if the user was looking at the space and then joined: select that space
            this.setActiveSpace(room.roomId, false);
        } else if (membership === "leave" && room.roomId === this.activeSpace) {
            // user's active space has gone away, go back to home
            this.goToFirstSpace(true);
        }
    };

    private notifyIfOrderChanged(): void {
        const rootSpaces = this.sortRootSpaces(this.rootSpaces);
        if (arrayHasOrderChange(this.rootSpaces, rootSpaces)) {
            this.rootSpaces = rootSpaces;
            this.emit(UPDATE_TOP_LEVEL_SPACES, this.spacePanelSpaces, this.enabledMetaSpaces);
        }
    }

    private onRoomState = (ev: MatrixEvent) => {
        const room = this.matrixClient.getRoom(ev.getRoomId());
        if (!room) return;

        switch (ev.getType()) {
            case EventType.SpaceChild: {
                const target = this.matrixClient.getRoom(ev.getStateKey());

                if (room.isSpaceRoom()) {
                    if (target?.isSpaceRoom()) {
                        this.rebuildSpaceHierarchy();
                        this.emit(target.roomId);
                    } else {
                        this.onRoomsUpdate();
                    }
                    this.emit(room.roomId);
                }

                if (room.roomId === this.activeSpace && // current space
                    target?.getMyMembership() !== "join" && // target not joined
                    ev.getPrevContent().suggested !== ev.getContent().suggested // suggested flag changed
                ) {
                    this.loadSuggestedRooms(room);
                }

                break;
            }

            case EventType.SpaceParent:
                // TODO rebuild the space parent and not the room - check permissions?
                // TODO confirm this after implementing parenting behaviour
                if (room.isSpaceRoom()) {
                    this.rebuildSpaceHierarchy();
                } else {
                    this.onRoomsUpdate();
                }
                this.emit(room.roomId);
                break;

            case EventType.RoomPowerLevels:
                if (room.isSpaceRoom()) {
                    this.onRoomsUpdate();
                }
                break;
        }
    };

    // listening for m.room.member events in onRoomState above doesn't work as the Member object isn't updated by then
    private onRoomStateMembers = (ev: MatrixEvent) => {
        const room = this.matrixClient.getRoom(ev.getRoomId());
        const userId = ev.getStateKey();
        if (room?.isSpaceRoom() && // only consider space rooms
            DMRoomMap.shared().getDMRoomsForUserId(userId).length > 0 && // only consider members we have a DM with
            ev.getPrevContent().membership !== ev.getContent().membership // only consider when membership changes
        ) {
            this.onMemberUpdate(room, userId);
        }
    };

    private onRoomAccountData = (ev: MatrixEvent, room: Room, lastEv?: MatrixEvent) => {
        if (!room.isSpaceRoom()) return;

        if (ev.getType() === EventType.SpaceOrder) {
            this.spaceOrderLocalEchoMap.delete(room.roomId); // clear any local echo
            const order = ev.getContent()?.order;
            const lastOrder = lastEv?.getContent()?.order;
            if (order !== lastOrder) {
                this.notifyIfOrderChanged();
            }
        } else if (ev.getType() === EventType.Tag) {
            // If the room was in favourites and now isn't or the opposite then update its position in the trees
            const oldTags = lastEv?.getContent()?.tags || {};
            const newTags = ev.getContent()?.tags || {};
            if (!!oldTags[DefaultTagID.Favourite] !== !!newTags[DefaultTagID.Favourite]) {
                this.onRoomFavouriteChange(room);
            }
        }
    };

    private onRoomFavouriteChange(room: Room) {
        if (this.enabledMetaSpaces.includes(MetaSpace.Favourites)) {
            if (room.tags[DefaultTagID.Favourite]) {
                this.spaceFilteredRooms.get(MetaSpace.Favourites).add(room.roomId);
            } else {
                this.spaceFilteredRooms.get(MetaSpace.Favourites).delete(room.roomId);
            }
            this.emit(MetaSpace.Favourites);
        }
    }

    private onRoomDmChange(room: Room, isDm: boolean): void {
        const enabledMetaSpaces = new Set(this.enabledMetaSpaces);

        if (!this.allRoomsInHome && enabledMetaSpaces.has(MetaSpace.Home)) {
            const homeRooms = this.spaceFilteredRooms.get(MetaSpace.Home);
            if (this.showInHomeSpace(room)) {
                homeRooms?.add(room.roomId);
            } else if (!this.spaceFilteredRooms.get(MetaSpace.Orphans).has(room.roomId)) {
                this.spaceFilteredRooms.get(MetaSpace.Home)?.delete(room.roomId);
            }

            this.emit(MetaSpace.Home);
        }

        if (enabledMetaSpaces.has(MetaSpace.People)) {
            this.emit(MetaSpace.People);
        }

        if (enabledMetaSpaces.has(MetaSpace.Orphans) || enabledMetaSpaces.has(MetaSpace.Home)) {
            if (isDm && this.spaceFilteredRooms.get(MetaSpace.Orphans).delete(room.roomId)) {
                this.emit(MetaSpace.Orphans);
                this.emit(MetaSpace.Home);
            }
        }
    }

    private onAccountData = (ev: MatrixEvent, prevEv?: MatrixEvent) => {
        if (ev.getType() === EventType.Direct) {
            const previousRooms = new Set(Object.values(prevEv?.getContent<Record<string, string[]>>() ?? {}).flat());
            const currentRooms = new Set(Object.values(ev.getContent<Record<string, string[]>>()).flat());

            const diff = setDiff(previousRooms, currentRooms);
            [...diff.added, ...diff.removed].forEach(roomId => {
                const room = this.matrixClient?.getRoom(roomId);
                if (room) {
                    this.onRoomDmChange(room, currentRooms.has(roomId));
                }
            });

            if (diff.removed.length > 0) {
                this.switchSpaceIfNeeded();
            }
        }
    };

    protected async reset() {
        this.rootSpaces = [];
        this.parentMap = new EnhancedMap();
        this.notificationStateMap = new Map();
        this.spaceFilteredRooms = new Map();
        this.spaceFilteredUsers = new Map();
        this._activeSpace = MetaSpace.Home; // set properly by onReady
        this._suggestedRooms = [];
        this._invitedSpaces = new Set();
        this._enabledMetaSpaces = [];
    }

    protected async onNotReady() {
        if (!SpaceStore.spacesEnabled) return;
        if (this.matrixClient) {
            this.matrixClient.removeListener("Room", this.onRoom);
            this.matrixClient.removeListener("Room.myMembership", this.onRoom);
            this.matrixClient.removeListener("Room.accountData", this.onRoomAccountData);
            this.matrixClient.removeListener("RoomState.events", this.onRoomState);
            this.matrixClient.removeListener("RoomState.members", this.onRoomStateMembers);
            this.matrixClient.removeListener("accountData", this.onAccountData);
        }
        await this.reset();
    }

    protected async onReady() {
        if (!spacesEnabled) return;
        this.matrixClient.on("Room", this.onRoom);
        this.matrixClient.on("Room.myMembership", this.onRoom);
        this.matrixClient.on("Room.accountData", this.onRoomAccountData);
        this.matrixClient.on("RoomState.events", this.onRoomState);
        this.matrixClient.on("RoomState.members", this.onRoomStateMembers);
        this.matrixClient.on("accountData", this.onAccountData);

        this.matrixClient.getCapabilities().then(capabilities => {
            this._restrictedJoinRuleSupport = capabilities
                ?.["m.room_versions"]?.["org.matrix.msc3244.room_capabilities"]?.["restricted"];
        });

        const enabledMetaSpaces = SettingsStore.getValue("Spaces.enabledMetaSpaces");
        this._enabledMetaSpaces = metaSpaceOrder.filter(k => enabledMetaSpaces[k]) as MetaSpace[];

        this._allRoomsInHome = SettingsStore.getValue("Spaces.allRoomsInHome");

        this.rebuildSpaceHierarchy(); // trigger an initial update

        // restore selected state from last session if any and still valid
        const lastSpaceId = window.localStorage.getItem(ACTIVE_SPACE_LS_KEY);
        const valid = (lastSpaceId && !isMetaSpace(lastSpaceId))
            ? this.matrixClient.getRoom(lastSpaceId)
            : enabledMetaSpaces[lastSpaceId];
        if (valid) {
            // don't context switch here as it may break permalinks
            this.setActiveSpace(lastSpaceId, false);
        } else {
            this.switchSpaceIfNeeded();
        }
    }

    private goToFirstSpace(contextSwitch = false) {
        this.setActiveSpace(this.enabledMetaSpaces[0] ?? this.spacePanelSpaces[0]?.roomId, contextSwitch);
    }

    protected async onAction(payload: ActionPayload) {
        if (!spacesEnabled || !this.matrixClient) return;

        switch (payload.action) {
            case "view_room": {
                // Don't auto-switch rooms when reacting to a context-switch
                // as this is not helpful and can create loops of rooms/space switching
                if (payload.context_switch) break;
                let roomId = payload.room_id;

                if (payload.room_alias && !roomId) {
                    roomId = getCachedRoomIDForAlias(payload.room_alias);
                }

                if (!roomId) return; // we'll get re-fired with the room ID shortly

                const room = this.matrixClient.getRoom(roomId);
                if (room?.isSpaceRoom()) {
                    // Don't context switch when navigating to the space room
                    // as it will cause you to end up in the wrong room
                    this.setActiveSpace(room.roomId, false);
                } else if (!this.isRoomInSpace(this.activeSpace, roomId)) {
                    this.switchToRelatedSpace(roomId);
                }

                // Persist last viewed room from a space
                // we don't await setActiveSpace above as we only care about this.activeSpace being up to date
                // synchronously for the below code - everything else can and should be async.
                window.localStorage.setItem(getSpaceContextKey(this.activeSpace), payload.room_id);
                break;
            }

            case "view_home_page":
                if (!payload.context_switch && this.enabledMetaSpaces.includes(MetaSpace.Home)) {
                    this.setActiveSpace(MetaSpace.Home, false);
                    window.localStorage.setItem(getSpaceContextKey(this.activeSpace), "");
                }
                break;

            case "after_leave_room":
                if (!isMetaSpace(this._activeSpace) && payload.room_id === this._activeSpace) {
                    // User has left the current space, go to first space
                    this.goToFirstSpace(true);
                }
                break;

            case Action.SwitchSpace: {
                // Metaspaces start at 1, Spaces follow
                if (payload.num < 1 || payload.num > 9) break;
                const numMetaSpaces = this.enabledMetaSpaces.length;
                if (payload.num <= numMetaSpaces) {
                    this.setActiveSpace(this.enabledMetaSpaces[payload.num - 1]);
                } else if (this.spacePanelSpaces.length > payload.num - numMetaSpaces - 1) {
                    this.setActiveSpace(this.spacePanelSpaces[payload.num - numMetaSpaces - 1].roomId);
                }
                break;
            }

            case Action.SettingUpdated: {
                const settingUpdatedPayload = payload as SettingUpdatedPayload;
                switch (settingUpdatedPayload.settingName) {
                    case "Spaces.allRoomsInHome": {
                        const newValue = SettingsStore.getValue("Spaces.allRoomsInHome");
                        if (this.allRoomsInHome !== newValue) {
                            this._allRoomsInHome = newValue;
                            this.emit(UPDATE_HOME_BEHAVIOUR, this.allRoomsInHome);
                            if (this.enabledMetaSpaces.includes(MetaSpace.Home)) {
                                this.rebuildHomeSpace();
                            }
                        }
                        break;
                    }

                    case "Spaces.enabledMetaSpaces": {
                        const newValue = SettingsStore.getValue("Spaces.enabledMetaSpaces");
                        const enabledMetaSpaces = metaSpaceOrder.filter(k => newValue[k]) as MetaSpace[];
                        if (arrayHasDiff(this._enabledMetaSpaces, enabledMetaSpaces)) {
                            const hadPeopleOrHomeEnabled = this.enabledMetaSpaces.some(s => {
                                return s === MetaSpace.Home || s === MetaSpace.People;
                            });
                            this._enabledMetaSpaces = enabledMetaSpaces;
                            const hasPeopleOrHomeEnabled = this.enabledMetaSpaces.some(s => {
                                return s === MetaSpace.Home || s === MetaSpace.People;
                            });

                            // if a metaspace currently being viewed was removed, go to another one
                            if (isMetaSpace(this.activeSpace) && !newValue[this.activeSpace]) {
                                this.switchSpaceIfNeeded();
                            }
                            this.rebuildMetaSpaces();

                            if (hadPeopleOrHomeEnabled !== hasPeopleOrHomeEnabled) {
                                // in this case we have to rebuild everything as DM badges will move to/from real spaces
                                this.updateNotificationStates();
                            } else {
                                this.updateNotificationStates(enabledMetaSpaces);
                            }

                            this.emit(UPDATE_TOP_LEVEL_SPACES, this.spacePanelSpaces, this.enabledMetaSpaces);
                        }
                        break;
                    }

                    case "Spaces.showPeopleInSpace":
                        // getSpaceFilteredUserIds will return the appropriate value
                        this.emit(settingUpdatedPayload.roomId);
                        if (!this.enabledMetaSpaces.some(s => s === MetaSpace.Home || s === MetaSpace.People)) {
                            this.updateNotificationStates([settingUpdatedPayload.roomId]);
                        }
                        break;
                }
            }
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

    private getSpaceTagOrdering = (space: Room): string | undefined => {
        if (this.spaceOrderLocalEchoMap.has(space.roomId)) return this.spaceOrderLocalEchoMap.get(space.roomId);
        return validOrder(space.getAccountData(EventType.SpaceOrder)?.getContent()?.order);
    };

    private sortRootSpaces(spaces: Room[]): Room[] {
        return sortBy(spaces, [this.getSpaceTagOrdering, "roomId"]);
    }

    private async setRootSpaceOrder(space: Room, order: string): Promise<void> {
        this.spaceOrderLocalEchoMap.set(space.roomId, order);
        try {
            await this.matrixClient.setRoomAccountData(space.roomId, EventType.SpaceOrder, { order });
        } catch (e) {
            logger.warn("Failed to set root space order", e);
            if (this.spaceOrderLocalEchoMap.get(space.roomId) === order) {
                this.spaceOrderLocalEchoMap.delete(space.roomId);
            }
        }
    }

    public moveRootSpace(fromIndex: number, toIndex: number): void {
        const currentOrders = this.rootSpaces.map(this.getSpaceTagOrdering);
        const changes = reorderLexicographically(currentOrders, fromIndex, toIndex);

        changes.forEach(({ index, order }) => {
            this.setRootSpaceOrder(this.rootSpaces[index], order);
        });

        this.notifyIfOrderChanged();
    }
}

export default class SpaceStore {
    public static spacesEnabled = spacesEnabled;

    private static internalInstance = new SpaceStoreClass();

    public static get instance(): SpaceStoreClass {
        return SpaceStore.internalInstance;
    }
}

window.mxSpaceStore = SpaceStore.instance;
