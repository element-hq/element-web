/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import fetchMockJest from "fetch-mock-jest";
import { mocked } from "jest-mock";

import { mediaFromMxc } from "../../../src/customisations/Media";
import { stubClient } from "../../test-utils";

describe("Media", () => {
    it("should not download error if server returns one", async () => {
        const cli = stubClient();
        // eslint-disable-next-line no-restricted-properties
        mocked(cli.mxcUrlToHttp).mockImplementation(
            (mxc) => `https://matrix.org/_matrix/media/r0/download/${mxc.slice(6)}`,
        );

        fetchMockJest.get("https://matrix.org/_matrix/media/r0/download/matrix.org/1234", {
            status: 404,
            body: { errcode: "M_NOT_FOUND", error: "Not found" },
        });

        const media = mediaFromMxc("mxc://matrix.org/1234");
        await expect(media.downloadSource()).rejects.toThrow("Not found");
    });
});
