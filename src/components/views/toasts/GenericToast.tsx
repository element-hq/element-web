/*
Copyright 2024 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ComponentType, type ReactNode } from "react";
import { Button } from "@vector-im/compound-web";

import { type XOR } from "../../../@types/common";

export interface IProps {
    description: ReactNode;
    detail?: ReactNode;
    primaryLabel: string;
    PrimaryIcon?: ComponentType<React.SVGAttributes<SVGElement>>;

    onPrimaryClick(): void;
}

interface IPropsExtended extends IProps {
    secondaryLabel: string;
    SecondaryIcon?: ComponentType<React.SVGAttributes<SVGElement>>;
    destructive?: "primary" | "secondary";
    onSecondaryClick(): void;

    // If set, this will override the max-width (of the description) making the toast wider or narrower than standard
    overrideWidth?: string;
}

const GenericToast: React.FC<XOR<IPropsExtended, IProps>> = ({
    description,
    detail,
    primaryLabel,
    PrimaryIcon,
    secondaryLabel,
    SecondaryIcon,
    destructive,
    onPrimaryClick,
    onSecondaryClick,
    overrideWidth,
}) => {
    const detailContent = detail ? <div className="mx_Toast_detail">{detail}</div> : null;

    return (
        <div>
            <div className="mx_Toast_description" style={{ maxWidth: overrideWidth }}>
                {description}
                {detailContent}
            </div>
            <div className="mx_Toast_buttons" aria-live="off">
                {onSecondaryClick && secondaryLabel && (
                    <Button
                        onClick={onSecondaryClick}
                        kind={destructive === "secondary" ? "destructive" : "secondary"}
                        Icon={SecondaryIcon}
                        size="sm"
                    >
                        {secondaryLabel}
                    </Button>
                )}
                <Button
                    onClick={onPrimaryClick}
                    kind={destructive === "primary" ? "destructive" : "primary"}
                    Icon={PrimaryIcon}
                    size="sm"
                >
                    {primaryLabel}
                </Button>
            </div>
        </div>
    );
};

export default GenericToast;
