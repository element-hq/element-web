/*
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { MatrixError } from "matrix-js-sdk/src/matrix";

import { getAliasCreationErrorMessage } from "../../../../../src/components/views/room_settings/AliasSettings";

describe("getAliasCreationErrorMessage", () => {
    it.each([
        ["M_ROOM_IN_USE", "That address is already in use. Try a different one."],
        ["M_INVALID_PARAM", "That address isn't valid. It must look like #my-room:example.org."],
        ["M_FORBIDDEN", "You don't have permission to create that address on this server."],
        ["M_EXCLUSIVE", "You don't have permission to create that address on this server."],
    ])("explains %s", (errcode, expected) => {
        expect(getAliasCreationErrorMessage(new MatrixError({ errcode }))).toEqual(expected);
    });

    it.each([
        ["an unrecognised errcode", new MatrixError({ errcode: "M_UNKNOWN" })],
        ["a non-Matrix failure", new Error("network down")],
    ])("falls back to the generic message for %s", (_name, err) => {
        expect(getAliasCreationErrorMessage(err)).toEqual(
            "There was an error creating that address. It may not be allowed by the server or a temporary failure occurred.",
        );
    });
});
