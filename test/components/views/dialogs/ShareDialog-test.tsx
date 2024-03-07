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
import { EventTimeline, MatrixEvent, Room, RoomMember } from "matrix-js-sdk/src/matrix";
import { render, RenderOptions } from "@testing-library/react";
import { TooltipProvider } from "@vector-im/compound-web";

import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import SettingsStore from "../../../../src/settings/SettingsStore";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import { _t } from "../../../../src/languageHandler";
import ShareDialog from "../../../../src/components/views/dialogs/ShareDialog";
import { UIFeature } from "../../../../src/settings/UIFeature";
import { stubClient } from "../../../test-utils";
jest.mock("../../../../src/utils/ShieldUtils");

function getWrapper(): RenderOptions {
    return {
        wrapper: ({ children }) => (
            <TooltipProvider>
                <MatrixClientContext.Provider value={MatrixClientPeg.safeGet()}>
                    {children}
                </MatrixClientContext.Provider>
            </TooltipProvider>
        ),
    };
}

describe("ShareDialog", () => {
    let room: Room;

    const ROOM_ID = "!1:example.org";

    beforeEach(async () => {
        stubClient();
        room = new Room(ROOM_ID, MatrixClientPeg.get()!, "@alice:example.org");
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("renders room share dialog", () => {
        const { container: withoutEvents } = render(<ShareDialog target={room} onFinished={jest.fn()} />, getWrapper());
        expect(withoutEvents).toHaveTextContent(_t("share|title_room"));

        jest.spyOn(room, "getLiveTimeline").mockReturnValue({ getEvents: () => [{} as MatrixEvent] } as EventTimeline);
        const { container: withEvents } = render(<ShareDialog target={room} onFinished={jest.fn()} />, getWrapper());
        expect(withEvents).toHaveTextContent(_t("share|permalink_most_recent"));
    });

    it("renders user share dialog", () => {
        mockRoomMembers(room, 1);
        const { container } = render(
            <ShareDialog target={room.getJoinedMembers()[0]} onFinished={jest.fn()} />,
            getWrapper(),
        );
        expect(container).toHaveTextContent(_t("share|title_user"));
    });

    it("renders link share dialog", () => {
        mockRoomMembers(room, 1);
        const { container } = render(
            <ShareDialog target={new URL("https://matrix.org")} onFinished={jest.fn()} />,
            getWrapper(),
        );
        expect(container).toHaveTextContent(_t("share|title_link"));
    });

    it("renders the QR code if configured", () => {
        const originalGetValue = SettingsStore.getValue;
        jest.spyOn(SettingsStore, "getValue").mockImplementation((feature) => {
            if (feature === UIFeature.ShareQRCode) return true;
            return originalGetValue(feature);
        });
        const { container } = render(<ShareDialog target={room} onFinished={jest.fn()} />, getWrapper());
        const qrCodesVisible = container.getElementsByClassName("mx_ShareDialog_qrcode_container").length > 0;
        expect(qrCodesVisible).toBe(true);
    });

    it("renders the social button if configured", () => {
        const originalGetValue = SettingsStore.getValue;
        jest.spyOn(SettingsStore, "getValue").mockImplementation((feature) => {
            if (feature === UIFeature.ShareSocial) return true;
            return originalGetValue(feature);
        });
        const { container } = render(<ShareDialog target={room} onFinished={jest.fn()} />, getWrapper());
        const qrCodesVisible = container.getElementsByClassName("mx_ShareDialog_social_container").length > 0;
        expect(qrCodesVisible).toBe(true);
    });
    it("renders custom title and subtitle", () => {
        const { container } = render(
            <ShareDialog
                target={room}
                customTitle="test_title_123"
                subtitle="custom_subtitle_1234"
                onFinished={jest.fn()}
            />,
            getWrapper(),
        );
        expect(container).toHaveTextContent("test_title_123");
        expect(container).toHaveTextContent("custom_subtitle_1234");
    });
});
/**
 *
 * @param count the number of users to create
 */
function mockRoomMembers(room: Room, count: number) {
    const members = Array(count)
        .fill(0)
        .map((_, index) => new RoomMember(room.roomId, "@alice:example.org"));

    room.currentState.setJoinedMemberCount(members.length);
    room.getJoinedMembers = jest.fn().mockReturnValue(members);
}
