/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TypedEventEmitter } from "matrix-js-sdk/src/matrix";

import { DocumentPipStore, DocumentPipStoreEvent } from "./DocumentPipStore";
import PersistedElement, { getPersistKey } from "../components/views/elements/PersistedElement";
import { CallEvent, ConnectionState, type ElementCall } from "../models/Call";
import WidgetUtils from "../utils/WidgetUtils";
import { SDKContextClass } from "../contexts/SDKContextClass";
import { UPDATE_EVENT } from "./AsyncStore";
import defaultDispatcher from "../dispatcher/dispatcher";
import { Action } from "../dispatcher/actions";

describe("DocumentPipStore", () => {
    const roomId = "!room:example.org";
    let call: ElementCall;
    let persistKey: string;
    let pipWindow: Window & { emitPageHide: () => void };
    let requestWindow: ReturnType<typeof vi.fn>;

    const store = (): DocumentPipStore => DocumentPipStore.instance;

    beforeEach(() => {
        call = Object.assign(new TypedEventEmitter(), {
            widget: { id: "call-widget", roomId, type: "m.call" },
            roomId,
        }) as unknown as ElementCall;
        persistKey = getPersistKey(WidgetUtils.getWidgetUid(call.widget));

        const listeners = new Map<string, () => void>();
        pipWindow = {
            document: document.implementation.createHTMLDocument("pip"),
            addEventListener: vi.fn((name: string, fn: () => void) => listeners.set(name, fn)),
            removeEventListener: vi.fn((name: string) => listeners.delete(name)),
            close: vi.fn(() => listeners.get("pagehide")?.()),
            focus: vi.fn(),
            emitPageHide: () => listeners.get("pagehide")?.(),
        } as unknown as typeof pipWindow;
        requestWindow = vi.fn().mockResolvedValue(pipWindow);
        Object.defineProperty(window, "documentPictureInPicture", {
            configurable: true,
            value: { window: null, requestWindow },
        });

        vi.spyOn(PersistedElement, "isMounted").mockReturnValue(true);
        vi.spyOn(PersistedElement, "detach").mockReturnValue(true);
        vi.spyOn(PersistedElement, "reattach").mockImplementation(() => {});
        vi.spyOn(SDKContextClass.instance.roomViewStore, "isViewingCall").mockReturnValue(false);
        vi.spyOn(SDKContextClass.instance.roomViewStore, "getRoomId").mockReturnValue(roomId);
    });

    afterEach(() => {
        store().close();
        vi.restoreAllMocks();
        // @ts-expect-error deleting the fake API again
        delete window.documentPictureInPicture;
    });

    it("is unsupported without the browser API", () => {
        // @ts-expect-error deleting the fake API
        delete window.documentPictureInPicture;
        expect(DocumentPipStore.isSupported).toBe(false);
    });

    it("moves the call's persisted tree into a new window", async () => {
        const style = document.createElement("style");
        style.textContent = ".mx_Test { color: red }";
        document.head.appendChild(style);
        document.body.className = "cpd-theme-light";
        const onUpdate = vi.fn();
        store().on(DocumentPipStoreEvent.Update, onUpdate);

        await store().open(call);

        expect(requestWindow).toHaveBeenCalledWith({ width: 640, height: 360 });
        expect(PersistedElement.detach).toHaveBeenCalledWith(persistKey, pipWindow.document.body);
        expect(store().call).toBe(call);
        expect(store().isShowing(call)).toBe(true);
        expect(store().isShowingWidget("call-widget", roomId)).toBe(true);
        expect(store().isShowingWidget("other", roomId)).toBe(false);
        expect(onUpdate).toHaveBeenCalledTimes(1);
        // The window got the page's stylesheets and theme
        const copiedStyles = Array.from(pipWindow.document.head.querySelectorAll("style"), (s) => s.textContent);
        expect(copiedStyles).toContain(".mx_Test { color: red }");
        expect(pipWindow.document.body.className).toBe("cpd-theme-light");

        style.remove();
        document.body.className = "";
    });

    it("does nothing when the call has nothing rendered", async () => {
        vi.mocked(PersistedElement.isMounted).mockReturnValue(false);
        await store().open(call);
        expect(requestWindow).not.toHaveBeenCalled();
        expect(store().call).toBeNull();
    });

    it("shows the timeline in place of the call view", async () => {
        vi.mocked(SDKContextClass.instance.roomViewStore.isViewingCall).mockReturnValue(true);
        const dispatch = vi.spyOn(defaultDispatcher, "dispatch").mockImplementation(() => {});

        await store().open(call);

        expect(dispatch).toHaveBeenCalledWith(
            expect.objectContaining({ action: Action.ViewRoom, room_id: roomId, view_call: false }),
        );
    });

    it("brings the call back when the window is closed by the user", async () => {
        await store().open(call);
        const onUpdate = vi.fn();
        store().on(DocumentPipStoreEvent.Update, onUpdate);

        pipWindow.emitPageHide();

        expect(PersistedElement.reattach).toHaveBeenCalledWith(persistKey);
        expect(store().call).toBeNull();
        expect(onUpdate).toHaveBeenCalledTimes(1);
    });

    it("closes the window when asked to, once", async () => {
        await store().open(call);
        store().close();
        store().close();

        expect(pipWindow.close).toHaveBeenCalledTimes(1);
        expect(PersistedElement.reattach).toHaveBeenCalledTimes(1);
        expect(store().call).toBeNull();
    });

    it("closes the window when the call disconnects", async () => {
        await store().open(call);
        call.emit(CallEvent.ConnectionState, ConnectionState.Disconnected, ConnectionState.Connected);

        expect(pipWindow.close).toHaveBeenCalled();
        expect(store().call).toBeNull();
    });

    it("closes the window when the call view is opened again", async () => {
        await store().open(call);

        // Some other room's view changing is not our business
        vi.mocked(SDKContextClass.instance.roomViewStore.getRoomId).mockReturnValue("!other:example.org");
        vi.mocked(SDKContextClass.instance.roomViewStore.isViewingCall).mockReturnValue(true);
        SDKContextClass.instance.roomViewStore.emit(UPDATE_EVENT);
        expect(store().call).toBe(call);

        vi.mocked(SDKContextClass.instance.roomViewStore.getRoomId).mockReturnValue(roomId);
        SDKContextClass.instance.roomViewStore.emit(UPDATE_EVENT);
        expect(pipWindow.close).toHaveBeenCalled();
        expect(store().call).toBeNull();
    });

    it("focuses the window when the same call is opened twice", async () => {
        await store().open(call);
        await store().open(call);

        expect(requestWindow).toHaveBeenCalledTimes(1);
        expect(pipWindow.focus).toHaveBeenCalled();
    });
});
