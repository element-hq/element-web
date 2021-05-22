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

import React, {useState} from 'react';
import QuestionDialog from './QuestionDialog';
import { _t } from '../../../languageHandler';
import Field from "../elements/Field";
import AccessibleButton from "../elements/AccessibleButton";
import CountlyAnalytics from "../../../CountlyAnalytics";
import SdkConfig from "../../../SdkConfig";
import Modal from "../../../Modal";
import BugReportDialog from "./BugReportDialog";
import InfoDialog from "./InfoDialog";
import StyledRadioGroup from "../elements/StyledRadioGroup";

const existingIssuesUrl = "https://github.com/vector-im/element-web/issues" +
    "?q=is%3Aopen+is%3Aissue+sort%3Areactions-%2B1-desc";
const newIssueUrl = "https://github.com/vector-im/element-web/issues/new";


export default (props) => {
    const [rating, setRating] = useState("");
    const [comment, setComment] = useState("");

    const onDebugLogsLinkClick = () => {
        props.onFinished();
        Modal.createTrackedDialog('Bug Report Dialog', '', BugReportDialog, {});
    };

    const hasFeedback = CountlyAnalytics.instance.canEnable();
    const onFinished = (sendFeedback) => {
        if (hasFeedback && sendFeedback) {
            CountlyAnalytics.instance.reportFeedback(parseInt(rating, 10), comment);
            Modal.createTrackedDialog('Feedback sent', '', InfoDialog, {
                title: _t('Feedback sent'),
                description: _t('Thank you!'),
            });
        }
        props.onFinished();
    };

    const brand = SdkConfig.get().brand;

    let countlyFeedbackSection;
    if (hasFeedback) {
        countlyFeedbackSection = <React.Fragment>
            <hr />
            <div className="mx_FeedbackDialog_section mx_FeedbackDialog_rateApp">
                <h3>{_t("Rate %(brand)s", { brand })}</h3>

                <p>{_t("Tell us below how you feel about %(brand)s so far.", { brand })}</p>
                <p>{_t("Please go into as much detail as you like, so we can track down the problem.")}</p>

                <StyledRadioGroup
                    name="feedbackRating"
                    value={rating}
                    onChange={setRating}
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
                />
            </div>
        </React.Fragment>;
    }

    let subheading;
    if (hasFeedback) {
        subheading = (
            <h2>{_t("There are two ways you can provide feedback and help us improve %(brand)s.", { brand })}</h2>
        );
    }

    let bugReports = null;
    if (SdkConfig.get().bug_report_endpoint_url) {
        bugReports = (
            <p>{
                _t("PRO TIP: If you start a bug, please submit <debugLogsLink>debug logs</debugLogsLink> " +
                    "to help us track down the problem.", {}, {
                    debugLogsLink: sub => (
                        <AccessibleButton kind="link" onClick={onDebugLogsLinkClick}>{sub}</AccessibleButton>
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
            { subheading }

            <div className="mx_FeedbackDialog_section mx_FeedbackDialog_reportBug">
                <h3>{_t("Report a bug")}</h3>
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
                {bugReports}
            </div>
            { countlyFeedbackSection }
        </React.Fragment>}
        button={hasFeedback ? _t("Send feedback") : _t("Go back")}
        buttonDisabled={hasFeedback && rating === ""}
        onFinished={onFinished}
    />);
};
