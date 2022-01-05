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

import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { User } from "matrix-js-sdk/src/models/user";
import { Room } from "matrix-js-sdk/src/models/room";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";
import { VerificationRequest } from "matrix-js-sdk/src/crypto/verification/request/VerificationRequest";

import { GroupMember } from "../../components/views/right_panel/UserInfo";
import { RightPanelPhases } from "./RightPanelStorePhases";

export interface IRightPanelCardState {
    member?: RoomMember | User | GroupMember;
    verificationRequest?: VerificationRequest;
    verificationRequestPromise?: Promise<VerificationRequest>;
    // group
    groupId?: string;
    groupRoomId?: string;
    widgetId?: string;
    spaceId?: string;
    // Room3pidMemberInfo, Space3pidMemberInfo,
    memberInfoEvent?: MatrixEvent;
    // threads
    threadHeadEvent?: MatrixEvent;
    initialEvent?: MatrixEvent;
    isInitialEventHighlighted?: boolean;
}

export interface IRightPanelCardStateStored {
    memberId?: string;
    // we do not store the things associated with verification
    // group
    groupId?: string;
    groupRoomId?: string;
    widgetId?: string;
    spaceId?: string;
    // 3pidMemberInfo
    memberInfoEventId?: string;
    // threads
    threadHeadEventId?: string;
    initialEventId?: string;
    isInitialEventHighlighted?: boolean;
}

export interface IRightPanelCard {
    phase: RightPanelPhases;
    state?: IRightPanelCardState;
}

export interface IRightPanelCardStored {
    phase: RightPanelPhases;
    state?: IRightPanelCardStateStored;
}

export interface IRightPanelForRoom {
    isOpen: boolean;
    history: Array<IRightPanelCard>;
}

interface IRightPanelForRoomStored {
    isOpen: boolean;
    history: Array<IRightPanelCardStored>;
}

export function convertToStorePanel(cacheRoom: IRightPanelForRoom): IRightPanelForRoomStored {
    if (!cacheRoom) return cacheRoom;
    const storeHistory = [...cacheRoom.history].map(panelState => convertCardToStore(panelState));
    return { isOpen: cacheRoom.isOpen, history: storeHistory };
}

export function convertToStatePanel(storeRoom: IRightPanelForRoomStored, room: Room): IRightPanelForRoom {
    if (!storeRoom) return storeRoom;
    const stateHistory = [...storeRoom.history].map(panelStateStore => convertStoreToCard(panelStateStore, room));
    return { history: stateHistory, isOpen: storeRoom.isOpen };
}

export function convertCardToStore(panelState: IRightPanelCard): IRightPanelCardStored {
    const panelStateThisRoomStored = { ...panelState.state } as any;
    if (!!panelState?.state?.threadHeadEvent?.getId()) {
        panelStateThisRoomStored.threadHeadEventId = panelState.state.threadHeadEvent.getId();
    }
    if (!!panelState?.state?.memberInfoEvent?.getId()) {
        panelStateThisRoomStored.memberInfoEventId = panelState.state.memberInfoEvent.getId();
    }
    if (!!panelState?.state?.initialEvent?.getId()) {
        panelStateThisRoomStored.initialEventId = panelState.state.initialEvent.getId();
    }
    if (!!panelState?.state?.member?.userId) {
        panelStateThisRoomStored.memberId = panelState.state.member.userId;
    }
    delete panelStateThisRoomStored.threadHeadEvent;
    delete panelStateThisRoomStored.initialEvent;
    delete panelStateThisRoomStored.memberInfoEvent;
    delete panelStateThisRoomStored.verificationRequest;
    delete panelStateThisRoomStored.verificationRequestPromise;
    delete panelStateThisRoomStored.member;

    const storedCard = { state: panelStateThisRoomStored as IRightPanelCardStored, phase: panelState.phase };
    return storedCard as IRightPanelCardStored;
}

function convertStoreToCard(panelStateStore: IRightPanelCardStored, room: Room): IRightPanelCard {
    const panelStateThisRoom = { ...panelStateStore?.state } as any;
    if (!!panelStateThisRoom.threadHeadEventId) {
        panelStateThisRoom.threadHeadEvent = room.findEventById(panelStateThisRoom.threadHeadEventId);
    }
    if (!!panelStateThisRoom.memberInfoEventId) {
        panelStateThisRoom.memberInfoEvent = room.findEventById(panelStateThisRoom.memberInfoEventId);
    }
    if (!!panelStateThisRoom.initialEventId) {
        panelStateThisRoom.initialEvent = room.findEventById(panelStateThisRoom.initialEventId);
    }
    if (!!panelStateThisRoom.memberId) {
        panelStateThisRoom.member = room.getMember(panelStateThisRoom.memberId);
    }
    delete panelStateThisRoom.threadHeadEventId;
    delete panelStateThisRoom.initialEventId;
    delete panelStateThisRoom.memberInfoEventId;
    delete panelStateThisRoom.memberId;

    return { state: panelStateThisRoom as IRightPanelCardState, phase: panelStateStore.phase } as IRightPanelCard;
}
