/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ReactNode } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { type EmptyObject } from "matrix-js-sdk/src/matrix";

import AccessibleButton from "../../../elements/AccessibleButton";
import { _t } from "../../../../../languageHandler";
import SdkConfig from "../../../../../SdkConfig";
import Modal from "../../../../../Modal";
import PlatformPeg from "../../../../../PlatformPeg";
import UpdateCheckButton from "../../UpdateCheckButton";
import BugReportDialog from "../../../dialogs/BugReportDialog";
import CopyableText from "../../../elements/CopyableText";
import SettingsTab from "../SettingsTab";
import { SettingsSection } from "../../shared/SettingsSection";
import { SettingsSubsection, SettingsSubsectionText } from "../../shared/SettingsSubsection";
import ExternalLink from "../../../elements/ExternalLink";
import MatrixClientContext from "../../../../../contexts/MatrixClientContext";

interface IState {
    appVersion: string | null;
    canUpdate: boolean;
}

export default class HelpUserSettingsTab extends React.Component<EmptyObject, IState> {
    public static contextType = MatrixClientContext;
    declare public context: React.ContextType<typeof MatrixClientContext>;

    public constructor(props: EmptyObject) {
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

    private getVersionInfo(): { appVersion: string; cryptoVersion: string } {
        const brand = SdkConfig.get().brand;
        const appVersion = this.state.appVersion || "unknown";
        const cryptoVersion = this.context.getCrypto()?.getVersion() ?? "<not-enabled>";

        return {
            appVersion: `${_t("setting|help_about|brand_version", { brand })} ${appVersion}`,
            cryptoVersion: `${_t("setting|help_about|crypto_version")} ${cryptoVersion}`,
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
        const { appVersion, cryptoVersion } = this.getVersionInfo();
        return `${appVersion}\n${cryptoVersion}`;
    };

    public render(): React.ReactNode {
        const brand = SdkConfig.get().brand;

        const faqText = _t(
            "setting|help_about|help_link",
            {
                brand,
            },
            {
                a: (sub) => <ExternalLink href={SdkConfig.get("help_url")}>{sub}</ExternalLink>,
            },
        );

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
                    <AccessibleButton onClick={this.onBugReport} kind="primary_outline">
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

        const { appVersion, cryptoVersion } = this.getVersionInfo();

        return (
            <SettingsTab>
                <SettingsSection>
                    {bugReportingSection}
                    <SettingsSubsection heading={_t("common|faq")} description={faqText} />
                    <SettingsSubsection heading={_t("setting|help_about|versions")}>
                        <SettingsSubsectionText>
                            <CopyableText getTextToCopy={this.getVersionTextToCopy}>
                                {appVersion}
                                <br />
                                {cryptoVersion}
                                <br />
                            </CopyableText>
                            {updateButton}
                        </SettingsSubsectionText>
                    </SettingsSubsection>
                    {this.renderLegal()}
                    {this.renderCredits()}
                    <SettingsSubsection heading={_t("common|advanced")}>
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
                                <summary className="mx_HelpUserSettingsTab_accessTokenDetails">
                                    {_t("common|access_token")}
                                </summary>
                                <strong>{_t("setting|help_about|access_token_detail")}</strong>
                                <CopyableText getTextToCopy={() => this.context.getAccessToken()}>
                                    {this.context.getAccessToken()}
                                </CopyableText>
                            </details>
                        </SettingsSubsectionText>
                        <AccessibleButton onClick={this.onClearCacheAndReload} kind="danger_outline">
                            {_t("setting|help_about|clear_cache_reload")}
                        </AccessibleButton>
                    </SettingsSubsection>
                </SettingsSection>
            </SettingsTab>
        );
    }
}
