/*
Copyright 2021 - 2023 The Matrix.org Foundation C.I.C.

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

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "focus-visible"; // to fix context menus
import { mocked } from "jest-mock";
import { MatrixClient, MatrixEvent, PendingEventOrdering, Room } from "matrix-js-sdk/src/matrix";
import { FeatureSupport, Thread } from "matrix-js-sdk/src/models/thread";

import ThreadPanel, { ThreadFilterType, ThreadPanelHeader } from "../../../src/components/structures/ThreadPanel";
import MatrixClientContext from "../../../src/contexts/MatrixClientContext";
import RoomContext from "../../../src/contexts/RoomContext";
import { _t } from "../../../src/languageHandler";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import { RoomPermalinkCreator } from "../../../src/utils/permalinks/Permalinks";
import ResizeNotifier from "../../../src/utils/ResizeNotifier";
import { getRoomContext, mockPlatformPeg, stubClient } from "../../test-utils";
import { mkThread } from "../../test-utils/threads";

jest.mock("../../../src/utils/Feedback");

describe("ThreadPanel", () => {
    describe("Header", () => {
        it("expect that All filter for ThreadPanelHeader properly renders Show: All threads", () => {
            const { asFragment } = render(
                <ThreadPanelHeader
                    empty={false}
                    filterOption={ThreadFilterType.All}
                    setFilterOption={() => undefined}
                />,
            );
            expect(asFragment()).toMatchSnapshot();
        });

        it("expect that My filter for ThreadPanelHeader properly renders Show: My threads", () => {
            const { asFragment } = render(
                <ThreadPanelHeader
                    empty={false}
                    filterOption={ThreadFilterType.My}
                    setFilterOption={() => undefined}
                />,
            );
            expect(asFragment()).toMatchSnapshot();
        });

        it("expect that ThreadPanelHeader properly opens a context menu when clicked on the button", () => {
            const { container } = render(
                <ThreadPanelHeader
                    empty={false}
                    filterOption={ThreadFilterType.All}
                    setFilterOption={() => undefined}
                />,
            );
            const found = container.querySelector(".mx_ThreadPanel_dropdown");
            expect(found).toBeTruthy();
            expect(screen.queryByRole("menu")).toBeFalsy();
            fireEvent.click(found!);
            expect(screen.queryByRole("menu")).toBeTruthy();
        });

        it("expect that ThreadPanelHeader has the correct option selected in the context menu", () => {
            const { container } = render(
                <ThreadPanelHeader
                    empty={false}
                    filterOption={ThreadFilterType.All}
                    setFilterOption={() => undefined}
                />,
            );
            fireEvent.click(container.querySelector(".mx_ThreadPanel_dropdown")!);
            const found = screen.queryAllByRole("menuitemradio");
            expect(found).toHaveLength(2);
            const foundButton = screen.queryByRole("menuitemradio", { checked: true });
            expect(foundButton?.textContent).toEqual(
                `${_t("All threads")}${_t("Shows all threads from current room")}`,
            );
            expect(foundButton).toMatchSnapshot();
        });
    });

    describe("Filtering", () => {
        const ROOM_ID = "!roomId:example.org";
        const SENDER = "@alice:example.org";

        let mockClient: MatrixClient;
        let room: Room;

        const TestThreadPanel = () => (
            <MatrixClientContext.Provider value={mockClient}>
                <RoomContext.Provider
                    value={getRoomContext(room, {
                        canSendMessages: true,
                    })}
                >
                    <ThreadPanel
                        roomId={ROOM_ID}
                        onClose={jest.fn()}
                        resizeNotifier={new ResizeNotifier()}
                        permalinkCreator={new RoomPermalinkCreator(room)}
                    />
                </RoomContext.Provider>
            </MatrixClientContext.Provider>
        );

        beforeEach(async () => {
            jest.clearAllMocks();

            stubClient();
            mockPlatformPeg();
            mockClient = mocked(MatrixClientPeg.safeGet());
            Thread.setServerSideSupport(FeatureSupport.Stable);
            Thread.setServerSideListSupport(FeatureSupport.Stable);
            Thread.setServerSideFwdPaginationSupport(FeatureSupport.Stable);
            jest.spyOn(mockClient, "supportsThreads").mockReturnValue(true);

            room = new Room(ROOM_ID, mockClient, mockClient.getUserId() ?? "", {
                pendingEventOrdering: PendingEventOrdering.Detached,
            });
            jest.spyOn(room, "fetchRoomThreads").mockReturnValue(Promise.resolve());
            jest.spyOn(mockClient, "getRoom").mockReturnValue(room);
            await room.createThreadsTimelineSets();
            const [allThreads, myThreads] = room.threadsTimelineSets;
            jest.spyOn(room, "createThreadsTimelineSets").mockReturnValue(Promise.resolve([allThreads!, myThreads!]));
        });

        function toggleThreadFilter(container: HTMLElement, newFilter: ThreadFilterType) {
            fireEvent.click(container.querySelector(".mx_ThreadPanel_dropdown")!);
            const found = screen.queryAllByRole("menuitemradio");
            expect(found).toHaveLength(2);

            const allThreadsContent = `${_t("All threads")}${_t("Shows all threads from current room")}`;
            const myThreadsContent = `${_t("My threads")}${_t("Shows all threads you've participated in")}`;

            const allThreadsOption = found.find((it) => it.textContent === allThreadsContent);
            const myThreadsOption = found.find((it) => it.textContent === myThreadsContent);
            expect(allThreadsOption).toBeTruthy();
            expect(myThreadsOption).toBeTruthy();

            const toSelect = newFilter === ThreadFilterType.My ? myThreadsOption : allThreadsOption;
            fireEvent.click(toSelect!);
        }

        type EventData = { sender: string | null; content: string | null };

        function findEvents(container: HTMLElement): EventData[] {
            return Array.from(container.querySelectorAll(".mx_EventTile")).map((el) => {
                const sender = el.querySelector(".mx_DisambiguatedProfile_displayName")?.textContent ?? null;
                const content = el.querySelector(".mx_EventTile_body")?.textContent ?? null;
                return { sender, content };
            });
        }

        function toEventData(event: MatrixEvent): EventData {
            return { sender: event.event.sender ?? null, content: event.event.content?.body ?? null };
        }

        it("correctly filters Thread List with multiple threads", async () => {
            const otherThread = mkThread({
                room,
                client: mockClient,
                authorId: SENDER,
                participantUserIds: [mockClient.getUserId()!],
            });

            const mixedThread = mkThread({
                room,
                client: mockClient,
                authorId: SENDER,
                participantUserIds: [SENDER, mockClient.getUserId()!],
            });

            const ownThread = mkThread({
                room,
                client: mockClient,
                authorId: mockClient.getUserId()!,
                participantUserIds: [mockClient.getUserId()!],
            });

            const threadRoots = [otherThread.rootEvent, mixedThread.rootEvent, ownThread.rootEvent];
            jest.spyOn(mockClient, "fetchRoomEvent").mockImplementation((_, eventId) => {
                const event = threadRoots.find((it) => it.getId() === eventId)?.event;
                return event ? Promise.resolve(event) : Promise.reject();
            });
            const [allThreads, myThreads] = room.threadsTimelineSets;
            allThreads!.addLiveEvent(otherThread.rootEvent);
            allThreads!.addLiveEvent(mixedThread.rootEvent);
            allThreads!.addLiveEvent(ownThread.rootEvent);
            myThreads!.addLiveEvent(mixedThread.rootEvent);
            myThreads!.addLiveEvent(ownThread.rootEvent);

            let events: EventData[] = [];
            const renderResult = render(<TestThreadPanel />);
            await waitFor(() => expect(renderResult.container.querySelector(".mx_AutoHideScrollbar")).toBeFalsy());
            await waitFor(() => {
                events = findEvents(renderResult.container);
                expect(findEvents(renderResult.container)).toHaveLength(3);
            });
            expect(events[0]).toEqual(toEventData(otherThread.rootEvent));
            expect(events[1]).toEqual(toEventData(mixedThread.rootEvent));
            expect(events[2]).toEqual(toEventData(ownThread.rootEvent));
            await waitFor(() => expect(renderResult.container.querySelector(".mx_ThreadPanel_dropdown")).toBeTruthy());
            toggleThreadFilter(renderResult.container, ThreadFilterType.My);
            await waitFor(() => expect(renderResult.container.querySelector(".mx_AutoHideScrollbar")).toBeFalsy());
            await waitFor(() => {
                events = findEvents(renderResult.container);
                expect(findEvents(renderResult.container)).toHaveLength(2);
            });
            expect(events[0]).toEqual(toEventData(mixedThread.rootEvent));
            expect(events[1]).toEqual(toEventData(ownThread.rootEvent));
            toggleThreadFilter(renderResult.container, ThreadFilterType.All);
            await waitFor(() => expect(renderResult.container.querySelector(".mx_AutoHideScrollbar")).toBeFalsy());
            await waitFor(() => {
                events = findEvents(renderResult.container);
                expect(findEvents(renderResult.container)).toHaveLength(3);
            });
            expect(events[0]).toEqual(toEventData(otherThread.rootEvent));
            expect(events[1]).toEqual(toEventData(mixedThread.rootEvent));
            expect(events[2]).toEqual(toEventData(ownThread.rootEvent));
        });

        it("correctly filters Thread List with a single, unparticipated thread", async () => {
            const otherThread = mkThread({
                room,
                client: mockClient,
                authorId: SENDER,
                participantUserIds: [mockClient.getUserId()!],
            });

            const threadRoots = [otherThread.rootEvent];
            jest.spyOn(mockClient, "fetchRoomEvent").mockImplementation((_, eventId) => {
                const event = threadRoots.find((it) => it.getId() === eventId)?.event;
                return event ? Promise.resolve(event) : Promise.reject();
            });
            const [allThreads] = room.threadsTimelineSets;
            allThreads!.addLiveEvent(otherThread.rootEvent);

            let events: EventData[] = [];
            const renderResult = render(<TestThreadPanel />);
            await waitFor(() => expect(renderResult.container.querySelector(".mx_AutoHideScrollbar")).toBeFalsy());
            await waitFor(() => {
                events = findEvents(renderResult.container);
                expect(findEvents(renderResult.container)).toHaveLength(1);
            });
            expect(events[0]).toEqual(toEventData(otherThread.rootEvent));
            await waitFor(() => expect(renderResult.container.querySelector(".mx_ThreadPanel_dropdown")).toBeTruthy());
            toggleThreadFilter(renderResult.container, ThreadFilterType.My);
            await waitFor(() => expect(renderResult.container.querySelector(".mx_AutoHideScrollbar")).toBeFalsy());
            await waitFor(() => {
                events = findEvents(renderResult.container);
                expect(findEvents(renderResult.container)).toHaveLength(0);
            });
            toggleThreadFilter(renderResult.container, ThreadFilterType.All);
            await waitFor(() => expect(renderResult.container.querySelector(".mx_AutoHideScrollbar")).toBeFalsy());
            await waitFor(() => {
                events = findEvents(renderResult.container);
                expect(findEvents(renderResult.container)).toHaveLength(1);
            });
            expect(events[0]).toEqual(toEventData(otherThread.rootEvent));
        });
    });
});
