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

import { useProfileInfo } from "../../src/hooks/useProfileInfo";
import { MatrixClientPeg } from "../../src/MatrixClientPeg";
import { stubClient } from "../test-utils/test-utils";

function ProfileInfoComponent({ onClick }) {
    const profileInfo = useProfileInfo();

    const {
        ready,
        loading,
        profile,
    } = profileInfo;

    return <div onClick={() => onClick(profileInfo)}>
        { (!ready || loading) && `ready: ${ready}, loading: ${loading}` }
        { profile && (
            `Name: ${profile.display_name}`
        ) }
    </div>;
}

describe("useProfileInfo", () => {
    let cli;

    beforeEach(() => {
        stubClient();
        cli = MatrixClientPeg.get();
        cli.getProfileInfo = (query) => {
            return Promise.resolve({
                avatar_url: undefined,
                displayname: query,
            });
        };
    });

    it("should display user profile when searching", async () => {
        const query = "@user:home.server";

        const wrapper = mount(<ProfileInfoComponent onClick={(hook) => {
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

        expect(wrapper.text()).toContain(query);
    });

    it("should work with empty queries", async () => {
        const wrapper = mount(<ProfileInfoComponent onClick={(hook) => {
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

    it("should treat invalid mxids as empty queries", async () => {
        const queries = [
            "@user",
            "user@home.server",
        ];

        for (const query of queries) {
            const wrapper = mount(<ProfileInfoComponent onClick={(hook) => {
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
        }
    });

    it("should recover from a server exception", async () => {
        cli.getProfileInfo = () => { throw new Error("Oops"); };
        const query = "@user:home.server";

        const wrapper = mount(<ProfileInfoComponent onClick={(hook) => {
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

    it("should be able to handle an empty result", async () => {
        cli.getProfileInfo = () => null;
        const query = "@user:home.server";

        const wrapper = mount(<ProfileInfoComponent onClick={(hook) => {
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
