/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render } from "jest-matrix-react";

import { EncryptionCard } from "../../../../../../src/components/views/settings/encryption/EncryptionCard";

describe("<EncryptionCard />", () => {
    it("should render", () => {
        const { asFragment } = render(
            <EncryptionCard title="My title" description="My description">
                Encryption card children
            </EncryptionCard>,
        );
        expect(asFragment()).toMatchSnapshot();
    });
});
