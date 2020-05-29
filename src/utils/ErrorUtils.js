/*
Copyright 2018 New Vector Ltd

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

import { _t, _td } from '../languageHandler';

/**
 * Produce a translated error message for a
 * M_RESOURCE_LIMIT_EXCEEDED error
 *
 * @param {string} limitType The limit_type from the error
 * @param {string} adminContact The admin_contact from the error
 * @param {Object} strings Translateable string for different
 *     limit_type. Must include at least the empty string key
 *     which is the default. Strings may include an 'a' tag
 *     for the admin contact link.
 * @param {Object} extraTranslations Extra translation substitution functions
 *     for any tags in the strings apart from 'a'
 * @returns {*} Translated string or react component
 */
export function messageForResourceLimitError(limitType, adminContact, strings, extraTranslations) {
    let errString = strings[limitType];
    if (errString === undefined) errString = strings[''];

    const linkSub = sub => {
        if (adminContact) {
            return <a href={adminContact} target="_blank" rel="noreferrer noopener">{sub}</a>;
        } else {
            return sub;
        }
    };

    if (errString.includes('<a>')) {
        return _t(errString, {}, Object.assign({ 'a': linkSub }, extraTranslations));
    } else {
        return _t(errString, {}, extraTranslations);
    }
}

export function messageForSendError(errorData) {
    if (errorData.errcode === "M_TOO_LARGE") {
        return _t("The message you are trying to send is too large.");
    }
}

export function messageForSyncError(err) {
    if (err.errcode === 'M_RESOURCE_LIMIT_EXCEEDED') {
        const limitError = messageForResourceLimitError(
            err.data.limit_type,
            err.data.admin_contact,
            {
                'monthly_active_user': _td("This homeserver has hit its Monthly Active User limit."),
                '': _td("This homeserver has exceeded one of its resource limits."),
            },
        );
        const adminContact = messageForResourceLimitError(
            err.data.limit_type,
            err.data.admin_contact,
            {
                '': _td("Please <a>contact your service administrator</a> to continue using the service."),
            },
        );
        return <div>
            <div>{limitError}</div>
            <div>{adminContact}</div>
        </div>;
    } else {
        return <div>
            {_t("Unable to connect to Homeserver. Retrying...")}
        </div>;
    }
}
