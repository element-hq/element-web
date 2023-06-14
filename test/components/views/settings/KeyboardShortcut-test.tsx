/*
Copyright 2022 Šimon Brandner <simon.bra.ag@gmail.com>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from "react";
import { render } from "@testing-library/react";

import { Key } from "../../../../src/Keyboard";
import { mockPlatformPeg, unmockPlatformPeg } from "../../../test-utils/platform";
import { KeyboardKey, KeyboardShortcut } from "../../../../src/components/views/settings/KeyboardShortcut";

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
