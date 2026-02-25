/*
Copyright 2024 New Vector Ltd.
Copyright 2022 Šimon Brandner <simon.bra.ag@gmail.com>
Copyright 2019-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useState } from "react";
import classNames from "classnames";
import { CopyIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t } from "../../../languageHandler";
import { copyPlaintext } from "../../../utils/strings";
import AccessibleButton, { type ButtonEvent } from "./AccessibleButton";

interface IProps extends React.HTMLAttributes<HTMLDivElement> {
    children?: React.ReactNode;
    getTextToCopy: () => string | null;
    border?: boolean;
    className?: string;
}

export const CopyTextButton: React.FC<Pick<IProps, "getTextToCopy" | "className" | "children">> = ({
    getTextToCopy,
    className,
    children,
}) => {
    const [tooltip, setTooltip] = useState<string | undefined>(undefined);

    const onCopyClickInternal = async (e: ButtonEvent): Promise<void> => {
        e.preventDefault();
        const text = getTextToCopy();
        const successful = !!text && (await copyPlaintext(text));
        setTooltip(successful ? _t("common|copied") : _t("error|failed_copy"));
    };

    const onHideTooltip = (): void => {
        if (tooltip) {
            setTooltip(undefined);
        }
    };

    return (
        <AccessibleButton
            title={tooltip ?? _t("action|copy")}
            onClick={onCopyClickInternal}
            className={className}
            onTooltipOpenChange={(open) => {
                if (!open) onHideTooltip();
            }}
        >
            {children}
        </AccessibleButton>
    );
};

const CopyableText: React.FC<IProps> = ({ children, getTextToCopy, border = true, className, ...props }) => {
    const combinedClassName = classNames("mx_CopyableText", className, {
        mx_CopyableText_border: border,
    });

    return (
        <div className={combinedClassName} {...props}>
            {children}
            <CopyTextButton getTextToCopy={getTextToCopy} className="mx_CopyableText_copyButton">
                <CopyIcon />
            </CopyTextButton>
        </div>
    );
};

export default CopyableText;
