/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "test-utils-rtl";
import KeyIcon from "@vector-im/compound-design-tokens/assets/web/icons/key-solid";

import { EncryptionCard } from "./EncryptionCard";

describe("<EncryptionCard />", () => {
    it("should render", () => {
        const { asFragment } = render(
            <EncryptionCard Icon={KeyIcon} title="My title" description="My description">
                Encryption card children
            </EncryptionCard>,
        );
        expect(asFragment()).toMatchSnapshot();
    });
});
