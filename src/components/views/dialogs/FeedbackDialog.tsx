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

import React, { useEffect, useRef, useState } from 'react';

import QuestionDialog from './QuestionDialog';
import { _t } from '../../../languageHandler';
import Field from "../elements/Field";
import AccessibleButton from "../elements/AccessibleButton";
import CountlyAnalytics, { Rating } from "../../../CountlyAnalytics";
import SdkConfig from "../../../SdkConfig";
import Modal from "../../../Modal";
import BugReportDialog from "./BugReportDialog";
import InfoDialog from "./InfoDialog";
import StyledRadioGroup from "../elements/StyledRadioGroup";
import { IDialogProps } from "./IDialogProps";
import { submitFeedback } from "../../../rageshake/submit-rageshake";
import { useStateToggle } from "../../../hooks/useStateToggle";
import StyledCheckbox from "../elements/StyledCheckbox";

const existingIssuesUrl = "https://github.com/vector-im/element-web/issues" +
    "?q=is%3Aopen+is%3Aissue+sort%3Areactions-%2B1-desc";
const newIssueUrl = "https://github.com/vector-im/element-web/issues/new/choose";

interface IProps extends IDialogProps {}

const FeedbackDialog: React.FC<IProps> = (props: IProps) => {
    const feedbackRef = useRef<Field>();
    const [rating, setRating] = useState<Rating>();
    const [comment, setComment] = useState<string>("");
    const [canContact, toggleCanContact] = useStateToggle(false);

    useEffect(() => {
        // autofocus doesn't work on textareas
        feedbackRef.current?.focus();
    }, []);

    const onDebugLogsLinkClick = (): void => {
        props.onFinished();
        Modal.createTrackedDialog('Bug Report Dialog', '', BugReportDialog, {});
    };

    const countlyEnabled = CountlyAnalytics.instance.canEnable();
    const rageshakeUrl = SdkConfig.get().bug_report_endpoint_url;

    const hasFeedback = countlyEnabled || rageshakeUrl;
    const onFinished = (sendFeedback: boolean): void => {
        if (hasFeedback && sendFeedback) {
            if (rageshakeUrl) {
                submitFeedback(rageshakeUrl, "feedback", comment, canContact);
            } else if (countlyEnabled) {
                CountlyAnalytics.instance.reportFeedback(rating, comment);
            }

            Modal.createTrackedDialog('Feedback sent', '', InfoDialog, {
                title: _t('Feedback sent'),
                description: _t('Thank you!'),
            });
        }
        props.onFinished();
    };

    const brand = SdkConfig.get().brand;

    let feedbackSection;
    if (rageshakeUrl) {
        feedbackSection = <div className="mx_FeedbackDialog_section mx_FeedbackDialog_rateApp">
            <h3>{ _t("Comment") }</h3>

            <p>{ _t("Your platform and username will be noted to help us use your feedback as much as we can.") }</p>

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

            <StyledCheckbox
                checked={canContact}
                onChange={toggleCanContact}
            >
                { _t("You may contact me if you want to follow up or to let me test out upcoming ideas") }
            </StyledCheckbox>
        </div>;
    } else if (countlyEnabled) {
        feedbackSection = <div className="mx_FeedbackDialog_section mx_FeedbackDialog_rateApp">
            <h3>{ _t("Rate %(brand)s", { brand }) }</h3>

            <p>{ _t("Tell us below how you feel about %(brand)s so far.", { brand }) }</p>
            <p>{ _t("Please go into as much detail as you like, so we can track down the problem.") }</p>

            <StyledRadioGroup
                name="feedbackRating"
                value={String(rating)}
                onChange={(r) => setRating(parseInt(r, 10) as Rating)}
                definitions={[
                    { value: "1", label: "😠" },
                    { value: "2", label: "😞" },
                    { value: "3", label: "😑" },
                    { value: "4", label: "😄" },
                    { value: "5", label: "😍" },
                ]}
            />

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
                ref={feedbackRef}
            />
        </div>;
    }

    let bugReports = null;
    if (rageshakeUrl) {
        bugReports = (
            <p className="mx_FeedbackDialog_section_microcopy">{
                _t("PRO TIP: If you start a bug, please submit <debugLogsLink>debug logs</debugLogsLink> " +
                    "to help us track down the problem.", {}, {
                    debugLogsLink: sub => (
                        <AccessibleButton kind="link" onClick={onDebugLogsLinkClick}>{ sub }</AccessibleButton>
                    ),
                })
            }</p>
        );
    }

    return (<QuestionDialog
        className="mx_FeedbackDialog"
        hasCancelButton={!!hasFeedback}
        title={_t("Feedback")}
        description={<React.Fragment>
            <div className="mx_FeedbackDialog_section mx_FeedbackDialog_reportBug">
                <h3>{ _t("Report a bug") }</h3>
                <p>{
                    _t("Please view <existingIssuesLink>existing bugs on Github</existingIssuesLink> first. " +
                        "No match? <newIssueLink>Start a new one</newIssueLink>.", {}, {
                        existingIssuesLink: (sub) => {
                            return <a target="_blank" rel="noreferrer noopener" href={existingIssuesUrl}>{ sub }</a>;
                        },
                        newIssueLink: (sub) => {
                            return <a target="_blank" rel="noreferrer noopener" href={newIssueUrl}>{ sub }</a>;
                        },
                    })
                }</p>
                { bugReports }
            </div>
            { feedbackSection }
        </React.Fragment>}
        button={hasFeedback ? _t("Send feedback") : _t("Go back")}
        buttonDisabled={hasFeedback && !rating && !comment}
        onFinished={onFinished}
    />);
};

export default FeedbackDialog;
