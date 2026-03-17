/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { EventType, MatrixEvent } from "matrix-js-sdk/src/matrix";
import { VideoBodyViewState } from "@element-hq/web-shared-components";

import SettingsStore from "../../../src/settings/SettingsStore";
import { ImageSize } from "../../../src/settings/enums/ImageSize";
import { mediaFromContent } from "../../../src/customisations/Media";
import { VideoBodyViewModel } from "../../../src/viewmodels/message-body/VideoBodyViewModel";

jest.mock("../../../src/customisations/Media", () => ({
    mediaFromContent: jest.fn(),
}));

describe("VideoBodyViewModel", () => {
    const mockedMediaFromContent = jest.mocked(mediaFromContent);
    const videoRef = { current: null };

    const createEvent = (body = "demo video"): MatrixEvent =>
        new MatrixEvent({
            type: EventType.RoomMessage,
            room_id: "!room:server",
            event_id: "$video:server",
            sender: "@alice:server",
            content: {
                msgtype: "m.video",
                body,
                url: "mxc://server/video",
                info: {
                    w: 320,
                    h: 180,
                    mimetype: "video/mp4",
                },
            },
        });

    const createVm = (overrides?: Partial<ConstructorParameters<typeof VideoBodyViewModel>[0]>): VideoBodyViewModel =>
        new VideoBodyViewModel({
            mxEvent: createEvent(),
            mediaVisible: false,
            videoRef,
            ...overrides,
        });

    beforeEach(() => {
        const originalGetValue = SettingsStore.getValue;
        jest.spyOn(SettingsStore, "getValue").mockImplementation((setting, ...args) => {
            if (setting === "Images.size") {
                return ImageSize.Normal;
            }
            if (setting === "autoplayVideo") {
                return false;
            }
            return originalGetValue(setting, ...args);
        });
        jest.spyOn(SettingsStore, "watchSetting").mockReturnValue("video-body-test-watch");
        jest.spyOn(SettingsStore, "unwatchSetting").mockImplementation(jest.fn());

        mockedMediaFromContent.mockReturnValue({
            isEncrypted: false,
            srcHttp: "https://server/video.mp4",
            thumbnailHttp: "https://server/poster.jpg",
            hasThumbnail: true,
        } as ReturnType<typeof mediaFromContent>);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("computes the initial hidden snapshot from props", () => {
        const vm = createVm();

        expect(vm.getSnapshot().state).toBe(VideoBodyViewState.HIDDEN);
        expect(vm.getSnapshot().hiddenButtonLabel).toBeTruthy();
        expect(vm.getSnapshot().maxWidth).toBe(320);
        expect(vm.getSnapshot().maxHeight).toBe(180);
    });

    it("updates to ready when media becomes visible", () => {
        const vm = createVm();

        vm.setMediaVisible(true);

        expect(vm.getSnapshot().state).toBe(VideoBodyViewState.READY);
        expect(vm.getSnapshot().src).toBe("https://server/video.mp4");
        expect(vm.getSnapshot().poster).toBe("https://server/poster.jpg");
    });

    it("updates controls and autoplay flags when interaction is inhibited", () => {
        const vm = createVm({ mediaVisible: true });

        vm.setInhibitInteraction(true);

        expect(vm.getSnapshot().controls).toBe(false);
        expect(vm.getSnapshot().muted).toBe(false);
        expect(vm.getSnapshot().autoPlay).toBe(false);
    });

    it("forwards preview clicks", () => {
        const onPreviewClick = jest.fn();
        const vm = createVm({ onPreviewClick });

        vm.onPreviewClick();

        expect(onPreviewClick).toHaveBeenCalledTimes(1);
    });

    it("does not emit for unchanged targeted setters", () => {
        const event = createEvent();
        const onPreviewClick = jest.fn();
        const vm = createVm({
            mxEvent: event,
            mediaVisible: false,
            onPreviewClick,
        });
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.setEvent(event, undefined);
        vm.setForExport(undefined);
        vm.setInhibitInteraction(undefined);
        vm.setMediaVisible(false);
        vm.setOnPreviewClick(onPreviewClick);

        expect(listener).not.toHaveBeenCalled();
    });
});
