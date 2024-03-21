/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import React, { FC } from "react";

import { Icon as FDroidBadge } from "../../../../res/img/badges/f-droid.svg";
import { Icon as GooglePlayBadge } from "../../../../res/img/badges/google-play.svg";
import { Icon as IOSBadge } from "../../../../res/img/badges/ios.svg";
import { _t } from "../../../languageHandler";
import SdkConfig from "../../../SdkConfig";
import AccessibleButton from "../elements/AccessibleButton";
import QRCode from "../elements/QRCode";
import Heading from "../typography/Heading";
import BaseDialog from "./BaseDialog";

interface Props {
    onFinished(): void;
}

export const showAppDownloadDialogPrompt = (): boolean => {
    const desktopBuilds = SdkConfig.getObject("desktop_builds");
    const mobileBuilds = SdkConfig.getObject("mobile_builds");

    return (
        !!desktopBuilds?.get("available") ||
        !!mobileBuilds?.get("ios") ||
        !!mobileBuilds?.get("android") ||
        !!mobileBuilds?.get("fdroid")
    );
};

export const AppDownloadDialog: FC<Props> = ({ onFinished }) => {
    const brand = SdkConfig.get("brand");
    const desktopBuilds = SdkConfig.getObject("desktop_builds");
    const mobileBuilds = SdkConfig.getObject("mobile_builds");

    const urlAppStore = mobileBuilds?.get("ios");

    const urlGooglePlay = mobileBuilds?.get("android");
    const urlFDroid = mobileBuilds?.get("fdroid");
    const urlAndroid = urlGooglePlay ?? urlFDroid;

    return (
        <BaseDialog
            title={_t("onboarding|download_brand", { brand })}
            className="mx_AppDownloadDialog"
            fixedWidth
            onFinished={onFinished}
        >
            {desktopBuilds?.get("available") && (
                <div className="mx_AppDownloadDialog_desktop">
                    <Heading size="3">{_t("onboarding|download_brand_desktop", { brand })}</Heading>
                    <AccessibleButton
                        kind="primary"
                        element="a"
                        href={desktopBuilds?.get("url")}
                        target="_blank"
                        onClick={() => {}}
                    >
                        {_t("onboarding|download_brand_desktop", { brand })}
                    </AccessibleButton>
                </div>
            )}
            <div className="mx_AppDownloadDialog_mobile">
                {urlAppStore && (
                    <div className="mx_AppDownloadDialog_app">
                        <Heading size="3">{_t("common|ios")}</Heading>
                        <QRCode data={urlAppStore} margin={0} width={172} />
                        <div className="mx_AppDownloadDialog_info">
                            {_t("onboarding|qr_or_app_links", {
                                appLinks: "",
                                qrCode: "",
                            })}
                        </div>
                        <div className="mx_AppDownloadDialog_links">
                            <AccessibleButton
                                element="a"
                                href={urlAppStore}
                                target="_blank"
                                aria-label={_t("onboarding|download_app_store")}
                                onClick={() => {}}
                            >
                                <IOSBadge />
                            </AccessibleButton>
                        </div>
                    </div>
                )}
                {urlAndroid && (
                    <div className="mx_AppDownloadDialog_app">
                        <Heading size="3">{_t("common|android")}</Heading>
                        <QRCode data={urlAndroid} margin={0} width={172} />
                        <div className="mx_AppDownloadDialog_info">
                            {_t("onboarding|qr_or_app_links", {
                                appLinks: "",
                                qrCode: "",
                            })}
                        </div>
                        <div className="mx_AppDownloadDialog_links">
                            {urlGooglePlay && (
                                <AccessibleButton
                                    element="a"
                                    href={urlGooglePlay}
                                    target="_blank"
                                    aria-label={_t("onboarding|download_google_play")}
                                    onClick={() => {}}
                                >
                                    <GooglePlayBadge />
                                </AccessibleButton>
                            )}
                            {urlFDroid && (
                                <AccessibleButton
                                    element="a"
                                    href={urlFDroid}
                                    target="_blank"
                                    aria-label={_t("onboarding|download_f_droid")}
                                    onClick={() => {}}
                                >
                                    <FDroidBadge />
                                </AccessibleButton>
                            )}
                        </div>
                    </div>
                )}
            </div>
            <div className="mx_AppDownloadDialog_legal">
                <p>{_t("onboarding|apple_trademarks")}</p>
                <p>{_t("onboarding|google_trademarks")}</p>
            </div>
        </BaseDialog>
    );
};
