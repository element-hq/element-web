/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "test-utils-rtl";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import userEvent from "@testing-library/user-event";
import { stubClient } from "test-utils/test-utils";

import { NetworkDropdown } from "./NetworkDropdown";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import SdkConfig from "../../../SdkConfig";

const PROTOCOLS_BY_SERVER = {
    "example.org": {
        xmpp: {
            user_fields: ["username"],
            location_fields: ["muc"],
            icon: "",
            field_types: {},
            instances: [{ desc: "XMPP", instance_id: "xmpp-instance", fields: {}, network_id: "xmpp" }],
        },
    },
};

describe("NetworkDropdown", () => {
    let cli: MatrixClient;

    beforeEach(() => {
        stubClient();
        cli = MatrixClientPeg.safeGet();
        cli.getDomain = () => "example.org";
        SdkConfig.put({ room_directory: { servers: ["remote.example.com"] } });
    });

    it("labels the selection with rooms by default", () => {
        render(<NetworkDropdown protocolsByServer={{}} config={null} setConfig={() => {}} />);
        expect(screen.getByText("Show: Matrix rooms")).toBeInTheDocument();
    });

    it("labels the selection with users when picking user directories", () => {
        render(<NetworkDropdown protocolsByServer={{}} config={null} setConfig={() => {}} entity="users" />);
        expect(screen.getByText("Show: Matrix users")).toBeInTheDocument();
    });

    it("labels a selected bridged network with users when picking user directories", async () => {
        render(
            <NetworkDropdown
                protocolsByServer={PROTOCOLS_BY_SERVER}
                config={{ roomServer: "example.org", instanceId: "xmpp-instance" }}
                setConfig={() => {}}
                entity="users"
            />,
        );
        expect(screen.getByText("Show: XMPP users (example.org)")).toBeInTheDocument();
    });

    it("labels a selected server with rooms in the room directory", () => {
        render(
            <NetworkDropdown
                protocolsByServer={{}}
                config={{ roomServer: "remote.example.com" }}
                setConfig={() => {}}
            />,
        );
        expect(screen.getByText("Show: Matrix rooms (remote.example.com)")).toBeInTheDocument();
    });

    it("only offers the local server when remote servers are not allowed", async () => {
        render(
            <NetworkDropdown
                protocolsByServer={{}}
                config={null}
                setConfig={() => {}}
                remoteServersAllowed={false}
                entity="users"
            />,
        );
        await userEvent.click(screen.getByRole("button", { name: /Show:/ }));
        expect(screen.getByText("example.org")).toBeInTheDocument();
        expect(screen.queryByText("remote.example.com")).not.toBeInTheDocument();
        expect(screen.queryByText("Add new server…")).not.toBeInTheDocument();
    });

    it("offers remote servers and adding servers when allowed", async () => {
        render(<NetworkDropdown protocolsByServer={{}} config={null} setConfig={() => {}} />);
        await userEvent.click(screen.getByRole("button", { name: /Show:/ }));
        expect(screen.getByText("remote.example.com")).toBeInTheDocument();
        expect(screen.getByText("Add new server…")).toBeInTheDocument();
    });
});
