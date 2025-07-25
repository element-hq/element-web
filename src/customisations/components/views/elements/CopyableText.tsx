/*
Copyright 2025 Keypair Establishment.
Copyright 2024 New Vector Ltd.
Copyright 2022 Šimon Brandner <simon.bra.ag@gmail.com>
Copyright 2019-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useState } from "react";
import classNames from "classnames";

import { _t } from "../../../../languageHandler";
import { copyPlaintext } from "../../../../utils/strings";
import AccessibleButton, { type ButtonEvent } from "../../../../components/views/elements/AccessibleButton";

interface IProps extends React.HTMLAttributes<HTMLDivElement> {
    children?: React.ReactNode;
    getTextToCopy: () => string | null;
    border?: boolean;
    className?: string;
    tooltipText?: string;
}

export const CopyTextButton: React.FC<Pick<IProps, "getTextToCopy" | "className" | "tooltipText">> = ({ getTextToCopy, tooltipText, className }) => {
    const [tooltip, setTooltip] = useState<string | undefined>(tooltipText);

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
        />
    );
};

const CopyableText: React.FC<IProps> = ({ children, getTextToCopy, border = true, className, tooltipText, ...props }) => {
    const combinedClassName = classNames("mx_CopyableText", className, {
        mx_CopyableText_border: border,
    });

    return (
        <div className={combinedClassName} {...props}>
            {children}
            <CopyTextButton getTextToCopy={getTextToCopy} tooltipText={tooltipText} className="mx_CopyableText_copyButton" />
        </div>
    );
};

export default CopyableText;
