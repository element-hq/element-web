/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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
import { mocked, Mocked } from "jest-mock";
import { render, screen, act } from "@testing-library/react";
import { PendingEventOrdering } from "matrix-js-sdk/src/client";
import { Room } from "matrix-js-sdk/src/models/room";
import { RoomStateEvent } from "matrix-js-sdk/src/models/room-state";
import { RoomType } from "matrix-js-sdk/src/@types/event";

import type { MatrixClient } from "matrix-js-sdk/src/client";
import type { RoomMember } from "matrix-js-sdk/src/models/room-member";
import { stubClient, wrapInMatrixClientContext, mkRoomMember } from "../../../test-utils";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import DMRoomMap from "../../../../src/utils/DMRoomMap";
import SettingsStore from "../../../../src/settings/SettingsStore";
import _RoomPreviewCard from "../../../../src/components/views/rooms/RoomPreviewCard";

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
        jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName) =>
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
        jest.spyOn(room, "getMyMembership").mockReturnValue("invite");
        enabledFeatures = ["feature_video_rooms"];

        await renderPreview();
        screen.getByRole("button", { name: /beta/i });
    });

    it("shows a beta pill on Element video room invites", async () => {
        jest.spyOn(room, "getType").mockReturnValue(RoomType.UnstableCall);
        jest.spyOn(room, "getMyMembership").mockReturnValue("invite");
        enabledFeatures = ["feature_video_rooms", "feature_element_call_video_rooms"];

        await renderPreview();
        screen.getByRole("button", { name: /beta/i });
    });

    it("doesn't show a beta pill on normal invites", async () => {
        jest.spyOn(room, "getMyMembership").mockReturnValue("invite");

        await renderPreview();
        expect(screen.queryByRole("button", { name: /beta/i })).toBeNull();
    });

    it("shows instructions on Jitsi video rooms invites if video rooms are disabled", async () => {
        jest.spyOn(room, "getType").mockReturnValue(RoomType.ElementVideo);
        jest.spyOn(room, "getMyMembership").mockReturnValue("invite");

        await renderPreview();
        screen.getByText(/enable video rooms in labs/i);
    });

    it("shows instructions on Element video rooms invites if video rooms are disabled", async () => {
        jest.spyOn(room, "getType").mockReturnValue(RoomType.UnstableCall);
        jest.spyOn(room, "getMyMembership").mockReturnValue("invite");
        enabledFeatures = ["feature_element_call_video_rooms"];

        await renderPreview();
        screen.getByText(/enable video rooms in labs/i);
    });
});
