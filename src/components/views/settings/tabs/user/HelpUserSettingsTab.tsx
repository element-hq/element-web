/*
Copyright 2019 - 2023 The Matrix.org Foundation C.I.C.

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

import React, { ReactNode } from "react";
import { logger } from "matrix-js-sdk/src/logger";

import AccessibleButton from "../../../elements/AccessibleButton";
import { _t, getCurrentLanguage } from "../../../../../languageHandler";
import SdkConfig from "../../../../../SdkConfig";
import createRoom from "../../../../../createRoom";
import Modal from "../../../../../Modal";
import PlatformPeg from "../../../../../PlatformPeg";
import UpdateCheckButton from "../../UpdateCheckButton";
import BugReportDialog from "../../../dialogs/BugReportDialog";
import CopyableText from "../../../elements/CopyableText";
import SettingsTab from "../SettingsTab";
import { SettingsSection } from "../../shared/SettingsSection";
import SettingsSubsection, { SettingsSubsectionText } from "../../shared/SettingsSubsection";
import ExternalLink from "../../../elements/ExternalLink";
import MatrixClientContext from "../../../../../contexts/MatrixClientContext";

interface IProps {
    closeSettingsFn: () => void;
}

interface IState {
    appVersion: string | null;
    canUpdate: boolean;
}

export default class HelpUserSettingsTab extends React.Component<IProps, IState> {
    public static contextType = MatrixClientContext;
    public context!: React.ContextType<typeof MatrixClientContext>;

    public constructor(props: IProps) {
        super(props);

        this.state = {
            appVersion: null,
            canUpdate: false,
        };
    }

    public componentDidMount(): void {
        PlatformPeg.get()
            ?.getAppVersion()
            .then((ver) => this.setState({ appVersion: ver }))
            .catch((e) => {
                logger.error("Error getting vector version: ", e);
            });
        PlatformPeg.get()
            ?.canSelfUpdate()
            .then((v) => this.setState({ canUpdate: v }))
            .catch((e) => {
                logger.error("Error getting self updatability: ", e);
            });
    }

    private getVersionInfo(): { appVersion: string; olmVersion: string } {
        const brand = SdkConfig.get().brand;
        const appVersion = this.state.appVersion || "unknown";
        const olmVersionTuple = this.context.olmVersion;
        const olmVersion = olmVersionTuple
            ? `${olmVersionTuple[0]}.${olmVersionTuple[1]}.${olmVersionTuple[2]}`
            : "<not-enabled>";

        return {
            appVersion: `${_t("setting|help_about|brand_version", { brand })} ${appVersion}`,
            olmVersion: `${_t("setting|help_about|olm_version")} ${olmVersion}`,
        };
    }

    private onClearCacheAndReload = (): void => {
        if (!PlatformPeg.get()) return;

        // Dev note: please keep this log line, it's useful when troubleshooting a MatrixClient suddenly
        // stopping in the middle of the logs.
        logger.log("Clear cache & reload clicked");
        this.context.stopClient();
        this.context.store.deleteAllData().then(() => {
            PlatformPeg.get()?.reload();
        });
    };

    private onBugReport = (): void => {
        Modal.createDialog(BugReportDialog, {});
    };

    private onStartBotChat = (): void => {
        this.props.closeSettingsFn();
        createRoom(this.context, {
            dmUserId: SdkConfig.get("welcome_user_id"),
            andView: true,
        });
    };

    private renderLegal(): ReactNode {
        const tocLinks = SdkConfig.get().terms_and_conditions_links;
        if (!tocLinks) return null;

        const legalLinks: JSX.Element[] = [];
        for (const tocEntry of tocLinks) {
            legalLinks.push(
                <div key={tocEntry.url}>
                    <ExternalLink href={tocEntry.url}>{tocEntry.text}</ExternalLink>
                </div>,
            );
        }

        return (
            <SettingsSubsection heading={_t("common|legal")}>
                <SettingsSubsectionText>{legalLinks}</SettingsSubsectionText>
            </SettingsSubsection>
        );
    }

    private renderCredits(): JSX.Element {
        // Note: This is not translated because it is legal text.
        // Also, &nbsp; is ugly but necessary.
        return (
            <SettingsSubsection heading={_t("common|credits")}>
                <SettingsSubsectionText>
                    <ul>
                        <li>
                            {_t(
                                "credits|default_cover_photo",
                                {},
                                {
                                    photo: (sub) => (
                                        <ExternalLink
                                            href="themes/element/img/backgrounds/lake.jpg"
                                            rel="noreferrer noopener"
                                            target="_blank"
                                        >
                                            {sub}
                                        </ExternalLink>
                                    ),
                                    author: (sub) => (
                                        <ExternalLink href="https://www.flickr.com/golan">{sub}</ExternalLink>
                                    ),
                                    terms: (sub) => (
                                        <ExternalLink
                                            href="https://creativecommons.org/licenses/by-sa/4.0/"
                                            rel="noreferrer noopener"
                                            target="_blank"
                                        >
                                            {sub}
                                        </ExternalLink>
                                    ),
                                },
                            )}
                        </li>
                        <li>
                            {_t(
                                "credits|twemoji_colr",
                                {},
                                {
                                    colr: (sub) => (
                                        <ExternalLink
                                            href="https://github.com/matrix-org/twemoji-colr"
                                            rel="noreferrer noopener"
                                            target="_blank"
                                        >
                                            {sub}
                                        </ExternalLink>
                                    ),
                                    author: (sub) => <ExternalLink href="https://mozilla.org">{sub}</ExternalLink>,
                                    terms: (sub) => (
                                        <ExternalLink
                                            href="https://www.apache.org/licenses/LICENSE-2.0"
                                            rel="noreferrer noopener"
                                            target="_blank"
                                        >
                                            {sub}
                                        </ExternalLink>
                                    ),
                                },
                            )}
                        </li>
                        <li>
                            {_t(
                                "credits|twemoji",
                                {},
                                {
                                    twemoji: (sub) => (
                                        <ExternalLink href="https://twemoji.twitter.com/">{sub}</ExternalLink>
                                    ),
                                    author: (sub) => (
                                        <ExternalLink href="https://twemoji.twitter.com/">{sub}</ExternalLink>
                                    ),
                                    terms: (sub) => (
                                        <ExternalLink
                                            href="https://creativecommons.org/licenses/by/4.0/"
                                            rel="noreferrer noopener"
                                            target="_blank"
                                        >
                                            {sub}
                                        </ExternalLink>
                                    ),
                                },
                            )}
                        </li>
                    </ul>
                </SettingsSubsectionText>
            </SettingsSubsection>
        );
    }

    private getVersionTextToCopy = (): string => {
        const { appVersion, olmVersion } = this.getVersionInfo();
        return `${appVersion}\n${olmVersion}`;
    };

    public render(): React.ReactNode {
        const brand = SdkConfig.get().brand;

        let faqText = _t(
            "setting|help_about|help_link",
            {
                brand,
            },
            {
                a: (sub) => <ExternalLink href={SdkConfig.get("help_url")}>{sub}</ExternalLink>,
            },
        );
        if (SdkConfig.get("welcome_user_id") && getCurrentLanguage().startsWith("en")) {
            faqText = (
                <div>
                    {_t(
                        "setting|help_about|help_link_chat_bot",
                        {
                            brand,
                        },
                        {
                            a: (sub) => (
                                <ExternalLink
                                    href={SdkConfig.get("help_url")}
                                    rel="noreferrer noopener"
                                    target="_blank"
                                >
                                    {sub}
                                </ExternalLink>
                            ),
                        },
                    )}
                    <div>
                        <AccessibleButton onClick={this.onStartBotChat} kind="primary">
                            {_t("setting|help_about|chat_bot", { brand })}
                        </AccessibleButton>
                    </div>
                </div>
            );
        }

        let updateButton: JSX.Element | undefined;
        if (this.state.canUpdate) {
            updateButton = <UpdateCheckButton />;
        }

        let bugReportingSection;
        if (SdkConfig.get().bug_report_endpoint_url) {
            bugReportingSection = (
                <SettingsSubsection
                    heading={_t("bug_reporting|title")}
                    description={
                        <>
                            <SettingsSubsectionText>{_t("bug_reporting|introduction")}</SettingsSubsectionText>
                            {_t("bug_reporting|description")}
                        </>
                    }
                >
                    <AccessibleButton onClick={this.onBugReport} kind="primary">
                        {_t("bug_reporting|submit_debug_logs")}
                    </AccessibleButton>
                    <SettingsSubsectionText>
                        {_t(
                            "bug_reporting|matrix_security_issue",
                            {},
                            {
                                a: (sub) => (
                                    <ExternalLink href="https://matrix.org/security-disclosure-policy/">
                                        {sub}
                                    </ExternalLink>
                                ),
                            },
                        )}
                    </SettingsSubsectionText>
                </SettingsSubsection>
            );
        }

        const { appVersion, olmVersion } = this.getVersionInfo();

        return (
            <SettingsTab>
                <SettingsSection heading={_t("setting|help_about|title")}>
                    {bugReportingSection}
                    <SettingsSubsection heading={_t("common|faq")} description={faqText} />
                    <SettingsSubsection heading={_t("setting|help_about|versions")}>
                        <SettingsSubsectionText>
                            <CopyableText getTextToCopy={this.getVersionTextToCopy}>
                                {appVersion}
                                <br />
                                {olmVersion}
                                <br />
                            </CopyableText>
                            {updateButton}
                        </SettingsSubsectionText>
                    </SettingsSubsection>
                    {this.renderLegal()}
                    {this.renderCredits()}
                    <SettingsSubsection heading={_t("common|Advanced")}>
                        <SettingsSubsectionText>
                            {_t(
                                "setting|help_about|homeserver",
                                {
                                    homeserverUrl: this.context.getHomeserverUrl(),
                                },
                                {
                                    code: (sub) => <code>{sub}</code>,
                                },
                            )}
                        </SettingsSubsectionText>
                        {this.context.getIdentityServerUrl() && (
                            <SettingsSubsectionText>
                                {_t(
                                    "setting|help_about|identity_server",
                                    {
                                        identityServerUrl: this.context.getIdentityServerUrl(),
                                    },
                                    {
                                        code: (sub) => <code>{sub}</code>,
                                    },
                                )}
                            </SettingsSubsectionText>
                        )}
                        <SettingsSubsectionText>
                            <details>
                                <summary>{_t("common|access_token")}</summary>
                                <b>{_t("setting|help_about|access_token_detail")}</b>
                                <CopyableText getTextToCopy={() => this.context.getAccessToken()}>
                                    {this.context.getAccessToken()}
                                </CopyableText>
                            </details>
                        </SettingsSubsectionText>
                        <AccessibleButton onClick={this.onClearCacheAndReload} kind="danger">
                            {_t("setting|help_about|clear_cache_reload")}
                        </AccessibleButton>
                    </SettingsSubsection>
                </SettingsSection>
            </SettingsTab>
        );
    }
}
