/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { act, renderHook, waitFor } from "jest-matrix-react";
import { JoinRule, type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";

import { useMediaVisible } from "../../../src/hooks/useMediaVisible";
import { createTestClient, mkStubRoom, withClientContextRenderOptions } from "../../test-utils";
import { type MediaPreviewConfig, MediaPreviewValue } from "../../../src/@types/media_preview";
import MediaPreviewConfigController from "../../../src/settings/controllers/MediaPreviewConfigController";
import SettingsStore from "../../../src/settings/SettingsStore";

const EVENT_ID = "$fibble:example.org";
const ROOM_ID = "!foobar:example.org";

describe("useMediaVisible", () => {
    let matrixClient: MatrixClient;
    let room: Room;
    const mediaPreviewConfig: MediaPreviewConfig = MediaPreviewConfigController.default;

    function render() {
        return renderHook(() => useMediaVisible(EVENT_ID, ROOM_ID), withClientContextRenderOptions(matrixClient));
    }
    beforeEach(() => {
        matrixClient = createTestClient();
        room = mkStubRoom(ROOM_ID, undefined, matrixClient);
        matrixClient.getRoom = jest.fn().mockReturnValue(room);
        const origFn = SettingsStore.getValue;
        jest.spyOn(SettingsStore, "getValue").mockImplementation((setting, ...args) => {
            if (setting === "mediaPreviewConfig") {
                return mediaPreviewConfig;
            }
            return origFn(setting, ...args);
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("should display media by default", async () => {
        const { result } = render();
        expect(result.current[0]).toEqual(true);
    });

    it("should hide media when media previews are Off", async () => {
        mediaPreviewConfig.media_previews = MediaPreviewValue.Off;
        const { result } = render();
        expect(result.current[0]).toEqual(false);
    });

    it.each([[JoinRule.Invite], [JoinRule.Knock], [JoinRule.Restricted]])(
        "should display media when media previews are Private and the join rule is %s",
        async (rule) => {
            mediaPreviewConfig.media_previews = MediaPreviewValue.Private;
            room.currentState.getJoinRule = jest.fn().mockReturnValue(rule);
            const { result } = render();
            expect(result.current[0]).toEqual(true);
        },
    );

    it.each([[JoinRule.Public], ["anything_else"]])(
        "should hide media when media previews are Private and the join rule is %s",
        async (rule) => {
            mediaPreviewConfig.media_previews = MediaPreviewValue.Private;
            room.currentState.getJoinRule = jest.fn().mockReturnValue(rule);
            const { result } = render();
            expect(result.current[0]).toEqual(false);
        },
    );

    it("should hide media after function is called", async () => {
        const { result } = render();
        expect(result.current[0]).toEqual(true);
        act(() => {
            result.current[1](false);
        });
        await waitFor(() => {
            expect(result.current[0]).toEqual(false);
        });
    });
    it("should show media after function is called", async () => {
        mediaPreviewConfig.media_previews = MediaPreviewValue.Off;
        const { result } = render();
        expect(result.current[0]).toEqual(false);
        act(() => {
            result.current[1](true);
        });
        await waitFor(() => {
            expect(result.current[0]).toEqual(true);
        });
    });
});
