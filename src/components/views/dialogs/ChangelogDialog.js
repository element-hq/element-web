/*
 Copyright 2016 Aviral Dasgupta

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
import sdk from 'matrix-react-sdk';
import request from 'browser-request';
import { _t } from 'matrix-react-sdk/lib/languageHandler';

const REPOS = ['vector-im/vector-web', 'matrix-org/matrix-react-sdk', 'matrix-org/matrix-js-sdk'];

export default class ChangelogDialog extends React.Component {
    constructor(props) {
        super(props);

        this.state = {};
    }

    componentDidMount() {
        const version = this.props.newVersion.split('-');
        const version2 = this.props.version.split('-');
        if(version == null || version2 == null) return;
        // parse versions of form: [vectorversion]-react-[react-sdk-version]-js-[js-sdk-version]
        for(let i=0; i<REPOS.length; i++) {
            const oldVersion = version2[2*i];
            const newVersion = version[2*i];
            request(`https://api.github.com/repos/${REPOS[i]}/compare/${oldVersion}...${newVersion}`, (a, b, body) => {
                if(body == null) return;
                this.setState({[REPOS[i]]: JSON.parse(body).commits});
            });
        }
    }

    _elementsForCommit(commit) {
        return (
            <li key={commit.sha} className="mx_ChangelogDialog_li">
                <a href={commit.html_url} target="_blank" rel="noopener">
                    {commit.commit.message}
                </a>
            </li>
        );
    }

    render() {
        const Spinner = sdk.getComponent('views.elements.Spinner');
        const QuestionDialog = sdk.getComponent('dialogs.QuestionDialog');

        const logs = REPOS.map(repo => {
            if (this.state[repo] == null) return <Spinner key={repo} />;
            return (
                <div key={repo}>
                    <h2>{repo}</h2>
                    <ul>
                    {this.state[repo].map(this._elementsForCommit)}
                    </ul>
                </div>
            )
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
        )
    }
}

ChangelogDialog.propTypes = {
    version: React.PropTypes.string.isRequired,
    newVersion: React.PropTypes.string.isRequired,
    onFinished: React.PropTypes.func.isRequired,
};
