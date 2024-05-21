/*
Copyright 2024 The Matrix.org Foundation C.I.C.

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
import userEvent from "@testing-library/user-event";

import DesktopCapturerSourcePicker from "../../../../src/components/views/elements/DesktopCapturerSourcePicker";
import PlatformPeg from "../../../../src/PlatformPeg";
import BasePlatform from "../../../../src/BasePlatform";

const SOURCES = [
    {
        id: "screen1",
        name: "Screen 1",
        thumbnailURL: "data:image/png;base64,",
    },
    {
        id: "window1",
        name: "Window 1",
        thumbnailURL: "data:image/png;base64,",
    },
];

describe("DesktopCapturerSourcePicker", () => {
    beforeEach(() => {
        const plaf = {
            getDesktopCapturerSources: jest.fn().mockResolvedValue(SOURCES),
            supportsSetting: jest.fn().mockReturnValue(false),
        };
        jest.spyOn(PlatformPeg, "get").mockReturnValue(plaf as unknown as BasePlatform);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("should render the component", () => {
        render(<DesktopCapturerSourcePicker onFinished={() => {}} />);
        expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
    });

    it("should disable share button until a source is selected", () => {
        render(<DesktopCapturerSourcePicker onFinished={() => {}} />);
        expect(screen.getByRole("button", { name: "Share" })).toBeDisabled();
    });

    it("should contain a screen source in the default tab", async () => {
        render(<DesktopCapturerSourcePicker onFinished={() => {}} />);

        const screen1Button = await screen.findByRole("button", { name: "Screen 1" });

        expect(screen1Button).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Window 1" })).not.toBeInTheDocument();
    });

    it("should contain a window source in the window tab", async () => {
        render(<DesktopCapturerSourcePicker onFinished={() => {}} />);

        await userEvent.click(screen.getByRole("tab", { name: "Application window" }));

        const window1Button = await screen.findByRole("button", { name: "Window 1" });

        expect(window1Button).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Screen 1" })).not.toBeInTheDocument();
    });

    it("should call onFinished with no arguments if cancelled", async () => {
        const onFinished = jest.fn();
        render(<DesktopCapturerSourcePicker onFinished={onFinished} />);

        await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(onFinished).toHaveBeenCalledWith();
    });

    it("should call onFinished with the selected source when share clicked", async () => {
        const onFinished = jest.fn();
        render(<DesktopCapturerSourcePicker onFinished={onFinished} />);

        const screen1Button = await screen.findByRole("button", { name: "Screen 1" });

        await userEvent.click(screen1Button);
        await userEvent.click(screen.getByRole("button", { name: "Share" }));
        expect(onFinished).toHaveBeenCalledWith(SOURCES[0]);
    });
});
