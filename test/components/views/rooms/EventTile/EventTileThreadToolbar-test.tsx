/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { getByLabelText, render, RenderResult } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { ComponentProps } from "react";

import { EventTileThreadToolbar } from "../../../../../src/components/views/rooms/EventTile/EventTileThreadToolbar";

describe("EventTileThreadToolbar", () => {
    const viewInRoom = jest.fn();
    const copyLink = jest.fn();

    function renderComponent(props: Partial<ComponentProps<typeof EventTileThreadToolbar>> = {}): RenderResult {
        return render(<EventTileThreadToolbar viewInRoom={viewInRoom} copyLinkToThread={copyLink} {...props} />);
    }

    afterEach(() => {
        jest.resetAllMocks();
    });

    it("renders", () => {
        const { asFragment } = renderComponent();
        expect(asFragment()).toMatchSnapshot();
    });

    it("calls the right callbacks", async () => {
        const { container } = renderComponent();

        const copyBtn = getByLabelText(container, "Copy link to thread");
        const viewInRoomBtn = getByLabelText(container, "View in room");

        await userEvent.click(copyBtn);
        expect(copyLink).toHaveBeenCalledTimes(1);

        await userEvent.click(viewInRoomBtn);
        expect(viewInRoom).toHaveBeenCalledTimes(1);
    });
});
