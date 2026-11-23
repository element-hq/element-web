/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { TypedEventEmitter } from "matrix-js-sdk/src/matrix";
import { logger as rootLogger } from "matrix-js-sdk/src/logger";

import { type Call, CallEvent, ConnectionState, type ElementCall } from "../models/Call";
import PersistedElement, { getPersistKey } from "../components/views/elements/PersistedElement";
import WidgetUtils from "../utils/WidgetUtils";
import { type SDKContextClass } from "../contexts/SDKContextClass";
import { UPDATE_EVENT } from "./AsyncStore";
import defaultDispatcher from "../dispatcher/dispatcher";
import { Action } from "../dispatcher/actions";
import { type ViewRoomPayload } from "../dispatcher/payloads/ViewRoomPayload";

const logger = rootLogger.getChild("DocumentPipStore");

export enum DocumentPipStoreEvent {
    /** The call shown in the Document Picture-in-Picture window changed (opened, closed, or replaced). */
    Update = "update",
}

type EventHandlerMap = {
    [DocumentPipStoreEvent.Update]: () => void;
};

/** The size a new Picture-in-Picture window opens at; the user can resize it from there. */
const DEFAULT_WINDOW_SIZE = { width: 640, height: 360 };

/** State of the OS Picture-in-Picture window right now, and where it came from. */
interface DocumentPiPState {
    call: ElementCall;
    /** reference back to the call's persistedElement DOM tree. */
    persistKey: string;
    pipWindow: Window;
    /**
     * Whether the call was floating in Element Web's own PiP when it left for the window, as opposed to
     * filling the room's call view. It goes back to wherever it came from.
     */
    fromPipView: boolean;
}

/**
 * Shows an Element Call call in a browser Document Picture-in-Picture window: a small always-on-top
 * window the user can move outside the browser, which Element Web's own floating PiP cannot do.
 *
 * Only calls rendered through the Element Call React component can be shown this way, because what
 * moves into the window is the call's persisted DOM tree (see `PersistedElement.detach`). The React
 * tree keeps running in this document, so the call carries on uninterrupted; an iframe would reload if
 * it were moved. While a call is in the window, Element Web's floating PiP does not show it as well.
 *
 * Chromium only for now (`window.documentPictureInPicture`); see `isSupported`.
 *
 * Constructed once by `SDKContextClass`; reach it through the SDK context rather than a global.
 */
export class DocumentPipStore extends TypedEventEmitter<DocumentPipStoreEvent, EventHandlerMap> {
    public constructor(private readonly sdkContext: SDKContextClass) {
        super();
    }

    /** Whether this browser has the Document Picture-in-Picture API. */
    public static get isSupported(): boolean {
        return typeof window !== "undefined" && window.documentPictureInPicture !== undefined;
    }

    /** `null` means its current not shown. !== null -> the PiP window is shown */
    private documentPipState: DocumentPiPState | null = null;
    /**
     * Counts requests to open a window. Opening waits for the browser, and a request overtaken in the
     * meantime by another `open` or by `close` must not install itself once its window arrives.
     */
    private openCloseRequestIndex = 0;

    /** The call currently shown in a Picture-in-Picture window, if any. */
    public get call(): ElementCall | null {
        return this.documentPipState?.call ?? null;
    }

    /** The Picture-in-Picture window, while a call is shown in one. */
    public get pipWindow(): Window | null {
        return this.documentPipState?.pipWindow ?? null;
    }

    public isShowing(call: Call | null): boolean {
        return call !== null && this.documentPipState?.call === call;
    }

    /** Whether the call identified by this (virtual) widget is in the Picture-in-Picture window. */
    public isShowingWidget(widgetId: string, roomId: string | null): boolean {
        return (
            this.documentPipState !== null &&
            this.documentPipState.call.widget.id === widgetId &&
            this.documentPipState.call.roomId === roomId
        );
    }

    /**
     * Moves the call into a Picture-in-Picture window. Must be called from a user gesture, as the browser
     * requires one. A call already in the window is focused instead; any other call in it is replaced.
     */
    public async open(call: ElementCall): Promise<void> {
        if (!DocumentPipStore.isSupported) return;
        if (this.documentPipState?.call === call) {
            this.documentPipState.pipWindow.focus();
            return;
        }
        const persistKey = getPersistKey(WidgetUtils.getWidgetUid(call.widget));
        if (!PersistedElement.isMounted(persistKey)) {
            logger.warn(`Call in ${call.roomId} has nothing rendered to show in Picture-in-Picture`);
            return;
        }

        this.close();
        const requestIndex = ++this.openCloseRequestIndex;
        let pipWindow: Window;
        try {
            pipWindow = await window.documentPictureInPicture!.requestWindow(DEFAULT_WINDOW_SIZE);
        } catch (e) {
            logger.warn("Could not open a Document Picture-in-Picture window", e);
            return;
        }
        // Overtaken while the browser was opening the window, or the call ended in the meantime
        if (requestIndex !== this.openCloseRequestIndex || !PersistedElement.isMounted(persistKey)) {
            pipWindow.close();
            return;
        }

        const roomViewStore = this.sdkContext.roomViewStore;
        const fromPipView = !(roomViewStore.isViewingCall() && roomViewStore.getRoomId() === call.roomId);

        prepareDocument(pipWindow.document);
        PersistedElement.detach(persistKey, pipWindow.document.body);
        this.documentPipState = { call, persistKey, pipWindow, fromPipView };

        pipWindow.addEventListener("pagehide", this.onWindowClosed);
        call.on(CallEvent.ConnectionState, this.onConnectionState);
        roomViewStore.on(UPDATE_EVENT, this.onRoomViewChanged);

        // The call has left the room view: show the timeline there, as minimising into Element Web's own
        // PiP does. Opening the call view again brings it back (see `onRoomViewChanged`), as does closing
        // the window (see `release`).
        if (!fromPipView) {
            defaultDispatcher.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                room_id: call.roomId,
                metricsTrigger: undefined,
                view_call: false,
            });
        }

        this.emit(DocumentPipStoreEvent.Update);
    }

    /**
     * Closes the Picture-in-Picture window, bringing the call back into this document. Also abandons a
     * window that is still being opened.
     */
    public close(): void {
        this.openCloseRequestIndex++;
        const shown = this.documentPipState;
        if (!shown) return;
        this.release(shown);
        shown.pipWindow.close();
    }

    private onWindowClosed = (): void => {
        if (this.documentPipState) this.release(this.documentPipState);
    };

    private onConnectionState = (state: ConnectionState): void => {
        if (state === ConnectionState.Disconnected) this.close();
    };

    private onRoomViewChanged = (): void => {
        // RoomViewStore updates on any change, most of them are unrelated to the window
        const roomViewStore = this.sdkContext.roomViewStore;
        if (
            this.documentPipState &&
            roomViewStore.getRoomId() === this.documentPipState.call.roomId &&
            roomViewStore.isViewingCall()
        ) {
            // The user opened the call view (a `ViewRoom` with `view_call`):
            // they want the call in the room view again, so the OS PiP window needs to go (close).
            this.close();
        }
    };

    /** Detaches from the window and puts the call back where it came from; idempotent. */
    private release(state: DocumentPiPState): void {
        if (this.documentPipState !== state) return;
        this.documentPipState = null;
        state.pipWindow.removeEventListener("pagehide", this.onWindowClosed);
        state.call.off(CallEvent.ConnectionState, this.onConnectionState);
        const roomViewStore = this.sdkContext.roomViewStore;
        roomViewStore.off(UPDATE_EVENT, this.onRoomViewChanged);
        PersistedElement.reattach(state.persistKey);
        this.emit(DocumentPipStoreEvent.Update);

        // Back to where it came from. A call that filled the room view returns there.
        // A call that reached Docuement PiP from the Element Web's floating PiP returns it into the EW PiP.
        // Viewing the same room (Action.ViewRoom) with `view_call` set, is how the call view is opened.
        // (see `RoomViewStore`'s handling of `view_call`);
        if (
            !state.fromPipView &&
            state.call.connected &&
            roomViewStore.getRoomId() === state.call.roomId &&
            !roomViewStore.isViewingCall()
        ) {
            defaultDispatcher.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                room_id: state.call.roomId,
                metricsTrigger: undefined,
                view_call: true,
            });
        }
    }
}

/**
 * Gives the Picture-in-Picture document what the call's DOM tree expects of its page: Element Web's
 * stylesheets (the component's own is among them once a call has rendered), the theme classes, and a
 * body the tree can fill.
 */
function prepareDocument(target: Document): void {
    // Copies of the elements rather than the parsed sheets: a `<link>` is fetched again by the new
    // document (from cache), and a `<style>` is cloned with its text.
    for (const node of document.querySelectorAll('link[rel="stylesheet"], style')) {
        target.head.appendChild(target.importNode(node, true));
    }

    const { documentElement, body } = target;
    documentElement.className = document.documentElement.className;
    documentElement.lang = document.documentElement.lang;
    documentElement.dir = document.documentElement.dir;
    documentElement.style.height = "100%";
    body.className = document.body.className;
    Object.assign(body.style, {
        margin: "0",
        height: "100%",
        overflow: "hidden",
        // The detached tree is positioned absolutely, against the body
        position: "relative",
    });
    target.title = document.title;
}
