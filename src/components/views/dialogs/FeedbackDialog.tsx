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
import QuestionDialog from "matrix-react-sdk/src/components/views/dialogs/QuestionDialog";
import { _t } from "matrix-react-sdk/src/languageHandler";
import Field from "matrix-react-sdk/src/components/views/elements/Field";
import AccessibleButton from "matrix-react-sdk/src/components/views/elements/AccessibleButton";
import SdkConfig from "matrix-react-sdk/src/SdkConfig";
import Modal from "matrix-react-sdk/src/Modal";
import BugReportDialog from "matrix-react-sdk/src/components/views/dialogs/BugReportDialog";
import { useStateToggle } from "matrix-react-sdk/src/hooks/useStateToggle";
import StyledCheckbox from "matrix-react-sdk/src/components/views/elements/StyledCheckbox";
import ExternalLink from "matrix-react-sdk/src/components/views/elements/ExternalLink";
import { MatrixClientPeg } from "matrix-react-sdk/src/MatrixClientPeg";
interface IProps {
    feature?: string;
    onFinished(): void;
}

const FeedbackDialog: React.FC<IProps> = (props: IProps) => {
    const feedbackRef = useRef<Field>(null);
    const [comment, setComment] = useState<string>("");
    const [canContact, toggleCanContact] = useStateToggle(false);
    const client = MatrixClientPeg.safeGet();

    useEffect(() => {
        // autofocus doesn't work on textareas
        feedbackRef.current?.focus();
    }, []);

    const onDebugLogsLinkClick = (): void => {
        props.onFinished();
        Modal.createDialog(BugReportDialog, {});
    };

    const hasFeedback = !!SdkConfig.get().bug_report_endpoint_url;
    const supportChannelRoomId = (SdkConfig.get() as any).support_channel_room_id;

    const onFinished = async (sendFeedback: boolean): Promise<void> => {
        if (hasFeedback && sendFeedback) {
            window.open(`#/room/${supportChannelRoomId}`, "_self");

            const actualRoomId = await client.getRoomIdForAlias(supportChannelRoomId);
            client.sendTextMessage(actualRoomId.room_id, comment);
        }
        props.onFinished();
    };

    let feedbackSection: JSX.Element | undefined;
    if (hasFeedback) {
        feedbackSection = (
            <div className="mx_FeedbackDialog_section mx_FeedbackDialog_rateApp">
                <h3>{_t("feedback|comment_label")}</h3>

                {/* <p>{_t("feedback|platform_username")}</p> */}
                <p>Ready to make a difference? Drop a message to share your feedback, thoughts, or suggestions.</p>

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
