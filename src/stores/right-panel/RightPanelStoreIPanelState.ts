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

import { RightPanelPhases } from "./RightPanelStorePhases";

export interface IRightPanelCardState {
    member?: RoomMember | User;
    verificationRequest?: VerificationRequest;
    verificationRequestPromise?: Promise<VerificationRequest>;
    widgetId?: string;
    spaceId?: string;
    // Room3pidMemberInfo, Space3pidMemberInfo,
    memberInfoEvent?: MatrixEvent;
    // threads
    threadHeadEvent?: MatrixEvent;
    initialEvent?: MatrixEvent;
    isInitialEventHighlighted?: boolean;
    initialEventScrollIntoView?: boolean;
}

export interface IRightPanelCardStateStored {
    memberId?: string;
    // we do not store the things associated with verification
    widgetId?: string;
    spaceId?: string;
    // 3pidMemberInfo
    memberInfoEventId?: string;
    // threads
    threadHeadEventId?: string;
    initialEventId?: string;
    isInitialEventHighlighted?: boolean;
    initialEventScrollIntoView?: boolean;
}

export interface IRightPanelCard {
    phase: RightPanelPhases | null;
    state?: IRightPanelCardState;
}

export interface IRightPanelCardStored {
    phase: RightPanelPhases | null;
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

export function convertToStorePanel(cacheRoom?: IRightPanelForRoom): IRightPanelForRoomStored | undefined {
    if (!cacheRoom) return undefined;
    const storeHistory = [...cacheRoom.history].map((panelState) => convertCardToStore(panelState));
    return { isOpen: cacheRoom.isOpen, history: storeHistory };
}

export function convertToStatePanel(storeRoom: IRightPanelForRoomStored, room: Room): IRightPanelForRoom {
    if (!storeRoom) return storeRoom;
    const stateHistory = [...storeRoom.history].map((panelStateStore) => convertStoreToCard(panelStateStore, room));
    return { history: stateHistory, isOpen: storeRoom.isOpen };
}

export function convertCardToStore(panelState: IRightPanelCard): IRightPanelCardStored {
    const state = panelState.state ?? {};
    const stateStored: IRightPanelCardStateStored = {
        widgetId: state.widgetId,
        spaceId: state.spaceId,
        isInitialEventHighlighted: state.isInitialEventHighlighted,
        initialEventScrollIntoView: state.initialEventScrollIntoView,
        threadHeadEventId: !!state?.threadHeadEvent?.getId() ? state.threadHeadEvent.getId() : undefined,
        memberInfoEventId: !!state?.memberInfoEvent?.getId() ? state.memberInfoEvent.getId() : undefined,
        initialEventId: !!state?.initialEvent?.getId() ? state.initialEvent.getId() : undefined,
        memberId: !!state?.member?.userId ? state.member.userId : undefined,
    };

    return { state: stateStored, phase: panelState.phase };
}

function convertStoreToCard(panelStateStore: IRightPanelCardStored, room: Room): IRightPanelCard {
    const stateStored = panelStateStore.state ?? {};
    const state: IRightPanelCardState = {
        widgetId: stateStored.widgetId,
        spaceId: stateStored.spaceId,
        isInitialEventHighlighted: stateStored.isInitialEventHighlighted,
        initialEventScrollIntoView: stateStored.initialEventScrollIntoView,
        threadHeadEvent: !!stateStored?.threadHeadEventId
            ? room.findEventById(stateStored.threadHeadEventId)
            : undefined,
        memberInfoEvent: !!stateStored?.memberInfoEventId
            ? room.findEventById(stateStored.memberInfoEventId)
            : undefined,
        initialEvent: !!stateStored?.initialEventId ? room.findEventById(stateStored.initialEventId) : undefined,
        member: (!!stateStored?.memberId && room.getMember(stateStored.memberId)) || undefined,
    };

    return { state: state, phase: panelStateStore.phase };
}
