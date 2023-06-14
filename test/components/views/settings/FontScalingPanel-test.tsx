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
import { fireEvent, render, waitFor } from "@testing-library/react";

import * as TestUtils from "../../../test-utils";
import FontScalingPanel from "../../../../src/components/views/settings/FontScalingPanel";
import SettingsStore from "../../../../src/settings/SettingsStore";

// Fake random strings to give a predictable snapshot
jest.mock("matrix-js-sdk/src/randomstring", () => {
    return {
        randomString: () => "abdefghi",
    };
});

describe("FontScalingPanel", () => {
    it("renders the font scaling UI", () => {
        TestUtils.stubClient();
        const { asFragment } = render(<FontScalingPanel />);
        expect(asFragment()).toMatchSnapshot();
    });

    it("should clamp custom font size when disabling it", async () => {
        jest.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);
        TestUtils.stubClient();
        const { container, getByText } = render(<FontScalingPanel />);
        fireEvent.click(getByText("Use custom size"));
        await waitFor(() => {
            expect(container.querySelector("input[checked]")).toBeDefined();
        });
        fireEvent.change(container.querySelector("#font_size_field")!, { target: { value: "20" } });
        fireEvent.click(getByText("Use custom size"));
        await waitFor(() => {
            expect(container.querySelector("#font_size_field")).toHaveValue(18);
        });
    });
});
