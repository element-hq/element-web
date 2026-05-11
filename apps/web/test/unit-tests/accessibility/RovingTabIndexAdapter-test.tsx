/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";
import { RovingAction, type RovingTabIndexProviderProps } from "@element-hq/web-shared-components";

import * as KeyBindingsManagerModule from "../../../src/KeyBindingsManager";
import { KeyBindingAction } from "../../../src/accessibility/KeyboardShortcuts";
import { RovingTabIndexProvider } from "../../../src/accessibility/RovingTabIndex";

jest.mock("@element-hq/web-shared-components", () => {
    const actual = jest.requireActual("@element-hq/web-shared-components");
    const mockSharedRovingTabIndexProvider = jest.fn(({ children }: RovingTabIndexProviderProps) => {
        return <>{children({ onDragEndHandler: jest.fn(), onKeyDownHandler: jest.fn() })}</>;
    });

    return {
        __mockSharedRovingTabIndexProvider: mockSharedRovingTabIndexProvider,
        ...actual,
        RovingTabIndexProvider: mockSharedRovingTabIndexProvider,
    };
});

const getMockSharedRovingTabIndexProvider = (): jest.Mock => {
    return jest.requireMock("@element-hq/web-shared-components").__mockSharedRovingTabIndexProvider as jest.Mock;
};

const getInjectedGetAction = (): NonNullable<RovingTabIndexProviderProps["getAction"]> => {
    const mockSharedRovingTabIndexProvider = getMockSharedRovingTabIndexProvider();
    expect(mockSharedRovingTabIndexProvider).toHaveBeenCalled();
    const getAction = (mockSharedRovingTabIndexProvider.mock.calls.at(-1)![0] as RovingTabIndexProviderProps).getAction;
    expect(getAction).toBeDefined();
    return getAction!;
};

describe("RovingTabIndex adapter", () => {
    beforeEach(() => {
        const mockSharedRovingTabIndexProvider = getMockSharedRovingTabIndexProvider();
        mockSharedRovingTabIndexProvider.mockClear();
        jest.restoreAllMocks();
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
        jest.spyOn(KeyBindingsManagerModule, "getKeyBindingsManager").mockReturnValue(manager);
        jest.spyOn(manager, "getAccessibilityAction").mockReturnValue(accessibilityAction);

        render(<RovingTabIndexProvider>{() => null}</RovingTabIndexProvider>);

        const getAction = getInjectedGetAction();
        expect(getAction({ key: "irrelevant" } as React.KeyboardEvent)).toBe(expectedRovingAction);
    });

    it("returns undefined when there is no matching accessibility action", () => {
        const manager = new KeyBindingsManagerModule.KeyBindingsManager();
        jest.spyOn(KeyBindingsManagerModule, "getKeyBindingsManager").mockReturnValue(manager);
        jest.spyOn(manager, "getAccessibilityAction").mockReturnValue(undefined);

        render(<RovingTabIndexProvider>{() => null}</RovingTabIndexProvider>);

        const getAction = getInjectedGetAction();
        expect(getAction({ key: "x" } as React.KeyboardEvent)).toBeUndefined();
    });

    it("forwards provider props to shared-components", () => {
        const onKeyDown = jest.fn();

        render(
            <RovingTabIndexProvider handleHomeEnd handleLoop handleUpDown onKeyDown={onKeyDown} scrollIntoView>
                {() => null}
            </RovingTabIndexProvider>,
        );

        const mockSharedRovingTabIndexProvider = getMockSharedRovingTabIndexProvider();
        const props = mockSharedRovingTabIndexProvider.mock.calls.at(-1)![0] as RovingTabIndexProviderProps;
        expect(props.handleHomeEnd).toBe(true);
        expect(props.handleLoop).toBe(true);
        expect(props.handleUpDown).toBe(true);
        expect(props.onKeyDown).toBe(onKeyDown);
        expect(props.scrollIntoView).toBe(true);
        expect(props.getAction).toEqual(expect.any(Function));
    });
});
