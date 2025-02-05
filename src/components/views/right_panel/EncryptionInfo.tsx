/*
Copyright 2024 New Vector Ltd.
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type RoomMember, type User } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../languageHandler";
import AccessibleButton from "../elements/AccessibleButton";
import Spinner from "../elements/Spinner";

export const PendingActionSpinner: React.FC<{ text: string }> = ({ text }) => {
    return (
        <div className="mx_EncryptionInfo_spinner">
            <Spinner />
            {text}
        </div>
    );
};

interface IProps {
    waitingForOtherParty: boolean;
    waitingForNetwork: boolean;
    member: RoomMember | User;
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
    if (waitingForOtherParty && isSelfVerification) {
        content = <div>{_t("encryption|verification|self_verification_hint")}</div>;
    } else if (waitingForOtherParty || waitingForNetwork) {
        let text: string;
        if (waitingForOtherParty) {
            text = _t("encryption|verification|waiting_for_user_accept", {
                displayName: (member as User).displayName || (member as RoomMember).name || member.userId,
            });
        } else {
            text = _t("encryption|verification|accepting");
        }
        content = <PendingActionSpinner text={text} />;
    } else {
        content = (
            <AccessibleButton
                kind="primary"
                className="mx_UserInfo_wideButton mx_UserInfo_startVerification"
                onClick={onStartVerification}
            >
                {_t("encryption|verification|start_button")}
            </AccessibleButton>
        );
    }

    let description: JSX.Element;
    if (isRoomEncrypted) {
        description = (
            <div>
                <p>{_t("user_info|room_encrypted")}</p>
                <p>{_t("user_info|room_encrypted_detail")}</p>
            </div>
        );
    } else {
        description = (
            <div>
                <p>{_t("user_info|room_unencrypted")}</p>
                <p>{_t("user_info|room_unencrypted_detail")}</p>
            </div>
        );
    }

    if (inDialog) {
        return content;
    }

    return (
        <React.Fragment>
            <div data-testid="encryption-info-description" className="mx_UserInfo_container">
                <h3>{_t("settings|security|encryption_section")}</h3>
                {description}
            </div>
            <div className="mx_UserInfo_container">
                <h3>{_t("user_info|verify_button")}</h3>
                <div>
                    <p>{_t("user_info|verify_explainer")}</p>
                    <p>{_t("encryption|verification|in_person")}</p>
                    {content}
                </div>
            </div>
        </React.Fragment>
    );
};

export default EncryptionInfo;
