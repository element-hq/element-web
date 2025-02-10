/*
Copyright 2024 New Vector Ltd.
Copyright 2018-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode } from "react";
import { MatrixError, ConnectionError } from "matrix-js-sdk/src/matrix";

import { _t, _td, lookupString, type Tags, type TranslatedString, type TranslationKey } from "../languageHandler";
import SdkConfig from "../SdkConfig";
import { type ValidatedServerConfig } from "./ValidatedServerConfig";
import ExternalLink from "../components/views/elements/ExternalLink";

export const resourceLimitStrings = {
    "monthly_active_user": _td("error|mau"),
    "hs_blocked": _td("error|hs_blocked"),
    "": _td("error|resource_limits"),
};

export const adminContactStrings = {
    "": _td("error|admin_contact"),
};

/**
 * Produce a translated error message for a
 * M_RESOURCE_LIMIT_EXCEEDED error
 *
 * @param {string} limitType The limit_type from the error
 * @param {string} adminContact The admin_contact from the error
 * @param {Object} strings Translatable string for different
 *     limit_type. Must include at least the empty string key
 *     which is the default. Strings may include an 'a' tag
 *     for the admin contact link.
 * @param {Object} extraTranslations Extra translation substitution functions
 *     for any tags in the strings apart from 'a'
 * @returns {*} Translated string or react component
 */
export function messageForResourceLimitError(
    limitType: string | undefined,
    adminContact: string | undefined,
    strings: Record<string, TranslationKey>,
    extraTranslations?: Tags,
): TranslatedString {
    let errString = limitType ? strings[limitType] : undefined;
    if (errString === undefined) errString = strings[""];

    const linkSub = (sub: string): ReactNode => {
        if (adminContact) {
            return (
                <a href={adminContact} target="_blank" rel="noreferrer noopener">
                    {sub}
                </a>
            );
        } else {
            return sub;
        }
    };

    if (lookupString(errString).includes("<a>")) {
        return _t(errString, {}, Object.assign({ a: linkSub }, extraTranslations));
    } else {
        return _t(errString, {}, extraTranslations!);
    }
}

export function messageForSyncError(err: Error): ReactNode {
    if (err instanceof MatrixError && err.errcode === "M_RESOURCE_LIMIT_EXCEEDED") {
        const limitError = messageForResourceLimitError(
            err.data.limit_type,
            err.data.admin_contact,
            resourceLimitStrings,
        );
        const adminContact = messageForResourceLimitError(
            err.data.limit_type,
            err.data.admin_contact,
            adminContactStrings,
        );
        return (
            <div>
                <div>{limitError}</div>
                <div>{adminContact}</div>
            </div>
        );
    } else {
        return <div>{_t("error|sync")}</div>;
    }
}

export function messageForLoginError(
    err: MatrixError,
    serverConfig: Pick<ValidatedServerConfig, "hsName" | "hsUrl">,
): ReactNode {
    if (err.errcode === "M_RESOURCE_LIMIT_EXCEEDED") {
        const errorTop = messageForResourceLimitError(
            err.data.limit_type,
            err.data.admin_contact,
            resourceLimitStrings,
        );
        const errorDetail = messageForResourceLimitError(
            err.data.limit_type,
            err.data.admin_contact,
            adminContactStrings,
        );
        return (
            <div>
                <div>{errorTop}</div>
                <div className="mx_Login_smallError">{errorDetail}</div>
            </div>
        );
    } else if (err.httpStatus === 401 || err.httpStatus === 403) {
        if (err.errcode === "M_USER_DEACTIVATED") {
            return _t("auth|account_deactivated");
        } else if (SdkConfig.get("disable_custom_urls")) {
            return (
                <div>
                    <div>{_t("auth|incorrect_credentials")}</div>
                    <div className="mx_Login_smallError">
                        {_t("auth|incorrect_credentials_detail", {
                            hs: serverConfig.hsName,
                        })}
                    </div>
                </div>
            );
        } else {
            return _t("auth|incorrect_credentials");
        }
    } else {
        return messageForConnectionError(err, serverConfig);
    }
}

export function messageForConnectionError(
    err: Error,
    serverConfig: Pick<ValidatedServerConfig, "hsName" | "hsUrl">,
): ReactNode {
    let errorText = _t("error|connection");

    if (err instanceof ConnectionError) {
        if (
            window.location.protocol === "https:" &&
            (serverConfig.hsUrl.startsWith("http:") || !serverConfig.hsUrl.startsWith("http"))
        ) {
            return (
                <span>
                    {_t(
                        "error|mixed_content",
                        {},
                        {
                            a: (sub) => {
                                return (
                                    <a
                                        target="_blank"
                                        rel="noreferrer noopener"
                                        href="https://www.google.com/search?&q=enable%20unsafe%20scripts"
                                    >
                                        {sub}
                                    </a>
                                );
                            },
                        },
                    )}
                </span>
            );
        }

        return (
            <span>
                {_t(
                    "error|tls",
                    {},
                    {
                        a: (sub) => (
                            <ExternalLink target="_blank" rel="noreferrer noopener" href={serverConfig.hsUrl}>
                                {sub}
                            </ExternalLink>
                        ),
                    },
                )}
            </span>
        );
    } else if (err instanceof MatrixError) {
        if (err.errcode) {
            errorText += `(${err.errcode})`;
        } else if (err.httpStatus) {
            errorText += ` (HTTP ${err.httpStatus})`;
        }
    }

    return errorText;
}
