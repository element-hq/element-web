/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, vi } from "vitest";
import { waitFor, renderHook } from "test-utils-rtl";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { stubClient } from "test-utils/test-utils";

import { useThirdPartyProtocols, findProtocolForInstance } from "./useThirdPartyProtocols";
import { MatrixClientPeg } from "../MatrixClientPeg";

const XMPP_PROTOCOLS = {
    xmpp: {
        user_fields: ["username"],
        location_fields: ["muc"],
        icon: "",
        field_types: {},
        instances: [{ desc: "XMPP", instance_id: "xmpp-instance", fields: {}, network_id: "xmpp" }],
    },
};

describe("useThirdPartyProtocols", () => {
    let cli: MatrixClient;

    beforeEach(() => {
        stubClient();
        cli = MatrixClientPeg.safeGet();
        cli.getDomain = () => "example.org";
    });

    it("fetches the local server's protocols without a server param", async () => {
        cli.doesServerSupportUnstableFeature = vi.fn().mockResolvedValue(false);
        cli.getThirdpartyProtocols = vi.fn().mockResolvedValue(XMPP_PROTOCOLS);

        const { result } = renderHook(() => useThirdPartyProtocols(["example.org"]));
        await waitFor(() => expect(result.current["example.org"]).toEqual(XMPP_PROTOCOLS));
        expect(cli.getThirdpartyProtocols).toHaveBeenCalledWith(undefined);
    });

    it("does not query remote servers when MSC4517 is not advertised", async () => {
        cli.doesServerSupportUnstableFeature = vi.fn().mockResolvedValue(false);
        cli.getThirdpartyProtocols = vi.fn().mockResolvedValue(XMPP_PROTOCOLS);

        const { result } = renderHook(() => useThirdPartyProtocols(["remote1.example.com"]));
        await waitFor(() => expect(result.current["remote1.example.com"]).toEqual({}));
        expect(cli.getThirdpartyProtocols).not.toHaveBeenCalledWith("remote1.example.com");
    });

    it("queries remote servers when MSC4517 is advertised", async () => {
        cli.doesServerSupportUnstableFeature = vi.fn().mockResolvedValue(true);
        cli.getThirdpartyProtocols = vi.fn().mockResolvedValue(XMPP_PROTOCOLS);

        const { result } = renderHook(() => useThirdPartyProtocols(["remote2.example.com"]));
        await waitFor(() => expect(result.current["remote2.example.com"]).toEqual(XMPP_PROTOCOLS));
        expect(cli.getThirdpartyProtocols).toHaveBeenCalledWith("remote2.example.com");
    });

    it("yields an empty entry for servers whose lookup fails", async () => {
        cli.doesServerSupportUnstableFeature = vi.fn().mockResolvedValue(true);
        cli.getThirdpartyProtocols = vi.fn().mockRejectedValue(new Error("no bridges here"));

        const { result } = renderHook(() => useThirdPartyProtocols(["remote3.example.com"]));
        await waitFor(() => expect(result.current["remote3.example.com"]).toEqual({}));
    });
});

describe("findProtocolForInstance", () => {
    it("finds the protocol owning an instance", () => {
        expect(findProtocolForInstance(XMPP_PROTOCOLS, "xmpp-instance")).toEqual({
            protocolKey: "xmpp",
            protocol: XMPP_PROTOCOLS.xmpp,
        });
    });

    it("returns undefined for unknown instances or missing protocols", () => {
        expect(findProtocolForInstance(XMPP_PROTOCOLS, "not-an-instance")).toBeUndefined();
        expect(findProtocolForInstance(undefined, "xmpp-instance")).toBeUndefined();
        expect(findProtocolForInstance(XMPP_PROTOCOLS, undefined)).toBeUndefined();
    });
});
