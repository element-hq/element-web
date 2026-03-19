/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { act, fireEvent, render, screen, waitFor } from "jest-matrix-react";
import {
    EventStatus,
    EventType,
    type IEventDecryptionResult,
    type MatrixClient,
    type MatrixEvent,
    NotificationCountType,
    PendingEventOrdering,
    Room,
    type Thread,
    ThreadEvent,
} from "matrix-js-sdk/src/matrix";
import {
    type CryptoApi,
    DecryptionFailureCode,
    type EventEncryptionInfo,
    EventShieldColour,
    EventShieldReason,
} from "matrix-js-sdk/src/crypto-api";
import { mkEncryptedMatrixEvent } from "matrix-js-sdk/src/testing";
import { getByTestId } from "@testing-library/dom";

import EventTile, {
    type EventTileHandle,
    type EventTileProps,
} from "../../../../../../src/components/views/rooms/EventTile";
import MatrixClientContext from "../../../../../../src/contexts/MatrixClientContext";
import { type RoomContextType, TimelineRenderingType } from "../../../../../../src/contexts/RoomContext";
import { MatrixClientPeg } from "../../../../../../src/MatrixClientPeg";
import {
    filterConsole,
    flushPromises,
    getRoomContext,
    mkEvent,
    mkMessage,
    stubClient,
} from "../../../../../test-utils";
import { makeThreadEvent, mkThread } from "../../../../../test-utils/threads";
import DMRoomMap from "../../../../../../src/utils/DMRoomMap";
import dis from "../../../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../../../src/dispatcher/actions";
import PinningUtils from "../../../../../../src/utils/PinningUtils";
import { ScopedRoomContextProvider } from "../../../../../../src/contexts/ScopedRoomContext.tsx";
import { DecryptionFailureTracker } from "../../../../../../src/DecryptionFailureTracker";

jest.mock("../../../../../../src/utils/EventRenderingUtils", () => ({
    ...jest.requireActual("../../../../../../src/utils/EventRenderingUtils"),
    getEventDisplayInfo: jest.fn(),
}));

jest.mock("../../../../../../src/components/views/rooms/EventTile/ReplyPreview", () => ({
    ReplyPreview: ({ mxEvent }: { mxEvent: MatrixEvent }) => <div data-testid="reply-preview">{mxEvent.getId()}</div>,
}));

jest.mock("../../../../../../src/components/views/rooms/EventTile/Avatar", () => ({
    Avatar: ({ member }: { member?: { userId?: string } | null }) =>
        member ? <div data-testid="avatar-subject">{member.userId}</div> : null,
}));

const mockGetEventDisplayInfo = jest.requireMock("../../../../../../src/utils/EventRenderingUtils")
    .getEventDisplayInfo as jest.Mock;

describe("EventTile", () => {
    const ROOM_ID = "!roomId:example.org";
    let mxEvent: MatrixEvent;
    let room: Room;
    let client: MatrixClient;

    function defer<T>(): {
        promise: Promise<T>;
        resolve: (value: T) => void;
        reject: (reason?: unknown) => void;
    } {
        let resolve!: (value: T) => void;
        let reject!: (reason?: unknown) => void;
        const promise = new Promise<T>((res, rej) => {
            resolve = res;
            reject = rej;
        });
        return { promise, resolve, reject };
    }

    // let changeEvent: (event: MatrixEvent) => void;

    /** wrap the EventTile up in context providers, and with basic properties, as it would be by MessagePanel normally. */
    function WrappedEventTile(props: {
        roomContext: RoomContextType;
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
        roomContext: Partial<RoomContextType> = {},
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

        mockGetEventDisplayInfo.mockReturnValue({
            hasRenderer: true,
            isBubbleMessage: false,
            isInfoMessage: false,
            isLeftAlignedBubbleMessage: false,
            noBubbleEvent: false,
            isSeeingThroughMessageHiddenForModeration: false,
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

        it("updates the thread preview when a new reply is added", async () => {
            const {
                thread,
                rootEvent,
                events: [, reply1],
            } = mkThread({
                room,
                client,
                authorId: "@alice:example.org",
                participantUserIds: ["@alice:example.org"],
                length: 2,
            });
            thread.initialEventsFetched = true;

            reply1.getContent().body = "ReplyEvent1";

            getComponent({ mxEvent: rootEvent }, TimelineRenderingType.Room);

            await screen.findByText("ReplyEvent1");

            const reply2 = makeThreadEvent({
                user: "@alice:example.org",
                room: room.roomId,
                event: true,
                msg: "ReplyEvent2",
                rootEventId: rootEvent.getId()!,
                replyToEventId: reply1.getId()!,
            });

            await act(async () => {
                await thread.addEvent(reply2, false, true);
            });

            await screen.findByText("ReplyEvent2");
        });
    });

    describe("EventTile renderingType: ThreadsList", () => {
        it("renders the sender in the thread list details", async () => {
            const { container } = getComponent({}, TimelineRenderingType.ThreadsList);

            await waitFor(() => {
                const sender = container.querySelector(".mx_EventTile_details .mx_DisambiguatedProfile");
                expect(sender).not.toBeNull();
                expect(sender).toHaveTextContent("@alice:example.org");
            });
        });

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

    describe("EventTile renderingType: Notification", () => {
        it("renders the room name in the notification details", async () => {
            const dmRoomMap: DMRoomMap = {
                getUserIdForRoomId: jest.fn(),
            } as unknown as DMRoomMap;
            DMRoomMap.setShared(dmRoomMap);
            room.name = "Test room";

            const { container } = getComponent({}, TimelineRenderingType.Notification);

            await waitFor(() => {
                const details = container.getElementsByClassName("mx_EventTile_details")[0];
                expect(details).toHaveTextContent("@alice:example.org");
                expect(details).toHaveTextContent("in Test room");
            });
        });

        it("does not render the missing renderer fallback for notifications", () => {
            mockGetEventDisplayInfo.mockReturnValue({
                hasRenderer: false,
                isBubbleMessage: false,
                isInfoMessage: false,
                isLeftAlignedBubbleMessage: false,
                noBubbleEvent: false,
                isSeeingThroughMessageHiddenForModeration: false,
            });

            const { container } = getComponent({}, TimelineRenderingType.Notification);

            expect(container).not.toHaveTextContent("This event could not be displayed");
        });
    });

    describe("EventTile renderingType: File", () => {
        it("renders the timestamp in the sender details when enabled", async () => {
            mxEvent = mkMessage({
                room: room.roomId,
                user: "@alice:example.org",
                msg: "Hello world!",
                event: true,
                ts: 123,
            });

            const { container } = getComponent({ mxEvent, alwaysShowTimestamps: true }, TimelineRenderingType.File);

            await waitFor(() => {
                expect(container.getElementsByClassName("mx_MessageTimestamp")).toHaveLength(1);
            });
        });
    });

    describe("EventTile presenter wiring", () => {
        it("renders the missing renderer fallback when the VM selects it", () => {
            mockGetEventDisplayInfo.mockReturnValue({
                hasRenderer: false,
                isBubbleMessage: false,
                isInfoMessage: false,
                isLeftAlignedBubbleMessage: false,
                noBubbleEvent: false,
                isSeeingThroughMessageHiddenForModeration: false,
            });

            const { container } = getComponent();

            expect(container).toHaveTextContent("This event could not be displayed");
        });

        it("renders a reply preview when the VM says the event is a reply", async () => {
            mxEvent = mkMessage({
                room: room.roomId,
                user: "@alice:example.org",
                msg: "Reply",
                event: true,
                relatesTo: {
                    "m.in_reply_to": {
                        event_id: "$parent",
                    },
                },
            });

            const { container } = getComponent({ mxEvent });

            await waitFor(() => expect(getByTestId(container, "reply-preview")).toHaveTextContent(mxEvent.getId()!));
        });

        it("resolves the avatar subject from the VM for third-party invites", async () => {
            mxEvent = mkEvent({
                event: true,
                type: "m.room.member",
                user: "@alice:example.org",
                room: room.roomId,
                content: {
                    membership: "invite",
                    third_party_invite: {
                        display_name: "Bob",
                    },
                },
            });
            mxEvent.sender = {
                userId: "@alice:example.org",
                membership: "join",
                name: "@alice:example.org",
                rawDisplayName: "@alice:example.org",
                roomId: room.roomId,
            } as never;
            mxEvent.target = {
                userId: "@bob:example.org",
                membership: "invite",
                name: "@bob:example.org",
                rawDisplayName: "@bob:example.org",
                roomId: room.roomId,
            } as never;

            const { container } = getComponent({ mxEvent });

            await waitFor(() => expect(getByTestId(container, "avatar-subject")).toHaveTextContent("@bob:example.org"));
        });
    });

    describe("EventTile renderingType: Pinned", () => {
        it("does not render a DisambiguatedProfile for continuation messages", () => {
            const { container } = getComponent({ continuation: true }, TimelineRenderingType.Pinned);

            expect(container.getElementsByClassName("mx_DisambiguatedProfile")).toHaveLength(0);
        });
    });

    describe("EventTile in the right panel", () => {
        beforeAll(() => {
            const dmRoomMap: DMRoomMap = {
                getUserIdForRoomId: jest.fn(),
            } as unknown as DMRoomMap;
            DMRoomMap.setShared(dmRoomMap);
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

        it("shows the correct reason code for a forwarded message", async () => {
            mxEvent = await mkEncryptedMatrixEvent({
                plainContent: { msgtype: "m.text", body: "msg1" },
                plainType: "m.room.message",
                sender: "@alice:example.org",
                roomId: room.roomId,
            });
            // @ts-ignore assignment to private member
            mxEvent.keyForwardedBy = "@bob:example.org";
            eventToEncryptionInfoMap.set(mxEvent.getId()!, {
                shieldColour: EventShieldColour.GREY,
                shieldReason: EventShieldReason.AUTHENTICITY_NOT_GUARANTEED,
            } as EventEncryptionInfo);

            const { container } = getComponent();

            const e2eIcon = await waitFor(() => getByTestId(container, "e2e-padlock"));
            expect(e2eIcon).toHaveAccessibleName(
                "@bob:example.org (@bob:example.org) shared this message since you were not in the room when it was sent.",
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
                expect(container.getElementsByClassName("mx_EventTile_e2eIcon")[0]).toHaveAccessibleName(
                    "This message could not be decrypted",
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
            expect(container.getElementsByClassName("mx_EventTile_e2eIcon")[0]).toHaveAccessibleName(
                "Encrypted by a device not verified by its owner.",
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
            expect(container.getElementsByClassName("mx_EventTile_e2eIcon")[0]).toHaveAccessibleName("Not encrypted");
        });

        it("ignores stale verification results after the event changes", async () => {
            const firstEvent = await mkEncryptedMatrixEvent({
                plainContent: { msgtype: "m.text", body: "msg1" },
                plainType: "m.room.message",
                sender: "@alice:example.org",
                roomId: room.roomId,
            });
            const secondEvent = await mkEncryptedMatrixEvent({
                plainContent: { msgtype: "m.text", body: "msg2" },
                plainType: "m.room.message",
                sender: "@alice:example.org",
                roomId: room.roomId,
            });

            const firstResult = defer<EventEncryptionInfo | null>();
            const secondResult = defer<EventEncryptionInfo | null>();
            const getEncryptionInfoForEvent = jest.fn((event: MatrixEvent) => {
                if (event.getId() === firstEvent.getId()) {
                    return firstResult.promise;
                }
                if (event.getId() === secondEvent.getId()) {
                    return secondResult.promise;
                }
                return Promise.resolve(null);
            });
            client.getCrypto = () =>
                ({
                    getEncryptionInfoForEvent,
                }) as unknown as CryptoApi;

            const roomContext = getRoomContext(room, {});
            const { container, rerender } = render(
                <WrappedEventTile
                    roomContext={roomContext}
                    eventTilePropertyOverrides={{
                        mxEvent: firstEvent,
                        replacingEventId: firstEvent.replacingEventId(),
                    }}
                />,
            );

            rerender(
                <WrappedEventTile
                    roomContext={roomContext}
                    eventTilePropertyOverrides={{
                        mxEvent: secondEvent,
                        replacingEventId: secondEvent.replacingEventId(),
                    }}
                />,
            );

            await act(async () => {
                secondResult.resolve({
                    shieldColour: EventShieldColour.RED,
                    shieldReason: EventShieldReason.UNSIGNED_DEVICE,
                } as EventEncryptionInfo);
                await flushPromises();
            });

            expect(container.getElementsByClassName("mx_EventTile_e2eIcon")).toHaveLength(1);
            expect(container.getElementsByClassName("mx_EventTile_e2eIcon")[0]).toHaveAccessibleName(
                "Encrypted by a device not verified by its owner.",
            );

            await act(async () => {
                firstResult.resolve({
                    shieldColour: EventShieldColour.NONE,
                    shieldReason: null,
                } as EventEncryptionInfo);
                await flushPromises();
            });

            expect(container.getElementsByClassName("mx_EventTile_e2eIcon")).toHaveLength(1);
            expect(container.getElementsByClassName("mx_EventTile_e2eIcon")[0]).toHaveAccessibleName(
                "Encrypted by a device not verified by its owner.",
            );
        });
    });

    it("decrypts the event on mount and when the event prop changes", async () => {
        const firstEvent = mkMessage({
            room: room.roomId,
            user: "@alice:example.org",
            msg: "First",
            event: true,
        });
        const secondEvent = mkMessage({
            room: room.roomId,
            user: "@alice:example.org",
            msg: "Second",
            event: true,
        });

        const roomContext = getRoomContext(room, {});
        const { rerender } = render(
            <WrappedEventTile
                roomContext={roomContext}
                eventTilePropertyOverrides={{ mxEvent: firstEvent, replacingEventId: firstEvent.replacingEventId() }}
            />,
        );

        await waitFor(() => expect(client.decryptEventIfNeeded).toHaveBeenCalledWith(firstEvent));

        jest.mocked(client.decryptEventIfNeeded).mockClear();

        rerender(
            <WrappedEventTile
                roomContext={roomContext}
                eventTilePropertyOverrides={{ mxEvent: secondEvent, replacingEventId: secondEvent.replacingEventId() }}
            />,
        );

        await waitFor(() => expect(client.decryptEventIfNeeded).toHaveBeenCalledWith(secondEvent));
    });

    it("marks the event as visible to the decryption failure tracker on mount", () => {
        const addVisibleEventSpy = jest.spyOn(DecryptionFailureTracker.instance, "addVisibleEvent");

        getComponent();

        expect(addVisibleEventSpy).toHaveBeenCalledWith(mxEvent);
    });

    it("marks a new event as visible to the decryption failure tracker when the event prop changes", () => {
        const addVisibleEventSpy = jest.spyOn(DecryptionFailureTracker.instance, "addVisibleEvent");
        const firstEvent = mkMessage({
            room: room.roomId,
            user: "@alice:example.org",
            msg: "First",
            event: true,
        });
        const secondEvent = mkMessage({
            room: room.roomId,
            user: "@alice:example.org",
            msg: "Second",
            event: true,
        });

        const roomContext = getRoomContext(room, {});
        const { rerender } = render(
            <WrappedEventTile
                roomContext={roomContext}
                eventTilePropertyOverrides={{ mxEvent: firstEvent, replacingEventId: firstEvent.replacingEventId() }}
            />,
        );

        expect(addVisibleEventSpy).toHaveBeenCalledWith(firstEvent);

        addVisibleEventSpy.mockClear();

        rerender(
            <WrappedEventTile
                roomContext={roomContext}
                eventTilePropertyOverrides={{ mxEvent: secondEvent, replacingEventId: secondEvent.replacingEventId() }}
            />,
        );

        expect(addVisibleEventSpy).toHaveBeenCalledWith(secondEvent);
    });

    it("does not mark exported events as visible to the decryption failure tracker", () => {
        const addVisibleEventSpy = jest.spyOn(DecryptionFailureTracker.instance, "addVisibleEvent");

        getComponent({ forExport: true });

        expect(addVisibleEventSpy).not.toHaveBeenCalled();
    });

    it("removes the ThreadEvent.New listener once the matching thread is found", () => {
        const offSpy = jest.spyOn(room, "off");
        getComponent();

        const thread = {
            id: mxEvent.getId(),
            length: 0,
            on: jest.fn(),
            off: jest.fn(),
        } as unknown as Thread;

        act(() => {
            room.emit(ThreadEvent.New, thread, false);
        });

        expect(offSpy).toHaveBeenCalledWith(ThreadEvent.New, expect.any(Function));
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

    it("refreshes derived state when forceUpdate is called through the imperative ref", () => {
        const ref = React.createRef<EventTileHandle>();
        const isPinnedSpy = jest.spyOn(PinningUtils, "isPinned").mockReturnValue(false);

        getComponent({ ref });

        expect(screen.queryByText("Pinned message")).toBeNull();

        isPinnedSpy.mockReturnValue(true);
        act(() => ref.current?.forceUpdate());

        expect(screen.getByText("Pinned message")).toBeInTheDocument();
    });

    it.each([
        [EventStatus.NOT_SENT, "Failed to send"],
        [EventStatus.SENDING, "Sending your message…"],
        [EventStatus.ENCRYPTING, "Encrypting your message…"],
    ])("should display %s status icon", (eventSendStatus, text) => {
        const ownEvent = mkMessage({
            room: room.roomId,
            user: client.getSafeUserId(),
            msg: "Hello world!",
            event: true,
        });
        const { getByRole } = getComponent({ mxEvent: ownEvent, eventSendStatus });

        expect(getByRole("status")).toHaveAccessibleName(text);
    });
});
