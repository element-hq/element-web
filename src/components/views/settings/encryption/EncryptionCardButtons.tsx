/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type PropsWithChildren } from "react";

/**
 * A component to present action buttons at the bottom of an {@link EncryptionCard}
 * (mostly as somewhere for the common CSS to live).
 */
export function EncryptionCardButtons({ children }: PropsWithChildren): JSX.Element {
    return <div className="mx_EncryptionCard_buttons">{children}</div>;
}
