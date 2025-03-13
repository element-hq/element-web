/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent, type Room, type RoomMember, type User } from "matrix-js-sdk/src/matrix";
import { type VerificationRequest } from "matrix-js-sdk/src/crypto-api";

import { type RightPanelPhases } from "./RightPanelStorePhases";

export interface IRightPanelCardState {
    member?: RoomMember | User;
    verificationRequest?: VerificationRequest;
    verificationRequestPromise?: Promise<VerificationRequest>;
    widgetId?: string;
    // Room3pidMemberInfo, Space3pidMemberInfo,
    memberInfoEvent?: MatrixEvent;
    // threads
    threadHeadEvent?: MatrixEvent;
    initialEvent?: MatrixEvent;
    isInitialEventHighlighted?: boolean;
    initialEventScrollIntoView?: boolean;
    // room summary
    focusRoomSearch?: boolean;
}

export interface IRightPanelCardStateStored {
    memberId?: string;
    // we do not store the things associated with verification
    widgetId?: string;
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

export type IRightPanelForRoomStored = {
    isOpen: boolean;
    history: Array<IRightPanelCardStored>;
};

export function convertToStorePanel(cacheRoom?: IRightPanelForRoom): IRightPanelForRoomStored | undefined {
    if (!cacheRoom) return undefined;
    const storeHistory = [...cacheRoom.history].map((panelState) => convertCardToStore(panelState));
    return { isOpen: cacheRoom.isOpen, history: storeHistory };
}

export function convertToStatePanel(storeRoom: IRightPanelForRoomStored | null, room: Room): IRightPanelForRoom | null {
    if (!storeRoom) return storeRoom;
    const stateHistory = [...storeRoom.history].map((panelStateStore) => convertStoreToCard(panelStateStore, room));
    return { history: stateHistory, isOpen: storeRoom.isOpen };
}

export function convertCardToStore(panelState: IRightPanelCard): IRightPanelCardStored {
    const state = panelState.state ?? {};
    const stateStored: IRightPanelCardStateStored = {
        widgetId: state.widgetId,
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
