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

interface IProps extends IDialogProps {
    featureId: string;
}

const BetaFeedbackDialog: React.FC<IProps> = ({featureId, onFinished}) => {
    const info = SettingsStore.getBetaInfo(featureId);

    const [comment, setComment] = useState("");

    const sendFeedback = async (ok: boolean) => {
        if (!ok) return onFinished(false);

        submitFeedback(SdkConfig.get().bug_report_endpoint_url, info.feedbackLabel, comment);
        onFinished(true);
    };

    return (<QuestionDialog
        className="mx_FeedbackDialog"
        hasCancelButton={true}
        title={_t("Beta feedback")}
        description={<React.Fragment>
            { _t(info.feedbackSubheading) }

            <Field
                id="feedbackComment"
                label={_t("Add comment")}
                placeholder={_t("Comment")}
                type="text"
                autoComplete="off"
                value={comment}
                element="textarea"
                onChange={(ev) => {
                    setComment(ev.target.value);
                }}
            />
        </React.Fragment>}
        button={_t("Send feedback")}
        buttonDisabled={!comment}
        onFinished={sendFeedback}
    />);
};

export default BetaFeedbackDialog;
