/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import React from "react";
import { act, render } from "test-utils-rtl";
import { afterEach, describe, expect, it } from "vitest";

import PersistedElement from "./PersistedElement";
import { SDKContext } from "../../../contexts/SDKContext";
import { SDKContextClass } from "../../../contexts/SDKContextClass";

describe("PersistedElement", () => {
    const persistKey = "widget_test";
    const container = (): HTMLElement | null => document.getElementById("mx_persistedElement_" + persistKey);
    // The positioned element inside the container, whose style PersistedElement manages
    const child = (): HTMLElement => container()!.querySelector("[data-testid=child]")!.parentElement!;

    const mount = () =>
        render(
            <SDKContext.Provider value={SDKContextClass.instance}>
                <PersistedElement persistKey={persistKey}>
                    <span data-testid="child">call</span>
                </PersistedElement>
            </SDKContext.Provider>,
        );

    afterEach(() => {
        act(() => PersistedElement.destroyElement(persistKey));
    });

    it("renders its children into a container on the body", async () => {
        const { unmount } = mount();
        await act(async () => {});

        expect(container()?.parentElement?.id).toBe("mx_PersistedElement_container");
        expect(child().style.display).toBe("block");
        expect(child().style.position).toBe("absolute");

        unmount();
        // Unmounting the placeholder hides the persisted tree rather than removing it
        expect(PersistedElement.isMounted(persistKey)).toBe(true);
        expect(child().style.display).toBe("none");
    });

    it("can move its DOM tree into another host and back", async () => {
        const { unmount } = mount();
        await act(async () => {});
        const host = document.createElement("div");
        document.body.appendChild(host);

        expect(PersistedElement.detach(persistKey, host)).toBe(true);
        expect(PersistedElement.isDetached(persistKey)).toBe(true);
        expect(container()?.parentElement).toBe(host);
        // Filling the host rather than following the placeholder
        expect(child().style.width).toBe("100%");
        expect(child().style.height).toBe("100%");
        expect(child().style.transform).toBe("none");

        // While detached, losing the placeholder does not hide it
        unmount();
        expect(child().style.display).toBe("block");

        PersistedElement.reattach(persistKey);
        expect(PersistedElement.isDetached(persistKey)).toBe(false);
        expect(container()?.parentElement?.id).toBe("mx_PersistedElement_container");
        // No placeholder is mounted any more, so it goes back to being hidden
        expect(child().style.display).toBe("none");

        // A placeholder mounting again places it
        mount();
        await act(async () => {});
        expect(child().style.display).toBe("block");
        expect(child().style.width).not.toBe("100%");

        host.remove();
    });

    it("reports when there is nothing to detach", () => {
        expect(PersistedElement.detach("widget_unknown", document.body)).toBe(false);
        expect(PersistedElement.isDetached("widget_unknown")).toBe(false);
        // And forgets the detached state once destroyed
        PersistedElement.reattach("widget_unknown");
    });
});
