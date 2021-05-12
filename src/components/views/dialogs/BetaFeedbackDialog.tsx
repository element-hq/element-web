/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import React, {useState} from "react";

import QuestionDialog from './QuestionDialog';
import { _t } from '../../../languageHandler';
import Field from "../elements/Field";
import SdkConfig from "../../../SdkConfig";
import {IDialogProps} from "./IDialogProps";
import SettingsStore from "../../../settings/SettingsStore";
import {submitFeedback} from "../../../rageshake/submit-rageshake";
import StyledCheckbox from "../elements/StyledCheckbox";
import Modal from "../../../Modal";
import InfoDialog from "./InfoDialog";
import AccessibleButton from "../elements/AccessibleButton";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import {Action} from "../../../dispatcher/actions";
import {USER_LABS_TAB} from "./UserSettingsDialog";

interface IProps extends IDialogProps {
    featureId: string;
}

const BetaFeedbackDialog: React.FC<IProps> = ({featureId, onFinished}) => {
    const info = SettingsStore.getBetaInfo(featureId);

    const [comment, setComment] = useState("");
    const [canContact, setCanContact] = useState(false);

    const sendFeedback = async (ok: boolean) => {
        if (!ok) return onFinished(false);

        submitFeedback(SdkConfig.get().bug_report_endpoint_url, info.feedbackLabel, comment, canContact);
        onFinished(true);

        Modal.createTrackedDialog("Beta Dialog Sent", featureId, InfoDialog, {
            title: _t("Beta feedback"),
            description: _t("Thank you for your feedback, we really appreciate it."),
            button: _t("Done"),
            hasCloseButton: false,
            fixedWidth: false,
        });
    };

    return (<QuestionDialog
        className="mx_BetaFeedbackDialog"
        hasCancelButton={true}
        title={_t("Beta feedback")}
        description={<React.Fragment>
            <div className="mx_BetaFeedbackDialog_subheading">
                { _t(info.feedbackSubheading) }
                &nbsp;
                { _t("Your platform and username will be noted to help us use your feedback as much as we can.")}

                <AccessibleButton kind="link" onClick={() => {
                    onFinished(false);
                    defaultDispatcher.dispatch({
                        action: Action.ViewUserSettings,
                        initialTabId: USER_LABS_TAB,
                    });
                }}>
                    { _t("To leave the beta, visit your settings.") }
                </AccessibleButton>
            </div>

            <Field
                id="feedbackComment"
                label={_t("Feedback")}
                type="text"
                autoComplete="off"
                value={comment}
                element="textarea"
                onChange={(ev) => {
                    setComment(ev.target.value);
                }}
            />

            <StyledCheckbox
                checked={canContact}
                onClick={e => setCanContact((e.target as HTMLInputElement).checked)}
            >
                { _t("You may contact me if you have any follow up questions") }
            </StyledCheckbox>
        </React.Fragment>}
        button={_t("Send feedback")}
        buttonDisabled={!comment}
        onFinished={sendFeedback}
    />);
};

export default BetaFeedbackDialog;
