/*
Copyright 2020-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ReactNode } from "react";
import { Text, Heading, Button, Separator } from "@vector-im/compound-web";
import PopOutIcon from "@vector-im/compound-design-tokens/assets/web/icons/pop-out";

import SdkConfig from "../../SdkConfig";
import { Flex } from "../../components/utils/Flex";
import { _t } from "../../languageHandler";
import { Icon as AppleIcon } from "../../../res/themes/element/img/compound/apple.svg";
import { Icon as MicrosoftIcon } from "../../../res/themes/element/img/compound/microsoft.svg";
import { Icon as LinuxIcon } from "../../../res/themes/element/img/compound/linux.svg";

// directly import the style here as this layer does not support rethemedex at this time so no matrix-react-sdk
// PostCSS variables will be accessible.
import "../../../res/css/structures/ErrorView.pcss";

interface IProps {
    // both of these should already be internationalised
    title: string;
    messages?: string[];
    footer?: ReactNode;
    children?: ReactNode;
}

export const ErrorView: React.FC<IProps> = ({ title, messages, footer, children }) => {
    return (
        <div className="mx_ErrorView cpd-theme-light">
            <img
                className="mx_ErrorView_logo"
                height="160"
                src="themes/element/img/logos/element-app-logo.png"
                alt="Element"
            />
            <div className="mx_ErrorView_container">
                <Heading size="md" weight="semibold">
                    {title}
                </Heading>
                {messages?.map((message) => (
                    <Text key={message} size="lg">
                        {message}
                    </Text>
                ))}
                {children}
            </div>
            {footer}
        </div>
    );
};

const MobileAppLinks: React.FC<{
    appleAppStoreUrl?: string;
    googlePlayUrl?: string;
    fdroidUrl?: string;
}> = ({ appleAppStoreUrl, googlePlayUrl, fdroidUrl }) => (
    <Flex gap="var(--cpd-space-6x)">
        {appleAppStoreUrl && (
            <a href={appleAppStoreUrl} target="_blank" rel="noreferrer noopener">
                <img height="64" src="themes/element/img/download/apple.svg" alt="Apple App Store" />
            </a>
        )}
        {googlePlayUrl && (
            <a href={googlePlayUrl} target="_blank" rel="noreferrer noopener" key="android">
                <img height="64" src="themes/element/img/download/google.svg" alt="Google Play Store" />
            </a>
        )}
        {fdroidUrl && (
            <a href={fdroidUrl} target="_blank" rel="noreferrer noopener" key="fdroid">
                <img height="64" src="themes/element/img/download/fdroid.svg" alt="F-Droid" />
            </a>
        )}
    </Flex>
);

const DesktopAppLinks: React.FC<{
    macOsUrl?: string;
    win64Url?: string;
    win64ArmUrl?: string;
    linuxUrl?: string;
}> = ({ macOsUrl, win64Url, win64ArmUrl, linuxUrl }) => {
    return (
        <Flex gap="var(--cpd-space-4x)">
            {macOsUrl && (
                <Button as="a" href={macOsUrl} kind="secondary" Icon={AppleIcon}>
                    {_t("incompatible_browser|macos")}
                </Button>
            )}
            {win64Url && (
                <Button as="a" href={win64Url} kind="secondary" Icon={MicrosoftIcon}>
                    {_t("incompatible_browser|windows_64bit")}
                </Button>
            )}
            {win64ArmUrl && (
                <Button as="a" href={win64ArmUrl} kind="secondary" Icon={MicrosoftIcon}>
                    {_t("incompatible_browser|windows_arm_64bit")}
                </Button>
            )}
            {linuxUrl && (
                <Button as="a" href={linuxUrl} kind="secondary" Icon={LinuxIcon}>
                    {_t("incompatible_browser|linux")}
                </Button>
            )}
        </Flex>
    );
};

const linkFactory =
    (link: string) =>
    (text: string): JSX.Element => (
        <a href={link} target="_blank" rel="noreferrer noopener">
            {text}
        </a>
    );

export const UnsupportedBrowserView: React.FC<{
    onAccept?(): void;
}> = ({ onAccept }) => {
    const config = SdkConfig.get();
    const brand = config.brand ?? "Element";

    const hasDesktopBuilds =
        config.desktop_builds?.available &&
        (config.desktop_builds?.url_macos ||
            config.desktop_builds?.url_win64 ||
            config.desktop_builds?.url_win64arm ||
            config.desktop_builds?.url_linux);
    const hasMobileBuilds = Boolean(
        config.mobile_builds?.ios || config.mobile_builds?.android || config.mobile_builds?.fdroid,
    );

    return (
        <ErrorView
            title={_t("incompatible_browser|title", { brand })}
            messages={[
                _t("incompatible_browser|description", {
                    brand,
                    detail: onAccept
                        ? _t("incompatible_browser|detail_can_continue")
                        : _t("incompatible_browser|detail_no_continue"),
                }),
            ]}
            footer={
                <>
                    {/* We render the apps in the footer as they are wider than the 520px container */}
                    {(hasDesktopBuilds || hasMobileBuilds) && <Separator />}

                    {hasDesktopBuilds && (
                        <>
                            <Heading as="h2" size="sm" weight="semibold">
                                {_t("incompatible_browser|use_desktop_heading", { brand })}
                            </Heading>
                            <DesktopAppLinks
                                macOsUrl={config.desktop_builds?.url_macos}
                                win64Url={config.desktop_builds?.url_win64}
                                win64ArmUrl={config.desktop_builds?.url_win64arm}
                                linuxUrl={config.desktop_builds?.url_linux}
                            />
                        </>
                    )}

                    {hasMobileBuilds && (
                        <>
                            <Heading as="h2" size="sm" weight="semibold">
                                {hasDesktopBuilds
                                    ? _t("incompatible_browser|use_mobile_heading_after_desktop")
                                    : _t("incompatible_browser|use_mobile_heading", { brand })}
                            </Heading>
                            <MobileAppLinks
                                appleAppStoreUrl={config.mobile_builds?.ios ?? undefined}
                                googlePlayUrl={config.mobile_builds?.android ?? undefined}
                                fdroidUrl={config.mobile_builds?.fdroid ?? undefined}
                            />
                        </>
                    )}
                </>
            }
        >
            <Text size="lg">
                {_t(
                    "incompatible_browser|supported_browsers",
                    {},
                    {
                        Chrome: linkFactory("https://google.com/chrome"),
                        Firefox: linkFactory("https://firefox.com"),
                        Edge: linkFactory("https://microsoft.com/edge"),
                        Safari: linkFactory("https://apple.com/safari"),
                    },
                )}
            </Text>

            <Flex gap="var(--cpd-space-4x)" className="mx_ErrorView_buttons">
                <Button Icon={PopOutIcon} kind="secondary" size="sm">
                    {_t("incompatible_browser|learn_more")}
                </Button>
                {onAccept && (
                    <Button kind="primary" size="sm" onClick={onAccept}>
                        {_t("incompatible_browser|continue")}
                    </Button>
                )}
            </Flex>
        </ErrorView>
    );
};
