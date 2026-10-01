/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ComponentProps } from "react";

import { _t } from "../../../../languageHandler";
import LearnMore from "../../elements/LearnMore";
import { DeviceSecurityVariation } from "./types";

type Props = Omit<ComponentProps<typeof LearnMore>, "title" | "description"> & {
    variation: DeviceSecurityVariation;
};

const securityCardContent: Record<
    DeviceSecurityVariation,
    {
        title: string;
        description: React.ReactNode | string;
    }
> = {
    [DeviceSecurityVariation.Verified]: {
        title: _t("settings|sessions|verified_sessions"),
        description: (
            <>
                <p>{_t("settings|sessions|verified_sessions_explainer_1")}</p>
                <p>{_t("settings|sessions|verified_sessions_explainer_2")}</p>
            </>
        ),
    },
    [DeviceSecurityVariation.Unverified]: {
        title: _t("settings|sessions|unverified_sessions"),
        description: (
            <>
                <p>{_t("settings|sessions|unverified_sessions_explainer_1")}</p>
                <p>{_t("settings|sessions|unverified_sessions_explainer_2")}</p>
            </>
        ),
    },
    // unverifiable uses single-session case
    // because it is only ever displayed on a single session detail
    [DeviceSecurityVariation.Unverifiable]: {
        title: _t("settings|sessions|unverified_session"),
        description: (
            <>
                <p>{_t("settings|sessions|unverified_session_explainer_1")}</p>
                <p>{_t("settings|sessions|unverified_session_explainer_2")}</p>
                <p>{_t("settings|sessions|unverified_session_explainer_3")}</p>
            </>
        ),
    },
    [DeviceSecurityVariation.Inactive]: {
        title: _t("settings|sessions|inactive_sessions"),
        description: (
            <>
                <p>{_t("settings|sessions|inactive_sessions_explainer_1")}</p>
                <p>{_t("settings|sessions|inactive_sessions_explainer_2")}</p>
            </>
        ),
    },
};

/**
 * LearnMore with content for device security warnings
 */
export const DeviceSecurityLearnMore: React.FC<Props> = ({ variation }) => {
    const { title, description } = securityCardContent[variation];
    return <LearnMore title={title} description={description} />;
};
