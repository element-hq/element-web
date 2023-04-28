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

import React, { ReactNode, useState } from "react";

import QuestionDialog from "./QuestionDialog";
import { _t } from "../../../languageHandler";
import Field from "../elements/Field";
import { submitFeedback } from "../../../rageshake/submit-rageshake";
import StyledCheckbox from "../elements/StyledCheckbox";
import Modal from "../../../Modal";
import InfoDialog from "./InfoDialog";

interface IProps {
    title: string;
    subheading?: string;
    rageshakeLabel?: string;
    rageshakeData?: Record<string, any>;
    children?: ReactNode;
    onFinished(sendFeedback?: boolean): void;
}

const GenericFeatureFeedbackDialog: React.FC<IProps> = ({
    title,
    subheading,
    children,
    rageshakeLabel,
    rageshakeData = {},
    onFinished,
}) => {
    const [comment, setComment] = useState("");
    const [canContact, setCanContact] = useState(false);

    const sendFeedback = async (ok: boolean): Promise<void> => {
        if (!ok) return onFinished(false);

        submitFeedback(rageshakeLabel, comment, canContact, rageshakeData);
        onFinished(true);

        Modal.createDialog(InfoDialog, {
            title,
            description: _t("Feedback sent! Thanks, we appreciate it!"),
            button: _t("Close"),
            hasCloseButton: false,
            fixedWidth: false,
        });
    };

    return (
        <QuestionDialog
            className="mx_GenericFeatureFeedbackDialog"
            hasCancelButton={true}
            title={title}
            description={
                <React.Fragment>
                    <div className="mx_GenericFeatureFeedbackDialog_subheading">
                        {subheading}
                        &nbsp;
                        {_t("Your platform and username will be noted to help us use your feedback as much as we can.")}
                        &nbsp;
                        {children}
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
                        autoFocus={true}
                    />

                    <StyledCheckbox
                        checked={canContact}
                        onChange={(e) => setCanContact((e.target as HTMLInputElement).checked)}
                    >
                        {_t("You may contact me if you have any follow up questions")}
                    </StyledCheckbox>
                </React.Fragment>
            }
            button={_t("Send feedback")}
            buttonDisabled={!comment}
            onFinished={sendFeedback}
        />
    );
};

export default GenericFeatureFeedbackDialog;
