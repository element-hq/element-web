/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type MatrixClient, MatrixEvent, Room, RoomMember } from "matrix-js-sdk/src/matrix";
import { render, screen, act } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import { waitFor } from "@testing-library/dom";

import SettingsStore from "../../../../../src/settings/SettingsStore";
import { ShareDialog } from "../../../../../src/components/views/dialogs/ShareDialog";
import { UIFeature } from "../../../../../src/settings/UIFeature";
import { stubClient, withClientContextRenderOptions } from "../../../../test-utils";
import * as StringsModule from "../../../../../src/utils/strings";
import { RoomPermalinkCreator } from "../../../../../src/utils/permalinks/Permalinks.ts";

describe("ShareDialog", () => {
    let client: MatrixClient;
    let room: Room;
    const copyTextFunc = jest.fn();

    beforeEach(async () => {
        client = stubClient();
        room = new Room("!1:example.org", client, "@alice:example.org");
        jest.spyOn(StringsModule, "copyPlaintext").mockImplementation(copyTextFunc);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        copyTextFunc.mockClear();
    });

    function renderComponent(target: Room | RoomMember | URL) {
        return render(<ShareDialog target={target} onFinished={jest.fn()} />, withClientContextRenderOptions(client));
    }

    const getUrl = () => new URL("https://matrix.org/");
    const getRoomMember = () => new RoomMember(room.roomId, "@alice:example.org");

    test.each([
        { name: "an URL", title: "Share Link", url: "https://matrix.org/", getTarget: getUrl },
        {
            name: "a room member",
            title: "Share User",
            url: "https://matrix.to/#/@alice:example.org",
            getTarget: getRoomMember,
        },
    ])("should render a share dialog for $name", async ({ title, url, getTarget }) => {
        const { asFragment } = renderComponent(getTarget());

        expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
        expect(screen.getByText(url)).toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();

        await userEvent.click(screen.getByRole("button", { name: "Copy link" }));
        expect(copyTextFunc).toHaveBeenCalledWith(url);
    });

    it("should render a share dialog for a room", async () => {
        const expectedURL = "https://matrix.to/#/!1:example.org";
        jest.spyOn(room.getLiveTimeline(), "getEvents").mockReturnValue([new MatrixEvent({ event_id: "!eventId" })]);

        const { asFragment } = renderComponent(room);
        expect(screen.getByRole("heading", { name: "Share Room" })).toBeInTheDocument();
        expect(screen.getByText(expectedURL)).toBeInTheDocument();
        expect(screen.getByRole("checkbox", { name: "Link to most recent message" })).toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();

        await userEvent.click(screen.getByRole("button", { name: "Copy link" }));
        expect(copyTextFunc).toHaveBeenCalledWith(expectedURL);

        // Click on the checkbox to link to the most recent message
        await userEvent.click(screen.getByRole("checkbox", { name: "Link to most recent message" }));
        const newExpectedURL = "https://matrix.to/#/!1:example.org/!eventId";
        expect(screen.getByText(newExpectedURL)).toBeInTheDocument();
    });

    it("should render a share dialog for a matrix event", async () => {
        const matrixEvent = new MatrixEvent({ event_id: "!eventId" });
        const permalinkCreator = new RoomPermalinkCreator(room);
        const expectedURL = "https://matrix.to/#/!1:example.org/!eventId";

        const { asFragment } = render(
            <ShareDialog target={matrixEvent} permalinkCreator={permalinkCreator} onFinished={jest.fn()} />,
            withClientContextRenderOptions(client),
        );
        expect(screen.getByRole("heading", { name: "Share Room Message" })).toBeInTheDocument();
        expect(screen.getByText(expectedURL)).toBeInTheDocument();
        expect(screen.getByRole("checkbox", { name: "Link to selected message" })).toBeChecked();
        expect(asFragment()).toMatchSnapshot();

        await userEvent.click(screen.getByRole("button", { name: "Copy link" }));
        expect(copyTextFunc).toHaveBeenCalledWith(expectedURL);

        // Click on the checkbox to link to the room
        await userEvent.click(screen.getByRole("checkbox", { name: "Link to selected message" }));
        expect(screen.getByText("https://matrix.to/#/!1:example.org")).toBeInTheDocument();
    });

    it("should change the copy button text when clicked", async () => {
        jest.useFakeTimers();
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
        // To not be bother with rtl warnings about QR code state update
        jest.spyOn(SettingsStore, "getValue").mockReturnValue(false);

        renderComponent(room);
        await user.click(screen.getByRole("button", { name: "Copy link" }));
        // Move after `copyPlaintext`
        await jest.advanceTimersToNextTimerAsync();
        expect(screen.getByRole("button", { name: "Link copied" })).toBeInTheDocument();

        // 2 sec after the button should be back to normal
        act(() => jest.advanceTimersByTime(2000));
        await waitFor(() => expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument());
    });

    it("should not render the QR code if disabled", () => {
        const originalGetValue = SettingsStore.getValue;
        jest.spyOn(SettingsStore, "getValue").mockImplementation((feature) => {
            if (feature === UIFeature.ShareQRCode) return false;
            return originalGetValue(feature);
        });

        const { asFragment } = renderComponent(room);
        expect(screen.queryByRole("img", { name: "QR code" })).toBeNull();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should not render the socials if disabled", () => {
        const originalGetValue = SettingsStore.getValue;
        jest.spyOn(SettingsStore, "getValue").mockImplementation((feature) => {
            if (feature === UIFeature.ShareSocial) return false;
            return originalGetValue(feature);
        });

        const { asFragment } = renderComponent(room);
        expect(screen.queryByRole("link", { name: "Reddit" })).toBeNull();
        expect(asFragment()).toMatchSnapshot();
    });
});
