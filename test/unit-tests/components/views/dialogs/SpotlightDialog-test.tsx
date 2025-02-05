/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { mocked } from "jest-mock";
import {
    ConnectionError,
    type IProtocol,
    type IPublicRoomsChunkRoom,
    JoinRule,
    type MatrixClient,
    type Room,
    RoomMember,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import sanitizeHtml from "sanitize-html";
import { fireEvent, render, screen, waitFor } from "jest-matrix-react";

import SpotlightDialog from "../../../../../src/components/views/dialogs/spotlight/SpotlightDialog";
import { Filter } from "../../../../../src/components/views/dialogs/spotlight/Filter";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import { LocalRoom, LOCAL_ROOM_ID_PREFIX } from "../../../../../src/models/LocalRoom";
import { DirectoryMember, startDmOnFirstMessage } from "../../../../../src/utils/direct-messages";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";
import { flushPromisesWithFakeTimers, mkRoom, stubClient } from "../../../../test-utils";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../../../src/settings/SettingLevel";
import defaultDispatcher from "../../../../../src/dispatcher/dispatcher";
import SdkConfig from "../../../../../src/SdkConfig";
import { Action } from "../../../../../src/dispatcher/actions";

jest.useFakeTimers();

jest.mock("../../../../../src/utils/Feedback");

jest.mock("../../../../../src/utils/direct-messages", () => ({
    // @ts-ignore
    ...jest.requireActual("../../../../../src/utils/direct-messages"),
    startDmOnFirstMessage: jest.fn(),
}));

jest.mock("../../../../../src/dispatcher/dispatcher", () => ({
    register: jest.fn(),
    dispatch: jest.fn(),
}));

interface IUserChunkMember {
    user_id: string;
    display_name?: string;
    avatar_url?: string;
}

interface MockClientOptions {
    userId?: string;
    homeserver?: string;
    thirdPartyProtocols?: Record<string, IProtocol>;
    rooms?: IPublicRoomsChunkRoom[];
    members?: RoomMember[];
    users?: IUserChunkMember[];
}

function mockClient({
    userId = "testuser",
    homeserver = "example.tld",
    thirdPartyProtocols = {},
    rooms = [],
    members = [],
    users = [],
}: MockClientOptions = {}): MatrixClient {
    stubClient();
    const cli = MatrixClientPeg.safeGet();
    cli.getUserId = jest.fn(() => userId);
    cli.getDomain = jest.fn(() => homeserver);
    cli.getHomeserverUrl = jest.fn(() => homeserver);
    cli.getThirdpartyProtocols = jest.fn(() => Promise.resolve(thirdPartyProtocols));
    cli.publicRooms = jest.fn((options) => {
        const searchTerm = options?.filter?.generic_search_term?.toLowerCase();
        const chunk = rooms.filter(
            (it) =>
                !searchTerm ||
                it.room_id.toLowerCase().includes(searchTerm) ||
                it.name?.toLowerCase().includes(searchTerm) ||
                sanitizeHtml(it?.topic || "", { allowedTags: [] })
                    .toLowerCase()
                    .includes(searchTerm) ||
                it.canonical_alias?.toLowerCase().includes(searchTerm) ||
                it.aliases?.find((alias) => alias.toLowerCase().includes(searchTerm)),
        );
        return Promise.resolve({
            chunk,
            total_room_count_estimate: chunk.length,
        });
    });
    cli.searchUserDirectory = jest.fn(({ term, limit }) => {
        const searchTerm = term?.toLowerCase();
        const results = users.filter(
            (it) =>
                !searchTerm ||
                it.user_id.toLowerCase().includes(searchTerm) ||
                it.display_name?.toLowerCase().includes(searchTerm),
        );
        return Promise.resolve({
            results: results.slice(0, limit ?? +Infinity),
            limited: !!limit && limit < results.length,
        });
    });
    cli.getProfileInfo = jest.fn(async (userId) => {
        const member = members.find((it) => it.userId === userId);
        if (member) {
            return Promise.resolve({
                displayname: member.rawDisplayName,
                avatar_url: member.getMxcAvatarUrl(),
            });
        } else {
            return Promise.reject();
        }
    });
    return cli;
}

describe("Spotlight Dialog", () => {
    const testPerson: IUserChunkMember = {
        user_id: "@janedoe:matrix.org",
        display_name: "Jane Doe",
        avatar_url: undefined,
    };

    const testPublicRoom: IPublicRoomsChunkRoom = {
        room_id: "!room247:matrix.org",
        name: "Room #247",
        topic: "We hope you'll have a <b>shining</b> experience!",
        world_readable: false,
        num_joined_members: 1,
        guest_can_join: false,
    };

    const testDMRoomId = "!testDM:example.com";
    const testDMUserId = "@alice:matrix.org";

    let testRoom: Room;
    let testDM: Room;
    let testLocalRoom: LocalRoom;

    let mockedClient: MatrixClient;

    beforeEach(() => {
        SdkConfig.reset();
        localStorage.clear();
        SettingsStore.reset();
        mockedClient = mockClient({ rooms: [testPublicRoom], users: [testPerson] });
        testRoom = mkRoom(mockedClient, "!test23:example.com");
        mocked(testRoom.getMyMembership).mockReturnValue(KnownMembership.Join);
        testLocalRoom = new LocalRoom(LOCAL_ROOM_ID_PREFIX + "test23", mockedClient, mockedClient.getUserId()!);
        testLocalRoom.updateMyMembership(KnownMembership.Join);
        mocked(mockedClient.getVisibleRooms).mockReturnValue([testRoom, testLocalRoom]);

        jest.spyOn(DMRoomMap, "shared").mockReturnValue({
            getUserIdForRoomId: jest.fn(),
        } as unknown as DMRoomMap);

        testDM = mkRoom(mockedClient, testDMRoomId);
        testDM.name = "Chat with Alice";
        mocked(testDM.getMyMembership).mockReturnValue(KnownMembership.Join);

        mocked(DMRoomMap.shared().getUserIdForRoomId).mockImplementation((roomId: string) => {
            if (roomId === testDMRoomId) {
                return testDMUserId;
            }
            return undefined;
        });

        mocked(mockedClient.getVisibleRooms).mockReturnValue([testRoom, testLocalRoom, testDM]);
    });

    describe("should apply filters supplied via props", () => {
        it("without filter", async () => {
            render(<SpotlightDialog onFinished={() => null} />);

            const filterChip = document.querySelector("div.mx_SpotlightDialog_filter");
            expect(filterChip).not.toBeInTheDocument();
        });

        it("with public room filter", async () => {
            render(<SpotlightDialog initialFilter={Filter.PublicRooms} onFinished={() => null} />);

            // search is debounced
            jest.advanceTimersByTime(200);
            await flushPromisesWithFakeTimers();

            const filterChip = document.querySelector("div.mx_SpotlightDialog_filter")!;
            expect(filterChip).toBeInTheDocument();
            expect(filterChip.innerHTML).toContain("Public rooms");

            await waitFor(() => {
                const content = document.querySelector("#mx_SpotlightDialog_content")!;
                const options = content.querySelectorAll("li.mx_SpotlightDialog_option");
                expect(options.length).toBe(1);
                expect(options[0].innerHTML).toContain(testPublicRoom.name);
            });
        });

        it("with people filter", async () => {
            render(
                <SpotlightDialog
                    initialFilter={Filter.People}
                    initialText={testPerson.display_name}
                    onFinished={() => null}
                />,
            );
            // search is debounced
            jest.advanceTimersByTime(200);
            await flushPromisesWithFakeTimers();

            const filterChip = document.querySelector("div.mx_SpotlightDialog_filter")!;
            expect(filterChip).toBeInTheDocument();
            expect(filterChip.innerHTML).toContain("People");

            await waitFor(() => {
                const content = document.querySelector("#mx_SpotlightDialog_content")!;
                const options = content.querySelectorAll("li.mx_SpotlightDialog_option");
                expect(options.length).toBeGreaterThanOrEqual(1);
                expect(options[0]!.innerHTML).toContain(testPerson.display_name);
            });
        });
    });

    describe("when MSC3946 dynamic room predecessors is enabled", () => {
        beforeEach(async () => {
            await SettingsStore.setValue("feature_dynamic_room_predecessors", null, SettingLevel.DEVICE, true);
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it("should call getVisibleRooms with MSC3946 dynamic room predecessors", async () => {
            render(<SpotlightDialog onFinished={() => null} />);
            jest.advanceTimersByTime(200);
            await flushPromisesWithFakeTimers();
            expect(mockedClient.getVisibleRooms).toHaveBeenCalledWith(true);
        });
    });

    describe("should apply manually selected filter", () => {
        it("with public rooms", async () => {
            render(<SpotlightDialog onFinished={() => null} />);
            jest.advanceTimersByTime(200);
            await flushPromisesWithFakeTimers();

            fireEvent.click(screen.getByText("Public rooms"));
            // wrapper.find("#mx_SpotlightDialog_button_explorePublicRooms").first().simulate("click");
            // search is debounced
            jest.advanceTimersByTime(200);
            await flushPromisesWithFakeTimers();

            const filterChip = document.querySelector("div.mx_SpotlightDialog_filter")!;
            expect(filterChip).toBeInTheDocument();
            expect(filterChip.innerHTML).toContain("Public rooms");

            await waitFor(() => {
                const content = document.querySelector("#mx_SpotlightDialog_content")!;
                const options = content.querySelectorAll("li.mx_SpotlightDialog_option");
                expect(options.length).toBe(1);
                expect(options[0]!.innerHTML).toContain(testPublicRoom.name);
            });

            // assert that getVisibleRooms is called without MSC3946 dynamic room predecessors
            expect(mockedClient.getVisibleRooms).toHaveBeenCalledWith(false);
        });
        it("with people", async () => {
            render(<SpotlightDialog initialText={testPerson.display_name} onFinished={() => null} />);
            jest.advanceTimersByTime(200);
            await flushPromisesWithFakeTimers();

            fireEvent.click(screen.getByText("People"));

            // search is debounced
            jest.advanceTimersByTime(200);
            await flushPromisesWithFakeTimers();

            const filterChip = document.querySelector("div.mx_SpotlightDialog_filter")!;
            expect(filterChip).toBeInTheDocument();
            expect(filterChip.innerHTML).toContain("People");

            await waitFor(() => {
                const content = document.querySelector("#mx_SpotlightDialog_content")!;
                const options = content.querySelectorAll("li.mx_SpotlightDialog_option");
                expect(options.length).toBeGreaterThanOrEqual(1);
                expect(options[0]!.innerHTML).toContain(testPerson.display_name);
            });
        });
    });

    describe("should allow clearing filter manually", () => {
        it("with public room filter", async () => {
            render(<SpotlightDialog initialFilter={Filter.PublicRooms} onFinished={() => null} />);
            // search is debounced
            jest.advanceTimersByTime(200);
            await flushPromisesWithFakeTimers();

            let filterChip = document.querySelector("div.mx_SpotlightDialog_filter")!;
            expect(filterChip).toBeInTheDocument();
            expect(filterChip.innerHTML).toContain("Public rooms");

            fireEvent.click(filterChip.querySelector("div.mx_SpotlightDialog_filter--close")!);
            jest.advanceTimersByTime(200);
            await flushPromisesWithFakeTimers();

            filterChip = document.querySelector("div.mx_SpotlightDialog_filter")!;
            expect(filterChip).not.toBeInTheDocument();
        });
        it("with people filter", async () => {
            render(
                <SpotlightDialog
                    initialFilter={Filter.People}
                    initialText={testPerson.display_name}
                    onFinished={() => null}
                />,
            );
            // search is debounced
            jest.advanceTimersByTime(200);
            await flushPromisesWithFakeTimers();

            let filterChip = document.querySelector("div.mx_SpotlightDialog_filter");
            expect(filterChip).toBeInTheDocument();
            expect(filterChip!.innerHTML).toContain("People");

            fireEvent.click(filterChip!.querySelector("div.mx_SpotlightDialog_filter--close")!);
            jest.advanceTimersByTime(1);
            await flushPromisesWithFakeTimers();

            filterChip = document.querySelector("div.mx_SpotlightDialog_filter");
            expect(filterChip).not.toBeInTheDocument();
        });
    });

    describe("searching for rooms", () => {
        let options: NodeListOf<Element>;

        beforeAll(async () => {
            render(<SpotlightDialog initialText="test23" onFinished={() => null} />);
            // search is debounced
            jest.advanceTimersByTime(200);
            await flushPromisesWithFakeTimers();

            const content = document.querySelector("#mx_SpotlightDialog_content")!;
            options = content.querySelectorAll("li.mx_SpotlightDialog_option");
        });

        it("should find Rooms", () => {
            expect(options).toHaveLength(4);
            expect(options[0]!.innerHTML).toContain(testRoom.name);
        });

        it("should not find LocalRooms", () => {
            expect(options).toHaveLength(4);
            expect(options[0]!.innerHTML).not.toContain(testLocalRoom.name);
        });
    });

    it("should not filter out users sent by the server", async () => {
        mocked(mockedClient.searchUserDirectory).mockResolvedValue({
            results: [
                { user_id: "@user1:server", display_name: "User Alpha", avatar_url: "mxc://1/avatar" },
                { user_id: "@user2:server", display_name: "User Beta", avatar_url: "mxc://2/avatar" },
            ],
            limited: false,
        });

        render(<SpotlightDialog initialFilter={Filter.People} initialText="Alpha" onFinished={() => null} />);
        // search is debounced
        jest.advanceTimersByTime(200);
        await flushPromisesWithFakeTimers();

        await waitFor(() => {
            const content = document.querySelector("#mx_SpotlightDialog_content")!;
            const options = content.querySelectorAll("li.mx_SpotlightDialog_option");
            expect(options.length).toBeGreaterThanOrEqual(2);
            expect(options[0]).toHaveTextContent("User Alpha");
            expect(options[1]).toHaveTextContent("User Beta");
        });
    });

    it("should not filter out users sent by the server even if a local suggestion gets filtered out", async () => {
        const member = new RoomMember(testRoom.roomId, testPerson.user_id);
        member.name = member.rawDisplayName = testPerson.display_name!;
        member.getMxcAvatarUrl = jest.fn().mockReturnValue("mxc://0/avatar");
        mocked(testRoom.getJoinedMembers).mockReturnValue([member]);
        mocked(mockedClient.searchUserDirectory).mockResolvedValue({
            results: [
                { user_id: "@janedoe:matrix.org", display_name: "User Alpha", avatar_url: "mxc://1/avatar" },
                { user_id: "@johndoe:matrix.org", display_name: "User Beta", avatar_url: "mxc://2/avatar" },
            ],
            limited: false,
        });

        render(<SpotlightDialog initialFilter={Filter.People} initialText="Beta" onFinished={() => null} />);
        // search is debounced
        jest.advanceTimersByTime(200);
        await flushPromisesWithFakeTimers();

        await waitFor(() => {
            const content = document.querySelector("#mx_SpotlightDialog_content")!;
            const options = content.querySelectorAll("li.mx_SpotlightDialog_option");
            expect(options.length).toBeGreaterThanOrEqual(2);
            expect(options[0]).toHaveTextContent(testPerson.display_name!);
            expect(options[1]).toHaveTextContent("User Beta");
        });
    });

    it("show non-matching query members with DMs if they are present in the server search results", async () => {
        mocked(mockedClient.searchUserDirectory).mockResolvedValue({
            results: [
                { user_id: testDMUserId, display_name: "Alice Wonder", avatar_url: "mxc://1/avatar" },
                { user_id: "@bob:matrix.org", display_name: "Bob Wonder", avatar_url: "mxc://2/avatar" },
            ],
            limited: false,
        });
        render(
            <SpotlightDialog initialFilter={Filter.People} initialText="Something Wonder" onFinished={() => null} />,
        );
        // search is debounced
        jest.advanceTimersByTime(200);
        await flushPromisesWithFakeTimers();

        await waitFor(() => {
            const content = document.querySelector("#mx_SpotlightDialog_content")!;
            const options = content.querySelectorAll("li.mx_SpotlightDialog_option");
            expect(options.length).toBeGreaterThanOrEqual(2);
            expect(options[0]).toHaveTextContent(testDMUserId);
            expect(options[1]).toHaveTextContent("Bob Wonder");
        });
    });

    it("don't sort the order of users sent by the server", async () => {
        const serverList = [
            { user_id: "@user2:server", display_name: "User Beta", avatar_url: "mxc://2/avatar" },
            { user_id: "@user1:server", display_name: "User Alpha", avatar_url: "mxc://1/avatar" },
        ];
        mocked(mockedClient.searchUserDirectory).mockResolvedValue({
            results: serverList,
            limited: false,
        });

        render(<SpotlightDialog initialFilter={Filter.People} initialText="User" onFinished={() => null} />);
        // search is debounced
        jest.advanceTimersByTime(200);
        await flushPromisesWithFakeTimers();

        await waitFor(() => {
            const content = document.querySelector("#mx_SpotlightDialog_content")!;
            const options = content.querySelectorAll("li.mx_SpotlightDialog_option");
            expect(options.length).toBeGreaterThanOrEqual(2);
            expect(options[0]).toHaveTextContent("User Beta");
            expect(options[1]).toHaveTextContent("User Alpha");
        });
    });

    it("should start a DM when clicking a person", async () => {
        render(
            <SpotlightDialog
                initialFilter={Filter.People}
                initialText={testPerson.display_name}
                onFinished={() => null}
            />,
        );

        jest.advanceTimersByTime(200);
        await flushPromisesWithFakeTimers();

        await waitFor(() => {
            const options = document.querySelectorAll("li.mx_SpotlightDialog_option");
            expect(options.length).toBeGreaterThanOrEqual(1);
            expect(options[0]!.innerHTML).toContain(testPerson.display_name);
            fireEvent.click(options[0]!);
            expect(startDmOnFirstMessage).toHaveBeenCalledWith(mockedClient, [new DirectoryMember(testPerson)]);
        });
    });

    it("should pass via of the server being explored when joining room from directory", async () => {
        SdkConfig.put({
            room_directory: {
                servers: ["example.tld"],
            },
        });
        localStorage.setItem("mx_last_room_directory_server", "example.tld");

        render(<SpotlightDialog initialFilter={Filter.PublicRooms} onFinished={() => null} />);

        jest.advanceTimersByTime(200);
        await flushPromisesWithFakeTimers();

        await waitFor(() => {
            const content = document.querySelector("#mx_SpotlightDialog_content")!;
            const options = content.querySelectorAll("li.mx_SpotlightDialog_option");
            expect(options.length).toBe(1);
            expect(options[0].innerHTML).toContain(testPublicRoom.name);

            fireEvent.click(options[0].querySelector("[role='button']")!);
            expect(defaultDispatcher.dispatch).toHaveBeenCalledTimes(1);
            expect(defaultDispatcher.dispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: "view_room",
                    room_id: testPublicRoom.room_id,
                    via_servers: ["example.tld"],
                }),
            );
        });
    });

    describe("nsfw public rooms filter", () => {
        const nsfwNameRoom: IPublicRoomsChunkRoom = {
            room_id: "@room1:matrix.org",
            name: "Room 1 [NSFW]",
            topic: undefined,
            world_readable: false,
            num_joined_members: 1,
            guest_can_join: false,
        };

        const nsfwTopicRoom: IPublicRoomsChunkRoom = {
            room_id: "@room2:matrix.org",
            name: "Room 2",
            topic: "A room with a topic that includes nsfw",
            world_readable: false,
            num_joined_members: 1,
            guest_can_join: false,
        };

        const potatoRoom: IPublicRoomsChunkRoom = {
            room_id: "@room3:matrix.org",
            name: "Potato Room 3",
            topic: "Room where we discuss potatoes",
            world_readable: false,
            num_joined_members: 1,
            guest_can_join: false,
        };

        beforeEach(async () => {
            mockedClient = mockClient({ rooms: [nsfwNameRoom, nsfwTopicRoom, potatoRoom], users: [testPerson] });
            await SettingsStore.setValue("SpotlightSearch.showNsfwPublicRooms", null, SettingLevel.DEVICE, false);
        });

        it("does not display rooms with nsfw keywords in results when showNsfwPublicRooms is falsy", async () => {
            render(<SpotlightDialog initialFilter={Filter.PublicRooms} onFinished={() => null} />);

            // search is debounced
            jest.advanceTimersByTime(200);
            await flushPromisesWithFakeTimers();

            await waitFor(() => {
                expect(screen.getByText(potatoRoom.name!)).toBeInTheDocument();
                expect(screen.queryByText(nsfwTopicRoom.name!)).not.toBeInTheDocument();
                expect(screen.queryByText(nsfwTopicRoom.name!)).not.toBeInTheDocument();
            });
        });

        it("displays rooms with nsfw keywords in results when showNsfwPublicRooms is truthy", async () => {
            await SettingsStore.setValue("SpotlightSearch.showNsfwPublicRooms", null, SettingLevel.DEVICE, true);
            render(<SpotlightDialog initialFilter={Filter.PublicRooms} onFinished={() => null} />);

            // search is debounced
            jest.advanceTimersByTime(200);
            await flushPromisesWithFakeTimers();

            await waitFor(() => {
                expect(screen.getByText(nsfwTopicRoom.name!)).toBeInTheDocument();
                expect(screen.getByText(nsfwNameRoom.name!)).toBeInTheDocument();
                expect(screen.getByText(potatoRoom.name!)).toBeInTheDocument();
            });
        });
    });

    it("should show error if /publicRooms API failed", async () => {
        mocked(mockedClient.publicRooms).mockRejectedValue(new ConnectionError("Failed to fetch"));
        render(<SpotlightDialog initialFilter={Filter.PublicRooms} onFinished={() => null} />);

        jest.advanceTimersByTime(200);
        await flushPromisesWithFakeTimers();

        await waitFor(() => expect(screen.getByText("Failed to query public rooms")).toBeInTheDocument());
    });

    describe("knock rooms", () => {
        const knockRoom: IPublicRoomsChunkRoom = {
            guest_can_join: false,
            join_rule: JoinRule.Knock,
            num_joined_members: 0,
            room_id: "some-room-id",
            world_readable: false,
        };

        const viewRoomParams = {
            action: Action.ViewRoom,
            metricsTrigger: "WebUnifiedSearch",
            metricsViaKeyboard: false,
            room_alias: undefined,
            room_id: knockRoom.room_id,
            should_peek: false,
            via_servers: ["example.tld"],
        };

        beforeEach(() => (mockedClient = mockClient({ rooms: [knockRoom] })));

        describe("when disabling feature", () => {
            beforeEach(async () => {
                await SettingsStore.setValue("feature_ask_to_join", null, SettingLevel.DEVICE, false);

                render(<SpotlightDialog initialFilter={Filter.PublicRooms} onFinished={() => {}} />);

                // search is debounced
                jest.advanceTimersByTime(200);
                await flushPromisesWithFakeTimers();

                fireEvent.click(await screen.findByRole("button", { name: "View" }));
            });

            it("should not skip to auto join", async () => {
                expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({ ...viewRoomParams, auto_join: true });
            });

            it("should not prompt ask to join", async () => {
                expect(defaultDispatcher.dispatch).not.toHaveBeenCalledWith({ action: Action.PromptAskToJoin });
            });
        });

        describe("when enabling feature", () => {
            beforeEach(async () => {
                await SettingsStore.setValue("feature_ask_to_join", null, SettingLevel.DEVICE, true);
                jest.spyOn(mockedClient, "getRoom").mockReturnValue(null);

                render(<SpotlightDialog initialFilter={Filter.PublicRooms} onFinished={() => {}} />);

                await waitFor(() => fireEvent.click(screen.getByRole("button", { name: "Ask to join" })));
            });

            it("should skip to auto join", async () => {
                expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({ ...viewRoomParams, auto_join: false });
            });

            it("should prompt ask to join", async () => {
                expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({ action: Action.PromptAskToJoin });
            });
        });
    });
});
