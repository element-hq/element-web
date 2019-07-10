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

import Promise from 'bluebird';

import MatrixClientPeg from './MatrixClientPeg';
import sdk from './';
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
 * Present a popup to the user prompting them to agree to terms and conditions
 *
 * @param {Service[]} services Object with keys 'servicetype', 'baseurl', '
 * @param {function} dialogTermsInteractionCallback Function called with an array of:
 *     { service: {Service}, terms: {terms response from API} }
 *     Must return a Promise which resolves with a list of URLs of documents agreed to
 * @returns {Promise} resolves when the user agreed to all necessary terms or rejects
 *     if they cancel.
 */
export function presentTermsForServices(services) {
    return startTermsFlow(services, dialogTermsInteractionCallback);
}

export async function startTermsFlow(services, interactionCallback) {
    const termsPromises = services.map(
        (s) => MatrixClientPeg.get().getTerms(s.serviceType, s.baseUrl, s.accessToken),
    );

    const terms = await Promise.all(termsPromises);
    const termsAndServices = terms.map((t, i) => { return { 'service': services[i], 'terms': t.policies }; });

    const agreedUrls = await interactionCallback(termsAndServices);
    console.log("User has agreed to URLs", agreedUrls);

    const agreePromises = termsAndServices.map((termsAndService) => {
        // filter the agreed URL list for ones that are actually for this service
        // (one URL may be used for multiple services)
        // Not a particularly efficient loop but probably fine given the numbers involved
        const urlsForService = agreedUrls.filter((url) => {
            for (const terms of Object.values(termsAndService.terms)) {
                for (const lang of Object.keys(terms)) {
                    if (lang === 'version') continue;
                    if (terms[lang].url === url) return true;
                }
            }
            return false;
        });

        if (urlsForService.length === 0) return Promise.resolve();

        return MatrixClientPeg.get().agreeToTerms(
            termsAndService.service.serviceType,
            termsAndService.service.baseUrl,
            termsAndService.service.accessToken,
            urlsForService,
        );
    });
    return Promise.all(agreePromises);
}

function dialogTermsInteractionCallback(termsWithServices) {
    return new Promise((resolve, reject) => {
        console.log("Terms that need agreement", termsWithServices);
        const TermsDialog = sdk.getComponent("views.dialogs.TermsDialog");

        Modal.createTrackedDialog('Terms of Service', '', TermsDialog, {
            termsWithServices: termsWithServices,
            onFinished: (done, agreedUrls) => {
                if (!done) {
                    reject(new TermsNotSignedError());
                    return;
                }
                resolve(agreedUrls);
            },
        });
    });
}
