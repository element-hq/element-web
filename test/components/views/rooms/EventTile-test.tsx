/*
Copyright 2022 - 2023 The Matrix.org Foundation C.I.C.

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

import * as React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { mocked } from "jest-mock";
import {
    CryptoApi,
    EventType,
    IEventDecryptionResult,
    MatrixClient,
    MatrixEvent,
    NotificationCountType,
    PendingEventOrdering,
    Room,
    TweakName,
} from "matrix-js-sdk/src/matrix";
import { EventEncryptionInfo, EventShieldColour, EventShieldReason } from "matrix-js-sdk/src/crypto-api";
import { TooltipProvider } from "@vector-im/compound-web";

import EventTile, { EventTileProps } from "../../../../src/components/views/rooms/EventTile";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import RoomContext, { TimelineRenderingType } from "../../../../src/contexts/RoomContext";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import {
    filterConsole,
    flushPromises,
    getRoomContext,
    mkEncryptedEvent,
    mkEvent,
    mkMessage,
    stubClient,
} from "../../../test-utils";
import { mkThread } from "../../../test-utils/threads";
import DMRoomMap from "../../../../src/utils/DMRoomMap";
import dis from "../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../src/dispatcher/actions";
import { IRoomState } from "../../../../src/components/structures/RoomView";

describe("EventTile", () => {
    const ROOM_ID = "!roomId:example.org";
    let mxEvent: MatrixEvent;
    let room: Room;
    let client: MatrixClient;

    // let changeEvent: (event: MatrixEvent) => void;

    /** wrap the EventTile up in context providers, and with basic properties, as it would be by MessagePanel normally. */
    function WrappedEventTile(props: {
        roomContext: IRoomState;
        eventTilePropertyOverrides?: Partial<EventTileProps>;
    }) {
        return (
            <MatrixClientContext.Provider value={client}>
                <RoomContext.Provider value={props.roomContext}>
                    <TooltipProvider>
                        <EventTile
                            mxEvent={mxEvent}
                            replacingEventId={mxEvent.replacingEventId()}
                            {...(props.eventTilePropertyOverrides ?? {})}
                        />
                    </TooltipProvider>
                </RoomContext.Provider>
            </MatrixClientContext.Provider>
        );
    }

    function getComponent(
        overrides: Partial<EventTileProps> = {},
        renderingType: TimelineRenderingType = TimelineRenderingType.Room,
    ) {
        const context = getRoomContext(room, {
            timelineRenderingType: renderingType,
        });
        return render(<WrappedEventTile roomContext={context} eventTilePropertyOverrides={overrides} />);
    }

    beforeEach(() => {
        jest.clearAllMocks();

        stubClient();
        client = MatrixClientPeg.safeGet();

        room = new Room(ROOM_ID, client, client.getSafeUserId(), {
            pendingEventOrdering: PendingEventOrdering.Detached,
            timelineSupport: true,
        });

        jest.spyOn(client, "getRoom").mockReturnValue(room);
        jest.spyOn(client, "decryptEventIfNeeded").mockResolvedValue();

        mxEvent = mkMessage({
            room: room.roomId,
            user: "@alice:example.org",
            msg: "Hello world!",
            event: true,
        });
    });

    describe("EventTile thread summary", () => {
        beforeEach(() => {
            jest.spyOn(client, "supportsThreads").mockReturnValue(true);
        });

        it("removes the thread summary when thread is deleted", async () => {
            const {
                rootEvent,
                events: [, reply],
            } = mkThread({
                room,
                client,
                authorId: "@alice:example.org",
                participantUserIds: ["@alice:example.org"],
                length: 2, // root + 1 answer
            });
            getComponent(
                {
                    mxEvent: rootEvent,
                },
                TimelineRenderingType.Room,
            );

            await waitFor(() => expect(screen.queryByTestId("thread-summary")).not.toBeNull());

            const redaction = mkEvent({
                event: true,
                type: EventType.RoomRedaction,
                user: "@alice:example.org",
                room: room.roomId,
                redacts: reply.getId(),
                content: {},
            });

            act(() => room.processThreadedEvents([redaction], false));

            await waitFor(() => expect(screen.queryByTestId("thread-summary")).toBeNull());
        });
    });

    describe("EventTile renderingType: ThreadsList", () => {
        it("shows an unread notification badge", () => {
            const { container } = getComponent({}, TimelineRenderingType.ThreadsList);

            // By default, the thread will assume it is read.
            expect(container.getElementsByClassName("mx_NotificationBadge")).toHaveLength(0);

            act(() => {
                room.setThreadUnreadNotificationCount(mxEvent.getId()!, NotificationCountType.Total, 3);
            });

            expect(container.getElementsByClassName("mx_NotificationBadge")).toHaveLength(1);
            expect(container.getElementsByClassName("mx_NotificationBadge_level_highlight")).toHaveLength(0);

            act(() => {
                room.setThreadUnreadNotificationCount(mxEvent.getId()!, NotificationCountType.Highlight, 1);
            });

            expect(container.getElementsByClassName("mx_NotificationBadge")).toHaveLength(1);
            expect(container.getElementsByClassName("mx_NotificationBadge_level_highlight")).toHaveLength(1);
        });
    });

    describe("EventTile in the right panel", () => {
        beforeAll(() => {
            const dmRoomMap: DMRoomMap = {
                getUserIdForRoomId: jest.fn(),
            } as unknown as DMRoomMap;
            DMRoomMap.setShared(dmRoomMap);
        });

        it("renders the room name for notifications", () => {
            const { container } = getComponent({}, TimelineRenderingType.Notification);
            expect(container.getElementsByClassName("mx_EventTile_details")[0]).toHaveTextContent(
                "@alice:example.org in !roomId:example.org",
            );
        });

        it("renders the sender for the thread list", () => {
            const { container } = getComponent({}, TimelineRenderingType.ThreadsList);
            expect(container.getElementsByClassName("mx_EventTile_details")[0]).toHaveTextContent("@alice:example.org");
        });

        it.each([
            [TimelineRenderingType.Notification, Action.ViewRoom],
            [TimelineRenderingType.ThreadsList, Action.ShowThread],
        ])("type %s dispatches %s", (renderingType, action) => {
            jest.spyOn(dis, "dispatch");

            const { container } = getComponent({}, renderingType);

            fireEvent.click(container.querySelector("li")!);

            expect(dis.dispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    action,
                }),
            );
        });
    });
    describe("Event verification", () => {
        // data for our stubbed getEncryptionInfoForEvent: a map from event id to result
        const eventToEncryptionInfoMap = new Map<string, EventEncryptionInfo>();

        beforeEach(() => {
            eventToEncryptionInfoMap.clear();

            const mockCrypto = {
                // a mocked version of getEncryptionInfoForEvent which will pick its result from `eventToEncryptionInfoMap`
                getEncryptionInfoForEvent: async (event: MatrixEvent) => eventToEncryptionInfoMap.get(event.getId()!)!,
            } as unknown as CryptoApi;
            client.getCrypto = () => mockCrypto;
        });

        it("shows a warning for an event from an unverified device", async () => {
            mxEvent = await mkEncryptedEvent({
                plainContent: { msgtype: "m.text", body: "msg1" },
                plainType: "m.room.message",
                user: "@alice:example.org",
                room: room.roomId,
            });
            eventToEncryptionInfoMap.set(mxEvent.getId()!, {
                shieldColour: EventShieldColour.RED,
                shieldReason: EventShieldReason.UNSIGNED_DEVICE,
            } as EventEncryptionInfo);

            const { container } = getComponent();
            await act(flushPromises);

            const eventTiles = container.getElementsByClassName("mx_EventTile");
            expect(eventTiles).toHaveLength(1);

            // there should be a warning shield
            expect(container.getElementsByClassName("mx_EventTile_e2eIcon")).toHaveLength(1);
            expect(container.getElementsByClassName("mx_EventTile_e2eIcon")[0].classList).toContain(
                "mx_EventTile_e2eIcon_warning",
            );
        });

        it("shows no shield for a verified event", async () => {
            mxEvent = await mkEncryptedEvent({
                plainContent: { msgtype: "m.text", body: "msg1" },
                plainType: "m.room.message",
                user: "@alice:example.org",
                room: room.roomId,
            });
            eventToEncryptionInfoMap.set(mxEvent.getId()!, {
                shieldColour: EventShieldColour.NONE,
                shieldReason: null,
            } as EventEncryptionInfo);

            const { container } = getComponent();
            await act(flushPromises);

            const eventTiles = container.getElementsByClassName("mx_EventTile");
            expect(eventTiles).toHaveLength(1);

            // there should be no warning
            expect(container.getElementsByClassName("mx_EventTile_e2eIcon")).toHaveLength(0);
        });

        it.each([
            [EventShieldReason.UNKNOWN, "Unknown error"],
            [EventShieldReason.UNVERIFIED_IDENTITY, "unverified user"],
            [EventShieldReason.UNSIGNED_DEVICE, "device not verified by its owner"],
            [EventShieldReason.UNKNOWN_DEVICE, "unknown or deleted device"],
            [EventShieldReason.AUTHENTICITY_NOT_GUARANTEED, "can't be guaranteed"],
            [EventShieldReason.MISMATCHED_SENDER_KEY, "Encrypted by an unverified session"],
        ])("shows the correct reason code for %i (%s)", async (reasonCode: EventShieldReason, expectedText: string) => {
            mxEvent = await mkEncryptedEvent({
                plainContent: { msgtype: "m.text", body: "msg1" },
                plainType: "m.room.message",
                user: "@alice:example.org",
                room: room.roomId,
            });
            eventToEncryptionInfoMap.set(mxEvent.getId()!, {
                shieldColour: EventShieldColour.GREY,
                shieldReason: reasonCode,
            } as EventEncryptionInfo);

            const { container } = getComponent();
            await act(flushPromises);

            const e2eIcons = container.getElementsByClassName("mx_EventTile_e2eIcon");
            expect(e2eIcons).toHaveLength(1);
            expect(e2eIcons[0].classList).toContain("mx_EventTile_e2eIcon_normal");
            fireEvent.focus(e2eIcons[0]);
            expect(e2eIcons[0].getAttribute("aria-describedby")).toBeTruthy();
            expect(document.getElementById(e2eIcons[0].getAttribute("aria-describedby")!)).toHaveTextContent(
                expectedText,
            );
        });

        describe("undecryptable event", () => {
            filterConsole("Error decrypting event");

            it("shows an undecryptable warning", async () => {
                mxEvent = mkEvent({
                    type: "m.room.encrypted",
                    room: room.roomId,
                    user: "@alice:example.org",
                    event: true,
                    content: {},
                });

                const mockCrypto = {
                    decryptEvent: async (_ev): Promise<IEventDecryptionResult> => {
                        throw new Error("can't decrypt");
                    },
                } as Parameters<MatrixEvent["attemptDecryption"]>[0];
                await mxEvent.attemptDecryption(mockCrypto);

                const { container } = getComponent();
                await act(flushPromises);

                const eventTiles = container.getElementsByClassName("mx_EventTile");
                expect(eventTiles).toHaveLength(1);

                expect(container.getElementsByClassName("mx_EventTile_e2eIcon")).toHaveLength(1);
                expect(container.getElementsByClassName("mx_EventTile_e2eIcon")[0].classList).toContain(
                    "mx_EventTile_e2eIcon_decryption_failure",
                );
            });
        });

        it("should update the warning when the event is edited", async () => {
            // we start out with an event from the trusted device
            mxEvent = await mkEncryptedEvent({
                plainContent: { msgtype: "m.text", body: "msg1" },
                plainType: "m.room.message",
                user: "@alice:example.org",
                room: room.roomId,
            });
            eventToEncryptionInfoMap.set(mxEvent.getId()!, {
                shieldColour: EventShieldColour.NONE,
                shieldReason: null,
            } as EventEncryptionInfo);

            const roomContext = getRoomContext(room, {});
            const { container, rerender } = render(<WrappedEventTile roomContext={roomContext} />);

            await act(flushPromises);

            const eventTiles = container.getElementsByClassName("mx_EventTile");
            expect(eventTiles).toHaveLength(1);

            // there should be no warning
            expect(container.getElementsByClassName("mx_EventTile_e2eIcon")).toHaveLength(0);

            // then we replace the event with one from the unverified device
            const replacementEvent = await mkEncryptedEvent({
                plainContent: { msgtype: "m.text", body: "msg1" },
                plainType: "m.room.message",
                user: "@alice:example.org",
                room: room.roomId,
            });
            eventToEncryptionInfoMap.set(replacementEvent.getId()!, {
                shieldColour: EventShieldColour.RED,
                shieldReason: EventShieldReason.UNSIGNED_DEVICE,
            } as EventEncryptionInfo);

            await act(async () => {
                mxEvent.makeReplaced(replacementEvent);
                rerender(<WrappedEventTile roomContext={roomContext} />);
                await flushPromises;
            });

            // check it was updated
            expect(container.getElementsByClassName("mx_EventTile_e2eIcon")).toHaveLength(1);
            expect(container.getElementsByClassName("mx_EventTile_e2eIcon")[0].classList).toContain(
                "mx_EventTile_e2eIcon_warning",
            );
        });

        it("should update the warning when the event is replaced with an unencrypted one", async () => {
            jest.spyOn(client, "isRoomEncrypted").mockReturnValue(true);

            // we start out with an event from the trusted device
            mxEvent = await mkEncryptedEvent({
                plainContent: { msgtype: "m.text", body: "msg1" },
                plainType: "m.room.message",
                user: "@alice:example.org",
                room: room.roomId,
            });

            eventToEncryptionInfoMap.set(mxEvent.getId()!, {
                shieldColour: EventShieldColour.NONE,
                shieldReason: null,
            } as EventEncryptionInfo);

            const roomContext = getRoomContext(room, {});
            const { container, rerender } = render(<WrappedEventTile roomContext={roomContext} />);
            await act(flushPromises);

            const eventTiles = container.getElementsByClassName("mx_EventTile");
            expect(eventTiles).toHaveLength(1);

            // there should be no warning
            expect(container.getElementsByClassName("mx_EventTile_e2eIcon")).toHaveLength(0);

            // then we replace the event with an unencrypted one
            const replacementEvent = await mkMessage({
                msg: "msg2",
                user: "@alice:example.org",
                room: room.roomId,
                event: true,
            });

            await act(async () => {
                mxEvent.makeReplaced(replacementEvent);
                rerender(<WrappedEventTile roomContext={roomContext} />);
                await flushPromises;
            });

            // check it was updated
            expect(container.getElementsByClassName("mx_EventTile_e2eIcon")).toHaveLength(1);
            expect(container.getElementsByClassName("mx_EventTile_e2eIcon")[0].classList).toContain(
                "mx_EventTile_e2eIcon_warning",
            );
        });
    });

    describe("event highlighting", () => {
        const isHighlighted = (container: HTMLElement): boolean =>
            !!container.getElementsByClassName("mx_EventTile_highlight").length;

        beforeEach(() => {
            mocked(client.getPushActionsForEvent).mockReturnValue(null);
        });

        it("does not highlight message where message matches no push actions", () => {
            const { container } = getComponent();

            expect(client.getPushActionsForEvent).toHaveBeenCalledWith(mxEvent);
            expect(isHighlighted(container)).toBeFalsy();
        });

        it(`does not highlight when message's push actions does not have a highlight tweak`, () => {
            mocked(client.getPushActionsForEvent).mockReturnValue({ notify: true, tweaks: {} });
            const { container } = getComponent();

            expect(isHighlighted(container)).toBeFalsy();
        });

        it(`highlights when message's push actions have a highlight tweak`, () => {
            mocked(client.getPushActionsForEvent).mockReturnValue({
                notify: true,
                tweaks: { [TweakName.Highlight]: true },
            });
            const { container } = getComponent();

            expect(isHighlighted(container)).toBeTruthy();
        });

        describe("when a message has been edited", () => {
            let editingEvent: MatrixEvent;

            beforeEach(() => {
                editingEvent = new MatrixEvent({
                    type: "m.room.message",
                    room_id: ROOM_ID,
                    sender: "@alice:example.org",
                    content: {
                        "msgtype": "m.text",
                        "body": "* edited body",
                        "m.new_content": {
                            msgtype: "m.text",
                            body: "edited body",
                        },
                        "m.relates_to": {
                            rel_type: "m.replace",
                            event_id: mxEvent.getId(),
                        },
                    },
                });
                mxEvent.makeReplaced(editingEvent);
            });

            it("does not highlight message where no version of message matches any push actions", () => {
                const { container } = getComponent();

                // get push actions for both events
                expect(client.getPushActionsForEvent).toHaveBeenCalledWith(mxEvent);
                expect(client.getPushActionsForEvent).toHaveBeenCalledWith(editingEvent);
                expect(isHighlighted(container)).toBeFalsy();
            });

            it(`does not highlight when no version of message's push actions have a highlight tweak`, () => {
                mocked(client.getPushActionsForEvent).mockReturnValue({ notify: true, tweaks: {} });
                const { container } = getComponent();

                expect(isHighlighted(container)).toBeFalsy();
            });

            it(`highlights when previous version of message's push actions have a highlight tweak`, () => {
                mocked(client.getPushActionsForEvent).mockImplementation((event: MatrixEvent) => {
                    if (event === mxEvent) {
                        return { notify: true, tweaks: { [TweakName.Highlight]: true } };
                    }
                    return { notify: false, tweaks: {} };
                });
                const { container } = getComponent();

                expect(isHighlighted(container)).toBeTruthy();
            });

            it(`highlights when new version of message's push actions have a highlight tweak`, () => {
                mocked(client.getPushActionsForEvent).mockImplementation((event: MatrixEvent) => {
                    if (event === editingEvent) {
                        return { notify: true, tweaks: { [TweakName.Highlight]: true } };
                    }
                    return { notify: false, tweaks: {} };
                });
                const { container } = getComponent();

                expect(isHighlighted(container)).toBeTruthy();
            });
        });
    });
});
