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
import { MatrixClientPeg } from "../../../../../MatrixClientPeg";
import SdkConfig from "../../../../../SdkConfig";
import createRoom from "../../../../../createRoom";
import Modal from "../../../../../Modal";
import PlatformPeg from "../../../../../PlatformPeg";
import UpdateCheckButton from "../../UpdateCheckButton";
import BugReportDialog from "../../../dialogs/BugReportDialog";
import { OpenToTabPayload } from "../../../../../dispatcher/payloads/OpenToTabPayload";
import { Action } from "../../../../../dispatcher/actions";
import { UserTab } from "../../../dialogs/UserTab";
import dis from "../../../../../dispatcher/dispatcher";
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
        const olmVersionTuple = MatrixClientPeg.get().olmVersion;
        const olmVersion = olmVersionTuple
            ? `${olmVersionTuple[0]}.${olmVersionTuple[1]}.${olmVersionTuple[2]}`
            : "<not-enabled>";

        return {
            appVersion: `${_t("%(brand)s version:", { brand })} ${appVersion}`,
            olmVersion: `${_t("Olm version:")} ${olmVersion}`,
        };
    }

    private onClearCacheAndReload = (): void => {
        if (!PlatformPeg.get()) return;

        // Dev note: please keep this log line, it's useful when troubleshooting a MatrixClient suddenly
        // stopping in the middle of the logs.
        logger.log("Clear cache & reload clicked");
        MatrixClientPeg.get().stopClient();
        MatrixClientPeg.get()
            .store.deleteAllData()
            .then(() => {
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
            <SettingsSubsection heading={_t("Legal")}>
                <SettingsSubsectionText>{legalLinks}</SettingsSubsectionText>
            </SettingsSubsection>
        );
    }

    private renderCredits(): JSX.Element {
        // Note: This is not translated because it is legal text.
        // Also, &nbsp; is ugly but necessary.
        return (
            <SettingsSubsection heading={_t("Credits")}>
                <SettingsSubsectionText>
                    <ul>
                        <li>
                            {_t(
                                "The <photo>default cover photo</photo> is © " +
                                    "<author>Jesús Roncero</author> used under the terms of <terms>CC-BY-SA 4.0</terms>.",
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
                                "The <colr>twemoji-colr</colr> font is © <author>Mozilla Foundation</author> " +
                                    "used under the terms of <terms>Apache 2.0</terms>.",
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
                                "The <twemoji>Twemoji</twemoji> emoji art is © " +
                                    "<author>Twitter, Inc and other contributors</author> used under the terms of " +
                                    "<terms>CC-BY 4.0</terms>.",
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

    private onKeyboardShortcutsClicked = (): void => {
        dis.dispatch<OpenToTabPayload>({
            action: Action.ViewUserSettings,
            initialTabId: UserTab.Keyboard,
        });
    };

    public render(): React.ReactNode {
        const brand = SdkConfig.get().brand;

        let faqText = _t(
            "For help with using %(brand)s, click <a>here</a>.",
            {
                brand,
            },
            {
                a: (sub) => <ExternalLink href="https://element.io/help">{sub}</ExternalLink>,
            },
        );
        if (SdkConfig.get("welcome_user_id") && getCurrentLanguage().startsWith("en")) {
            faqText = (
                <div>
                    {_t(
                        "For help with using %(brand)s, click <a>here</a> or start a chat with our " +
                            "bot using the button below.",
                        {
                            brand,
                        },
                        {
                            a: (sub) => (
                                <ExternalLink href="https://element.io/help" rel="noreferrer noopener" target="_blank">
                                    {sub}
                                </ExternalLink>
                            ),
                        },
                    )}
                    <div>
                        <AccessibleButton onClick={this.onStartBotChat} kind="primary">
                            {_t("Chat with %(brand)s Bot", { brand })}
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
                    heading={_t("Bug reporting")}
                    description={
                        <>
                            <SettingsSubsectionText>
                                {_t(
                                    "If you've submitted a bug via GitHub, debug logs can help " +
                                        "us track down the problem. ",
                                )}
                            </SettingsSubsectionText>
                            {_t(
                                "Debug logs contain application " +
                                    "usage data including your username, the IDs or aliases of " +
                                    "the rooms you have visited, which UI elements you " +
                                    "last interacted with, and the usernames of other users. " +
                                    "They do not contain messages.",
                            )}
                        </>
                    }
                >
                    <AccessibleButton onClick={this.onBugReport} kind="primary">
                        {_t("Submit debug logs")}
                    </AccessibleButton>
                    <SettingsSubsectionText>
                        {_t(
                            "To report a Matrix-related security issue, please read the Matrix.org " +
                                "<a>Security Disclosure Policy</a>.",
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
                <SettingsSection heading={_t("Help & About")}>
                    {bugReportingSection}
                    <SettingsSubsection heading={_t("FAQ")} description={faqText}>
                        <AccessibleButton kind="primary" onClick={this.onKeyboardShortcutsClicked}>
                            {_t("Keyboard Shortcuts")}
                        </AccessibleButton>
                    </SettingsSubsection>
                    <SettingsSubsection heading={_t("Versions")}>
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
                    <SettingsSubsection heading={_t("Advanced")}>
                        <SettingsSubsectionText>
                            {_t(
                                "Homeserver is <code>%(homeserverUrl)s</code>",
                                {
                                    homeserverUrl: MatrixClientPeg.get().getHomeserverUrl(),
                                },
                                {
                                    code: (sub) => <code>{sub}</code>,
                                },
                            )}
                        </SettingsSubsectionText>
                        {MatrixClientPeg.get().getIdentityServerUrl() && (
                            <SettingsSubsectionText>
                                {_t(
                                    "Identity server is <code>%(identityServerUrl)s</code>",
                                    {
                                        identityServerUrl: MatrixClientPeg.get().getIdentityServerUrl(),
                                    },
                                    {
                                        code: (sub) => <code>{sub}</code>,
                                    },
                                )}
                            </SettingsSubsectionText>
                        )}
                        <SettingsSubsectionText>
                            <details>
                                <summary>{_t("Access Token")}</summary>
                                <b>
                                    {_t(
                                        "Your access token gives full access to your account." +
                                            " Do not share it with anyone.",
                                    )}
                                </b>
                                <CopyableText getTextToCopy={() => MatrixClientPeg.get().getAccessToken()}>
                                    {MatrixClientPeg.get().getAccessToken()}
                                </CopyableText>
                            </details>
                        </SettingsSubsectionText>
                        <AccessibleButton onClick={this.onClearCacheAndReload} kind="danger">
                            {_t("Clear cache and reload")}
                        </AccessibleButton>
                    </SettingsSubsection>
                </SettingsSection>
            </SettingsTab>
        );
    }
}
