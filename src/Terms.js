/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import classNames from 'classnames';

import {MatrixClientPeg} from './MatrixClientPeg';
import * as sdk from './';
import Modal from './Modal';

export class TermsNotSignedError extends Error {}

/**
 * Class representing a service that may have terms & conditions that
 * require agreement from the user before the user can use that service.
 */
export class Service {
    /**
     * @param {MatrixClient.SERVICE_TYPES} serviceType The type of service
     * @param {string} baseUrl The Base URL of the service (ie. before '/_matrix')
     * @param {string} accessToken The user's access token for the service
     */
    constructor(serviceType, baseUrl, accessToken) {
        this.serviceType = serviceType;
        this.baseUrl = baseUrl;
        this.accessToken = accessToken;
    }
}

/**
 * Start a flow where the user is presented with terms & conditions for some services
 *
 * @param {Service[]} services Object with keys 'serviceType', 'baseUrl', 'accessToken'
 * @param {function} interactionCallback Function called with:
 *      * an array of { service: {Service}, policies: {terms response from API} }
 *      * an array of URLs the user has already agreed to
 *     Must return a Promise which resolves with a list of URLs of documents agreed to
 * @returns {Promise} resolves when the user agreed to all necessary terms or rejects
 *     if they cancel.
 */
export async function startTermsFlow(
    services,
    interactionCallback = dialogTermsInteractionCallback,
) {
    const termsPromises = services.map(
        (s) => MatrixClientPeg.get().getTerms(s.serviceType, s.baseUrl),
    );

    /*
     * a /terms response looks like:
     * {
     *     "policies": {
     *         "terms_of_service": {
     *             "version": "2.0",
     *              "en": {
     *                 "name": "Terms of Service",
     *                 "url": "https://example.org/somewhere/terms-2.0-en.html"
     *             },
     *             "fr": {
     *                 "name": "Conditions d'utilisation",
     *                 "url": "https://example.org/somewhere/terms-2.0-fr.html"
     *             }
     *         }
     *     }
     * }
     */

    const terms = await Promise.all(termsPromises);
    const policiesAndServicePairs = terms.map((t, i) => { return { 'service': services[i], 'policies': t.policies }; });

    // fetch the set of agreed policy URLs from account data
    const currentAcceptedTerms = await MatrixClientPeg.get().getAccountData('m.accepted_terms');
    let agreedUrlSet;
    if (!currentAcceptedTerms || !currentAcceptedTerms.getContent() || !currentAcceptedTerms.getContent().accepted) {
        agreedUrlSet = new Set();
    } else {
        agreedUrlSet = new Set(currentAcceptedTerms.getContent().accepted);
    }

    // remove any policies the user has already agreed to and any services where
    // they've already agreed to all the policies
    // NB. it could be nicer to show the user stuff they've already agreed to,
    // but then they'd assume they can un-check the boxes to un-agree to a policy,
    // but that is not a thing the API supports, so probably best to just show
    // things they've not agreed to yet.
    const unagreedPoliciesAndServicePairs = [];
    for (const {service, policies} of policiesAndServicePairs) {
        const unagreedPolicies = {};
        for (const [policyName, policy] of Object.entries(policies)) {
            let policyAgreed = false;
            for (const lang of Object.keys(policy)) {
                if (lang === 'version') continue;
                if (agreedUrlSet.has(policy[lang].url)) {
                    policyAgreed = true;
                    break;
                }
            }
            if (!policyAgreed) unagreedPolicies[policyName] = policy;
        }
        if (Object.keys(unagreedPolicies).length > 0) {
            unagreedPoliciesAndServicePairs.push({service, policies: unagreedPolicies});
        }
    }

    // if there's anything left to agree to, prompt the user
    const numAcceptedBeforeAgreement = agreedUrlSet.size;
    if (unagreedPoliciesAndServicePairs.length > 0) {
        const newlyAgreedUrls = await interactionCallback(unagreedPoliciesAndServicePairs, [...agreedUrlSet]);
        console.log("User has agreed to URLs", newlyAgreedUrls);
        // Merge with previously agreed URLs
        newlyAgreedUrls.forEach(url => agreedUrlSet.add(url));
    } else {
        console.log("User has already agreed to all required policies");
    }

    // We only ever add to the set of URLs, so if anything has changed then we'd see a different length
    if (agreedUrlSet.size !== numAcceptedBeforeAgreement) {
        const newAcceptedTerms = {accepted: Array.from(agreedUrlSet)};
        await MatrixClientPeg.get().setAccountData('m.accepted_terms', newAcceptedTerms);
    }

    const agreePromises = policiesAndServicePairs.map((policiesAndService) => {
        // filter the agreed URL list for ones that are actually for this service
        // (one URL may be used for multiple services)
        // Not a particularly efficient loop but probably fine given the numbers involved
        const urlsForService = Array.from(agreedUrlSet).filter((url) => {
            for (const policy of Object.values(policiesAndService.policies)) {
                for (const lang of Object.keys(policy)) {
                    if (lang === 'version') continue;
                    if (policy[lang].url === url) return true;
                }
            }
            return false;
        });

        if (urlsForService.length === 0) return Promise.resolve();

        return MatrixClientPeg.get().agreeToTerms(
            policiesAndService.service.serviceType,
            policiesAndService.service.baseUrl,
            policiesAndService.service.accessToken,
            urlsForService,
        );
    });
    return Promise.all(agreePromises);
}

export function dialogTermsInteractionCallback(
    policiesAndServicePairs,
    agreedUrls,
    extraClassNames,
) {
    return new Promise((resolve, reject) => {
        console.log("Terms that need agreement", policiesAndServicePairs);
        const TermsDialog = sdk.getComponent("views.dialogs.TermsDialog");

        Modal.createTrackedDialog('Terms of Service', '', TermsDialog, {
            policiesAndServicePairs,
            agreedUrls,
            onFinished: (done, agreedUrls) => {
                if (!done) {
                    reject(new TermsNotSignedError());
                    return;
                }
                resolve(agreedUrls);
            },
        }, classNames("mx_TermsDialog", extraClassNames));
    });
}
