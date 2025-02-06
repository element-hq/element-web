/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type DetailedHTMLProps, type HTMLAttributes } from "react";
import CloseIcon from "@vector-im/compound-design-tokens/assets/web/icons/close";

import AccessibleButton from "./AccessibleButton";

interface IProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
    icon?: () => JSX.Element;
    label: string;
    onDeleteClick?: () => void;
    disabled?: boolean;
}

export const Tag: React.FC<IProps> = ({ icon, label, onDeleteClick, disabled = false, ...other }) => {
    return (
        <div className="mx_Tag" {...other}>
            {icon?.()}
            {label}
            {onDeleteClick && (
                <AccessibleButton
                    aria-label="Remove"
                    className="mx_Tag_delete"
                    onClick={onDeleteClick}
                    disabled={disabled}
                >
                    <CloseIcon />
                </AccessibleButton>
            )}
        </div>
    );
};
