/*
Copyright 2026 Artur M. <art0007i@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import React, { act } from "react";
import { fireEvent, render, waitFor, screen } from "jest-matrix-react";
import { Room } from "matrix-js-sdk/src/matrix";

import Stickerpicker from "../../../../../src/components/views/rooms/Stickerpicker";
import {
    clientAndSDKContextRenderOptions,
    flushPromises,
    getMockClientWithEventEmitter,
    mockClientMethodsUser,
} from "../../../../test-utils";
import { TestSdkContext } from "../../../TestSdkContext";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import WidgetUtils from "../../../../../src/utils/WidgetUtils";

describe("Stickerpicker", () => {
    const userId = "@alice:domain.org";
    const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        getAccountData: jest.fn(),
        getRoom: jest.fn(),
        getSyncState: jest.fn().mockReturnValue(null),
        getSyncStateData: jest.fn().mockReturnValue(null),
        getMediaHandler: jest.fn(),
        setPushRuleEnabled: jest.fn(),
        setPushRuleActions: jest.fn(),
        getCrypto: jest.fn().mockReturnValue(undefined),
        setExtendedProfileProperty: jest.fn().mockResolvedValue(undefined),
        deleteExtendedProfileProperty: jest.fn().mockResolvedValue(undefined),
        doesServerSupportExtendedProfiles: jest.fn().mockResolvedValue(true),
    });
    const sdkContext: TestSdkContext = new TestSdkContext();
    const roomId = "#room:example.com";
    const room = new Room(roomId, mockClient, userId);
    const setPickerOpen = jest.fn();

    jest.spyOn(MatrixClientPeg, "safeGet").mockReturnValue(mockClient);
    jest.spyOn(WidgetUtils, "getStickerpickerWidgets").mockReturnValue([
        {
            id: "stickerpicker",
            content: {
                id: "stickerpicker",
                type: "m.stickerpicker",
                url: "example.com",
                name: "Stickerpicker",
                creatorUserId: userId,
                data: {},
            },
            type: "m.widget",
            sender: userId,
            state_key: "stickerpicker",
        },
    ]);

    let stickerPicker: Stickerpicker | null = null;

    const renderStickerPicker = async (): Promise<HTMLElement> => {
        const { container } = render(
            <Stickerpicker
                room={room}
                threadId={null}
                isStickerPickerOpen={true}
                setStickerPickerOpen={setPickerOpen}
                ref={(ref) => {
                    stickerPicker = ref;
                }}
            />,
            clientAndSDKContextRenderOptions(mockClient, sdkContext),
        );
        await flushPromises();
        await waitFor(() => expect(stickerPicker).toBeTruthy());
        return container;
    };

    it("handleResizeStart/Move/End update state and persist to localStorage", async () => {
        window.localStorage.removeItem("mx_stickerpicker_width");
        window.localStorage.removeItem("mx_stickerpicker_height");

        await renderStickerPicker();
        if (stickerPicker == null) throw new Error("Stickerpicker may not be null here.");

        // Default values right after rendering component
        expect(stickerPicker.state.popoverWidth).toBe(300);
        expect(stickerPicker.state.popoverHeight).toBe(300);

        act(() => {
            // @ts-ignore
            stickerPicker.handleResizeStart(100, 100);
            // @ts-ignore
            stickerPicker.handleResizeMove(90, 90);
        });

        expect(stickerPicker.state.popoverWidth).toBe(310);
        expect(stickerPicker.state.popoverHeight).toBe(310);

        act(() => {
            // @ts-ignore
            stickerPicker.handleResizeEnd();
        });

        expect(window.localStorage.getItem("mx_stickerpicker_width")).toBe("310");
        expect(window.localStorage.getItem("mx_stickerpicker_height")).toBe("310");
    });

    it("popoverWidth/Height uses defaults when localStorage values are NaN or too small", async () => {
        window.localStorage.setItem("mx_stickerpicker_width", "not-a-number");
        window.localStorage.setItem("mx_stickerpicker_height", "200"); // below PICKER_MIN_SIZE (250)

        await renderStickerPicker();
        if (stickerPicker == null) throw new Error("Stickerpicker may not be null here.");

        expect(stickerPicker.state.popoverWidth).toBe(300);
        expect(stickerPicker.state.popoverHeight).toBe(300);
    });

    it("onResize closes the picker when open", async () => {
        await renderStickerPicker();
        // @ts-ignore
        stickerPicker.onResize();
        expect(setPickerOpen).toHaveBeenCalledWith(false);
    });

    it("mouse/touch handlers properly resize the sticker picker", async () => {
        window.localStorage.removeItem("mx_stickerpicker_width");
        window.localStorage.removeItem("mx_stickerpicker_height");

        await renderStickerPicker();
        if (stickerPicker == null) throw new Error("Stickerpicker may not be null here.");
        const resizer = screen.getByTestId("Stickers_resizeHandle");

        act(() => {
            fireEvent.mouseDown(resizer, {
                clientX: 100,
                clientY: 100,
            });
            fireEvent.mouseMove(resizer.ownerDocument, {
                clientX: 90,
                clientY: 90,
            });
            fireEvent.mouseUp(resizer.ownerDocument, {
                clientX: 90,
                clientY: 90,
            });
        });
        act(() => {
            fireEvent.touchStart(resizer, {
                touches: [
                    {
                        clientX: 100,
                        clientY: 100,
                    },
                ],
            });
            fireEvent.touchMove(resizer.ownerDocument, {
                touches: [
                    {
                        clientX: 90,
                        clientY: 90,
                    },
                ],
            });
            fireEvent.touchEnd(resizer.ownerDocument, {
                touches: [
                    {
                        clientX: 90,
                        clientY: 90,
                    },
                ],
            });
        });

        // 300 = default, +10 from mouse events, +10 from touch events
        expect(stickerPicker.state.popoverWidth).toBe(320);
        expect(stickerPicker.state.popoverHeight).toBe(320);
    });
});
