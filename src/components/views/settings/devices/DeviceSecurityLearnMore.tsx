/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import React from "react";

import { _t } from "../../../../languageHandler";
import LearnMore, { LearnMoreProps } from "../../elements/LearnMore";
import { DeviceSecurityVariation } from "./types";

interface Props extends Omit<LearnMoreProps, "title" | "description"> {
    variation: DeviceSecurityVariation;
}

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
