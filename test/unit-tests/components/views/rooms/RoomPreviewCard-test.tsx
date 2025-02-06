/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { mocked, type Mocked } from "jest-mock";
import { render, screen, act } from "jest-matrix-react";
import { PendingEventOrdering, Room, RoomStateEvent, RoomType } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import type { MatrixClient, RoomMember } from "matrix-js-sdk/src/matrix";
import { stubClient, wrapInMatrixClientContext, mkRoomMember } from "../../../../test-utils";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import _RoomPreviewCard from "../../../../../src/components/views/rooms/RoomPreviewCard";

const RoomPreviewCard = wrapInMatrixClientContext(_RoomPreviewCard);

describe("RoomPreviewCard", () => {
    let client: Mocked<MatrixClient>;
    let room: Room;
    let alice: RoomMember;
    let enabledFeatures: string[];

    beforeEach(() => {
        stubClient();
        client = mocked(MatrixClientPeg.safeGet());
        client.getUserId.mockReturnValue("@alice:example.org");
        DMRoomMap.makeShared(client);

        room = new Room("!1:example.org", client, "@alice:example.org", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
        alice = mkRoomMember(room.roomId, "@alice:example.org");
        jest.spyOn(room, "getMember").mockImplementation((userId) => (userId === alice.userId ? alice : null));

        client.getRoom.mockImplementation((roomId) => (roomId === room.roomId ? room : null));
        client.getRooms.mockReturnValue([room]);
        client.reEmitter.reEmit(room, [RoomStateEvent.Events]);

        enabledFeatures = [];
        jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName): any =>
            enabledFeatures.includes(settingName) ? true : undefined,
        );
    });

    afterEach(() => {
        client.reEmitter.stopReEmitting(room, [RoomStateEvent.Events]);
        jest.restoreAllMocks();
    });

    const renderPreview = async (): Promise<void> => {
        render(<RoomPreviewCard room={room} onJoinButtonClicked={() => {}} onRejectButtonClicked={() => {}} />);
        await act(() => Promise.resolve()); // Allow effects to settle
    };

    it("shows a beta pill on Jitsi video room invites", async () => {
        jest.spyOn(room, "getType").mockReturnValue(RoomType.ElementVideo);
        jest.spyOn(room, "getMyMembership").mockReturnValue(KnownMembership.Invite);
        enabledFeatures = ["feature_video_rooms"];

        await renderPreview();
        screen.getByRole("button", { name: /beta/i });
    });

    it("shows a beta pill on Element video room invites", async () => {
        jest.spyOn(room, "getType").mockReturnValue(RoomType.UnstableCall);
        jest.spyOn(room, "getMyMembership").mockReturnValue(KnownMembership.Invite);
        enabledFeatures = ["feature_video_rooms", "feature_element_call_video_rooms"];

        await renderPreview();
        screen.getByRole("button", { name: /beta/i });
    });

    it("doesn't show a beta pill on normal invites", async () => {
        jest.spyOn(room, "getMyMembership").mockReturnValue(KnownMembership.Invite);

        await renderPreview();
        expect(screen.queryByRole("button", { name: /beta/i })).toBeNull();
    });
});
