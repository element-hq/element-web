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
import { mount } from "enzyme";
import { sleep } from "matrix-js-sdk/src/utils";
import React from "react";
import { act } from "react-dom/test-utils";

import { usePublicRoomDirectory } from "../../src/hooks/usePublicRoomDirectory";
import { MatrixClientPeg } from "../../src/MatrixClientPeg";
import { stubClient } from "../test-utils/test-utils";

function PublicRoomComponent({ onClick }) {
    const roomDirectory = usePublicRoomDirectory();

    const {
        ready,
        loading,
        publicRooms,
    } = roomDirectory;

    return <div onClick={() => onClick(roomDirectory)}>
        { (!ready || loading) && `ready: ${ready}, loading: ${loading}` }
        { publicRooms[0] && (
            `Name: ${publicRooms[0].name}`
        ) }
    </div>;
}

describe("usePublicRoomDirectory", () => {
    let cli;

    beforeEach(() => {
        stubClient();
        cli = MatrixClientPeg.get();

        MatrixClientPeg.getHomeserverName = () => "matrix.org";
        cli.getThirdpartyProtocols = () => Promise.resolve({});
        cli.publicRooms = (({ filter: { generic_search_term: query } }) => Promise.resolve({
            chunk: [{
                room_id: "hello world!",
                name: query,
                world_readable: true,
                guest_can_join: true,
                num_joined_members: 1,
            }],
            total_room_count_estimate: 1,
        }));
    });

    it("should display public rooms when searching", async () => {
        const query = "ROOM NAME";

        const wrapper = mount(<PublicRoomComponent onClick={(hook) => {
            hook.search({
                limit: 1,
                query,
            });
        }} />);

        expect(wrapper.text()).toBe("ready: false, loading: false");

        await act(async () => {
            await sleep(1);
            wrapper.simulate("click");
            return act(() => sleep(1));
        });

        expect(wrapper.text()).toContain(query);
    });

    it("should work with empty queries", async () => {
        const wrapper = mount(<PublicRoomComponent onClick={(hook) => {
            hook.search({
                limit: 1,
                query: "",
            });
        }} />);

        await act(async () => {
            await sleep(1);
            wrapper.simulate("click");
            return act(() => sleep(1));
        });

        expect(wrapper.text()).toBe("");
    });

    it("should recover from a server exception", async () => {
        cli.publicRooms = () => { throw new Error("Oops"); };
        const query = "ROOM NAME";

        const wrapper = mount(<PublicRoomComponent onClick={(hook) => {
            hook.search({
                limit: 1,
                query,
            });
        }} />);
        await act(async () => {
            await sleep(1);
            wrapper.simulate("click");
            return act(() => sleep(1));
        });

        expect(wrapper.text()).toBe("");
    });
});
