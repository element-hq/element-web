/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { Alert, Button } from "@vector-im/compound-web";

import type { FileErrorIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

interface Action {
    label: string;
    Icon?: typeof FileErrorIcon;
    onClick: () => void;
    className?: string;
}

interface Props {
    className?: string;
    title?: string;
    children: React.ReactNode;
    action?: Action;
}

const MediaProcessingError: React.FC<Props> = ({ className, title, children, action }) => {
    const resolvedTitle = title ?? (typeof children === "string" ? children : "");
    const description = title ? children : undefined;

    return (
        <Alert
            className={`mx_MediaProcessingError${className ? ` ${className}` : ""}`}
            type="critical"
            title={resolvedTitle}
            actions={
                action && (
                    <Button
                        className={action.className}
                        kind="secondary"
                        size="sm"
                        Icon={action.Icon}
                        onClick={action.onClick}
                    >
                        {action.label}
                    </Button>
                )
            }
        >
            {description}
        </Alert>
    );
};

export default MediaProcessingError;
