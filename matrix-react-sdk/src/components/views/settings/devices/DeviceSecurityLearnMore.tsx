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
        title: _t("Verified sessions"),
        description: (
            <>
                <p>
                    {_t(
                        "Verified sessions are anywhere you are using this account after entering your passphrase or confirming your identity with another verified session.",
                    )}
                </p>
                <p>
                    {_t(
                        `This means that you have all the keys needed to unlock your encrypted messages ` +
                            `and confirm to other users that you trust this session.`,
                    )}
                </p>
            </>
        ),
    },
    [DeviceSecurityVariation.Unverified]: {
        title: _t("Unverified sessions"),
        description: (
            <>
                <p>
                    {_t(
                        "Unverified sessions are sessions that have logged in with your credentials but have not been cross-verified.",
                    )}
                </p>
                <p>
                    {_t(
                        `You should make especially certain that you recognise these sessions ` +
                            `as they could represent an unauthorised use of your account.`,
                    )}
                </p>
            </>
        ),
    },
    // unverifiable uses single-session case
    // because it is only ever displayed on a single session detail
    [DeviceSecurityVariation.Unverifiable]: {
        title: _t("Unverified session"),
        description: (
            <>
                <p>{_t(`This session doesn't support encryption and thus can't be verified.`)}</p>
                <p>
                    {_t(
                        `You won't be able to participate in rooms where encryption is enabled when using this session.`,
                    )}
                </p>
                <p>
                    {_t(
                        `For best security and privacy, it is recommended to use Matrix clients that support encryption.`,
                    )}
                </p>
            </>
        ),
    },
    [DeviceSecurityVariation.Inactive]: {
        title: _t("Inactive sessions"),
        description: (
            <>
                <p>
                    {_t(
                        "Inactive sessions are sessions you have not used in some time, but they continue to receive encryption keys.",
                    )}
                </p>
                <p>
                    {_t(
                        `Removing inactive sessions improves security and performance, ` +
                            `and makes it easier for you to identify if a new session is suspicious.`,
                    )}
                </p>
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
