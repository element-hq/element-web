/*
Copyright 2024 New Vector Ltd.
Copyright 2021 Robin Townsend <robin@robin.town>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import {
    MatrixEvent,
    EventType,
    LocationAssetType,
    M_ASSET,
    M_LOCATION,
    M_TIMESTAMP,
    M_TEXT,
} from "matrix-js-sdk/src/matrix";
import { act, fireEvent, render, type RenderResult, screen, waitFor } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import { sleep } from "matrix-js-sdk/src/utils";
import {
    getMockClientWithEventEmitter,
    makeBeaconEvent,
    makeLegacyLocationEvent,
    makeLocationEvent,
    mkEvent,
    mkMessage,
    mkStubRoom,
    mockPlatformPeg,
    TestSDKContext,
} from "test-utils";

import { MatrixClientPeg } from "../../../MatrixClientPeg";
import ForwardDialog from "./ForwardDialog";
import DMRoomMap from "../../../utils/DMRoomMap";
import { RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import { TILE_SERVER_WK_KEY } from "../../../utils/WellKnownUtils";
import SettingsStore from "../../../settings/SettingsStore";
import { SDKContext } from "../../../contexts/SDKContext";

vi.mock("maplibre-gl");

vi.mock("../../../stores/OwnProfileStore", () => ({
    OwnProfileStore: {
        instance: {
            on: vi.fn(),
            off: vi.fn(),
            removeListener: vi.fn(),
            displayName: "Bob",
            avatarMxc: null,
            getHttpAvatarUrl: vi.fn().mockReturnValue(null),
        },
    },
}));

describe("ForwardDialog", () => {
    const sourceRoom = "!111111111111111111:example.org";
    const aliceId = "@alice:example.org";
    const defaultMessage = mkMessage({
        room: sourceRoom,
        user: aliceId,
        msg: "Hello world!",
        event: true,
    });
    const accountDataEvent = new MatrixEvent({
        type: EventType.Direct,
        sender: aliceId,
        content: {},
    });
    const mockClient = getMockClientWithEventEmitter({
        getUserId: vi.fn().mockReturnValue(aliceId),
        getSafeUserId: vi.fn().mockReturnValue(aliceId),
        isGuest: vi.fn().mockReturnValue(false),
        getVisibleRooms: vi.fn().mockReturnValue([]),
        getRoom: vi.fn(),
        getAccountData: vi.fn().mockReturnValue(accountDataEvent),
        getPushActionsForEvent: vi.fn(),
        mxcUrlToHttp: vi.fn().mockReturnValue(""),
        decryptEventIfNeeded: vi.fn(),
        sendEvent: vi.fn(),
        getClientWellKnown: vi.fn().mockReturnValue({
            [TILE_SERVER_WK_KEY.name]: { map_style_url: "maps.com" },
        }),
    });
    const defaultRooms = ["a", "A", "b"].map((name) => mkStubRoom(name, name, mockClient));

    const sdkContext = new TestSDKContext();
    sdkContext._client = mockClient;

    const mountForwardDialog = (message = defaultMessage, rooms = defaultRooms, stubSource = false) => {
        mockClient.getVisibleRooms.mockReturnValue(rooms);

        const sourceRoomStub = mkStubRoom(sourceRoom, sourceRoom, mockClient);

        mockClient.getRoom.mockImplementation((roomId) => {
            if (stubSource && roomId === sourceRoom) {
                return sourceRoomStub; // Return the source room stub, if enabled
            }
            return rooms.find((room) => room.roomId === roomId) || null;
        });

        const wrapper: RenderResult = render(
            <ForwardDialog
                event={message}
                permalinkCreator={new RoomPermalinkCreator(undefined!, sourceRoom)}
                onFinished={vi.fn()}
            />,
            {
                wrapper: ({ children }) => <SDKContext.Provider value={sdkContext}>{children}</SDKContext.Provider>,
            },
        );

        return wrapper;
    };

    const getSendButtons = (): HTMLButtonElement[] =>
        screen.getAllByRole("option").map((row) => row.querySelector<HTMLButtonElement>("button")!);

    beforeEach(() => {
        DMRoomMap.makeShared(mockClient);
        vi.clearAllMocks();
        mockClient.getUserId.mockReturnValue("@bob:example.org");
        mockClient.getSafeUserId.mockReturnValue("@bob:example.org");
        mockClient.sendEvent.mockReset();
    });

    afterAll(() => {
        vi.spyOn(MatrixClientPeg, "get").mockRestore();
    });

    it("shows a preview with us as the sender", async () => {
        const { container } = mountForwardDialog();

        expect(screen.queryByText("Hello world!")).toBeInTheDocument();

        // We would just test SenderProfile for the user ID, but it's stubbed
        const previewAvatar = container.querySelector('[data-testid="event-tile-slot-avatar"] .mx_BaseAvatar');
        expect(previewAvatar?.getAttribute("title")).toBe("@bob:example.org");
    });

    it("filters the rooms", async () => {
        mountForwardDialog();

        expect(screen.getAllByRole("option")).toHaveLength(3);

        await userEvent.type(screen.getByRole("searchbox"), "a");

        expect(screen.getAllByRole("option")).toHaveLength(2);
    });

    it("should be navigable using the keyboard", async () => {
        mountForwardDialog();

        const searchBox = screen.getByRole("searchbox");
        searchBox.focus();

        await userEvent.keyboard("[ArrowDown]");
        await waitFor(() => expect(screen.getAllByRole("option")[0]).toHaveFocus());

        await userEvent.keyboard("[ArrowDown]");
        await waitFor(() => expect(screen.getAllByRole("option")[1]).toHaveFocus());

        await userEvent.keyboard("[ArrowUp]");
        await waitFor(() => expect(screen.getAllByRole("option")[0]).toHaveFocus());

        await userEvent.tab();
        expect(getSendButtons()[0]).toHaveFocus();

        await userEvent.keyboard("[Enter]");
        expect(mockClient.sendEvent).toHaveBeenCalledWith("a", "m.room.message", {
            "body": "Hello world!",
            "msgtype": "m.text",
            "m.mentions": {},
        });
    });

    it("tracks message sending progress across multiple rooms", async () => {
        mockPlatformPeg();
        mountForwardDialog();

        // Make sendEvent require manual resolution so we can see the sending state
        let finishSend: (arg?: any) => void;
        let cancelSend: () => void;
        mockClient.sendEvent.mockImplementation(
            <T extends {}>() =>
                new Promise<T>((resolve, reject) => {
                    finishSend = resolve;
                    cancelSend = reject;
                }),
        );

        const stateOf = (index: number) => getSendButtons()[index].getAttribute("data-send-state");

        expect(stateOf(0)).toBe("can_send");

        act(() => {
            fireEvent.click(getSendButtons()[0]);
        });
        expect(stateOf(0)).toBe("sending");

        await act(async () => {
            cancelSend();
            // Wait one tick for the button to realize the send failed
            await sleep(0);
        });
        expect(stateOf(0)).toBe("failed");

        expect(stateOf(1)).toBe("can_send");

        act(() => {
            fireEvent.click(getSendButtons()[1]);
        });
        expect(stateOf(1)).toBe("sending");

        await act(async () => {
            finishSend();
            // Wait one tick for the button to realize the send succeeded
            await sleep(0);
        });
        expect(stateOf(1)).toBe("sent");
    });

    it("can render replies", async () => {
        const replyMessage = mkEvent({
            type: "m.room.message",
            room: "!111111111111111111:example.org",
            user: "@alice:example.org",
            content: {
                "msgtype": "m.text",
                "body": "> <@bob:example.org> Hi Alice!\n\nHi Bob!",
                "m.relates_to": {
                    "m.in_reply_to": {
                        event_id: "$2222222222222222222222222222222222222222222",
                    },
                },
            },
            event: true,
        });

        mountForwardDialog(replyMessage);

        expect(screen.queryByText("Hi Alice!", { exact: false })).toBeInTheDocument();
    });

    it("disables buttons for rooms without send permissions", async () => {
        const readOnlyRoom = mkStubRoom("a", "a", mockClient);
        readOnlyRoom.maySendMessage = vi.fn().mockReturnValue(false);
        const rooms = [readOnlyRoom, mkStubRoom("b", "b", mockClient)];

        mountForwardDialog(undefined, rooms);

        const [firstButton, secondButton] = getSendButtons();

        expect(firstButton).toHaveAttribute("aria-disabled", "true");
        expect(secondButton).not.toHaveAttribute("aria-disabled", "true");
    });

    describe("Mention recalculation", () => {
        const roomId = "a";
        const sendClick = (): void =>
            act(() => {
                fireEvent.click(getSendButtons()[0]);
            });
        const makeMessage = (body: string, mentions: object, formattedBody?: string) => {
            return mkEvent({
                type: "m.room.message",
                room: sourceRoom,
                user: "@bob:example.org",
                content: {
                    "msgtype": "m.text",
                    "body": body,
                    "m.mentions": mentions,
                    ...(formattedBody && {
                        format: "org.matrix.custom.html",
                        formatted_body: formattedBody,
                    }),
                },
                event: true,
            });
        };

        it("strips extra mentions", async () => {
            const message = makeMessage("Hi Alice", { user_ids: [aliceId] });
            mountForwardDialog(message);
            sendClick();
            // Expected content should have mentions empty.
            expect(mockClient.sendEvent).toHaveBeenCalledWith(roomId, message.getType(), {
                ...message.getContent(),
                "m.mentions": {},
            });
        });

        it("recalculates mention pills", async () => {
            const message = makeMessage(
                "Hi Alice",
                { user_ids: [aliceId] },
                `Hi <a href="https://matrix.to/#/${aliceId}">Alice</a>`,
            );
            mountForwardDialog(message, defaultRooms, true);
            sendClick();
            // Expected content should have mentions empty.
            expect(mockClient.sendEvent).toHaveBeenCalledWith(roomId, message.getType(), {
                ...message.getContent(),
                "m.mentions": { user_ids: [aliceId] },
            });
        });
    });

    describe("Location events", () => {
        // 14.03.2022 16:15
        const now = 1647270879403;
        const roomId = "a";
        const geoUri = "geo:51.5076,-0.1276";
        const legacyLocationEvent = makeLegacyLocationEvent(geoUri);
        const modernLocationEvent = makeLocationEvent(geoUri);
        const pinDropLocationEvent = makeLocationEvent(geoUri, LocationAssetType.Pin);

        beforeEach(() => {
            // legacy events will default timestamp to Date.now()
            // mock a stable now for easy assertion
            vi.spyOn(Date, "now").mockReturnValue(now);
        });

        afterAll(() => {
            vi.spyOn(Date, "now").mockRestore();
        });

        const sendToFirstRoom = (): void =>
            act(() => {
                fireEvent.click(getSendButtons()[0]);
            });

        it("converts legacy location events to pin drop shares", async () => {
            const { container } = mountForwardDialog(legacyLocationEvent);

            await waitFor(() => expect(container.querySelector(".mx_MLocationBody")).toBeTruthy());
            sendToFirstRoom();

            // text and description from original event are removed
            // text gets new default message from event values
            // timestamp is defaulted to now
            const text = `Location ${geoUri} at ${new Date(now).toISOString()}`;
            const expectedStrippedContent = {
                ...modernLocationEvent.getContent(),
                body: text,
                [M_TEXT.name]: text,
                [M_TIMESTAMP.name]: now,
                [M_ASSET.name]: { type: LocationAssetType.Pin },
                [M_LOCATION.name]: {
                    uri: geoUri,
                },
            };
            expect(mockClient.sendEvent).toHaveBeenCalledWith(
                roomId,
                legacyLocationEvent.getType(),
                expectedStrippedContent,
            );
        });

        it("removes personal information from static self location shares", async () => {
            const { container } = mountForwardDialog(modernLocationEvent);

            await waitFor(() => expect(container.querySelector(".mx_MLocationBody")).toBeTruthy());
            sendToFirstRoom();

            const timestamp = M_TIMESTAMP.findIn<number>(modernLocationEvent.getContent())!;
            // text and description from original event are removed
            // text gets new default message from event values
            const text = `Location ${geoUri} at ${new Date(timestamp).toISOString()}`;
            const expectedStrippedContent = {
                ...modernLocationEvent.getContent(),
                body: text,
                [M_TEXT.name]: text,
                [M_ASSET.name]: { type: LocationAssetType.Pin },
                [M_LOCATION.name]: {
                    uri: geoUri,
                },
            };
            expect(mockClient.sendEvent).toHaveBeenCalledWith(
                roomId,
                modernLocationEvent.getType(),
                expectedStrippedContent,
            );
        });

        it("forwards beacon location as a pin drop event", async () => {
            const timestamp = 123456;
            const beaconEvent = makeBeaconEvent("@alice:server.org", { geoUri, timestamp });
            const text = `Location ${geoUri} at ${new Date(timestamp).toISOString()}`;
            const expectedContent = {
                msgtype: "m.location",
                body: text,
                [M_TEXT.name]: text,
                [M_ASSET.name]: { type: LocationAssetType.Pin },
                [M_LOCATION.name]: {
                    uri: geoUri,
                },
                geo_uri: geoUri,
                [M_TIMESTAMP.name]: timestamp,
            };
            const { container } = mountForwardDialog(beaconEvent);

            await waitFor(() => expect(container.querySelector(".mx_MLocationBody")).toBeTruthy());

            sendToFirstRoom();

            expect(mockClient.sendEvent).toHaveBeenCalledWith(roomId, EventType.RoomMessage, expectedContent);
        });

        it("forwards pin drop event", async () => {
            const { container } = mountForwardDialog(pinDropLocationEvent);

            await waitFor(() => expect(container.querySelector(".mx_MLocationBody")).toBeTruthy());

            sendToFirstRoom();

            const expectedContent = {
                ...pinDropLocationEvent.getContent(),
                "m.mentions": {}, // Add mentions (explicitly set to empty)
            };

            expect(mockClient.sendEvent).toHaveBeenCalledWith(roomId, pinDropLocationEvent.getType(), expectedContent);
        });
    });

    describe("If the feature_dynamic_room_predecessors is not enabled", () => {
        beforeEach(() => {
            vi.spyOn(SettingsStore, "getValue").mockReturnValue(false);
        });

        it("Passes through the dynamic predecessor setting", async () => {
            mockClient.getVisibleRooms.mockClear();
            mountForwardDialog();
            expect(mockClient.getVisibleRooms).toHaveBeenCalledWith(false);
        });
    });

    describe("If the feature_dynamic_room_predecessors is enabled", () => {
        beforeEach(() => {
            // Turn on feature_dynamic_room_predecessors setting
            vi.spyOn(SettingsStore, "getValue").mockImplementation(
                (settingName) => settingName === "feature_dynamic_room_predecessors",
            );
        });

        it("Passes through the dynamic predecessor setting", async () => {
            mockClient.getVisibleRooms.mockClear();
            mountForwardDialog();
            expect(mockClient.getVisibleRooms).toHaveBeenCalledWith(true);
        });
    });
});
