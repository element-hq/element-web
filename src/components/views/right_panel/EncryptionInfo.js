/*
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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
import PropTypes from "prop-types";

import * as sdk from "../../../index";
import {_t} from "../../../languageHandler";

export const PendingActionSpinner = ({text}) => {
    const Spinner = sdk.getComponent('elements.Spinner');
    return <div className="mx_EncryptionInfo_spinner">
        <Spinner />
        { text }
    </div>;
};

const EncryptionInfo = ({pending, member, onStartVerification}) => {
    let content;
    if (pending) {
        const text = _t("Waiting for %(displayName)s to accept…", {
            displayName: member.displayName || member.name || member.userId,
        });
        content = <PendingActionSpinner text={text} />;
    } else {
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        content = (
            <AccessibleButton kind="primary" className="mx_UserInfo_wideButton" onClick={onStartVerification}>
                {_t("Start Verification")}
            </AccessibleButton>
        );
    }

    return <React.Fragment>
        <div className="mx_UserInfo_container">
            <h3>{_t("Encryption")}</h3>
            <div>
                <p>{_t("Messages in this room are end-to-end encrypted.")}</p>
                <p>{_t("Your messages are secured and only you and the recipient have the unique keys to unlock them.")}</p>
            </div>
        </div>
        <div className="mx_UserInfo_container">
            <h3>{_t("Verify User")}</h3>
            <div>
                <p>{_t("For extra security, verify this user by checking a one-time code on both of your devices.")}</p>
                <p>{_t("To be secure, do this in person or use a trusted way to communicate.")}</p>
                { content }
            </div>
        </div>
    </React.Fragment>;
};
EncryptionInfo.propTypes = {
    member: PropTypes.object.isRequired,
    onStartVerification: PropTypes.func.isRequired,
    request: PropTypes.object,
};

export default EncryptionInfo;
