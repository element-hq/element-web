/*
Copyright 2024 New Vector Ltd.
Copyright 2022 Šimon Brandner <simon.bra.ag@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";

import { Key } from "../../../../../src/Keyboard";
import { mockPlatformPeg, unmockPlatformPeg } from "../../../../test-utils/platform";
import { KeyboardKey, KeyboardShortcut } from "../../../../../src/components/views/settings/KeyboardShortcut";

const renderKeyboardShortcut = (Component: React.FunctionComponent<any>, props: Record<string, any>) => {
    return render(<Component {...props} />).container;
};

describe("KeyboardShortcut", () => {
    beforeEach(() => {
        jest.resetModules();
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
        mockPlatformPeg({ overrideBrowserShortcuts: jest.fn().mockReturnValue(false) });
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
        jest.resetModules();
    });
});
