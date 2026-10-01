/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { vi, describe, it, expect } from "vitest";

import UIStore, { UI_EVENTS } from "./UIStore";

vi.useFakeTimers();

describe("UIStore", () => {
    class MockResizeObserver {
        public static instance: ResizeObserver;
        public static callback: ResizeObserverCallback;

        public constructor(callback: ResizeObserverCallback) {
            MockResizeObserver.callback = callback;
            MockResizeObserver.instance = this;
        }

        public static changeWidth = (width: number): void => {
            const entry = {
                target: document.body,
                contentRect: {
                    width,
                    height: 1000,
                },
            } as unknown as ResizeObserverEntry;
            MockResizeObserver.callback([entry], MockResizeObserver.instance);
        };

        public observe = vi.fn();
        public unobserve = vi.fn();
        public disconnect = vi.fn();
    }
    globalThis.ResizeObserver = MockResizeObserver;

    it("should emit events on width increase/decrease", () => {
        // eslint-disable-next-line no-restricted-properties
        window.innerWidth = 500;
        const store = UIStore.instance;

        const onDecrease = vi.fn();
        store.on(UI_EVENTS.WidthDecreased, onDecrease);
        MockResizeObserver.changeWidth(200);
        expect(onDecrease).toHaveBeenCalledWith(200);

        const onIncrease = vi.fn();
        store.on(UI_EVENTS.WidthIncreased, onIncrease);
        MockResizeObserver.changeWidth(700);
        expect(onIncrease).toHaveBeenCalledWith(700);

        UIStore.destroy();
    });

    it("should set isWindowBeingResized on resize", () => {
        // eslint-disable-next-line no-restricted-properties
        window.innerWidth = 500;
        const store = UIStore.instance;

        // No resize yet, so expect isWindowBeingResized to be false
        expect(store.isWindowBeingResized).toBe(false);

        // When resizing the window, expect isWindowBeingResized to be true
        MockResizeObserver.changeWidth(200);
        expect(store.isWindowBeingResized).toBe(true);

        // After a second, isWindowBeingResized should again become false
        vi.runAllTimers();
        expect(store.isWindowBeingResized).toBe(false);
    });
});
