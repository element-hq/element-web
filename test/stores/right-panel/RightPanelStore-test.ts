/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { mocked, MockedObject } from "jest-mock";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";

import { stubClient } from "../../test-utils";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import DMRoomMap from "../../../src/utils/DMRoomMap";
import { Action } from "../../../src/dispatcher/actions";
import defaultDispatcher from "../../../src/dispatcher/dispatcher";
import { ActiveRoomChangedPayload } from "../../../src/dispatcher/payloads/ActiveRoomChangedPayload";
import RightPanelStore from "../../../src/stores/right-panel/RightPanelStore";
import { RightPanelPhases } from "../../../src/stores/right-panel/RightPanelStorePhases";
import SettingsStore from "../../../src/settings/SettingsStore";

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
            store.setCard({ phase: RightPanelPhases.RoomMemberInfo }, true, "!1:example.org");
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
        it("overwrites history if changing the phase", async () => {
            await viewRoom("!1:example.org");
            store.setCard({ phase: RightPanelPhases.RoomSummary }, true, "!1:example.org");
            store.setCard({ phase: RightPanelPhases.RoomMemberList }, true, "!1:example.org");
            expect(store.roomPhaseHistory).toEqual([{ phase: RightPanelPhases.RoomMemberList, state: {} }]);
        });
    });

    describe("setCards", () => {
        it("overwrites history", async () => {
            await viewRoom("!1:example.org");
            store.setCard({ phase: RightPanelPhases.RoomMemberList }, true, "!1:example.org");
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
                    phase: RightPanelPhases.RoomMemberList,
                },
                {
                    phase: RightPanelPhases.RoomMemberInfo,
                    state: { member: new RoomMember("!1:example.org", "@alice:example.org") },
                },
            ],
            true,
            "!1:example.org",
        );
        expect(store.currentCardForRoom("!1:example.org").phase).toEqual(RightPanelPhases.RoomMemberInfo);

        // Switch away and back
        await viewRoom("!2:example.org");
        await viewRoom("!1:example.org");
        expect(store.currentCardForRoom("!1:example.org").phase).toEqual(RightPanelPhases.RoomMemberList);
    });
});
