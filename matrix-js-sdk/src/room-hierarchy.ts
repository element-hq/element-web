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

import { Room } from "./models/room";
import { IHierarchyRoom, IHierarchyRelation } from "./@types/spaces";
import { MatrixClient } from "./client";
import { EventType } from "./@types/event";
import { MatrixError } from "./http-api";

export class RoomHierarchy {
    // Map from room id to list of servers which are listed as a via somewhere in the loaded hierarchy
    public readonly viaMap = new Map<string, Set<string>>();
    // Map from room id to list of rooms which claim this room as their child
    public readonly backRefs = new Map<string, string[]>();
    // Map from room id to object
    public readonly roomMap = new Map<string, IHierarchyRoom>();
    private loadRequest?: ReturnType<MatrixClient["getRoomHierarchy"]>;
    private nextBatch?: string;
    private _rooms?: IHierarchyRoom[];
    private serverSupportError?: Error;

    /**
     * Construct a new RoomHierarchy
     *
     * A RoomHierarchy instance allows you to easily make use of the /hierarchy API and paginate it.
     *
     * @param root - the root of this hierarchy
     * @param pageSize - the maximum number of rooms to return per page, can be overridden per load request.
     * @param maxDepth - the maximum depth to traverse the hierarchy to
     * @param suggestedOnly - whether to only return rooms with suggested=true.
     */
    public constructor(
        public readonly root: Room,
        private readonly pageSize?: number,
        private readonly maxDepth?: number,
        private readonly suggestedOnly = false,
    ) {}

    public get noSupport(): boolean {
        return !!this.serverSupportError;
    }

    public get canLoadMore(): boolean {
        return !!this.serverSupportError || !!this.nextBatch || !this._rooms;
    }

    public get loading(): boolean {
        return !!this.loadRequest;
    }

    public get rooms(): IHierarchyRoom[] | undefined {
        return this._rooms;
    }

    public async load(pageSize = this.pageSize): Promise<IHierarchyRoom[]> {
        if (this.loadRequest) return this.loadRequest.then((r) => r.rooms);

        this.loadRequest = this.root.client.getRoomHierarchy(
            this.root.roomId,
            pageSize,
            this.maxDepth,
            this.suggestedOnly,
            this.nextBatch,
        );

        let rooms: IHierarchyRoom[];
        try {
            ({ rooms, next_batch: this.nextBatch } = await this.loadRequest);
        } catch (e) {
            if ((<MatrixError>e).errcode === "M_UNRECOGNIZED") {
                this.serverSupportError = <MatrixError>e;
            } else {
                throw e;
            }

            return [];
        } finally {
            this.loadRequest = undefined;
        }

        if (this._rooms) {
            this._rooms = this._rooms.concat(rooms);
        } else {
            this._rooms = rooms;
        }

        rooms.forEach((room) => {
            this.roomMap.set(room.room_id, room);

            room.children_state.forEach((ev) => {
                if (ev.type !== EventType.SpaceChild) return;
                const childRoomId = ev.state_key;

                // track backrefs for quicker hierarchy navigation
                if (!this.backRefs.has(childRoomId)) {
                    this.backRefs.set(childRoomId, []);
                }
                this.backRefs.get(childRoomId)!.push(room.room_id);

                // fill viaMap
                if (Array.isArray(ev.content.via)) {
                    if (!this.viaMap.has(childRoomId)) {
                        this.viaMap.set(childRoomId, new Set());
                    }
                    const vias = this.viaMap.get(childRoomId)!;
                    ev.content.via.forEach((via) => vias.add(via));
                }
            });
        });

        return rooms;
    }

    public getRelation(parentId: string, childId: string): IHierarchyRelation | undefined {
        return this.roomMap.get(parentId)?.children_state.find((e) => e.state_key === childId);
    }

    public isSuggested(parentId: string, childId: string): boolean | undefined {
        return this.getRelation(parentId, childId)?.content.suggested;
    }

    // locally remove a relation as a form of local echo
    public removeRelation(parentId: string, childId: string): void {
        const backRefs = this.backRefs.get(childId);
        if (backRefs?.length === 1) {
            this.backRefs.delete(childId);
        } else if (backRefs?.length) {
            this.backRefs.set(
                childId,
                backRefs.filter((ref) => ref !== parentId),
            );
        }

        const room = this.roomMap.get(parentId);
        if (room) {
            room.children_state = room.children_state.filter((ev) => ev.state_key !== childId);
        }
    }
}
