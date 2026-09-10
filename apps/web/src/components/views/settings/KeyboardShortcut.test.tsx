/*
Copyright 2024 New Vector Ltd.
Copyright 2022 Šimon Brandner <simon.bra.ag@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "test-utils-rtl";
import { mockPlatformPeg, unmockPlatformPeg } from "test-utils";

import { Key } from "../../../Keyboard";
import { KeyboardKey, KeyboardShortcut } from "./KeyboardShortcut";

const renderKeyboardShortcut = (Component: React.FunctionComponent<any>, props: Record<string, any>) => {
    return render(<Component {...props} />).container;
};

describe("KeyboardShortcut", () => {
    beforeEach(() => {
        vi.resetModules();
        unmockPlatformPeg();
    });

    it("renders key icon", () => {
        const body = renderKeyboardShortcut(KeyboardKey, { name: Key.ARROW_DOWN });
        expect(body).toMatchSnapshot();
    });

    it("renders alternative key name", () => {
        const body = renderKeyboardShortcut(KeyboardKey, { name: Key.PAGE_DOWN });
        expect(body).toMatchSnapshot();
    });

    it("doesn't render + if last", () => {
        const body = renderKeyboardShortcut(KeyboardKey, { name: Key.A, last: true });
        expect(body).toMatchSnapshot();
    });

    it("doesn't render same modifier twice", () => {
        mockPlatformPeg({ overrideBrowserShortcuts: vi.fn().mockReturnValue(false) });
        const body1 = renderKeyboardShortcut(KeyboardShortcut, {
            value: {
                key: Key.A,
                ctrlOrCmdKey: true,
                metaKey: true,
            },
        });
        expect(body1).toMatchSnapshot();

        const body2 = renderKeyboardShortcut(KeyboardShortcut, {
            value: {
                key: Key.A,
                ctrlOrCmdKey: true,
                ctrlKey: true,
            },
        });
        expect(body2).toMatchSnapshot();
        vi.resetModules();
    });
});
