/*
Copyright 2024 The Matrix.org Foundation C.I.C.

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

import React, { useCallback, useEffect, useState } from "react";
import { ThreepidMedium } from "matrix-js-sdk/src/matrix";
import { Alert } from "@vector-im/compound-web";

import { _t } from "../../../languageHandler";
import InlineSpinner from "../elements/InlineSpinner";
import SettingsSubsection from "./shared/SettingsSubsection";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import { ThirdPartyIdentifier } from "../../../AddThreepid";
import SettingsStore from "../../../settings/SettingsStore";
import { UIFeature } from "../../../settings/UIFeature";
import { AddRemoveThreepids } from "./AddRemoveThreepids";

type LoadingState = "loading" | "loaded" | "error";

interface ThreepidSectionWrapperProps {
    error: string;
    loadingState: LoadingState;
    children: React.ReactNode;
}

const ThreepidSectionWrapper: React.FC<ThreepidSectionWrapperProps> = ({ error, loadingState, children }) => {
    if (loadingState === "loading") {
        return <InlineSpinner />;
    } else if (loadingState === "error") {
        return (
            <Alert type="critical" title={_t("common|error")}>
                {error}
            </Alert>
        );
    } else {
        return <>{children}</>;
    }
};

interface UserPersonalInfoSettingsProps {
    canMake3pidChanges: boolean;
}

/**
 * Settings controls allowing the user to set personal information like email addresses.
 */
export const UserPersonalInfoSettings: React.FC<UserPersonalInfoSettingsProps> = ({ canMake3pidChanges }) => {
    const [emails, setEmails] = useState<ThirdPartyIdentifier[] | undefined>();
    const [phoneNumbers, setPhoneNumbers] = useState<ThirdPartyIdentifier[] | undefined>();
    const [loadingState, setLoadingState] = useState<"loading" | "loaded" | "error">("loading");

    const client = useMatrixClientContext();

    const updateThreepids = useCallback(async () => {
        try {
            const threepids = await client.getThreePids();
            setEmails(threepids.threepids.filter((a) => a.medium === ThreepidMedium.Email));
            setPhoneNumbers(threepids.threepids.filter((a) => a.medium === ThreepidMedium.Phone));
            setLoadingState("loaded");
        } catch (e) {
            setLoadingState("error");
        }
    }, [client]);

    useEffect(() => {
        updateThreepids().then();
    }, [updateThreepids]);

    const onEmailsChange = useCallback(() => {
        updateThreepids().then();
    }, [updateThreepids]);

    const onMsisdnsChange = useCallback(() => {
        updateThreepids().then();
    }, [updateThreepids]);

    if (!SettingsStore.getValue(UIFeature.ThirdPartyID)) return null;

    return (
        <div>
            <h2>{_t("settings|general|personal_info")}</h2>
            <SettingsSubsection
                heading={_t("settings|general|emails_heading")}
                stretchContent
                data-testid="mx_AccountEmailAddresses"
            >
                <ThreepidSectionWrapper
                    error={_t("settings|general|unable_to_load_emails")}
                    loadingState={loadingState}
                >
                    <AddRemoveThreepids
                        mode="hs"
                        medium={ThreepidMedium.Email}
                        threepids={emails!}
                        onChange={onEmailsChange}
                        disabled={!canMake3pidChanges}
                        isLoading={loadingState === "loading"}
                    />
                </ThreepidSectionWrapper>
            </SettingsSubsection>

            <SettingsSubsection
                heading={_t("settings|general|msisdns_heading")}
                stretchContent
                data-testid="mx_AccountPhoneNumbers"
            >
                <ThreepidSectionWrapper
                    error={_t("settings|general|unable_to_load_msisdns")}
                    loadingState={loadingState}
                >
                    <AddRemoveThreepids
                        mode="hs"
                        medium={ThreepidMedium.Phone}
                        threepids={phoneNumbers!}
                        onChange={onMsisdnsChange}
                        disabled={!canMake3pidChanges}
                        isLoading={loadingState === "loading"}
                    />
                </ThreepidSectionWrapper>
            </SettingsSubsection>
        </div>
    );
};

export default UserPersonalInfoSettings;
