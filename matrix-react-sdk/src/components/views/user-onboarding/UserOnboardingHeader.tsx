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
    let description: string;
    let image;
    let actionLabel: string;

    switch (useCase) {
        case UseCase.PersonalMessaging:
            title = _t("Secure messaging for friends and family");
            description = _t(
                "With free end-to-end encrypted messaging, and unlimited voice and video calls, " +
                    "%(brand)s is a great way to stay in touch.",
                {
                    brand: SdkConfig.get("brand"),
                },
            );
            image = require("../../../../res/img/user-onboarding/PersonalMessaging.png");
            actionLabel = _t("Start your first chat");
            break;
        case UseCase.WorkMessaging:
            title = _t("Secure messaging for work");
            description = _t(
                "With free end-to-end encrypted messaging, and unlimited voice and video calls," +
                    " %(brand)s is a great way to stay in touch.",
                {
                    brand: SdkConfig.get("brand"),
                },
            );
            image = require("../../../../res/img/user-onboarding/WorkMessaging.png");
            actionLabel = _t("Find your co-workers");
            break;
        case UseCase.CommunityMessaging:
            title = _t("Community ownership");
            description = _t(
                "Keep ownership and control of community discussion.\n" +
                    "Scale to support millions, with powerful moderation and interoperability.",
            );
            image = require("../../../../res/img/user-onboarding/CommunityMessaging.png");
            actionLabel = _t("Find your people");
            break;
        default:
            title = _t("Welcome to %(brand)s", {
                brand: SdkConfig.get("brand"),
            });
            description = _t(
                "With free end-to-end encrypted messaging, and unlimited voice and video calls," +
                    " %(brand)s is a great way to stay in touch.",
                {
                    brand: SdkConfig.get("brand"),
                },
            );
            image = require("../../../../res/img/user-onboarding/PersonalMessaging.png");
            actionLabel = _t("Start your first chat");
            break;
    }

    return (
        <div className="mx_UserOnboardingHeader">
            <div className="mx_UserOnboardingHeader_content">
                <Heading size="h1">
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
