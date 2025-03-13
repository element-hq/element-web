/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode } from "react";

interface Props {
    label: string;
    children?: ReactNode;
}

export const enum SeparatorKind {
    None,
    Date,
    LateEvent,
}

/**
 * Generic timeline separator component to render within a MessagePanel
 *
 * @param label the accessible label string describing the separator
 * @param children the children to draw within the timeline separator
 */
const TimelineSeparator: React.FC<Props> = ({ label, children }) => {
    // ARIA treats <hr/>s as separators, here we abuse them slightly so manually treat this entire thing as one
    return (
        <div className="mx_TimelineSeparator" role="separator" aria-label={label}>
            <hr role="none" />
            {children}
            <hr role="none" />
        </div>
    );
};

export default TimelineSeparator;
