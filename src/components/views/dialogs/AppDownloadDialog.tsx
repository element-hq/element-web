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

const fallbackAppStore = "https://apps.apple.com/app/vector/id1083446067";
const fallbackGooglePlay = "https://play.google.com/store/apps/details?id=im.vector.app";
const fallbackFDroid = "https://f-droid.org/repository/browse/?fdid=im.vector.app";

interface Props {
    onFinished(): void;
}

export const AppDownloadDialog: FC<Props> = ({ onFinished }) => {
    const brand = SdkConfig.get("brand");
    const desktopBuilds = SdkConfig.getObject("desktop_builds");
    const mobileBuilds = SdkConfig.getObject("mobile_builds");

    const urlAppStore = mobileBuilds?.get("ios") ?? fallbackAppStore;

    const urlAndroid = mobileBuilds?.get("android") ?? mobileBuilds?.get("fdroid") ?? fallbackGooglePlay;
    const urlGooglePlay = mobileBuilds?.get("android") ?? fallbackGooglePlay;
    const urlFDroid = mobileBuilds?.get("fdroid") ?? fallbackFDroid;

    return (
        <BaseDialog
            title={_t("Download %(brand)s", { brand })}
            className="mx_AppDownloadDialog"
            fixedWidth
            onFinished={onFinished}
        >
            {desktopBuilds?.get("available") && (
                <div className="mx_AppDownloadDialog_desktop">
                    <Heading size="h3">{_t("Download %(brand)s Desktop", { brand })}</Heading>
                    <AccessibleButton
                        kind="primary"
                        element="a"
                        href={desktopBuilds?.get("url")}
                        target="_blank"
                        onClick={() => {}}
                    >
                        {_t("Download %(brand)s Desktop", { brand })}
                    </AccessibleButton>
                </div>
            )}
            <div className="mx_AppDownloadDialog_mobile">
                <div className="mx_AppDownloadDialog_app">
                    <Heading size="h3">{_t("iOS")}</Heading>
                    <QRCode data={urlAppStore} margin={0} width={172} />
                    <div className="mx_AppDownloadDialog_info">
                        {_t("%(qrCode)s or %(appLinks)s", {
                            appLinks: "",
                            qrCode: "",
                        })}
                    </div>
                    <div className="mx_AppDownloadDialog_links">
                        <AccessibleButton
                            element="a"
                            href={urlAppStore}
                            target="_blank"
                            aria-label={_t("Download on the App Store")}
                            onClick={() => {}}
                        >
                            <IOSBadge />
                        </AccessibleButton>
                    </div>
                </div>
                <div className="mx_AppDownloadDialog_app">
                    <Heading size="h3">{_t("Android")}</Heading>
                    <QRCode data={urlAndroid} margin={0} width={172} />
                    <div className="mx_AppDownloadDialog_info">
                        {_t("%(qrCode)s or %(appLinks)s", {
                            appLinks: "",
                            qrCode: "",
                        })}
                    </div>
                    <div className="mx_AppDownloadDialog_links">
                        <AccessibleButton
                            element="a"
                            href={urlGooglePlay}
                            target="_blank"
                            aria-label={_t("Get it on Google Play")}
                            onClick={() => {}}
                        >
                            <GooglePlayBadge />
                        </AccessibleButton>
                        <AccessibleButton
                            element="a"
                            href={urlFDroid}
                            target="_blank"
                            aria-label={_t("Get it on F-Droid")}
                            onClick={() => {}}
                        >
                            <FDroidBadge />
                        </AccessibleButton>
                    </div>
                </div>
            </div>
            <div className="mx_AppDownloadDialog_legal">
                <p>{_t("App Store® and the Apple logo® are trademarks of Apple Inc.")}</p>
                <p>{_t("Google Play and the Google Play logo are trademarks of Google LLC.")}</p>
            </div>
        </BaseDialog>
    );
};
