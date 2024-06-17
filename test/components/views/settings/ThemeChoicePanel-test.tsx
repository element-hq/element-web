/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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
import { render, screen } from "@testing-library/react";

import * as TestUtils from "../../../test-utils";
import ThemeChoicePanel from "../../../../src/components/views/settings/ThemeChoicePanel";
import SettingsStore from "../../../../src/settings/SettingsStore";
import { UIFeature } from "../../../../src/settings/UIFeature";

describe("ThemeChoicePanel", () => {
    it("renders the theme choice UI", () => {
        TestUtils.stubClient();
        const { asFragment } = render(<ThemeChoicePanel />);
        expect(asFragment()).toMatchSnapshot();
    });
    it("does renders custom theme choice URL when feature is on", () => {
        jest.spyOn(SettingsStore, "getValue").mockImplementation((name: string) => {
            if (name == UIFeature.CustomThemePanel) return true;
            return true;
        });
        TestUtils.stubClient();
        render(<ThemeChoicePanel />);
        expect(screen.queryByText("Custom theme URL")).toBeInTheDocument();
    });
    it("does not render custom theme choice URL when feature is off", () => {
        jest.spyOn(SettingsStore, "getValue").mockImplementation((name: string) => {
            if (name == UIFeature.CustomThemePanel) return false;
            return true;
        });
        TestUtils.stubClient();
        render(<ThemeChoicePanel />);
        expect(screen.queryByText("Custom theme URL")).toBeNull();
    });
});
