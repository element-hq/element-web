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

import React from 'react';
import QuestionDialog from './QuestionDialog';
import { _t } from '../../../languageHandler';

export default (props) => {
    const existingIssuesUrl = "https://github.com/vector-im/riot-web/issues" +
        "?q=is%3Aopen+is%3Aissue+sort%3Areactions-%2B1-desc";
    const newIssueUrl = "https://github.com/vector-im/riot-web/issues/new";

    const description1 =
        _t("If you run into any bugs or have feedback you'd like to share, " +
           "please let us know on GitHub.");
    const description2 = _t("To help avoid duplicate issues, " +
        "please <existingIssuesLink>view existing issues</existingIssuesLink> " +
        "first (and add a +1) or <newIssueLink>create a new issue</newIssueLink> " +
        "if you can't find it.", {},
        {
            existingIssuesLink: (sub) => {
                return <a target="_blank" rel="noreferrer noopener" href={existingIssuesUrl}>{ sub }</a>;
            },
            newIssueLink: (sub) => {
                return <a target="_blank" rel="noreferrer noopener" href={newIssueUrl}>{ sub }</a>;
            },
        });

    return (<QuestionDialog
        hasCancelButton={false}
        title={_t("Report bugs & give feedback")}
        description={<div><p>{description1}</p><p>{description2}</p></div>}
        button={_t("Go back")}
        onFinished={props.onFinished}
    />);
};
