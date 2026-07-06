/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { vi, describe, it, test, expect, beforeEach } from "vitest";
import { EventTimeline, EventType, type IEvent, type MatrixClient, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";

import { createTestClient } from "../../test/test-utils";
import PinningUtils from "./PinningUtils";
import SettingsStore from "../settings/SettingsStore";
import { isContentActionable } from "./EventUtils";
import { ReadPinsEventId } from "../components/views/right_panel/types";

vi.mock("./EventUtils", () => {
    return {
        isContentActionable: vi.fn(),
        canPinEvent: vi.fn(),
    };
});

describe("PinningUtils", () => {
    const roomId = "!room:example.org";
    const userId = "@alice:example.org";

    const mockedIsContentActionable = vi.mocked(isContentActionable);

    let matrixClient: MatrixClient;
    let room: Room;

    /**
     * Create a pinned event with the given content.
     * @param content
     */
    function makePinEvent(content?: Partial<IEvent>) {
        return new MatrixEvent({
            type: EventType.RoomMessage,
            sender: userId,
            content: {
                body: "First pinned message",
                msgtype: "m.text",
            },
            room_id: roomId,
            origin_server_ts: 0,
            event_id: "$eventId",
            ...content,
        });
    }

    beforeEach(() => {
        // Enable feature pinning
        vi.spyOn(SettingsStore, "getValue").mockReturnValue(true);
        mockedIsContentActionable.mockImplementation(() => true);

        matrixClient = createTestClient();
        room = new Room(roomId, matrixClient, userId);
        matrixClient.getRoom = vi.fn().mockReturnValue(room);

        vi.spyOn(
            matrixClient.getRoom(roomId)!.getLiveTimeline().getState(EventTimeline.FORWARDS)!,
            "mayClientSendStateEvent",
        ).mockReturnValue(true);
    });

    describe("isUnpinnable", () => {
        test.each(PinningUtils.PINNABLE_EVENT_TYPES)("should return true for pinnable event types", (eventType) => {
            const event = makePinEvent({ type: eventType });
            expect(PinningUtils.isUnpinnable(event)).toBe(true);
        });

        test("should return false for a non pinnable event type", () => {
            const event = makePinEvent({ type: EventType.RoomCreate });
            expect(PinningUtils.isUnpinnable(event)).toBe(false);
        });

        test("should return true for a redacted event", () => {
            const event = makePinEvent({ unsigned: { redacted_because: "because" as unknown as IEvent } });
            expect(PinningUtils.isUnpinnable(event)).toBe(true);
        });
    });

    describe("isPinnable", () => {
        test.each(PinningUtils.PINNABLE_EVENT_TYPES)("should return true for pinnable event types", (eventType) => {
            const event = makePinEvent({ type: eventType });
            expect(PinningUtils.isPinnable(event)).toBe(true);
        });

        test("should return false for a redacted event", () => {
            const event = makePinEvent({ unsigned: { redacted_because: "because" as unknown as IEvent } });
            expect(PinningUtils.isPinnable(event)).toBe(false);
        });
    });

    describe("isPinned", () => {
        test("should return false if no room", () => {
            matrixClient.getRoom = vi.fn().mockReturnValue(undefined);
            const event = makePinEvent();

            expect(PinningUtils.isPinned(matrixClient, event)).toBe(false);
        });

        test("should return false if no pinned event", () => {
            vi.spyOn(
                matrixClient.getRoom(roomId)!.getLiveTimeline().getState(EventTimeline.FORWARDS)!,
                "getStateEvents",
            ).mockReturnValue(null);

            const event = makePinEvent();
            expect(PinningUtils.isPinned(matrixClient, event)).toBe(false);
        });

        test("should return false if pinned events do not contain the event id", () => {
            vi.spyOn(
                matrixClient.getRoom(roomId)!.getLiveTimeline().getState(EventTimeline.FORWARDS)!,
                "getStateEvents",
            ).mockReturnValue({
                // @ts-ignore
                getContent: () => ({ pinned: ["$otherEventId"] }),
            });

            const event = makePinEvent();
            expect(PinningUtils.isPinned(matrixClient, event)).toBe(false);
        });

        test("should return true if pinned events contains the event id", () => {
            const event = makePinEvent();
            vi.spyOn(
                matrixClient.getRoom(roomId)!.getLiveTimeline().getState(EventTimeline.FORWARDS)!,
                "getStateEvents",
            ).mockReturnValue({
                // @ts-ignore
                getContent: () => ({ pinned: [event.getId()] }),
            });

            expect(PinningUtils.isPinned(matrixClient, event)).toBe(true);
        });
    });

    describe("canPin & canUnpin", () => {
        describe("canPin", () => {
            test("should return false if event is not actionable", () => {
                mockedIsContentActionable.mockImplementation(() => false);
                const event = makePinEvent();

                expect(PinningUtils.canPin(matrixClient, event)).toBe(false);
            });

            test("should return false if no room", () => {
                matrixClient.getRoom = vi.fn().mockReturnValue(undefined);
                const event = makePinEvent();

                expect(PinningUtils.canPin(matrixClient, event)).toBe(false);
            });

            test("should return false if client cannot send state event", () => {
                vi.spyOn(
                    matrixClient.getRoom(roomId)!.getLiveTimeline().getState(EventTimeline.FORWARDS)!,
                    "mayClientSendStateEvent",
                ).mockReturnValue(false);
                const event = makePinEvent();

                expect(PinningUtils.canPin(matrixClient, event)).toBe(false);
            });

            test("should return false if event is not pinnable", () => {
                const event = makePinEvent({ type: EventType.RoomCreate });

                expect(PinningUtils.canPin(matrixClient, event)).toBe(false);
            });

            test("should return true if all conditions are met", () => {
                const event = makePinEvent();

                expect(PinningUtils.canPin(matrixClient, event)).toBe(true);
            });
        });

        describe("canUnpin", () => {
            test("should return false if event is not unpinnable", () => {
                const event = makePinEvent({ type: EventType.RoomCreate });

                expect(PinningUtils.canUnpin(matrixClient, event)).toBe(false);
            });

            test("should return true if all conditions are met", () => {
                const event = makePinEvent();

                expect(PinningUtils.canUnpin(matrixClient, event)).toBe(true);
            });

            test("should return true if the event is redacted", () => {
                const event = makePinEvent({ unsigned: { redacted_because: "because" as unknown as IEvent } });

                expect(PinningUtils.canUnpin(matrixClient, event)).toBe(true);
            });
        });
    });

    describe("pinOrUnpinEvent", () => {
        test("should do nothing if no room", async () => {
            matrixClient.getRoom = vi.fn().mockReturnValue(undefined);
            const event = makePinEvent();

            await PinningUtils.pinOrUnpinEvent(matrixClient, event);
            expect(matrixClient.sendStateEvent).not.toHaveBeenCalled();
        });

        test("should do nothing if no event id", async () => {
            const event = makePinEvent({ event_id: undefined });

            await PinningUtils.pinOrUnpinEvent(matrixClient, event);
            expect(matrixClient.sendStateEvent).not.toHaveBeenCalled();
        });

        test("should pin the event if not pinned", async () => {
            vi.spyOn(
                matrixClient.getRoom(roomId)!.getLiveTimeline().getState(EventTimeline.FORWARDS)!,
                "getStateEvents",
            ).mockReturnValue({
                // @ts-ignore
                getContent: () => ({ pinned: ["$otherEventId"] }),
            });

            vi.spyOn(room, "getAccountData").mockReturnValue({
                getContent: vi.fn().mockReturnValue({
                    event_ids: ["$otherEventId"],
                }),
            } as unknown as MatrixEvent);

            const event = makePinEvent();
            await PinningUtils.pinOrUnpinEvent(matrixClient, event);

            expect(matrixClient.setRoomAccountData).toHaveBeenCalledWith(roomId, ReadPinsEventId, {
                event_ids: ["$otherEventId", event.getId()],
            });
            expect(matrixClient.sendStateEvent).toHaveBeenCalledWith(
                roomId,
                EventType.RoomPinnedEvents,
                { pinned: ["$otherEventId", event.getId()] },
                "",
            );
        });

        test("should unpin the event if already pinned", async () => {
            const event = makePinEvent();

            vi.spyOn(
                matrixClient.getRoom(roomId)!.getLiveTimeline().getState(EventTimeline.FORWARDS)!,
                "getStateEvents",
            ).mockReturnValue({
                // @ts-ignore
                getContent: () => ({ pinned: [event.getId(), "$otherEventId"] }),
            });

            await PinningUtils.pinOrUnpinEvent(matrixClient, event);
            expect(matrixClient.sendStateEvent).toHaveBeenCalledWith(
                roomId,
                EventType.RoomPinnedEvents,
                { pinned: ["$otherEventId"] },
                "",
            );
        });
    });

    describe("userHasPinOrUnpinPermission", () => {
        test("should return true if user can pin or unpin", () => {
            expect(PinningUtils.userHasPinOrUnpinPermission(matrixClient, room)).toBe(true);
        });

        test("should return false if client cannot send state event", () => {
            vi.spyOn(
                matrixClient.getRoom(roomId)!.getLiveTimeline().getState(EventTimeline.FORWARDS)!,
                "mayClientSendStateEvent",
            ).mockReturnValue(false);

            expect(PinningUtils.userHasPinOrUnpinPermission(matrixClient, room)).toBe(false);
        });
    });

    describe("unpinAllEvents", () => {
        it("should unpin all events in the given room", async () => {
            await PinningUtils.unpinAllEvents(matrixClient, roomId);

            expect(matrixClient.sendStateEvent).toHaveBeenCalledWith(
                roomId,
                EventType.RoomPinnedEvents,
                { pinned: [] },
                "",
            );
        });
    });
});
