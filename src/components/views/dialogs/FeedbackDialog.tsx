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

import React, { useEffect, useRef, useState } from "react";

import QuestionDialog from "./QuestionDialog";
import { _t } from "../../../languageHandler";
import Field from "../elements/Field";
import AccessibleButton from "../elements/AccessibleButton";
import SdkConfig from "../../../SdkConfig";
import Modal from "../../../Modal";
import BugReportDialog from "./BugReportDialog";
import InfoDialog from "./InfoDialog";
import { submitFeedback } from "../../../rageshake/submit-rageshake";
import { useStateToggle } from "../../../hooks/useStateToggle";
import StyledCheckbox from "../elements/StyledCheckbox";
import ExternalLink from "../elements/ExternalLink";

interface IProps {
    feature?: string;
    onFinished(): void;
}

const FeedbackDialog: React.FC<IProps> = (props: IProps) => {
    const feedbackRef = useRef<Field>(null);
    const [comment, setComment] = useState<string>("");
    const [canContact, toggleCanContact] = useStateToggle(false);

    useEffect(() => {
        // autofocus doesn't work on textareas
        feedbackRef.current?.focus();
    }, []);

    const onDebugLogsLinkClick = (): void => {
        props.onFinished();
        Modal.createDialog(BugReportDialog, {});
    };

    const hasFeedback = !!SdkConfig.get().bug_report_endpoint_url;
    const onFinished = (sendFeedback: boolean): void => {
        if (hasFeedback && sendFeedback) {
            const label = props.feature ? `${props.feature}-feedback` : "feedback";
            submitFeedback(label, comment, canContact);

            Modal.createDialog(InfoDialog, {
                title: _t("Feedback sent"),
                description: _t("Thank you!"),
            });
        }
        props.onFinished();
    };

    let feedbackSection: JSX.Element | undefined;
    if (hasFeedback) {
        feedbackSection = (
            <div className="mx_FeedbackDialog_section mx_FeedbackDialog_rateApp">
                <h3>{_t("Comment")}</h3>

                <p>{_t("Your platform and username will be noted to help us use your feedback as much as we can.")}</p>

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
                    ref={feedbackRef}
                />

                <StyledCheckbox checked={canContact} onChange={toggleCanContact}>
                    {_t("You may contact me if you want to follow up or to let me test out upcoming ideas")}
                </StyledCheckbox>
            </div>
        );
    }

    let bugReports: JSX.Element | undefined;
    if (hasFeedback) {
        bugReports = (
            <p className="mx_FeedbackDialog_section_microcopy">
                {_t(
                    "PRO TIP: If you start a bug, please submit <debugLogsLink>debug logs</debugLogsLink> " +
                        "to help us track down the problem.",
                    {},
                    {
                        debugLogsLink: (sub) => (
                            <AccessibleButton kind="link_inline" onClick={onDebugLogsLinkClick}>
                                {sub}
                            </AccessibleButton>
                        ),
                    },
                )}
            </p>
        );
    }

    const existingIssuesUrl = SdkConfig.getObject("feedback").get("existing_issues_url");
    const newIssueUrl = SdkConfig.getObject("feedback").get("new_issue_url");

    return (
        <QuestionDialog
            className="mx_FeedbackDialog"
            hasCancelButton={!!hasFeedback}
            title={_t("Feedback")}
            description={
                <React.Fragment>
                    <div className="mx_FeedbackDialog_section mx_FeedbackDialog_reportBug">
                        <h3>{_t("Report a bug")}</h3>
                        <p>
                            {_t(
                                "Please view <existingIssuesLink>existing bugs on Github</existingIssuesLink> first. " +
                                    "No match? <newIssueLink>Start a new one</newIssueLink>.",
                                {},
                                {
                                    existingIssuesLink: (sub) => {
                                        return (
                                            <ExternalLink
                                                target="_blank"
                                                rel="noreferrer noopener"
                                                href={existingIssuesUrl}
                                            >
                                                {sub}
                                            </ExternalLink>
                                        );
                                    },
                                    newIssueLink: (sub) => {
                                        return (
                                            <ExternalLink target="_blank" rel="noreferrer noopener" href={newIssueUrl}>
                                                {sub}
                                            </ExternalLink>
                                        );
                                    },
                                },
                            )}
                        </p>
                        {bugReports}
                    </div>
                    {feedbackSection}
                </React.Fragment>
            }
            button={hasFeedback ? _t("Send feedback") : _t("Go back")}
            buttonDisabled={hasFeedback && !comment}
            onFinished={onFinished}
        />
    );
};

export default FeedbackDialog;
