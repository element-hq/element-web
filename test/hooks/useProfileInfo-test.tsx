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

import { waitFor } from "@testing-library/react";
import { renderHook, act } from "@testing-library/react-hooks/dom";
import { MatrixClient } from "matrix-js-sdk/src/matrix";

import { useProfileInfo } from "../../src/hooks/useProfileInfo";
import { MatrixClientPeg } from "../../src/MatrixClientPeg";
import { stubClient } from "../test-utils/test-utils";

function render() {
    return renderHook(() => useProfileInfo());
}

describe("useProfileInfo", () => {
    let cli: MatrixClient;

    beforeEach(() => {
        stubClient();
        cli = MatrixClientPeg.safeGet();
        cli.getProfileInfo = (query) => {
            return Promise.resolve({
                avatar_url: undefined,
                displayname: query,
            });
        };
    });

    it("should display user profile when searching", async () => {
        const query = "@user:home.server";

        const { result } = render();

        act(() => {
            result.current.search({ query });
        });

        await waitFor(() => expect(result.current.ready).toBe(true));

        expect(result.current.profile?.display_name).toBe(query);
    });

    it("should work with empty queries", async () => {
        const query = "";

        const { result } = render();

        act(() => {
            result.current.search({ query });
        });

        await waitFor(() => expect(result.current.ready).toBe(true));

        expect(result.current.profile).toBeNull();
    });

    it("should treat invalid mxids as empty queries", async () => {
        const queries = ["@user", "user@home.server"];

        for (const query of queries) {
            const { result } = render();

            act(() => {
                result.current.search({ query });
            });

            await waitFor(() => expect(result.current.ready).toBe(true));

            expect(result.current.profile).toBeNull();
        }
    });

    it("should recover from a server exception", async () => {
        cli.getProfileInfo = () => {
            throw new Error("Oops");
        };
        const query = "@user:home.server";

        const { result } = render();

        act(() => {
            result.current.search({ query });
        });

        await waitFor(() => expect(result.current.ready).toBe(true));

        expect(result.current.profile).toBeNull();
    });

    it("should be able to handle an empty result", async () => {
        cli.getProfileInfo = () => null as unknown as Promise<{}>;
        const query = "@user:home.server";

        const { result } = render();

        act(() => {
            result.current.search({ query });
        });

        await waitFor(() => expect(result.current.ready).toBe(true));

        expect(result.current.profile?.display_name).toBeUndefined();
    });
});
