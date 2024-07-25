/*
Copyright 2020 New Vector Ltd

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
import { Text, Heading, Button, Separator } from "@vector-im/compound-web";
import SdkConfig from "matrix-react-sdk/src/SdkConfig";
import { Flex } from "matrix-react-sdk/src/components/utils/Flex";
import PopOutIcon from "@vector-im/compound-design-tokens/assets/web/icons/pop-out";

import { _t } from "../../languageHandler";

// directly import the style here as this layer does not support rethemedex at this time so no matrix-react-sdk
// PostCSS variables will be accessible.
import "../../../res/css/structures/ErrorView.pcss";

interface IProps {
    // both of these should already be internationalised
    title: string;
    messages?: string[];
    footer?: ReactNode;
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

const MobileApps: React.FC<{
    appleAppStoreUrl?: string;
    googlePlayUrl?: string;
    fdroidUrl?: string;
}> = ({ appleAppStoreUrl, googlePlayUrl, fdroidUrl }) => {
    let appleAppStoreButton: JSX.Element | undefined;
    if (appleAppStoreUrl) {
        appleAppStoreButton = (
            <a href={appleAppStoreUrl} target="_blank" rel="noreferrer noopener">
                <img height="64" src="themes/element/img/download/apple.svg" alt="Apple App Store" />
            </a>
        );
    }

    let googlePlayButton: JSX.Element | undefined;
    if (googlePlayUrl) {
        googlePlayButton = (
            <a href={googlePlayUrl} target="_blank" rel="noreferrer noopener" key="android">
                <img height="64" src="themes/element/img/download/google.svg" alt="Google Play Store" />
            </a>
        );
    }

    let fdroidButton: JSX.Element | undefined;
    if (fdroidUrl) {
        fdroidButton = (
            <a href={fdroidUrl} target="_blank" rel="noreferrer noopener" key="fdroid">
                <img height="64" src="themes/element/img/download/fdroid.svg" alt="F-Droid" />
            </a>
        );
    }

    return (
        <Flex gap="var(--cpd-space-6x)">
            {appleAppStoreButton}
            {googlePlayButton}
            {fdroidButton}
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
                    <MobileApps
                        appleAppStoreUrl={config.mobile_builds?.ios ?? undefined}
                        googlePlayUrl={config.mobile_builds?.android ?? undefined}
                        fdroidUrl={config.mobile_builds?.fdroid ?? undefined}
                    />
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

            {(config.mobile_builds?.ios || config.mobile_builds?.android || config.mobile_builds?.fdroid) && (
                <>
                    <Separator />

                    <Heading as="h2" size="sm" weight="semibold">
                        {_t("incompatible_browser|use_mobile_heading", { brand })}
                    </Heading>
                </>
            )}
        </ErrorView>
    );
};
