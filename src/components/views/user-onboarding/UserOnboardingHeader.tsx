/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import * as React from "react";

import defaultDispatcher from "../../../dispatcher/dispatcher";
import { _t } from "../../../languageHandler";
import PosthogTrackers from "../../../PosthogTrackers";
import SdkConfig from "../../../SdkConfig";
import { UseCase } from "../../../settings/enums/UseCase";
import AccessibleButton, { ButtonEvent } from "../../views/elements/AccessibleButton";
import Heading from "../../views/typography/Heading";

const onClickSendDm = (ev: ButtonEvent): void => {
    PosthogTrackers.trackInteraction("WebUserOnboardingHeaderSendDm", ev);
    defaultDispatcher.dispatch({ action: "view_create_chat" });
};

interface Props {
    useCase: UseCase | null;
}

export function UserOnboardingHeader({ useCase }: Props): JSX.Element {
    let title: string;
    let description = _t("onboarding|free_e2ee_messaging_unlimited_voip", {
        brand: SdkConfig.get("brand"),
    });
    let image: string;
    let actionLabel: string;

    switch (useCase) {
        case UseCase.PersonalMessaging:
            title = _t("onboarding|personal_messaging_title");
            image = require("../../../../res/img/user-onboarding/PersonalMessaging.png");
            actionLabel = _t("onboarding|personal_messaging_action");
            break;
        case UseCase.WorkMessaging:
            title = _t("onboarding|work_messaging_title");
            description = _t("onboarding|free_e2ee_messaging_unlimited_voip", {
                brand: SdkConfig.get("brand"),
            });
            image = require("../../../../res/img/user-onboarding/WorkMessaging.png");
            actionLabel = _t("onboarding|work_messaging_action");
            break;
        case UseCase.CommunityMessaging:
            title = _t("onboarding|community_messaging_title");
            description = _t("onboarding|community_messaging_description");
            image = require("../../../../res/img/user-onboarding/CommunityMessaging.png");
            actionLabel = _t("onboarding|community_messaging_action");
            break;
        default:
            title = _t("onboarding|welcome_to_brand", {
                brand: SdkConfig.get("brand"),
            });
            image = require("../../../../res/img/user-onboarding/PersonalMessaging.png");
            actionLabel = _t("onboarding|personal_messaging_action");
            break;
    }

    return (
        <div className="mx_UserOnboardingHeader">
            <div className="mx_UserOnboardingHeader_content">
                <Heading size="1">
                    {title}
                    <span className="mx_UserOnboardingHeader_dot">.</span>
                </Heading>
                <p>{description}</p>
                <AccessibleButton onClick={onClickSendDm} kind="primary">
                    {actionLabel}
                </AccessibleButton>
            </div>
            <img className="mx_UserOnboardingHeader_image" src={image} alt="" />
        </div>
    );
}
