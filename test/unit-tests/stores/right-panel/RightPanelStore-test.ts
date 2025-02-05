/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked, type MockedObject } from "jest-mock";
import { type MatrixClient, RoomMember } from "matrix-js-sdk/src/matrix";

import { stubClient } from "../../../test-utils";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import DMRoomMap from "../../../../src/utils/DMRoomMap";
import { Action } from "../../../../src/dispatcher/actions";
import defaultDispatcher from "../../../../src/dispatcher/dispatcher";
import { type ActiveRoomChangedPayload } from "../../../../src/dispatcher/payloads/ActiveRoomChangedPayload";
import RightPanelStore from "../../../../src/stores/right-panel/RightPanelStore";
import { RightPanelPhases } from "../../../../src/stores/right-panel/RightPanelStorePhases";
import SettingsStore from "../../../../src/settings/SettingsStore";
import { pendingVerificationRequestForUser } from "../../../../src/verification.ts";

jest.mock("../../../../src/verification");

describe("RightPanelStore", () => {
    // Mock out the settings store so the right panel store can't persist values between tests
    jest.spyOn(SettingsStore, "setValue").mockImplementation(async () => {});

    const store = RightPanelStore.instance;
    let cli: MockedObject<MatrixClient>;
    beforeEach(() => {
        stubClient();
        cli = mocked(MatrixClientPeg.safeGet());
        DMRoomMap.makeShared(cli);

        // Make sure we start with a clean store
        store.reset();
        store.useUnitTestClient(cli);
    });

    const viewRoom = async (roomId: string) => {
        const roomChanged = new Promise<void>((resolve) => {
            const ref = defaultDispatcher.register((payload) => {
                if (payload.action === Action.ActiveRoomChanged && payload.newRoomId === roomId) {
                    defaultDispatcher.unregister(ref);
                    resolve();
                }
            });
        });

        defaultDispatcher.dispatch<ActiveRoomChangedPayload>({
            action: Action.ActiveRoomChanged,
            oldRoomId: null,
            newRoomId: roomId,
        });

        await roomChanged;
    };

    const setCard = (roomId: string, phase: RightPanelPhases) => store.setCard({ phase }, true, roomId);

    describe("isOpen", () => {
        it("is false if no rooms are open", () => {
            expect(store.isOpen).toEqual(false);
        });
        it("is false if a room other than the current room is open", async () => {
            await viewRoom("!1:example.org");
            setCard("!2:example.org", RightPanelPhases.RoomSummary);
            expect(store.isOpen).toEqual(false);
        });
        it("is true if the current room is open", async () => {
            await viewRoom("!1:example.org");
            setCard("!1:example.org", RightPanelPhases.RoomSummary);
            expect(store.isOpen).toEqual(true);
        });
    });

    describe("currentCard", () => {
        it("has a phase of null if nothing is open", () => {
            expect(store.currentCard.phase).toEqual(null);
        });
        it("has a phase of null if the panel is open but in another room", async () => {
            await viewRoom("!1:example.org");
            setCard("!2:example.org", RightPanelPhases.RoomSummary);
            expect(store.currentCard.phase).toEqual(null);
        });
        it("reflects the phase of the current room", async () => {
            await viewRoom("!1:example.org");
            setCard("!1:example.org", RightPanelPhases.RoomSummary);
            expect(store.currentCard.phase).toEqual(RightPanelPhases.RoomSummary);
        });
    });

    describe("setCard", () => {
        it("does nothing if given no room ID and not viewing a room", () => {
            store.setCard({ phase: RightPanelPhases.RoomSummary }, true);
            expect(store.isOpen).toEqual(false);
            expect(store.currentCard.phase).toEqual(null);
        });
        it("does nothing if given an invalid state", async () => {
            await viewRoom("!1:example.org");
            // Needs a member specified to be valid
            store.setCard({ phase: RightPanelPhases.MemberInfo }, true, "!1:example.org");
            expect(store.roomPhaseHistory).toEqual([]);
        });
        it("only creates a single history entry if given the same card twice", async () => {
            await viewRoom("!1:example.org");
            store.setCard({ phase: RightPanelPhases.RoomSummary }, true, "!1:example.org");
            store.setCard({ phase: RightPanelPhases.RoomSummary }, true, "!1:example.org");
            expect(store.roomPhaseHistory).toEqual([{ phase: RightPanelPhases.RoomSummary, state: {} }]);
        });
        it("opens the panel in the given room with the correct phase", () => {
            store.setCard({ phase: RightPanelPhases.RoomSummary }, true, "!1:example.org");
            expect(store.isOpenForRoom("!1:example.org")).toEqual(true);
            expect(store.currentCardForRoom("!1:example.org").phase).toEqual(RightPanelPhases.RoomSummary);
        });
        it("history is generated for certain phases", async () => {
            await viewRoom("!1:example.org");
            // Setting the memberlist card should also generate a history with room summary card
            store.setCard({ phase: RightPanelPhases.MemberList }, true, "!1:example.org");
            expect(store.roomPhaseHistory).toEqual([
                { phase: RightPanelPhases.RoomSummary, state: {} },
                { phase: RightPanelPhases.MemberList, state: {} },
            ]);
        });
    });

    describe("setCards", () => {
        it("overwrites history", async () => {
            await viewRoom("!1:example.org");
            store.setCard({ phase: RightPanelPhases.MemberList }, true, "!1:example.org");
            store.setCards(
                [{ phase: RightPanelPhases.RoomSummary }, { phase: RightPanelPhases.PinnedMessages }],
                true,
                "!1:example.org",
            );
            expect(store.roomPhaseHistory).toEqual([
                { phase: RightPanelPhases.RoomSummary, state: {} },
                { phase: RightPanelPhases.PinnedMessages, state: {} },
            ]);
        });
    });

    describe("pushCard", () => {
        it("does nothing if given no room ID and not viewing a room", () => {
            store.pushCard({ phase: RightPanelPhases.RoomSummary }, true);
            expect(store.isOpen).toEqual(false);
            expect(store.currentCard.phase).toEqual(null);
        });
        it("opens the panel in the given room with the correct phase", () => {
            store.pushCard({ phase: RightPanelPhases.RoomSummary }, true, "!1:example.org");
            expect(store.isOpenForRoom("!1:example.org")).toEqual(true);
            expect(store.currentCardForRoom("!1:example.org").phase).toEqual(RightPanelPhases.RoomSummary);
        });
        it("appends the phase to any phases that were there before", async () => {
            await viewRoom("!1:example.org");
            store.setCard({ phase: RightPanelPhases.RoomSummary }, true, "!1:example.org");
            store.pushCard({ phase: RightPanelPhases.PinnedMessages }, true, "!1:example.org");
            expect(store.roomPhaseHistory).toEqual([
                { phase: RightPanelPhases.RoomSummary, state: {} },
                { phase: RightPanelPhases.PinnedMessages, state: {} },
            ]);
        });
    });

    describe("popCard", () => {
        it("removes the most recent card", () => {
            store.setCards(
                [{ phase: RightPanelPhases.RoomSummary }, { phase: RightPanelPhases.PinnedMessages }],
                true,
                "!1:example.org",
            );
            expect(store.currentCardForRoom("!1:example.org").phase).toEqual(RightPanelPhases.PinnedMessages);
            store.popCard("!1:example.org");
            expect(store.currentCardForRoom("!1:example.org").phase).toEqual(RightPanelPhases.RoomSummary);
        });
    });

    describe("togglePanel", () => {
        it("does nothing if the room has no phase to open to", () => {
            expect(store.isOpenForRoom("!1:example.org")).toEqual(false);
            store.togglePanel("!1:example.org");
            expect(store.isOpenForRoom("!1:example.org")).toEqual(false);
        });
        it("works if a room is specified", () => {
            store.setCard({ phase: RightPanelPhases.RoomSummary }, true, "!1:example.org");
            expect(store.isOpenForRoom("!1:example.org")).toEqual(true);
            store.togglePanel("!1:example.org");
            expect(store.isOpenForRoom("!1:example.org")).toEqual(false);
            store.togglePanel("!1:example.org");
            expect(store.isOpenForRoom("!1:example.org")).toEqual(true);
        });
        it("operates on the current room if no room is specified", async () => {
            await viewRoom("!1:example.org");
            store.setCard({ phase: RightPanelPhases.RoomSummary }, true);
            expect(store.isOpen).toEqual(true);
            store.togglePanel(null);
            expect(store.isOpen).toEqual(false);
            store.togglePanel(null);
            expect(store.isOpen).toEqual(true);
        });
    });

    it("doesn't restore member info cards when switching back to a room", async () => {
        await viewRoom("!1:example.org");
        store.setCards(
            [
                {
                    phase: RightPanelPhases.MemberList,
                },
                {
                    phase: RightPanelPhases.MemberInfo,
                    state: { member: new RoomMember("!1:example.org", "@alice:example.org") },
                },
            ],
            true,
            "!1:example.org",
        );
        expect(store.currentCardForRoom("!1:example.org").phase).toEqual(RightPanelPhases.MemberInfo);

        // Switch away and back
        await viewRoom("!2:example.org");
        await viewRoom("!1:example.org");
        expect(store.currentCardForRoom("!1:example.org").phase).toEqual(RightPanelPhases.MemberList);
    });

    it("should redirect to verification if set to phase MemberInfo for a user with a pending verification", async () => {
        const member = new RoomMember("!1:example.org", "@alice:example.org");
        const verificationRequest = { mockVerificationRequest: true } as any;
        mocked(pendingVerificationRequestForUser).mockReturnValue(verificationRequest);
        await viewRoom("!1:example.org");
        store.setCard(
            {
                phase: RightPanelPhases.MemberInfo,
                state: { member },
            },
            true,
            "!1:example.org",
        );
        expect(store.currentCard).toEqual({
            phase: RightPanelPhases.EncryptionPanel,
            state: { member, verificationRequest },
        });
    });
});
