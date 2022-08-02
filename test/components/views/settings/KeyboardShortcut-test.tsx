
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
// eslint-disable-next-line deprecate/import
import { mount, ReactWrapper } from "enzyme";

import { Key } from "../../../../src/Keyboard";
import { mockPlatformPeg, unmockPlatformPeg } from "../../../test-utils/platform";

const PATH_TO_COMPONENT = "../../../../src/components/views/settings/KeyboardShortcut.tsx";

const renderKeyboardShortcut = async (component, props?): Promise<ReactWrapper> => {
    const Component = (await import(PATH_TO_COMPONENT))[component];
    return mount(<Component {...props} />);
};

describe("KeyboardShortcut", () => {
    beforeEach(() => {
        jest.resetModules();
        unmockPlatformPeg();
    });

    it("renders key icon", async () => {
        const body = await renderKeyboardShortcut("KeyboardKey", { name: Key.ARROW_DOWN });
        expect(body).toMatchSnapshot();
    });

    it("renders alternative key name", async () => {
        const body = await renderKeyboardShortcut("KeyboardKey", { name: Key.PAGE_DOWN });
        expect(body).toMatchSnapshot();
    });

    it("doesn't render + if last", async () => {
        const body = await renderKeyboardShortcut("KeyboardKey", { name: Key.A, last: true });
        expect(body).toMatchSnapshot();
    });

    it("doesn't render same modifier twice", async () => {
        mockPlatformPeg({ overrideBrowserShortcuts: jest.fn().mockReturnValue(false) });
        const body1 = await renderKeyboardShortcut("KeyboardShortcut", {
            value: {
                key: Key.A,
                ctrlOrCmdKey: true,
                metaKey: true,
            },
        });
        expect(body1).toMatchSnapshot();

        const body2 = await renderKeyboardShortcut("KeyboardShortcut", {
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
