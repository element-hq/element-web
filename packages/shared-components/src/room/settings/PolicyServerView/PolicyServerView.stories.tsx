/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { PolicyServerView } from "./PolicyServerView";
import { useMockedViewModel } from "../../../core/viewmodel";
import { withViewDocs } from "../../../../.storybook/withViewDocs";
import { type PolicyServerViewActions, type PolicyServerViewSnapshot } from "./types";

type PolicyServerViewWrapperProps = PolicyServerViewSnapshot & PolicyServerViewActions;

const PolicyServerViewWrapperImpl = ({ setServerName, apply, ...rest }: PolicyServerViewWrapperProps): JSX.Element => {
    const vm = useMockedViewModel(rest, { setServerName, apply });
    return <PolicyServerView vm={vm} />;
};
const PolicyServerViewWrapper = withViewDocs(PolicyServerViewWrapperImpl, PolicyServerView);

const meta = {
    title: "Room Settings/PolicyServerView",
    component: PolicyServerViewWrapper,
    tags: ["autodocs"],
    args: {
        serverName: "",
        currentServerName: "",
        isLegacyConfig: false,
        canChange: true,
        canApply: false,
        busy: false,
        error: null,
        supportUrl: null,
        setServerName: fn(),
        apply: fn(),
    },
    decorators: [
        (Story) => (
            <div style={{ width: "560px" }}>
                <Story />
            </div>
        ),
    ],
} satisfies Meta<typeof PolicyServerViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The room has no policy server and nothing has been entered yet.
 */
export const Default: Story = {};

/**
 * A server name has been entered but not applied yet.
 */
export const Editing: Story = {
    args: {
        serverName: "policy.example.org",
        canApply: true,
    },
};

/**
 * The room uses a policy server which advertises a support page.
 */
export const Configured: Story = {
    args: {
        serverName: "policy.example.org",
        currentServerName: "policy.example.org",
        supportUrl: "https://policy.example.org/support",
    },
};

/**
 * The room uses a policy server which does not advertise a support page.
 */
export const ConfiguredWithoutSupportPage: Story = {
    args: {
        serverName: "policy.example.org",
        currentServerName: "policy.example.org",
    },
};

/**
 * The room was configured with the pre-stabilisation state event and should be re-applied.
 */
export const LegacyConfig: Story = {
    args: {
        serverName: "policy.example.org",
        currentServerName: "policy.example.org",
        isLegacyConfig: true,
        canApply: true,
    },
};

/**
 * The entered server name could not be resolved to a policy server.
 */
export const LookupFailed: Story = {
    args: {
        serverName: "not-a-policy-server.example.org",
        canApply: true,
        error: "lookup_failed",
    },
};

/**
 * The state event could not be sent.
 */
export const UpdateFailed: Story = {
    args: {
        serverName: "policy.example.org",
        canApply: true,
        error: "update_failed",
    },
};

/**
 * A lookup or state update is in progress.
 */
export const Busy: Story = {
    args: {
        serverName: "policy.example.org",
        busy: true,
    },
};

/**
 * The user may see but not change the room's policy server.
 */
export const ReadOnly: Story = {
    args: {
        serverName: "policy.example.org",
        currentServerName: "policy.example.org",
        canChange: false,
    },
};
