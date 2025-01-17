/*
Copyright 2018-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
                title: _t("feedback|sent"),
                description: _t("bug_reporting|thank_you"),
            });
        }
        props.onFinished();
    };

    let feedbackSection: JSX.Element | undefined;
    if (hasFeedback) {
        feedbackSection = (
            <div className="mx_FeedbackDialog_section mx_FeedbackDialog_rateApp">
                <h3>{_t("feedback|comment_label")}</h3>

                <p>{_t("feedback|platform_username")}</p>

                <Field
                    id="feedbackComment"
                    label={_t("common|feedback")}
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
                    {_t("feedback|may_contact_label")}
                </StyledCheckbox>
            </div>
        );
    }

    let bugReports: JSX.Element | undefined;
    if (hasFeedback) {
        bugReports = (
            <p className="mx_FeedbackDialog_section_microcopy">
                {_t(
                    "feedback|pro_type",
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
            hasCancelButton={hasFeedback}
            title={_t("common|feedback")}
            description={
                <React.Fragment>
                    <div className="mx_FeedbackDialog_section mx_FeedbackDialog_reportBug">
                        <h3>{_t("common|report_a_bug")}</h3>
                        <p>
                            {_t(
                                "feedback|existing_issue_link",
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
            button={hasFeedback ? _t("feedback|send_feedback_action") : _t("action|go_back")}
            buttonDisabled={hasFeedback && !comment}
            onFinished={onFinished}
        />
    );
};

export default FeedbackDialog;
