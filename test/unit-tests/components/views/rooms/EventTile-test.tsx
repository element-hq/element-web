/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import * as React from "react";
import { act, fireEvent, render, screen, waitFor } from "jest-matrix-react";
import { mocked } from "jest-mock";
import {
    EventType,
    type IEventDecryptionResult,
    type MatrixClient,
    MatrixEvent,
    NotificationCountType,
    PendingEventOrdering,
    Room,
    TweakName,
} from "matrix-js-sdk/src/matrix";
import {
    type CryptoApi,
    DecryptionFailureCode,
    type EventEncryptionInfo,
    EventShieldColour,
    EventShieldReason,
} from "matrix-js-sdk/src/crypto-api";
import { mkEncryptedMatrixEvent } from "matrix-js-sdk/src/testing";

import EventTile, { type EventTileProps } from "../../../../../src/components/views/rooms/EventTile";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import { TimelineRenderingType } from "../../../../../src/contexts/RoomContext";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import { filterConsole, flushPromises, getRoomContext, mkEvent, mkMessage, stubClient } from "../../../../test-utils";
import { mkThread } from "../../../../test-utils/threads";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";
import dis from "../../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../../src/dispatcher/actions";
import { type IRoomState } from "../../../../../src/components/structures/RoomView";
import PinningUtils from "../../../../../src/utils/PinningUtils";
import { Layout } from "../../../../../src/settings/enums/Layout";
import { ScopedRoomContextProvider } from "../../../../../src/contexts/ScopedRoomContext.tsx";

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
                <ScopedRoomContextProvider {...props.roomContext}>
                    <EventTile
                        mxEvent={mxEvent}
                        replacingEventId={mxEvent.replacingEventId()}
                        {...(props.eventTilePropertyOverrides ?? {})}
                    />
                </ScopedRoomContextProvider>
            </MatrixClientContext.Provider>
        );
    }

    function getComponent(
        overrides: Partial<EventTileProps> = {},
        renderingType: TimelineRenderingType = TimelineRenderingType.Room,
        roomContext: Partial<IRoomState> = {},
    ) {
        const context = getRoomContext(room, {
            timelineRenderingType: renderingType,
            ...roomContext,
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

    afterEach(() => {
        jest.spyOn(PinningUtils, "isPinned").mockReturnValue(false);
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

    describe("EventTile renderingType: Threads", () => {
        it("should display the pinned message badge", async () => {
            jest.spyOn(PinningUtils, "isPinned").mockReturnValue(true);
            getComponent({}, TimelineRenderingType.Thread);

            expect(screen.getByText("Pinned message")).toBeInTheDocument();
        });
    });

    describe("EventTile renderingType: File", () => {
        it("should not display the pinned message badge", async () => {
            jest.spyOn(PinningUtils, "isPinned").mockReturnValue(true);
            getComponent({}, TimelineRenderingType.File);

            expect(screen.queryByText("Pinned message")).not.toBeInTheDocument();
        });
    });

    describe("EventTile renderingType: default", () => {
        it.each([[Layout.Group], [Layout.Bubble], [Layout.IRC]])(
            "should display the pinned message badge",
            async (layout) => {
                jest.spyOn(PinningUtils, "isPinned").mockReturnValue(true);
                getComponent({ layout });

                expect(screen.getByText("Pinned message")).toBeInTheDocument();
            },
        );
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
            mxEvent = await mkEncryptedMatrixEvent({
                plainContent: { msgtype: "m.text", body: "msg1" },
                plainType: "m.room.message",
                sender: "@alice:example.org",
                roomId: room.roomId,
            });
            eventToEncryptionInfoMap.set(mxEvent.getId()!, {
                shieldColour: EventShieldColour.RED,
                shieldReason: EventShieldReason.UNSIGNED_DEVICE,
            } as EventEncryptionInfo);

            const { container } = getComponent();
            await flushPromises();

            const eventTiles = container.getElementsByClassName("mx_EventTile");
            expect(eventTiles).toHaveLength(1);

            // there should be a warning shield
            expect(container.getElementsByClassName("mx_EventTile_e2eIcon")).toHaveLength(1);
            expect(container.getElementsByClassName("mx_EventTile_e2eIcon")[0].classList).toContain(
                "mx_EventTile_e2eIcon_warning",
            );
        });

        it("shows no shield for a verified event", async () => {
            mxEvent = await mkEncryptedMatrixEvent({
                plainContent: { msgtype: "m.text", body: "msg1" },
                plainType: "m.room.message",
                sender: "@alice:example.org",
                roomId: room.roomId,
            });
            eventToEncryptionInfoMap.set(mxEvent.getId()!, {
                shieldColour: EventShieldColour.NONE,
                shieldReason: null,
            } as EventEncryptionInfo);

            const { container } = getComponent();
            await flushPromises();

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
            [EventShieldReason.SENT_IN_CLEAR, "Not encrypted"],
            [EventShieldReason.VERIFICATION_VIOLATION, "Sender's verified identity has changed"],
        ])("shows the correct reason code for %i (%s)", async (reasonCode: EventShieldReason, expectedText: string) => {
            mxEvent = await mkEncryptedMatrixEvent({
                plainContent: { msgtype: "m.text", body: "msg1" },
                plainType: "m.room.message",
                sender: "@alice:example.org",
                roomId: room.roomId,
            });
            eventToEncryptionInfoMap.set(mxEvent.getId()!, {
                shieldColour: EventShieldColour.GREY,
                shieldReason: reasonCode,
            } as EventEncryptionInfo);

            const { container } = getComponent();
            await flushPromises();

            const e2eIcons = container.getElementsByClassName("mx_EventTile_e2eIcon");
            expect(e2eIcons).toHaveLength(1);
            expect(e2eIcons[0].classList).toContain("mx_EventTile_e2eIcon_normal");
            fireEvent.focus(e2eIcons[0]);
            expect(e2eIcons[0].getAttribute("aria-labelledby")).toBeTruthy();
            expect(document.getElementById(e2eIcons[0].getAttribute("aria-labelledby")!)).toHaveTextContent(
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
                await flushPromises();

                const eventTiles = container.getElementsByClassName("mx_EventTile");
                expect(eventTiles).toHaveLength(1);

                expect(container.getElementsByClassName("mx_EventTile_e2eIcon")).toHaveLength(1);
                expect(container.getElementsByClassName("mx_EventTile_e2eIcon")[0].classList).toContain(
                    "mx_EventTile_e2eIcon_decryption_failure",
                );
            });

            it("should not show a shield for previously-verified users", async () => {
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
                mxEvent["_decryptionFailureReason"] = DecryptionFailureCode.SENDER_IDENTITY_PREVIOUSLY_VERIFIED;

                const { container } = getComponent();
                await act(flushPromises);

                const eventTiles = container.getElementsByClassName("mx_EventTile");
                expect(eventTiles).toHaveLength(1);

                expect(container.getElementsByClassName("mx_EventTile_e2eIcon")).toHaveLength(0);
            });
        });

        it("should update the warning when the event is edited", async () => {
            // we start out with an event from the trusted device
            mxEvent = await mkEncryptedMatrixEvent({
                plainContent: { msgtype: "m.text", body: "msg1" },
                plainType: "m.room.message",
                sender: "@alice:example.org",
                roomId: room.roomId,
            });
            eventToEncryptionInfoMap.set(mxEvent.getId()!, {
                shieldColour: EventShieldColour.NONE,
                shieldReason: null,
            } as EventEncryptionInfo);

            const roomContext = getRoomContext(room, {});
            const { container, rerender } = render(<WrappedEventTile roomContext={roomContext} />);

            await flushPromises();

            const eventTiles = container.getElementsByClassName("mx_EventTile");
            expect(eventTiles).toHaveLength(1);

            // there should be no warning
            expect(container.getElementsByClassName("mx_EventTile_e2eIcon")).toHaveLength(0);

            // then we replace the event with one from the unverified device
            const replacementEvent = await mkEncryptedMatrixEvent({
                plainContent: { msgtype: "m.text", body: "msg1" },
                plainType: "m.room.message",
                sender: "@alice:example.org",
                roomId: room.roomId,
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
            // we start out with an event from the trusted device
            mxEvent = await mkEncryptedMatrixEvent({
                plainContent: { msgtype: "m.text", body: "msg1" },
                plainType: "m.room.message",
                sender: "@alice:example.org",
                roomId: room.roomId,
            });

            eventToEncryptionInfoMap.set(mxEvent.getId()!, {
                shieldColour: EventShieldColour.NONE,
                shieldReason: null,
            } as EventEncryptionInfo);

            const roomContext = getRoomContext(room, { isRoomEncrypted: true });
            const { container, rerender } = render(<WrappedEventTile roomContext={roomContext} />);
            await flushPromises();

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

    it("should display the not encrypted status for an unencrypted event when the room becomes encrypted", async () => {
        jest.spyOn(client.getCrypto()!, "getEncryptionInfoForEvent").mockResolvedValue({
            shieldColour: EventShieldColour.NONE,
            shieldReason: null,
        });

        const { rerender } = getComponent();
        await flushPromises();
        // The room and the event are unencrypted, the tile should not show the not encrypted status
        expect(screen.queryByText("Not encrypted")).toBeNull();

        // The room is now encrypted
        rerender(
            <WrappedEventTile
                roomContext={getRoomContext(room, {
                    isRoomEncrypted: true,
                })}
            />,
        );

        // The event tile should now show the not encrypted status
        await waitFor(() => expect(screen.getByText("Not encrypted")).toBeInTheDocument());
    });
});
