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

import url from 'url';
import React from 'react';
import PropTypes from 'prop-types';
import * as sdk from '../../../index';
import { _t, pickBestLanguage } from '../../../languageHandler';

import Matrix from 'matrix-js-sdk';

class TermsCheckbox extends React.PureComponent {
    static propTypes = {
        onChange: PropTypes.func.isRequired,
        url: PropTypes.string.isRequired,
        checked: PropTypes.bool.isRequired,
    }

    onChange = (ev) => {
        this.props.onChange(this.props.url, ev.target.checked);
    }

    render() {
        return <input type="checkbox"
            onChange={this.onChange}
            checked={this.props.checked}
        />;
    }
}

export default class TermsDialog extends React.PureComponent {
    static propTypes = {
        /**
         * Array of [Service, policies] pairs, where policies is the response from the
         * /terms endpoint for that service
         */
        policiesAndServicePairs: PropTypes.array.isRequired,

        /**
         * urls that the user has already agreed to
         */
        agreedUrls: PropTypes.arrayOf(PropTypes.string),

        /**
         * Called with:
         *     * success {bool} True if the user accepted any douments, false if cancelled
         *     * agreedUrls {string[]} List of agreed URLs
         */
        onFinished: PropTypes.func.isRequired,
    }

    constructor(props) {
        super();
        this.state = {
            // url -> boolean
            agreedUrls: {},
        };
        for (const url of props.agreedUrls) {
            this.state.agreedUrls[url] = true;
        }
    }

    _onCancelClick = () => {
        this.props.onFinished(false);
    }

    _onNextClick = () => {
        this.props.onFinished(true, Object.keys(this.state.agreedUrls).filter((url) => this.state.agreedUrls[url]));
    }

    _nameForServiceType(serviceType, host) {
        switch (serviceType) {
            case Matrix.SERVICE_TYPES.IS:
                return <div>{_t("Identity Server")}<br />({host})</div>;
            case Matrix.SERVICE_TYPES.IM:
                return <div>{_t("Integration Manager")}<br />({host})</div>;
        }
    }

    _summaryForServiceType(serviceType) {
        switch (serviceType) {
            case Matrix.SERVICE_TYPES.IS:
                return <div>
                    {_t("Find others by phone or email")}
                    <br />
                    {_t("Be found by phone or email")}
                </div>;
            case Matrix.SERVICE_TYPES.IM:
                return <div>
                    {_t("Use bots, bridges, widgets and sticker packs")}
                </div>;
        }
    }

    _onTermsCheckboxChange = (url, checked) => {
        this.setState({
            agreedUrls: Object.assign({}, this.state.agreedUrls, { [url]: checked }),
        });
    }

    render() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');

        const rows = [];
        for (const policiesAndService of this.props.policiesAndServicePairs) {
            const parsedBaseUrl = url.parse(policiesAndService.service.baseUrl);

            const policyValues = Object.values(policiesAndService.policies);
            for (let i = 0; i < policyValues.length; ++i) {
                const termDoc = policyValues[i];
                const termsLang = pickBestLanguage(Object.keys(termDoc).filter((k) => k !== 'version'));
                let serviceName;
                let summary;
                if (i === 0) {
                    serviceName = this._nameForServiceType(policiesAndService.service.serviceType, parsedBaseUrl.host);
                    summary = this._summaryForServiceType(
                        policiesAndService.service.serviceType,
                    );
                }

                rows.push(<tr key={termDoc[termsLang].url}>
                    <td className="mx_TermsDialog_service">{serviceName}</td>
                    <td className="mx_TermsDialog_summary">{summary}</td>
                    <td>{termDoc[termsLang].name} <a rel="noreferrer noopener" target="_blank" href={termDoc[termsLang].url}>
                        <span className="mx_TermsDialog_link" />
                    </a></td>
                    <td><TermsCheckbox
                        url={termDoc[termsLang].url}
                        onChange={this._onTermsCheckboxChange}
                        checked={Boolean(this.state.agreedUrls[termDoc[termsLang].url])}
                    /></td>
                </tr>);
            }
        }

        // if all the documents for at least one service have been checked, we can enable
        // the submit button
        let enableSubmit = false;
        for (const policiesAndService of this.props.policiesAndServicePairs) {
            let docsAgreedForService = 0;
            for (const terms of Object.values(policiesAndService.policies)) {
                let docAgreed = false;
                for (const lang of Object.keys(terms)) {
                    if (lang === 'version') continue;
                    if (this.state.agreedUrls[terms[lang].url]) {
                        docAgreed = true;
                        break;
                    }
                }
                if (docAgreed) {
                    ++docsAgreedForService;
                }
            }
            if (docsAgreedForService === Object.keys(policiesAndService.policies).length) {
                enableSubmit = true;
                break;
            }
        }

        return (
            <BaseDialog
                fixedWidth={false}
                onFinished={this._onCancelClick}
                title={_t("Terms of Service")}
                contentId='mx_Dialog_content'
                hasCancel={false}
            >
                <div id='mx_Dialog_content'>
                    <p>{_t("To continue you need to accept the terms of this service.")}</p>

                    <table className="mx_TermsDialog_termsTable"><tbody>
                        <tr className="mx_TermsDialog_termsTableHeader">
                            <th>{_t("Service")}</th>
                            <th>{_t("Summary")}</th>
                            <th>{_t("Document")}</th>
                            <th>{_t("Accept")}</th>
                        </tr>
                        {rows}
                    </tbody></table>
                </div>

                <DialogButtons primaryButton={_t('Next')}
                    hasCancel={true}
                    onCancel={this._onCancelClick}
                    onPrimaryButtonClick={this._onNextClick}
                    primaryDisabled={!enableSubmit}
                />
            </BaseDialog>
        );
    }
}
