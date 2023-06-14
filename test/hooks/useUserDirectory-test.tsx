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

import { useUserDirectory } from "../../src/hooks/useUserDirectory";
import { MatrixClientPeg } from "../../src/MatrixClientPeg";
import { stubClient } from "../test-utils";

function render() {
    return renderHook(() => useUserDirectory());
}

describe("useUserDirectory", () => {
    let cli: MatrixClient;

    beforeEach(() => {
        stubClient();
        cli = MatrixClientPeg.safeGet();

        MatrixClientPeg.getHomeserverName = () => "matrix.org";
        cli.getThirdpartyProtocols = () => Promise.resolve({});
        cli.searchUserDirectory = ({ term: query }) =>
            Promise.resolve({
                results: [
                    {
                        user_id: "@bob:matrix.org",
                        display_name: query,
                    },
                ],
                limited: false,
            });
    });

    it("search for users in the identity server", async () => {
        const query = "Bob";
        const { result } = render();

        act(() => {
            result.current.search({ limit: 1, query });
        });
        await waitFor(() => expect(result.current.ready).toBe(true));

        expect(result.current.loading).toBe(false);
        expect(result.current.users[0].name).toBe(query);
    });

    it("should work with empty queries", async () => {
        const query = "";
        const { result } = render();

        act(() => {
            result.current.search({ limit: 1, query });
        });
        await waitFor(() => expect(result.current.ready).toBe(true));

        expect(result.current.loading).toBe(false);
        expect(result.current.users).toEqual([]);
    });

    it("should recover from a server exception", async () => {
        cli.searchUserDirectory = () => {
            throw new Error("Oops");
        };
        const query = "Bob";

        const { result } = render();

        act(() => {
            result.current.search({ limit: 1, query });
        });
        await waitFor(() => expect(result.current.ready).toBe(true));

        expect(result.current.loading).toBe(false);
        expect(result.current.users).toEqual([]);
    });
});
