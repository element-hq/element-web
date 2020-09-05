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

import * as sdk from "../../../index";
import {_t} from "../../../languageHandler";
import {RoomMember} from "matrix-js-sdk/src/models/room-member";

export const PendingActionSpinner = ({text}) => {
    const Spinner = sdk.getComponent('elements.Spinner');
    return <div className="mx_EncryptionInfo_spinner">
        <Spinner />
        { text }
    </div>;
};

interface IProps {
    waitingForOtherParty: boolean;
    waitingForNetwork: boolean;
    member: RoomMember;
    onStartVerification: () => Promise<void>;
    isRoomEncrypted: boolean;
    inDialog: boolean;
    isSelfVerification: boolean;
}

const EncryptionInfo: React.FC<IProps> = ({
    waitingForOtherParty,
    waitingForNetwork,
    member,
    onStartVerification,
    isRoomEncrypted,
    inDialog,
    isSelfVerification,
}: IProps) => {
    let content: JSX.Element;
    if (waitingForOtherParty || waitingForNetwork) {
        let text: string;
        if (waitingForOtherParty) {
            if (isSelfVerification) {
                text = _t("Waiting for you to accept on your other session…");
            } else {
                text = _t("Waiting for %(displayName)s to accept…", {
                    displayName: member.displayName || member.name || member.userId,
                });
            }
        } else {
            text = _t("Accepting…");
        }
        content = <PendingActionSpinner text={text} />;
    } else {
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        content = (
            <AccessibleButton kind="primary" className="mx_UserInfo_wideButton" onClick={onStartVerification}>
                {_t("Start Verification")}
            </AccessibleButton>
        );
    }

    let description: JSX.Element;
    if (isRoomEncrypted) {
        description = (
            <div>
                <p>{_t("Messages in this room are end-to-end encrypted.")}</p>
                <p>{_t("Your messages are secured and only you and the recipient have " +
                    "the unique keys to unlock them.")}</p>
            </div>
        );
    } else {
        description = (
            <div>
                <p>{_t("Messages in this room are not end-to-end encrypted.")}</p>
                <p>{_t("In encrypted rooms, your messages are secured and only you and the recipient have " +
                    "the unique keys to unlock them.")}</p>
            </div>
        );
    }

    if (inDialog) {
        return content;
    }

    return <React.Fragment>
        <div className="mx_UserInfo_container">
            <h3>{_t("Encryption")}</h3>
            { description }
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

export default EncryptionInfo;
