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

// eslint-disable-next-line deprecate/import
import { mount, ReactWrapper } from "enzyme";
import { mocked } from "jest-mock";
import { IProtocol, IPublicRoomsChunkRoom, MatrixClient, Room, RoomMember } from "matrix-js-sdk/src/matrix";
import { sleep } from "matrix-js-sdk/src/utils";
import React from "react";
import { act } from "react-dom/test-utils";
import sanitizeHtml from "sanitize-html";

import SpotlightDialog, { Filter } from "../../../../src/components/views/dialogs/spotlight/SpotlightDialog";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import { LocalRoom, LOCAL_ROOM_ID_PREFIX } from "../../../../src/models/LocalRoom";
import { DirectoryMember, startDmOnFirstMessage } from "../../../../src/utils/direct-messages";
import DMRoomMap from "../../../../src/utils/DMRoomMap";
import { mkRoom, stubClient } from "../../../test-utils";

jest.mock("../../../../src/utils/direct-messages", () => ({
    // @ts-ignore
    ...jest.requireActual("../../../../src/utils/direct-messages"),
    startDmOnFirstMessage: jest.fn(),
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

function mockClient(
    {
        userId = "testuser",
        homeserver = "example.tld",
        thirdPartyProtocols = {},
        rooms = [],
        members = [],
        users = [],
    }: MockClientOptions = {},
): MatrixClient {
    stubClient();
    const cli = MatrixClientPeg.get();
    MatrixClientPeg.getHomeserverName = jest.fn(() => homeserver);
    cli.getUserId = jest.fn(() => userId);
    cli.getHomeserverUrl = jest.fn(() => homeserver);
    cli.getThirdpartyProtocols = jest.fn(() => Promise.resolve(thirdPartyProtocols));
    cli.publicRooms = jest.fn((options) => {
        const searchTerm = options?.filter?.generic_search_term?.toLowerCase();
        const chunk = rooms.filter(it =>
            !searchTerm ||
            it.room_id.toLowerCase().includes(searchTerm) ||
            it.name?.toLowerCase().includes(searchTerm) ||
            sanitizeHtml(it?.topic, { allowedTags: [] }).toLowerCase().includes(searchTerm) ||
            it.canonical_alias?.toLowerCase().includes(searchTerm) ||
            it.aliases?.find(alias => alias.toLowerCase().includes(searchTerm)));
        return Promise.resolve({
            chunk,
            total_room_count_estimate: chunk.length,
        });
    });
    cli.searchUserDirectory = jest.fn(({ term, limit }) => {
        const searchTerm = term?.toLowerCase();
        const results = users.filter(it => !searchTerm ||
            it.user_id.toLowerCase().includes(searchTerm) ||
            it.display_name.toLowerCase().includes(searchTerm));
        return Promise.resolve({
            results: results.slice(0, limit ?? +Infinity),
            limited: limit && limit < results.length,
        });
    });
    cli.getProfileInfo = jest.fn(async (userId) => {
        const member = members.find(it => it.userId === userId);
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
        room_id: "@room247:matrix.org",
        name: "Room #247",
        topic: "We hope you'll have a <b>shining</b> experience!",
        world_readable: false,
        num_joined_members: 1,
        guest_can_join: false,
    };

    let testRoom: Room;
    let testLocalRoom: LocalRoom;

    let mockedClient: MatrixClient;

    beforeEach(() => {
        mockedClient = mockClient({ rooms: [testPublicRoom], users: [testPerson] });
        testRoom = mkRoom(mockedClient, "!test23:example.com");
        mocked(testRoom.getMyMembership).mockReturnValue("join");
        testLocalRoom = new LocalRoom(LOCAL_ROOM_ID_PREFIX + "test23", mockedClient, mockedClient.getUserId());
        testLocalRoom.updateMyMembership("join");
        mocked(mockedClient.getVisibleRooms).mockReturnValue([testRoom, testLocalRoom]);

        jest.spyOn(DMRoomMap, "shared").mockReturnValue({
            getUserIdForRoomId: jest.fn(),
        } as unknown as DMRoomMap);
    });
    describe("should apply filters supplied via props", () => {
        it("without filter", async () => {
            const wrapper = mount(
                <SpotlightDialog
                    initialFilter={null}
                    onFinished={() => null} />,
            );
            await act(async () => {
                await sleep(200);
            });
            wrapper.update();

            const filterChip = wrapper.find("div.mx_SpotlightDialog_filter");
            expect(filterChip.exists()).toBeFalsy();

            wrapper.unmount();
        });
        it("with public room filter", async () => {
            const wrapper = mount(
                <SpotlightDialog
                    initialFilter={Filter.PublicRooms}
                    onFinished={() => null} />,
            );
            await act(async () => {
                await sleep(200);
            });
            wrapper.update();

            const filterChip = wrapper.find("div.mx_SpotlightDialog_filter");
            expect(filterChip.exists()).toBeTruthy();
            expect(filterChip.text()).toEqual("Public rooms");

            const content = wrapper.find("#mx_SpotlightDialog_content");
            const options = content.find("div.mx_SpotlightDialog_option");
            expect(options.length).toBe(1);
            expect(options.first().text()).toContain(testPublicRoom.name);

            wrapper.unmount();
        });
        it("with people filter", async () => {
            const wrapper = mount(
                <SpotlightDialog
                    initialFilter={Filter.People}
                    initialText={testPerson.display_name}
                    onFinished={() => null} />,
            );
            await act(async () => {
                await sleep(200);
            });
            wrapper.update();

            const filterChip = wrapper.find("div.mx_SpotlightDialog_filter");
            expect(filterChip.exists()).toBeTruthy();
            expect(filterChip.text()).toEqual("People");

            const content = wrapper.find("#mx_SpotlightDialog_content");
            const options = content.find("div.mx_SpotlightDialog_option");
            expect(options.length).toBeGreaterThanOrEqual(1);
            expect(options.first().text()).toContain(testPerson.display_name);

            wrapper.unmount();
        });
    });

    describe("should apply manually selected filter", () => {
        it("with public rooms", async () => {
            const wrapper = mount(
                <SpotlightDialog
                    onFinished={() => null} />,
            );
            await act(async () => {
                await sleep(1);
            });
            wrapper.update();
            wrapper.find("#mx_SpotlightDialog_button_explorePublicRooms").first().simulate("click");
            await act(async () => {
                await sleep(200);
            });
            wrapper.update();

            const filterChip = wrapper.find("div.mx_SpotlightDialog_filter");
            expect(filterChip.exists()).toBeTruthy();
            expect(filterChip.text()).toEqual("Public rooms");

            const content = wrapper.find("#mx_SpotlightDialog_content");
            const options = content.find("div.mx_SpotlightDialog_option");
            expect(options.length).toBe(1);
            expect(options.first().text()).toContain(testPublicRoom.name);

            wrapper.unmount();
        });
        it("with people", async () => {
            const wrapper = mount(
                <SpotlightDialog
                    initialText={testPerson.display_name}
                    onFinished={() => null} />,
            );
            await act(async () => {
                await sleep(1);
            });
            wrapper.update();
            wrapper.find("#mx_SpotlightDialog_button_startChat").first().simulate("click");
            await act(async () => {
                await sleep(200);
            });
            wrapper.update();

            const filterChip = wrapper.find("div.mx_SpotlightDialog_filter");
            expect(filterChip.exists()).toBeTruthy();
            expect(filterChip.text()).toEqual("People");

            const content = wrapper.find("#mx_SpotlightDialog_content");
            const options = content.find("div.mx_SpotlightDialog_option");
            expect(options.length).toBeGreaterThanOrEqual(1);
            expect(options.first().text()).toContain(testPerson.display_name);

            wrapper.unmount();
        });
    });

    describe("should allow clearing filter manually", () => {
        it("with public room filter", async () => {
            const wrapper = mount(
                <SpotlightDialog
                    initialFilter={Filter.PublicRooms}
                    onFinished={() => null} />,
            );
            await act(async () => {
                await sleep(200);
            });
            wrapper.update();

            let filterChip = wrapper.find("div.mx_SpotlightDialog_filter");
            expect(filterChip.exists()).toBeTruthy();
            expect(filterChip.text()).toEqual("Public rooms");

            filterChip.find("div.mx_SpotlightDialog_filter--close").simulate("click");
            await act(async () => {
                await sleep(1);
            });
            wrapper.update();

            filterChip = wrapper.find("div.mx_SpotlightDialog_filter");
            expect(filterChip.exists()).toBeFalsy();

            wrapper.unmount();
        });
        it("with people filter", async () => {
            const wrapper = mount(
                <SpotlightDialog
                    initialFilter={Filter.People}
                    initialText={testPerson.display_name}
                    onFinished={() => null} />,
            );
            await act(async () => {
                await sleep(200);
            });
            wrapper.update();

            let filterChip = wrapper.find("div.mx_SpotlightDialog_filter");
            expect(filterChip.exists()).toBeTruthy();
            expect(filterChip.text()).toEqual("People");

            filterChip.find("div.mx_SpotlightDialog_filter--close").simulate("click");
            await act(async () => {
                await sleep(1);
            });
            wrapper.update();

            filterChip = wrapper.find("div.mx_SpotlightDialog_filter");
            expect(filterChip.exists()).toBeFalsy();

            wrapper.unmount();
        });
    });

    describe("searching for rooms", () => {
        let wrapper: ReactWrapper;
        let options: ReactWrapper;

        beforeAll(async () => {
            wrapper = mount(
                <SpotlightDialog
                    initialText="test23"
                    onFinished={() => null} />,
            );
            await act(async () => {
                await sleep(200);
            });
            wrapper.update();

            const content = wrapper.find("#mx_SpotlightDialog_content");
            options = content.find("div.mx_SpotlightDialog_option");
        });

        afterAll(() => {
            wrapper.unmount();
        });

        it("should find Rooms", () => {
            expect(options.length).toBe(3);
            expect(options.first().text()).toContain(testRoom.name);
        });

        it("should not find LocalRooms", () => {
            expect(options.length).toBe(3);
            expect(options.first().text()).not.toContain(testLocalRoom.name);
        });
    });

    it("should start a DM when clicking a person", async () => {
        const wrapper = mount(
            <SpotlightDialog
                initialFilter={Filter.People}
                initialText={testPerson.display_name}
                onFinished={() => null} />,
        );

        await act(async () => {
            await sleep(200);
        });
        wrapper.update();

        const options = wrapper.find("div.mx_SpotlightDialog_option");
        expect(options.length).toBeGreaterThanOrEqual(1);
        expect(options.first().text()).toContain(testPerson.display_name);

        options.first().simulate("click");
        expect(startDmOnFirstMessage).toHaveBeenCalledWith(mockedClient, [new DirectoryMember(testPerson)]);

        wrapper.unmount();
    });
});
