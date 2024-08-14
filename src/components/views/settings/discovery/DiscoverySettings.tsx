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
import { SERVICE_TYPES, ThreepidMedium } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { Alert } from "@vector-im/compound-web";

import { getThreepidsWithBindStatus } from "../../../../boundThreepids";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import { ThirdPartyIdentifier } from "../../../../AddThreepid";
import SettingsStore from "../../../../settings/SettingsStore";
import { UIFeature } from "../../../../settings/UIFeature";
import { _t } from "../../../../languageHandler";
import SetIdServer from "../SetIdServer";
import SettingsSubsection from "../shared/SettingsSubsection";
import InlineTermsAgreement from "../../terms/InlineTermsAgreement";
import { Service, ServicePolicyPair, startTermsFlow } from "../../../../Terms";
import IdentityAuthClient from "../../../../IdentityAuthClient";
import { abbreviateUrl } from "../../../../utils/UrlUtils";
import { useDispatcher } from "../../../../hooks/useDispatcher";
import defaultDispatcher from "../../../../dispatcher/dispatcher";
import { ActionPayload } from "../../../../dispatcher/payloads";
import { AddRemoveThreepids } from "../AddRemoveThreepids";

type RequiredPolicyInfo =
    | {
          // This object is passed along to a component for handling
          policiesAndServices: null; // From the startTermsFlow callback
          agreedUrls: null; // From the startTermsFlow callback
          resolve: null; // Promise resolve function for startTermsFlow callback
      }
    | {
          policiesAndServices: ServicePolicyPair[];
          agreedUrls: string[];
          resolve: (values: string[]) => void;
      };

/**
 * Settings controlling how a user's email addreses and phone numbers can be used to discover them
 */
export const DiscoverySettings: React.FC = () => {
    const client = useMatrixClientContext();

    const [isLoadingThreepids, setIsLoadingThreepids] = useState<boolean>(true);
    const [emails, setEmails] = useState<ThirdPartyIdentifier[]>([]);
    const [phoneNumbers, setPhoneNumbers] = useState<ThirdPartyIdentifier[]>([]);
    const [idServerName, setIdServerName] = useState<string | undefined>(abbreviateUrl(client.getIdentityServerUrl()));
    const [canMake3pidChanges, setCanMake3pidChanges] = useState<boolean>(false);

    const [requiredPolicyInfo, setRequiredPolicyInfo] = useState<RequiredPolicyInfo>({
        // This object is passed along to a component for handling
        policiesAndServices: null, // From the startTermsFlow callback
        agreedUrls: null, // From the startTermsFlow callback
        resolve: null, // Promise resolve function for startTermsFlow callback
    });
    const [hasTerms, setHasTerms] = useState<boolean>(false);

    const getThreepidState = useCallback(async () => {
        setIsLoadingThreepids(true);
        const threepids = await getThreepidsWithBindStatus(client);
        setEmails(threepids.filter((a) => a.medium === ThreepidMedium.Email));
        setPhoneNumbers(threepids.filter((a) => a.medium === ThreepidMedium.Phone));
        setIsLoadingThreepids(false);
    }, [client]);

    useDispatcher(
        defaultDispatcher,
        useCallback(
            (payload: ActionPayload) => {
                if (payload.action === "id_server_changed") {
                    setIdServerName(abbreviateUrl(client.getIdentityServerUrl()));

                    getThreepidState().then();
                }
            },
            [client, getThreepidState],
        ),
    );

    useEffect(() => {
        (async () => {
            try {
                await getThreepidState();

                const capabilities = await client.getCapabilities();
                setCanMake3pidChanges(
                    !capabilities["m.3pid_changes"] || capabilities["m.3pid_changes"].enabled === true,
                );

                // By starting the terms flow we get the logic for checking which terms the user has signed
                // for free. So we might as well use that for our own purposes.
                const idServerUrl = client.getIdentityServerUrl();
                if (!idServerUrl) {
                    return;
                }

                const authClient = new IdentityAuthClient();
                try {
                    const idAccessToken = await authClient.getAccessToken({ check: false });
                    await startTermsFlow(
                        client,
                        [new Service(SERVICE_TYPES.IS, idServerUrl, idAccessToken!)],
                        (policiesAndServices, agreedUrls, extraClassNames) => {
                            return new Promise((resolve) => {
                                setIdServerName(abbreviateUrl(idServerUrl));
                                setHasTerms(true);
                                setRequiredPolicyInfo({
                                    policiesAndServices,
                                    agreedUrls,
                                    resolve,
                                });
                            });
                        },
                    );
                    // User accepted all terms
                    setHasTerms(false);
                } catch (e) {
                    logger.warn(
                        `Unable to reach identity server at ${idServerUrl} to check ` + `for terms in Settings`,
                    );
                    logger.warn(e);
                }
            } catch (e) {}
        })();
    }, [client, getThreepidState]);

    if (!SettingsStore.getValue(UIFeature.ThirdPartyID)) return null;

    if (hasTerms && requiredPolicyInfo.policiesAndServices) {
        const intro = (
            <Alert type="info" title={_t("settings|general|discovery_needs_terms_title")}>
                {_t("settings|general|discovery_needs_terms", { serverName: idServerName })}
            </Alert>
        );
        return (
            <>
                <InlineTermsAgreement
                    policiesAndServicePairs={requiredPolicyInfo.policiesAndServices}
                    agreedUrls={requiredPolicyInfo.agreedUrls}
                    onFinished={requiredPolicyInfo.resolve}
                    introElement={intro}
                />
                {/* has its own heading as it includes the current identity server */}
                <SetIdServer missingTerms={true} />
            </>
        );
    }

    let threepidSection;
    if (idServerName) {
        threepidSection = (
            <>
                <SettingsSubsection
                    heading={_t("settings|general|emails_heading")}
                    description={emails.length === 0 ? _t("settings|general|discovery_email_empty") : undefined}
                    stretchContent
                >
                    <AddRemoveThreepids
                        mode="is"
                        medium={ThreepidMedium.Email}
                        threepids={emails}
                        onChange={getThreepidState}
                        disabled={!canMake3pidChanges}
                        isLoading={isLoadingThreepids}
                    />
                </SettingsSubsection>
                <SettingsSubsection
                    heading={_t("settings|general|msisdns_heading")}
                    description={phoneNumbers.length === 0 ? _t("settings|general|discovery_msisdn_empty") : undefined}
                    stretchContent
                >
                    <AddRemoveThreepids
                        mode="is"
                        medium={ThreepidMedium.Phone}
                        threepids={phoneNumbers}
                        onChange={getThreepidState}
                        disabled={!canMake3pidChanges}
                        isLoading={isLoadingThreepids}
                    />
                </SettingsSubsection>
            </>
        );
    }

    return (
        <SettingsSubsection heading={_t("settings|discovery|title")} data-testid="discoverySection" stretchContent>
            {threepidSection}
            {/* has its own heading as it includes the current identity server */}
            <SetIdServer missingTerms={false} />
        </SettingsSubsection>
    );
};

export default DiscoverySettings;
