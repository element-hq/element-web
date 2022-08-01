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

import { _t } from "../../../languageHandler";
import Modal from "../../../Modal";
import SdkConfig from "../../../SdkConfig";
import AccessibleButton from "../../views/elements/AccessibleButton";
import Heading from "../../views/typography/Heading";
import FeedbackDialog from "../dialogs/FeedbackDialog";

export function UserOnboardingFeedback() {
    if (!SdkConfig.get().bug_report_endpoint_url) {
        return null;
    }

    return (
        <div className="mx_UserOnboardingFeedback">
            <div className="mx_UserOnboardingFeedback_content">
                <Heading size="h4" className="mx_UserOnboardingFeedback_title">
                    { _t("How are you finding Element so far?") }
                </Heading>
                <div className="mx_UserOnboardingFeedback_text">
                    { _t("We’d appreciate any feedback on how you’re finding Element.") }
                </div>
            </div>
            <AccessibleButton
                kind="primary_outline"
                className="mx_UserOnboardingFeedback_action"
                onClick={() => {
                    Modal.createDialog(FeedbackDialog, {
                        feature: "use-case-selection",
                    });
                }}
            >
                { _t("Feedback") }
            </AccessibleButton>
        </div>
    );
}
