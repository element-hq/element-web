/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { RovingAction, type RovingTabIndexProviderProps } from "@element-hq/web-shared-components";
import { render } from "test-utils-rtl";

import * as KeyBindingsManagerModule from "../KeyBindingsManager";
import { KeyBindingAction } from "./KeyboardShortcuts";
import { RovingTabIndexProvider } from "./RovingTabIndex";

const { mockSharedRovingTabIndexProvider } = vi.hoisted(() => ({
    mockSharedRovingTabIndexProvider: vi.fn(),
}));

vi.mock("@element-hq/web-shared-components", async () => {
    const actual = await vi.importActual<typeof import("@element-hq/web-shared-components")>(
        "@element-hq/web-shared-components",
    );
    mockSharedRovingTabIndexProvider.mockImplementation(({ children }: RovingTabIndexProviderProps) => {
        return <>{children({ onDragEndHandler: vi.fn(), onKeyDownHandler: vi.fn() })}</>;
    });

    return {
        ...actual,
        RovingTabIndexProvider: mockSharedRovingTabIndexProvider,
    };
});

const getInjectedGetAction = (): NonNullable<RovingTabIndexProviderProps["getAction"]> => {
    expect(mockSharedRovingTabIndexProvider).toHaveBeenCalled();
    const getAction = (mockSharedRovingTabIndexProvider.mock.calls.at(-1)![0] as RovingTabIndexProviderProps).getAction;
    expect(getAction).toBeDefined();
    return getAction!;
};

describe("RovingTabIndex adapter", () => {
    beforeEach(() => {
        mockSharedRovingTabIndexProvider.mockClear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it.each([
        [KeyBindingAction.ArrowDown, RovingAction.ArrowDown],
        [KeyBindingAction.ArrowUp, RovingAction.ArrowUp],
        [KeyBindingAction.ArrowRight, RovingAction.ArrowRight],
        [KeyBindingAction.ArrowLeft, RovingAction.ArrowLeft],
        [KeyBindingAction.Home, RovingAction.Home],
        [KeyBindingAction.End, RovingAction.End],
        [KeyBindingAction.Tab, RovingAction.Tab],
    ])("maps %s to %s", (accessibilityAction, expectedRovingAction) => {
        const manager = new KeyBindingsManagerModule.KeyBindingsManager();
        vi.spyOn(KeyBindingsManagerModule, "getKeyBindingsManager").mockReturnValue(manager);
        vi.spyOn(manager, "getAccessibilityAction").mockReturnValue(accessibilityAction);

        render(<RovingTabIndexProvider>{() => null}</RovingTabIndexProvider>);

        const getAction = getInjectedGetAction();
        expect(getAction({ key: "irrelevant" } as React.KeyboardEvent)).toBe(expectedRovingAction);
    });

    it("returns undefined when there is no matching accessibility action", () => {
        const manager = new KeyBindingsManagerModule.KeyBindingsManager();
        vi.spyOn(KeyBindingsManagerModule, "getKeyBindingsManager").mockReturnValue(manager);
        vi.spyOn(manager, "getAccessibilityAction").mockReturnValue(undefined);

        render(<RovingTabIndexProvider>{() => null}</RovingTabIndexProvider>);

        const getAction = getInjectedGetAction();
        expect(getAction({ key: "x" } as React.KeyboardEvent)).toBeUndefined();
    });

    it("forwards provider props to shared-components", () => {
        const onKeyDown = vi.fn();

        render(
            <RovingTabIndexProvider handleHomeEnd handleLoop handleUpDown onKeyDown={onKeyDown} scrollIntoView>
                {() => null}
            </RovingTabIndexProvider>,
        );

        const props = mockSharedRovingTabIndexProvider.mock.calls.at(-1)![0] as RovingTabIndexProviderProps;
        expect(props.handleHomeEnd).toBe(true);
        expect(props.handleLoop).toBe(true);
        expect(props.handleUpDown).toBe(true);
        expect(props.onKeyDown).toBe(onKeyDown);
        expect(props.scrollIntoView).toBe(true);
        expect(props.getAction).toEqual(expect.any(Function));
    });
});
