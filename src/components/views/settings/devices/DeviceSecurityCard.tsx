/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import classNames from "classnames";
import React from "react";

import { Icon as VerifiedIcon } from "../../../../../res/img/e2e/verified.svg";
import { Icon as UnverifiedIcon } from "../../../../../res/img/e2e/warning.svg";
import { Icon as InactiveIcon } from "../../../../../res/img/element-icons/settings/inactive.svg";
import { DeviceSecurityVariation } from "./types";
interface Props {
    variation: DeviceSecurityVariation;
    heading: string;
    description: string | React.ReactNode;
    children?: React.ReactNode;
}

const VariationIcon: Record<DeviceSecurityVariation, React.FC<React.SVGProps<SVGSVGElement>>> = {
    [DeviceSecurityVariation.Inactive]: InactiveIcon,
    [DeviceSecurityVariation.Verified]: VerifiedIcon,
    [DeviceSecurityVariation.Unverified]: UnverifiedIcon,
    [DeviceSecurityVariation.Unverifiable]: UnverifiedIcon,
};

const DeviceSecurityIcon: React.FC<{ variation: DeviceSecurityVariation }> = ({ variation }) => {
    const Icon = VariationIcon[variation];
    return (
        <div className={classNames("mx_DeviceSecurityCard_icon", variation)}>
            <Icon height={16} width={16} />
        </div>
    );
};

const DeviceSecurityCard: React.FC<Props> = ({ variation, heading, description, children }) => {
    return (
        <div className="mx_DeviceSecurityCard">
            <DeviceSecurityIcon variation={variation} />
            <div className="mx_DeviceSecurityCard_content">
                <p className="mx_DeviceSecurityCard_heading">{heading}</p>
                <p className="mx_DeviceSecurityCard_description">{description}</p>
                {!!children && <div className="mx_DeviceSecurityCard_actions">{children}</div>}
            </div>
        </div>
    );
};

export default DeviceSecurityCard;
