/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ComponentProps } from "react";
import { type MatrixClient, type MatrixEvent, RelationType, type Room } from "matrix-js-sdk/src/matrix";
import { type MockedObject } from "jest-mock-vitest-adapter";
import { fireEvent, render, waitFor } from "jest-matrix-react";
import { PushProcessor } from "matrix-js-sdk/src/pushprocessor";
import { LinkedTextContext, setMissingEntryGenerator } from "@element-hq/web-shared-components";

import { getMockClientWithEventEmitter, mkEvent, mkStubRoom } from "../../../../test-utils";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";
import { TextualBodyFactory as TextualBody } from "../../../../../src/components/views/messages/TextualBodyFactory";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import RoomContext from "../../../../../src/contexts/RoomContext";
import { RoomPermalinkCreator } from "../../../../../src/utils/permalinks/Permalinks";
import { LinkedTextConfiguration } from "../../../../../src/Linkify";
import { type MediaEventHelper } from "../../../../../src/utils/MediaEventHelper";
import { getRoomContext } from "../../../../test-utils/room";

jest.mock("../../../../../src/hooks/useMediaVisible", () => ({
    __esModule: true,
    useMediaVisible: () => [true, jest.fn()],
}));

// Only the URL-preview-bundle feature flag is mocked; every other setting is
// resolved through the real `useSettingValue` implementation. The value is held
// in a mutable variable so individual tests can flip the feature on and off.
// The `mock` prefix is required for jest to allow the factory to reference it.
let mockUrlPreviewBundleEnabled = true;
jest.mock("../../../../../src/hooks/useSettings", () => {
    const actual = jest.requireActual("../../../../../src/hooks/useSettings");
    return {
        ...actual,
        useSettingValue: (name: string, ...args: unknown[]) =>
            name === "feature_msc4095_url_preview_bundle"
                ? mockUrlPreviewBundleEnabled
                : (actual.useSettingValue as (...a: unknown[]) => unknown)(name, ...args),
    };
});

const ROOM_ID = "!room1:example.com";
const CURRENT_USER = "@user:example.com";
const OTHER_USER = "@someone-else:example.com";

const BUNDLE_ONE = {
    "matched_url": "https://example.org/1",
    "og:title": "Bundled one",
    "og:description": "First bundled preview",
    "og:url": "https://example.org/1",
};
const BUNDLE_TWO = {
    "matched_url": "https://example.org/2",
    "og:title": "Bundled two",
    "og:description": "Second bundled preview",
    "og:url": "https://example.org/2",
};

interface MkBundledMessageOpts {
    sender?: string;
    bundles?: object[];
}

const mkBundledMessage = ({ sender = CURRENT_USER, bundles = [BUNDLE_ONE] }: MkBundledMessageOpts = {}): MatrixEvent =>
    mkEvent({
        type: "m.room.message",
        room: ROOM_ID,
        user: sender,
        content: {
            "body": "Visit https://example.org/1",
            "msgtype": "m.text",
            "com.beeper.linkpreviews": bundles,
        },
        event: true,
    });

describe("<TextualBodyFactory /> allowRemoveUrlPreview", () => {
    let room: Room;
    let matrixClient: MockedObject<MatrixClient>;

    const defaultProps: ComponentProps<typeof TextualBody> = {
        mxEvent: mkBundledMessage(),
        highlights: [] as string[],
        highlightLink: "",
        onMessageAllowed: jest.fn(),
        mediaEventHelper: {} as MediaEventHelper,
        showUrlPreview: true,
    };

    beforeEach(() => {
        mockUrlPreviewBundleEnabled = true;
        setMissingEntryGenerator((key) => key.split("|", 2)[1]);

        matrixClient = getMockClientWithEventEmitter({
            getRoom: (roomId: string | undefined) => (roomId === ROOM_ID ? room : null),
            getRooms: () => [room],
            getAccountData: (): MatrixEvent | undefined => undefined,
            isGuest: () => false,
            mxcUrlToHttp: (s: string) => s,
            getUserId: () => CURRENT_USER,
            getUrlPreview: () => new Promise(() => {}),
            sendMessage: jest.fn().mockResolvedValue({ event_id: "$edit:example.com" }),
            fetchRoomEvent: () => {
                throw new Error("MockClient event not found");
            },
        });
        // @ts-expect-error simplified test stub
        matrixClient.pushProcessor = new PushProcessor(matrixClient);

        room = mkStubRoom(ROOM_ID, "test room", matrixClient);
        DMRoomMap.makeShared(matrixClient);
    });

    const getComponent = (props = {}) => {
        const mergedProps = { ...defaultProps, ...props };
        const finalProps = {
            ...mergedProps,
            permalinkCreator: new RoomPermalinkCreator(room),
        };
        return render(
            <LinkedTextContext.Provider value={LinkedTextConfiguration}>
                <MatrixClientContext.Provider value={matrixClient}>
                    <RoomContext.Provider value={getRoomContext(room, {})}>
                        <TextualBody {...finalProps} />
                    </RoomContext.Provider>
                </MatrixClientContext.Provider>
            </LinkedTextContext.Provider>,
        );
    };

    it("renders a per-preview remove button when the current user sent a bundled preview", async () => {
        const { container } = getComponent({ mxEvent: mkBundledMessage() });

        // The bundled preview is rendered...
        expect(await waitFor(() => container.querySelector('[class*="removePreview"]'))).toBeInTheDocument();
        // ...and the remove button is present because allowRemoveUrlPreview is true.
        expect(container.querySelectorAll('[class*="removePreview"]')).toHaveLength(1);
    });

    it("edits the message to strip the clicked preview from the bundle", async () => {
        const ev = mkBundledMessage();
        const { container } = getComponent({ mxEvent: ev });

        const removeButton = await waitFor(() => {
            const button = container.querySelector('[class*="removePreview"]');
            expect(button).toBeInTheDocument();
            return button!;
        });

        fireEvent.click(removeButton);

        expect(matrixClient.sendMessage).toHaveBeenCalledWith(
            ROOM_ID,
            expect.objectContaining({
                "body": "* Visit https://example.org/1",
                "m.new_content": expect.objectContaining({
                    "com.beeper.linkpreviews": [],
                }),
                "m.relates_to": {
                    rel_type: RelationType.Replace,
                    event_id: ev.getId(),
                },
            }),
        );
    });

    it("only removes the preview whose remove button was clicked", async () => {
        const ev = mkBundledMessage({ bundles: [BUNDLE_ONE, BUNDLE_TWO] });
        const { container } = getComponent({ mxEvent: ev });

        const removeButtons = await waitFor(() => {
            const buttons = container.querySelectorAll('[class*="removePreview"]');
            expect(buttons).toHaveLength(2);
            return buttons;
        });

        // Remove the second preview.
        fireEvent.click(removeButtons[1]);

        expect(matrixClient.sendMessage).toHaveBeenCalledWith(
            ROOM_ID,
            expect.objectContaining({
                "m.new_content": expect.objectContaining({
                    "com.beeper.linkpreviews": [BUNDLE_ONE],
                }),
            }),
        );
    });

    it("sends the edit into the thread when the event is threaded", async () => {
        const ev = mkBundledMessage();
        jest.spyOn(ev, "threadRootId", "get").mockReturnValue("$threadroot:example.com");

        const { container } = getComponent({ mxEvent: ev });

        const removeButton = await waitFor(() => {
            const button = container.querySelector('[class*="removePreview"]');
            expect(button).toBeInTheDocument();
            return button!;
        });

        fireEvent.click(removeButton);

        expect(matrixClient.sendMessage).toHaveBeenCalledWith(
            ROOM_ID,
            "$threadroot:example.com",
            expect.objectContaining({
                "m.relates_to": {
                    rel_type: RelationType.Replace,
                    event_id: ev.getId(),
                },
            }),
        );
    });

    it("does not render a remove button when the event was sent by another user", async () => {
        const { container } = getComponent({ mxEvent: mkBundledMessage({ sender: OTHER_USER }) });

        // The preview itself still renders...
        await waitFor(() => expect(container.querySelector(".mx_TextualBody_urlPreviews")).toBeInTheDocument());
        // ...but no per-preview remove button is shown.
        expect(container.querySelector('[class*="removePreview"]')).toBeNull();
    });

    it("does not render a remove button when the URL preview bundle feature is disabled", async () => {
        mockUrlPreviewBundleEnabled = false;

        const { container } = getComponent({ mxEvent: mkBundledMessage() });

        // Give the view model a chance to (not) produce previews.
        await waitFor(() => expect(matrixClient.getRoom(ROOM_ID)).toBeTruthy());
        expect(container.querySelector('[class*="removePreview"]')).toBeNull();
    });
});
