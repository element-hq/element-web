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

import React from "react";
import { SERVICE_TYPES } from "matrix-js-sdk/src/service-types";

import { _t, pickBestLanguage } from "../../../languageHandler";
import DialogButtons from "../elements/DialogButtons";
import BaseDialog from "./BaseDialog";
import { ServicePolicyPair } from "../../../Terms";
import ExternalLink from "../elements/ExternalLink";
import { parseUrl } from "../../../utils/UrlUtils";

interface ITermsCheckboxProps {
    onChange: (url: string, checked: boolean) => void;
    url: string;
    checked: boolean;
}

class TermsCheckbox extends React.PureComponent<ITermsCheckboxProps> {
    private onChange = (ev: React.FormEvent<HTMLInputElement>): void => {
        this.props.onChange(this.props.url, ev.currentTarget.checked);
    };

    public render(): React.ReactNode {
        return <input type="checkbox" onChange={this.onChange} checked={this.props.checked} />;
    }
}

interface ITermsDialogProps {
    /**
     * Array of [Service, policies] pairs, where policies is the response from the
     * /terms endpoint for that service
     */
    policiesAndServicePairs: ServicePolicyPair[];

    /**
     * urls that the user has already agreed to
     */
    agreedUrls: string[];

    /**
     * Called with:
     *     * success {bool} True if the user accepted any douments, false if cancelled
     *     * agreedUrls {string[]} List of agreed URLs
     */
    onFinished: (success: boolean, agreedUrls?: string[]) => void;
}

interface IState {
    agreedUrls: any;
}

export default class TermsDialog extends React.PureComponent<ITermsDialogProps, IState> {
    public constructor(props: ITermsDialogProps) {
        super(props);
        this.state = {
            // url -> boolean
            agreedUrls: {},
        };
        for (const url of props.agreedUrls) {
            this.state.agreedUrls[url] = true;
        }
    }

    private onCancelClick = (): void => {
        this.props.onFinished(false);
    };

    private onNextClick = (): void => {
        this.props.onFinished(
            true,
            Object.keys(this.state.agreedUrls).filter((url) => this.state.agreedUrls[url]),
        );
    };

    private nameForServiceType(serviceType: SERVICE_TYPES, host: string): JSX.Element {
        switch (serviceType) {
            case SERVICE_TYPES.IS:
                return (
                    <div>
                        {_t("Identity server")}
                        <br />({host})
                    </div>
                );
            case SERVICE_TYPES.IM:
                return (
                    <div>
                        {_t("Integration manager")}
                        <br />({host})
                    </div>
                );
        }
    }

    private summaryForServiceType(serviceType: SERVICE_TYPES): JSX.Element {
        switch (serviceType) {
            case SERVICE_TYPES.IS:
                return (
                    <div>
                        {_t("Find others by phone or email")}
                        <br />
                        {_t("Be found by phone or email")}
                    </div>
                );
            case SERVICE_TYPES.IM:
                return <div>{_t("Use bots, bridges, widgets and sticker packs")}</div>;
        }
    }

    private onTermsCheckboxChange = (url: string, checked: boolean): void => {
        this.setState({
            agreedUrls: Object.assign({}, this.state.agreedUrls, { [url]: checked }),
        });
    };

    public render(): React.ReactNode {
        const rows: JSX.Element[] = [];
        for (const policiesAndService of this.props.policiesAndServicePairs) {
            const parsedBaseUrl = parseUrl(policiesAndService.service.baseUrl);

            const policyValues = Object.values(policiesAndService.policies);
            for (let i = 0; i < policyValues.length; ++i) {
                const termDoc = policyValues[i];
                const termsLang = pickBestLanguage(Object.keys(termDoc).filter((k) => k !== "version"));
                let serviceName: JSX.Element | undefined;
                let summary: JSX.Element | undefined;
                if (i === 0) {
                    serviceName = this.nameForServiceType(policiesAndService.service.serviceType, parsedBaseUrl.host);
                    summary = this.summaryForServiceType(policiesAndService.service.serviceType);
                }

                rows.push(
                    <tr key={termDoc[termsLang].url}>
                        <td className="mx_TermsDialog_service">{serviceName}</td>
                        <td className="mx_TermsDialog_summary">{summary}</td>
                        <td>
                            <ExternalLink rel="noreferrer noopener" target="_blank" href={termDoc[termsLang].url}>
                                {termDoc[termsLang].name}
                            </ExternalLink>
                        </td>
                        <td>
                            <TermsCheckbox
                                url={termDoc[termsLang].url}
                                onChange={this.onTermsCheckboxChange}
                                checked={Boolean(this.state.agreedUrls[termDoc[termsLang].url])}
                            />
                        </td>
                    </tr>,
                );
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
                    if (lang === "version") continue;
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
                onFinished={this.onCancelClick}
                title={_t("Terms of Service")}
                contentId="mx_Dialog_content"
                hasCancel={false}
            >
                <div id="mx_Dialog_content">
                    <p>{_t("To continue you need to accept the terms of this service.")}</p>

                    <table className="mx_TermsDialog_termsTable">
                        <tbody>
                            <tr className="mx_TermsDialog_termsTableHeader">
                                <th>{_t("Service")}</th>
                                <th>{_t("Summary")}</th>
                                <th>{_t("Document")}</th>
                                <th>{_t("Accept")}</th>
                            </tr>
                            {rows}
                        </tbody>
                    </table>
                </div>

                <DialogButtons
                    primaryButton={_t("Next")}
                    hasCancel={true}
                    onCancel={this.onCancelClick}
                    onPrimaryButtonClick={this.onNextClick}
                    primaryDisabled={!enableSubmit}
                />
            </BaseDialog>
        );
    }
}
