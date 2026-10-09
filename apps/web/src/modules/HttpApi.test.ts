/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi } from "vitest";
import { type MatrixClient, Method } from "matrix-js-sdk/src/matrix";
import { stubClient } from "test-utils";

import { HttpApi } from "./HttpApi";

describe("HttpApi", () => {
    it("sends an authenticated request through the matrix client", async () => {
        const cli = stubClient();
        const authedRequest = vi.fn().mockResolvedValue({ ok: true });
        // The stub client has no HTTP API
        cli.http = { authedRequest } as unknown as MatrixClient["http"];
        const api = new HttpApi();

        const response = await api.authedRequest("POST", "/invite_guests", {
            prefix: "/_synapse/client",
            queryParams: { foo: "bar" },
            body: { room_id: "!room:example.org" },
        });

        expect(response).toEqual({ ok: true });
        expect(authedRequest).toHaveBeenCalledWith(
            Method.Post,
            "/invite_guests",
            { foo: "bar" },
            { room_id: "!room:example.org" },
            { prefix: "/_synapse/client" },
        );
    });
});
