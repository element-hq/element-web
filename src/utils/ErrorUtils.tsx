/*
Copyright 2018 - 2021 The Matrix.org Foundation C.I.C.

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

import React, { ReactNode } from "react";
import { MatrixError, ConnectionError } from "matrix-js-sdk/src/http-api";

import { _t, _td, Tags, TranslatedString } from "../languageHandler";
import SdkConfig from "../SdkConfig";
import { ValidatedServerConfig } from "./ValidatedServerConfig";
import ExternalLink from "../components/views/elements/ExternalLink";

export const resourceLimitStrings = {
    "monthly_active_user": _td("This homeserver has hit its Monthly Active User limit."),
    "hs_blocked": _td("This homeserver has been blocked by its administrator."),
    "": _td("This homeserver has exceeded one of its resource limits."),
};

export const adminContactStrings = {
    "": _td("Please <a>contact your service administrator</a> to continue using this service."),
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
    strings: Record<string, string>,
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

    if (errString.includes("<a>")) {
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
        return <div>{_t("Unable to connect to Homeserver. Retrying…")}</div>;
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
            return _t("This account has been deactivated.");
        } else if (SdkConfig.get("disable_custom_urls")) {
            return (
                <div>
                    <div>{_t("Incorrect username and/or password.")}</div>
                    <div className="mx_Login_smallError">
                        {_t("Please note you are logging into the %(hs)s server, not matrix.org.", {
                            hs: serverConfig.hsName,
                        })}
                    </div>
                </div>
            );
        } else {
            return _t("Incorrect username and/or password.");
        }
    } else {
        return messageForConnectionError(err, serverConfig);
    }
}

export function messageForConnectionError(
    err: Error,
    serverConfig: Pick<ValidatedServerConfig, "hsName" | "hsUrl">,
): ReactNode {
    let errorText = _t("There was a problem communicating with the homeserver, please try again later.");

    if (err instanceof ConnectionError) {
        if (
            window.location.protocol === "https:" &&
            (serverConfig.hsUrl.startsWith("http:") || !serverConfig.hsUrl.startsWith("http"))
        ) {
            return (
                <span>
                    {_t(
                        "Can't connect to homeserver via HTTP when an HTTPS URL is in your browser bar. " +
                            "Either use HTTPS or <a>enable unsafe scripts</a>.",
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
                    "Can't connect to homeserver - please check your connectivity, ensure your " +
                        "<a>homeserver's SSL certificate</a> is trusted, and that a browser extension " +
                        "is not blocking requests.",
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
