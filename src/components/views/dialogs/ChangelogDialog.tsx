/*
Copyright 2024 New Vector Ltd.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2016 Aviral Dasgupta

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
 */

import React from "react";

import { _t } from "../../../languageHandler";
import QuestionDialog from "./QuestionDialog";
import Spinner from "../elements/Spinner";
import Heading from "../typography/Heading";

interface IProps {
    newVersion: string;
    version: string;
    onFinished: (success: boolean) => void;
}

type State = Partial<Record<(typeof REPOS)[number], null | string | Commit[]>>;

interface Commit {
    sha: string;
    html_url: string;
    commit: {
        message: string;
    };
}

const REPOS = ["element-hq/element-web", "element-hq/matrix-react-sdk", "matrix-org/matrix-js-sdk"] as const;

export default class ChangelogDialog extends React.Component<IProps, State> {
    public constructor(props: IProps) {
        super(props);

        this.state = {};
    }

    private async fetchChanges(repo: (typeof REPOS)[number], oldVersion: string, newVersion: string): Promise<void> {
        const url = `https://riot.im/github/repos/${repo}/compare/${oldVersion}...${newVersion}`;

        try {
            const res = await fetch(url);

            if (!res.ok) {
                this.setState({ [repo]: res.statusText });
                return;
            }

            const body = await res.json();
            this.setState({ [repo]: body.commits });
        } catch (err) {
            this.setState({ [repo]: err instanceof Error ? err.message : _t("error|unknown") });
        }
    }

    public componentDidMount(): void {
        const version = this.props.newVersion.split("-");
        const version2 = this.props.version.split("-");
        if (version == null || version2 == null) return;
        // parse versions of form: [vectorversion]-react-[react-sdk-version]-js-[js-sdk-version]
        for (let i = 0; i < REPOS.length; i++) {
            const oldVersion = version2[2 * i];
            const newVersion = version[2 * i];
            this.fetchChanges(REPOS[i], oldVersion, newVersion);
        }
    }

    private elementsForCommit(commit: Commit): JSX.Element {
        return (
            <li key={commit.sha} className="mx_ChangelogDialog_li">
                <a href={commit.html_url} target="_blank" rel="noreferrer noopener">
                    {commit.commit.message.split("\n")[0]}
                </a>
            </li>
        );
    }

    public render(): React.ReactNode {
        const logs = REPOS.map((repo) => {
            let content;
            if (this.state[repo] == null) {
                content = <Spinner key={repo} />;
            } else if (typeof this.state[repo] === "string") {
                content = _t("update|error_unable_load_commit", {
                    msg: this.state[repo],
                });
            } else {
                content = (this.state[repo] as Commit[]).map(this.elementsForCommit);
            }
            return (
                <div key={repo}>
                    <Heading as="h2" size="4">
                        {repo}
                    </Heading>
                    <ul>{content}</ul>
                </div>
            );
        });

        const content = (
            <div className="mx_ChangelogDialog_content">
                {this.props.version == null || this.props.newVersion == null ? (
                    <h2>{_t("update|unavailable")}</h2>
                ) : (
                    logs
                )}
            </div>
        );

        return (
            <QuestionDialog
                title={_t("update|changelog")}
                description={content}
                button={_t("action|update")}
                onFinished={this.props.onFinished}
            />
        );
    }
}
