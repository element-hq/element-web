/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { waitFor, renderHook, act } from "jest-matrix-react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import { useUserDirectory } from "../../../src/hooks/useUserDirectory";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import { stubClient } from "../../test-utils";

function render() {
    return renderHook(() => useUserDirectory());
}

describe("useUserDirectory", () => {
    let cli: MatrixClient;

    beforeEach(() => {
        stubClient();
        cli = MatrixClientPeg.safeGet();

        cli.getDomain = () => "matrix.org";
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
