/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import {
    EventStatus,
    type IEventDecryptionResult,
    MatrixEvent,
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

import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import { EventTileViewModel, type EventTileViewModelProps } from "../../../src/viewmodels/room/EventTileViewModel";
import { ClickMode, EventTileEncryptionIndicatorMode, SenderMode } from "../../../src/components/views/rooms/EventTile/EventTileModes";
import { TimelineRenderingType } from "../../../src/contexts/RoomContext";
import { filterConsole, flushPromises, mkEvent, mkMessage, stubClient } from "../../test-utils";

describe("EventTileViewModel", () => {
    const ROOM_ID = "!roomId:example.org";
    let mxEvent: MatrixEvent;
    let room: Room;
    let client: ReturnType<typeof MatrixClientPeg.safeGet>;

    const createdViewModels: EventTileViewModel[] = [];

    function makeProps(overrides: Partial<EventTileViewModelProps> = {}): EventTileViewModelProps {
        return {
            cli: client,
            mxEvent,
            timelineRenderingType: TimelineRenderingType.Room,
            isRoomEncrypted: false,
            showHiddenEvents: false,
            ...overrides,
        };
    }

    function createViewModel(overrides: Partial<EventTileViewModelProps> = {}): EventTileViewModel {
        const vm = new EventTileViewModel(makeProps(overrides));
        createdViewModels.push(vm);
        return vm;
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
        for (const vm of createdViewModels.splice(0)) {
            vm.dispose();
        }
    });

    describe("click and sender modes", () => {
        it.each([
            [TimelineRenderingType.Notification, ClickMode.ViewRoom],
            [TimelineRenderingType.ThreadsList, ClickMode.ShowThread],
            [TimelineRenderingType.Room, ClickMode.None],
        ])("sets tile click mode for %s", (timelineRenderingType, tileClickMode) => {
            const vm = createViewModel({ timelineRenderingType });

            expect(vm.getSnapshot().tileClickMode).toBe(tileClickMode);
        });

        it.each([
            [TimelineRenderingType.Room, SenderMode.ComposerInsert],
            [TimelineRenderingType.Search, SenderMode.ComposerInsert],
            [TimelineRenderingType.ThreadsList, SenderMode.Tooltip],
            [TimelineRenderingType.Notification, SenderMode.Default],
        ])("sets sender mode for %s", (timelineRenderingType, senderMode) => {
            const vm = createViewModel({ timelineRenderingType });

            expect(vm.getSnapshot().senderMode).toBe(senderMode);
        });
    });

    describe("event verification", () => {
        const eventToEncryptionInfoMap = new Map<string, EventEncryptionInfo>();

        beforeEach(() => {
            eventToEncryptionInfoMap.clear();

            const mockCrypto = {
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

            const vm = createViewModel();
            await flushPromises();

            expect(vm.getSnapshot()).toMatchObject({
                encryptionIndicatorMode: EventTileEncryptionIndicatorMode.Warning,
                encryptionIndicatorTitle: "Encrypted by a device not verified by its owner.",
            });
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

            const vm = createViewModel();
            await flushPromises();

            expect(vm.getSnapshot()).toMatchObject({
                encryptionIndicatorMode: EventTileEncryptionIndicatorMode.None,
                encryptionIndicatorTitle: undefined,
            });
        });

        it.each([
            [EventShieldReason.UNKNOWN, "Unknown error"],
            [EventShieldReason.UNVERIFIED_IDENTITY, "Encrypted by an unverified user."],
            [EventShieldReason.UNSIGNED_DEVICE, "Encrypted by a device not verified by its owner."],
            [EventShieldReason.UNKNOWN_DEVICE, "Encrypted by an unknown or deleted device."],
            [
                EventShieldReason.AUTHENTICITY_NOT_GUARANTEED,
                "The authenticity of this encrypted message can't be guaranteed on this device.",
            ],
            [EventShieldReason.MISMATCHED_SENDER_KEY, "Encrypted by an unverified session"],
            [EventShieldReason.SENT_IN_CLEAR, "Not encrypted"],
            [EventShieldReason.VERIFICATION_VIOLATION, "Sender's verified identity was reset"],
            [
                EventShieldReason.MISMATCHED_SENDER,
                "The sender of the event does not match the owner of the device that sent it.",
            ],
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

            const vm = createViewModel();
            await flushPromises();

            expect(vm.getSnapshot()).toMatchObject({
                encryptionIndicatorMode: EventTileEncryptionIndicatorMode.Normal,
                encryptionIndicatorTitle: expectedText,
            });
        });

        it("exposes shared key metadata for forwarded messages", async () => {
            mxEvent = await mkEncryptedMatrixEvent({
                plainContent: { msgtype: "m.text", body: "msg1" },
                plainType: "m.room.message",
                sender: "@alice:example.org",
                roomId: room.roomId,
            });
            // @ts-expect-error private test setup
            mxEvent.keyForwardedBy = "@bob:example.org";
            eventToEncryptionInfoMap.set(mxEvent.getId()!, {
                shieldColour: EventShieldColour.GREY,
                shieldReason: EventShieldReason.AUTHENTICITY_NOT_GUARANTEED,
            } as EventEncryptionInfo);

            const vm = createViewModel();
            await flushPromises();

            expect(vm.getSnapshot()).toMatchObject({
                encryptionIndicatorMode: EventTileEncryptionIndicatorMode.None,
                sharedKeysUserId: "@bob:example.org",
                sharedKeysRoomId: room.roomId,
            });
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
                    decryptEvent: async (): Promise<IEventDecryptionResult> => {
                        throw new Error("can't decrypt");
                    },
                } as Parameters<MatrixEvent["attemptDecryption"]>[0];
                await mxEvent.attemptDecryption(mockCrypto);

                const vm = createViewModel();
                await flushPromises();

                expect(vm.getSnapshot()).toMatchObject({
                    encryptionIndicatorMode: EventTileEncryptionIndicatorMode.DecryptionFailure,
                    encryptionIndicatorTitle: "This message could not be decrypted",
                });
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
                    decryptEvent: async (): Promise<IEventDecryptionResult> => {
                        throw new Error("can't decrypt");
                    },
                } as Parameters<MatrixEvent["attemptDecryption"]>[0];
                await mxEvent.attemptDecryption(mockCrypto);
                // @ts-expect-error internal test setup
                mxEvent._decryptionFailureReason = DecryptionFailureCode.SENDER_IDENTITY_PREVIOUSLY_VERIFIED;

                const vm = createViewModel();
                await flushPromises();

                expect(vm.getSnapshot().encryptionIndicatorMode).toBe(EventTileEncryptionIndicatorMode.None);
            });
        });

        it("flags unencrypted replacement events when the room is encrypted", async () => {
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

            const replacementEvent = mkMessage({
                msg: "msg2",
                user: "@alice:example.org",
                room: room.roomId,
                event: true,
            });
            mxEvent.makeReplaced(replacementEvent);

            const vm = createViewModel({ isRoomEncrypted: true });
            await flushPromises();

            expect(vm.getSnapshot()).toMatchObject({
                encryptionIndicatorMode: EventTileEncryptionIndicatorMode.Warning,
                encryptionIndicatorTitle: "Not encrypted",
            });
        });
    });

    describe("event highlighting", () => {
        beforeEach(() => {
            mocked(client.getPushActionsForEvent).mockReturnValue(null);
        });

        it("does not highlight message where message matches no push actions", () => {
            const vm = createViewModel();

            expect(client.getPushActionsForEvent).toHaveBeenCalledWith(mxEvent);
            expect(vm.getSnapshot().isHighlighted).toBeFalsy();
        });

        it("does not highlight when message's push actions does not have a highlight tweak", () => {
            mocked(client.getPushActionsForEvent).mockReturnValue({ notify: true, tweaks: {} });

            const vm = createViewModel();

            expect(vm.getSnapshot().isHighlighted).toBeFalsy();
        });

        it("does not highlight when message's push actions have a highlight tweak but message has been redacted", () => {
            mocked(client.getPushActionsForEvent).mockReturnValue({
                notify: true,
                tweaks: { [TweakName.Highlight]: true },
            });

            const vm = createViewModel({ isRedacted: true });

            expect(vm.getSnapshot().isHighlighted).toBeFalsy();
        });

        it("highlights when message's push actions have a highlight tweak", () => {
            mocked(client.getPushActionsForEvent).mockReturnValue({
                notify: true,
                tweaks: { [TweakName.Highlight]: true },
            });

            const vm = createViewModel();

            expect(vm.getSnapshot().isHighlighted).toBeTruthy();
        });

        describe("when a message has been edited", () => {
            let editingEvent: MatrixEvent;

            beforeEach(() => {
                editingEvent = new MatrixEvent({
                    type: "m.room.message",
                    room_id: ROOM_ID,
                    sender: "@alice:example.org",
                    content: {
                        msgtype: "m.text",
                        body: "* edited body",
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
                const vm = createViewModel();

                expect(client.getPushActionsForEvent).toHaveBeenCalledWith(mxEvent);
                expect(client.getPushActionsForEvent).toHaveBeenCalledWith(editingEvent);
                expect(vm.getSnapshot().isHighlighted).toBeFalsy();
            });

            it("does not highlight when no version of message's push actions have a highlight tweak", () => {
                mocked(client.getPushActionsForEvent).mockReturnValue({ notify: true, tweaks: {} });

                const vm = createViewModel();

                expect(vm.getSnapshot().isHighlighted).toBeFalsy();
            });

            it("highlights when previous version of message's push actions have a highlight tweak", () => {
                mocked(client.getPushActionsForEvent).mockImplementation((event: MatrixEvent) => {
                    if (event === mxEvent) {
                        return { notify: true, tweaks: { [TweakName.Highlight]: true } };
                    }
                    return { notify: false, tweaks: {} };
                });

                const vm = createViewModel();

                expect(vm.getSnapshot().isHighlighted).toBeTruthy();
            });

            it("highlights when new version of message's push actions have a highlight tweak", () => {
                mocked(client.getPushActionsForEvent).mockImplementation((event: MatrixEvent) => {
                    if (event === editingEvent) {
                        return { notify: true, tweaks: { [TweakName.Highlight]: true } };
                    }
                    return { notify: false, tweaks: {} };
                });

                const vm = createViewModel();

                expect(vm.getSnapshot().isHighlighted).toBeTruthy();
            });
        });
    });

    it.each([
        [EventStatus.NOT_SENT, false, true],
        [EventStatus.SENDING, false, true],
        [EventStatus.ENCRYPTING, false, true],
    ])("derives sending receipt flags for %s", (eventSendStatus, shouldShowSentReceipt, shouldShowSendingReceipt) => {
        const ownEvent = mkMessage({
            room: room.roomId,
            user: client.getSafeUserId(),
            msg: "Hello world!",
            event: true,
        });

        const vm = createViewModel({ mxEvent: ownEvent, eventSendStatus });

        expect(vm.getSnapshot()).toMatchObject({
            shouldShowSentReceipt,
            shouldShowSendingReceipt,
        });
    });
});
