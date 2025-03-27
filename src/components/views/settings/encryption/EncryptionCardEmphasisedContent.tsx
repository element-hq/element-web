/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type PropsWithChildren } from "react";

import { Flex } from "../../../utils/Flex";

/**
 * A component for emphasised text within an {@link EncryptionCard}
 * (mostly as somewhere for the common CSS to live).
 */
export function EncryptionCardEmphasisedContent({ children }: PropsWithChildren): JSX.Element {
    return (
        <Flex
            direction="column"
            gap="var(--cpd-space-3x)"
            align="normal"
            className="mx_EncryptionCard_emphasisedContent"
        >
            {children}
        </Flex>
    );
}
