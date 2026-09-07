/*
Copyright 2024, 2025 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach, type Mocked } from "vitest";
import { render, screen, act } from "test-utils-rtl";
import { PendingEventOrdering, Room, RoomStateEvent, RoomType } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import type { MatrixClient, RoomMember } from "matrix-js-sdk/src/matrix";
import { stubClient, wrapInMatrixClientContext, mkRoomMember } from "test-utils";

import { MatrixClientPeg } from "../../../MatrixClientPeg";
import DMRoomMap from "../../../utils/DMRoomMap";
import SettingsStore from "../../../settings/SettingsStore";
import _RoomPreviewCard from "./RoomPreviewCard";

const RoomPreviewCard = wrapInMatrixClientContext(_RoomPreviewCard);

describe("RoomPreviewCard", () => {
    let client: Mocked<MatrixClient>;
    let room: Room;
    let alice: RoomMember;
    let enabledFeatures: string[];

    beforeEach(() => {
        stubClient();
        client = vi.mocked(MatrixClientPeg.safeGet());
        client.getUserId.mockReturnValue("@alice:example.org");
        DMRoomMap.makeShared(client);

        room = new Room("!1:example.org", client, "@alice:example.org", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
        alice = mkRoomMember(room.roomId, "@alice:example.org");
        vi.spyOn(room, "getMember").mockImplementation((userId) => (userId === alice.userId ? alice : null));

        client.getRoom.mockImplementation((roomId) => (roomId === room.roomId ? room : null));
        client.getRooms.mockReturnValue([room]);
        client.reEmitter.reEmit(room, [RoomStateEvent.Events]);

        enabledFeatures = [];
        const origFn = SettingsStore.getValue;
        vi.spyOn(SettingsStore, "getValue").mockImplementation((settingName): any => {
            if (enabledFeatures.includes(settingName)) {
                return true;
            }
            return origFn(settingName);
        });
    });

    afterEach(() => {
        client.reEmitter.stopReEmitting(room, [RoomStateEvent.Events]);
        vi.restoreAllMocks();
    });

    const renderPreview = async (): Promise<void> => {
        render(<RoomPreviewCard room={room} onJoinButtonClicked={() => {}} onRejectButtonClicked={() => {}} />);
        await act(() => Promise.resolve()); // Allow effects to settle
    };

    it("shows a beta pill on Jitsi video room invites", async () => {
        vi.spyOn(room, "getType").mockReturnValue(RoomType.ElementVideo);
        vi.spyOn(room, "getMyMembership").mockReturnValue(KnownMembership.Invite);
        enabledFeatures = ["feature_video_rooms"];

        await renderPreview();
        expect(screen.getByRole("button", { name: /beta/i })).toBeVisible();
    });

    it("shows a beta pill on Element video room invites", async () => {
        vi.spyOn(room, "getType").mockReturnValue(RoomType.UnstableCall);
        vi.spyOn(room, "getMyMembership").mockReturnValue(KnownMembership.Invite);
        enabledFeatures = ["feature_video_rooms", "feature_element_call_video_rooms"];

        await renderPreview();
        expect(screen.getByRole("button", { name: /beta/i })).toBeVisible();
    });

    it("doesn't show a beta pill on normal invites", async () => {
        vi.spyOn(room, "getMyMembership").mockReturnValue(KnownMembership.Invite);

        await renderPreview();
        expect(screen.queryByRole("button", { name: /beta/i })).toBeNull();
    });
});
