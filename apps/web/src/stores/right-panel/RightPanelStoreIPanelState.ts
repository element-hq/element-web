/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent, type Room, type RoomMember, type User } from "matrix-js-sdk/src/matrix";
import { type VerificationRequest } from "matrix-js-sdk/src/crypto-api";

import { type RightPanelPhases } from "./RightPanelStorePhases";
import type { MediaHandle } from "@element-hq/element-web-module-api";
import { type RegisteredFileViewer, uploadedMediaOfEvent, remoteMediaOfPreview } from "../../modules/FileViewerApi";
import { ModuleApi } from "../../modules/Api";
import { type UrlPreview } from "shared-types";

/**
 * State of the file viewer card.
 */
export interface FileViewerCardState {
    /**
     * Viewer in use of viewing
     */
    viewer: RegisteredFileViewer;
    /**
     * The media that is being viewed
     */
    media: MediaHandle;
    /**
     * The event the media being viewed is from
     */
    mxEvent: MatrixEvent;
}

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
    // document viewer: the m.file event whose attachment is being read
    documentViewerEvent?: MatrixEvent;
    // file viewer: its fields are only valid together, so they are grouped into one optional object
    fileViewer?: FileViewerCardState;
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
    // document viewer
    documentViewerEventId?: string;
    // file viewer
    fileViewerId?: string;
    fileViewerSourceEventId?: string;
    // what room is the event from?
    fileViewerSourceRoomId?: string;
    // only present if file viewer is viewing remote content (from a URL preview)
    fileViewerUrlPreview?: UrlPreview;
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

export function convertToStorePanel(cacheRoom?: IRightPanelForRoom): IRightPanelForRoomStored | null {
    if (!cacheRoom) return null;
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
        documentViewerEventId: state?.documentViewerEvent?.getId(),
        fileViewerId: state?.fileViewer?.viewer.options.id,
        fileViewerSourceEventId: state?.fileViewer?.mxEvent.getId(),
        fileViewerSourceRoomId: state?.fileViewer?.mxEvent.getRoomId(),
        fileViewerUrlPreview: state?.fileViewer?.media.type === "remote" ? state.fileViewer.media.preview : undefined,
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
        documentViewerEvent: !!stateStored?.documentViewerEventId
            ? room.findEventById(stateStored.documentViewerEventId)
            : undefined,
    };

    if (stateStored.fileViewerId && stateStored.fileViewerSourceRoomId && stateStored.fileViewerSourceEventId) {
        const viewer = ModuleApi.instance.fileViewer.getViewerById(stateStored.fileViewerId);
        const mxEvent = room.client
            .getRoom(stateStored.fileViewerSourceRoomId)
            ?.findEventById(stateStored.fileViewerSourceEventId);

        if (viewer && mxEvent) {
            const media = stateStored.fileViewerUrlPreview
                ? remoteMediaOfPreview(stateStored.fileViewerUrlPreview)
                : uploadedMediaOfEvent(mxEvent);
            if (media) state.fileViewer = { viewer, media, mxEvent };
        }
    }

    return { state: state, phase: panelStateStore.phase };
}
