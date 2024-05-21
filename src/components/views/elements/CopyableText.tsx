/*
Copyright 2019-2022 The Matrix.org Foundation C.I.C.
Copyright 2022 Šimon Brandner <simon.bra.ag@gmail.com>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React, { useState } from "react";
import classNames from "classnames";

import { _t } from "../../../languageHandler";
import { copyPlaintext } from "../../../utils/strings";
import AccessibleButton, { ButtonEvent } from "./AccessibleButton";

interface IProps {
    children?: React.ReactNode;
    getTextToCopy: () => string | null;
    border?: boolean;
    className?: string;
}

const CopyableText: React.FC<IProps> = ({ children, getTextToCopy, border = true, className }) => {
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

    const combinedClassName = classNames("mx_CopyableText", className, {
        mx_CopyableText_border: border,
    });

    return (
        <div className={combinedClassName}>
            {children}
            <AccessibleButton
                title={tooltip ?? _t("action|copy")}
                onClick={onCopyClickInternal}
                className="mx_CopyableText_copyButton"
                onTooltipOpenChange={(open) => {
                    if (!open) onHideTooltip();
                }}
            />
        </div>
    );
};

export default CopyableText;
