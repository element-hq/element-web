/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type PropsWithChildren, type MouseEventHandler } from "react";
import { VisibilityOnIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

interface IProps {
    onClick: MouseEventHandler<HTMLButtonElement>;
}

export const HiddenMediaPlaceholder: React.FunctionComponent<PropsWithChildren<IProps>> = ({ onClick, children }) => {
    return (
        <button onClick={onClick} className="mx_HiddenMediaPlaceholder">
            <div>
                <VisibilityOnIcon />
                <span>{children}</span>
            </div>
        </button>
    );
};
