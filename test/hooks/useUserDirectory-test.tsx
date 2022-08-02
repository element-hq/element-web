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

import { useUserDirectory } from "../../src/hooks/useUserDirectory";
import { MatrixClientPeg } from "../../src/MatrixClientPeg";
import { stubClient } from "../test-utils";

function UserDirectoryComponent({ onClick }) {
    const userDirectory = useUserDirectory();

    const {
        ready,
        loading,
        users,
    } = userDirectory;

    return <div onClick={() => onClick(userDirectory)}>
        { users[0]
            ? (
                `Name: ${users[0].name}`
            )
            : `ready: ${ready}, loading: ${loading}` }
    </div>;
}

describe("useUserDirectory", () => {
    let cli;

    beforeEach(() => {
        stubClient();
        cli = MatrixClientPeg.get();

        MatrixClientPeg.getHomeserverName = () => "matrix.org";
        cli.getThirdpartyProtocols = () => Promise.resolve({});
        cli.searchUserDirectory = (({ term: query }) => Promise.resolve({
            results: [{
                user_id: "@bob:matrix.org",
                display_name: query,
            }] },
        ));
    });

    it("search for users in the identity server", async () => {
        const query = "Bob";

        const wrapper = mount(<UserDirectoryComponent onClick={(hook) => {
            hook.search({
                limit: 1,
                query,
            });
        }} />);

        expect(wrapper.text()).toBe("ready: true, loading: false");

        await act(async () => {
            await sleep(1);
            wrapper.simulate("click");
            return act(() => sleep(1));
        });

        expect(wrapper.text()).toContain(query);
    });

    it("should work with empty queries", async () => {
        const query = "";

        const wrapper = mount(<UserDirectoryComponent onClick={(hook) => {
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
        expect(wrapper.text()).toBe("ready: true, loading: false");
    });

    it("should recover from a server exception", async () => {
        cli.searchUserDirectory = () => { throw new Error("Oops"); };
        const query = "Bob";

        const wrapper = mount(<UserDirectoryComponent onClick={(hook) => {
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
        expect(wrapper.text()).toBe("ready: true, loading: false");
    });
});
