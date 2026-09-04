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
import { SDKContextClass } from "../contexts/SDKContextClass";
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

interface Shown {
    call: ElementCall;
    persistKey: string;
    pipWindow: Window;
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
 */
export class DocumentPipStore extends TypedEventEmitter<DocumentPipStoreEvent, EventHandlerMap> {
    private static internalInstance?: DocumentPipStore;

    public static get instance(): DocumentPipStore {
        if (!DocumentPipStore.internalInstance) {
            DocumentPipStore.internalInstance = new DocumentPipStore();
        }
        return DocumentPipStore.internalInstance;
    }

    /** Whether this browser has the Document Picture-in-Picture API. */
    public static get isSupported(): boolean {
        return typeof window !== "undefined" && window.documentPictureInPicture !== undefined;
    }

    private shown: Shown | null = null;

    /** The call currently shown in a Picture-in-Picture window, if any. */
    public get call(): ElementCall | null {
        return this.shown?.call ?? null;
    }

    public isShowing(call: Call | null): boolean {
        return call !== null && this.shown?.call === call;
    }

    /** Whether the call identified by this (virtual) widget is in the Picture-in-Picture window. */
    public isShowingWidget(widgetId: string, roomId: string | null): boolean {
        return this.shown !== null && this.shown.call.widget.id === widgetId && this.shown.call.roomId === roomId;
    }

    /**
     * Moves the call into a Picture-in-Picture window. Must be called from a user gesture, as the browser
     * requires one. A call already in the window is focused instead; any other call in it is replaced.
     */
    public async open(call: ElementCall): Promise<void> {
        if (!DocumentPipStore.isSupported) return;
        if (this.shown?.call === call) {
            this.shown.pipWindow.focus();
            return;
        }
        const persistKey = getPersistKey(WidgetUtils.getWidgetUid(call.widget));
        if (!PersistedElement.isMounted(persistKey)) {
            logger.warn(`Call in ${call.roomId} has nothing rendered to show in Picture-in-Picture`);
            return;
        }

        this.close();
        let pipWindow: Window;
        try {
            pipWindow = await window.documentPictureInPicture!.requestWindow(DEFAULT_WINDOW_SIZE);
        } catch (e) {
            logger.warn("Could not open a Document Picture-in-Picture window", e);
            return;
        }
        // The call may have ended while the browser was opening the window
        if (!PersistedElement.isMounted(persistKey)) {
            pipWindow.close();
            return;
        }

        prepareDocument(pipWindow.document);
        PersistedElement.detach(persistKey, pipWindow.document.body);
        this.shown = { call, persistKey, pipWindow };

        pipWindow.addEventListener("pagehide", this.onWindowClosed);
        call.on(CallEvent.ConnectionState, this.onConnectionState);
        SDKContextClass.instance.roomViewStore.on(UPDATE_EVENT, this.onRoomViewChanged);

        // The call has left the room view: show the timeline there, as minimising into Element Web's own
        // PiP does. Opening the call view again brings it back (see `onRoomViewChanged`).
        const roomViewStore = SDKContextClass.instance.roomViewStore;
        if (roomViewStore.isViewingCall() && roomViewStore.getRoomId() === call.roomId) {
            defaultDispatcher.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                room_id: call.roomId,
                metricsTrigger: undefined,
                view_call: false,
            });
        }

        this.emit(DocumentPipStoreEvent.Update);
    }

    /** Closes the Picture-in-Picture window, bringing the call back into this document. */
    public close(): void {
        const shown = this.shown;
        if (!shown) return;
        this.release(shown);
        shown.pipWindow.close();
    }

    private onWindowClosed = (): void => {
        if (this.shown) this.release(this.shown);
    };

    private onConnectionState = (state: ConnectionState): void => {
        if (state === ConnectionState.Disconnected) this.close();
    };

    private onRoomViewChanged = (): void => {
        // The user wants the call in the room view again
        const roomViewStore = SDKContextClass.instance.roomViewStore;
        if (this.shown && roomViewStore.isViewingCall() && roomViewStore.getRoomId() === this.shown.call.roomId) {
            this.close();
        }
    };

    /** Detaches from the window and puts the call back where it came from; idempotent. */
    private release(shown: Shown): void {
        if (this.shown !== shown) return;
        this.shown = null;
        shown.pipWindow.removeEventListener("pagehide", this.onWindowClosed);
        shown.call.off(CallEvent.ConnectionState, this.onConnectionState);
        SDKContextClass.instance.roomViewStore.off(UPDATE_EVENT, this.onRoomViewChanged);
        PersistedElement.reattach(shown.persistKey);
        this.emit(DocumentPipStoreEvent.Update);
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
