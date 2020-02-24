/*
 Copyright 2016 Aviral Dasgupta
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

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
import PropTypes from 'prop-types';
import * as sdk from '../../../index';
import request from 'browser-request';
import { _t } from '../../../languageHandler';

const REPOS = ['vector-im/riot-web', 'matrix-org/matrix-react-sdk', 'matrix-org/matrix-js-sdk'];

export default class ChangelogDialog extends React.Component {
    constructor(props) {
        super(props);

        this.state = {};
    }

    componentDidMount() {
        const version = this.props.newVersion.split('-');
        const version2 = this.props.version.split('-');
        if (version == null || version2 == null) return;
        // parse versions of form: [vectorversion]-react-[react-sdk-version]-js-[js-sdk-version]
        for (let i=0; i<REPOS.length; i++) {
            const oldVersion = version2[2*i];
            const newVersion = version[2*i];
            const url = `https://riot.im/github/repos/${REPOS[i]}/compare/${oldVersion}...${newVersion}`;
            request(url, (err, response, body) => {
                if (response.statusCode < 200 || response.statusCode >= 300) {
                    this.setState({ [REPOS[i]]: response.statusText });
                    return;
                }
                this.setState({[REPOS[i]]: JSON.parse(body).commits});
            });
        }
    }

    _elementsForCommit(commit) {
        return (
            <li key={commit.sha} className="mx_ChangelogDialog_li">
                <a href={commit.html_url} target="_blank" rel="noreferrer noopener">
                    {commit.commit.message.split('\n')[0]}
                </a>
            </li>
        );
    }

    render() {
        const Spinner = sdk.getComponent('views.elements.Spinner');
        const QuestionDialog = sdk.getComponent('dialogs.QuestionDialog');

        const logs = REPOS.map(repo => {
            let content;
            if (this.state[repo] == null) {
                content = <Spinner key={repo} />;
            } else if (typeof this.state[repo] === "string") {
                content = _t("Unable to load commit detail: %(msg)s", {
                    msg: this.state[repo],
                });
            } else {
                content = this.state[repo].map(this._elementsForCommit);
            }
            return (
                <div key={repo}>
                    <h2>{repo}</h2>
                    <ul>{content}</ul>
                </div>
            );
        });

        const content = (
            <div className="mx_ChangelogDialog_content">
                {this.props.version == null || this.props.newVersion == null ? <h2>{_t("Unavailable")}</h2> : logs}
            </div>
        );


        return (
            <QuestionDialog
                title={_t("Changelog")}
                description={content}
                button={_t("Update")}
                onFinished={this.props.onFinished}
                />
        );
    }
}

ChangelogDialog.propTypes = {
    version: PropTypes.string.isRequired,
    newVersion: PropTypes.string.isRequired,
    onFinished: PropTypes.func.isRequired,
};
