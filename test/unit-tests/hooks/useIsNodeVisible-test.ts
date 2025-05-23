/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { renderHook, act } from "jest-matrix-react";

import { useIsNodeVisible } from "../../../src/hooks/useIsNodeVisible";

describe("useIsNodeVisible", () => {
    let mockObserve: jest.Mock;
    let mockDisconnect: jest.Mock;
    let mockObserverInstance: IntersectionObserver;
    let intersectionObserverCallback: IntersectionObserverCallback;

    beforeEach(() => {
        mockObserve = jest.fn();
        mockDisconnect = jest.fn();
        mockObserverInstance = {
            observe: mockObserve,
            disconnect: mockDisconnect,
        } as unknown as IntersectionObserver;

        // Mock IntersectionObserver implementation
        global.IntersectionObserver = jest.fn((callback) => {
            intersectionObserverCallback = callback;
            return mockObserverInstance;
        });
    });

    it("should be null when the refs are not set", () => {
        const { result } = renderHook(() => useIsNodeVisible());
        expect(result.current.isVisible).toBeNull();
    });

    it("should be null when only nodeRef is set", () => {
        const { result } = renderHook(() => useIsNodeVisible());

        const nodeElement = document.createElement("div");
        act(() => {
            result.current.nodeRef(nodeElement);
        });

        expect(result.current.isVisible).toBeNull();
        expect(mockObserve).not.toHaveBeenCalled();
    });

    it("should be null when only rootRef is set", () => {
        const { result } = renderHook(() => useIsNodeVisible());

        const rootElement = document.createElement("div");
        act(() => {
            result.current.rootRef(rootElement);
        });

        expect(result.current.isVisible).toBeNull();
        expect(mockObserve).not.toHaveBeenCalled();
    });

    it("should start observing when both refs are set", () => {
        const { result } = renderHook(() => useIsNodeVisible());

        const nodeElement = document.createElement("div");
        const rootElement = document.createElement("div");

        act(() => {
            result.current.nodeRef(nodeElement);
            result.current.rootRef(rootElement);
        });

        expect(mockObserve).toHaveBeenCalledWith(nodeElement);
        expect(global.IntersectionObserver).toHaveBeenCalledWith(
            expect.any(Function),
            expect.objectContaining({ root: rootElement }),
        );
    });

    it("should update isVisible when intersection changes", () => {
        const { result } = renderHook(() => useIsNodeVisible());

        const nodeElement = document.createElement("div");
        const rootElement = document.createElement("div");

        act(() => {
            result.current.nodeRef(nodeElement);
            result.current.rootRef(rootElement);
        });

        // Simulate element becoming visible
        act(() => {
            intersectionObserverCallback([{ isIntersecting: true } as IntersectionObserverEntry], mockObserverInstance);
        });
        expect(result.current.isVisible).toBe(true);

        // Simulate element becoming hidden
        act(() => {
            intersectionObserverCallback(
                [{ isIntersecting: false } as IntersectionObserverEntry],
                mockObserverInstance,
            );
        });
        expect(result.current.isVisible).toBe(false);
    });

    it("should disconnect observer when component unmounts", () => {
        const { unmount, result } = renderHook(() => useIsNodeVisible());
        const nodeElement = document.createElement("div");
        const rootElement = document.createElement("div");

        act(() => {
            result.current.nodeRef(nodeElement);
            result.current.rootRef(rootElement);
        });

        unmount();
        expect(mockDisconnect).toHaveBeenCalled();
    });

    it("should pass options to IntersectionObserver", () => {
        const options = { threshold: 0.5, rootMargin: "10px" };
        renderHook(() => useIsNodeVisible(options));

        const nodeElement = document.createElement("div");
        const rootElement = document.createElement("div");

        // Manually call the refs to simulate mounting
        const { result } = renderHook(() => useIsNodeVisible(options));
        act(() => {
            result.current.nodeRef(nodeElement);
            result.current.rootRef(rootElement);
        });

        expect(global.IntersectionObserver).toHaveBeenCalledWith(
            expect.any(Function),
            expect.objectContaining({
                root: rootElement,
                threshold: 0.5,
                rootMargin: "10px",
            }),
        );
    });

    it("should re-observe when refs change", () => {
        const { result } = renderHook(() => useIsNodeVisible());

        const nodeElement1 = document.createElement("div");
        const rootElement1 = document.createElement("div");

        act(() => {
            result.current.nodeRef(nodeElement1);
            result.current.rootRef(rootElement1);
        });

        expect(mockObserve).toHaveBeenCalledWith(nodeElement1);

        // Change the node ref
        const nodeElement2 = document.createElement("div");
        act(() => {
            result.current.nodeRef(nodeElement2);
        });

        expect(mockDisconnect).toHaveBeenCalled();
        expect(mockObserve).toHaveBeenCalledWith(nodeElement2);
    });
});
