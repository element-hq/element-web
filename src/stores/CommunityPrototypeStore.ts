/*
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

import { AsyncStoreWithClient } from "./AsyncStoreWithClient";
import defaultDispatcher from "../dispatcher/dispatcher";
import { ActionPayload } from "../dispatcher/payloads";
import { Room } from "matrix-js-sdk/src/models/room";
import { EffectiveMembership, getEffectiveMembership } from "../utils/membership";
import SettingsStore from "../settings/SettingsStore";
import * as utils from "matrix-js-sdk/src/utils";
import { UPDATE_EVENT } from "./AsyncStore";

interface IState {
    // nothing of value - we use account data
}

export interface IRoomProfile {
    displayName: string;
    avatarMxc: string;
}

export class CommunityPrototypeStore extends AsyncStoreWithClient<IState> {
    private static internalInstance = new CommunityPrototypeStore();

    private constructor() {
        super(defaultDispatcher, {});
    }

    public static get instance(): CommunityPrototypeStore {
        return CommunityPrototypeStore.internalInstance;
    }

    protected async onAction(payload: ActionPayload): Promise<any> {
        if (!this.matrixClient || !SettingsStore.getValue("feature_communities_v2_prototypes")) {
            return;
        }

        if (payload.action === "MatrixActions.Room.myMembership") {
            const room: Room = payload.room;
            const membership = getEffectiveMembership(payload.membership);
            const oldMembership = getEffectiveMembership(payload.oldMembership);
            if (membership === oldMembership) return;

            if (membership === EffectiveMembership.Invite) {
                try {
                    const path = utils.encodeUri("/rooms/$roomId/group_info", {$roomId: room.roomId});
                    const profile = await this.matrixClient._http.authedRequest(
                        undefined, "GET", path,
                        undefined, undefined,
                        {prefix: "/_matrix/client/unstable/im.vector.custom"});
                    // we use global account data because per-room account data on invites is unreliable
                    await this.matrixClient.setAccountData("im.vector.group_info." + room.roomId, profile);
                } catch (e) {
                    console.warn("Non-fatal error getting group information for invite:", e);
                }
            }
        } else if (payload.action === "MatrixActions.accountData") {
            if (payload.event_type.startsWith("im.vector.group_info.")) {
                this.emit(UPDATE_EVENT, payload.event_type.substring("im.vector.group_info.".length));
            }
        }
    }

    public getInviteProfile(roomId: string): IRoomProfile {
        if (!this.matrixClient) return {displayName: null, avatarMxc: null};
        const room = this.matrixClient.getRoom(roomId);
        if (SettingsStore.getValue("feature_communities_v2_prototypes")) {
            const data = this.matrixClient.getAccountData("im.vector.group_info." + roomId);
            if (data && data.getContent()) {
                return {displayName: data.getContent().name, avatarMxc: data.getContent().avatar_url};
            }
        }
        return {displayName: room.name, avatarMxc: room.avatar_url};
    }

    protected async onReady(): Promise<any> {
        for (const room of this.matrixClient.getRooms()) {
            const myMember = room.currentState.getMembers().find(m => m.userId === this.matrixClient.getUserId());
            if (!myMember) continue;
            if (getEffectiveMembership(myMember.membership) === EffectiveMembership.Invite) {
                // Fake an update for anything that might have started listening before the invite
                // data was available (eg: RoomPreviewBar after a refresh)
                this.emit(UPDATE_EVENT, room.roomId);
            }
        }
    }
}
