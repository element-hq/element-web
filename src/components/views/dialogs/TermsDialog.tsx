/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { SERVICE_TYPES } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../languageHandler";
import DialogButtons from "../elements/DialogButtons";
import BaseDialog from "./BaseDialog";
import { pickBestPolicyLanguage, type ServicePolicyPair } from "../../../Terms";
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
                        {_t("common|identity_server")}
                        <br />({host})
                    </div>
                );
            case SERVICE_TYPES.IM:
                return (
                    <div>
                        {_t("common|integration_manager")}
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
                        {_t("terms|summary_identity_server_1")}
                        <br />
                        {_t("terms|summary_identity_server_2")}
                    </div>
                );
            case SERVICE_TYPES.IM:
                return <div>{_t("terms|integration_manager")}</div>;
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
                const internationalisedPolicy = pickBestPolicyLanguage(policyValues[i]);
                if (!internationalisedPolicy) continue;
                let serviceName: JSX.Element | undefined;
                let summary: JSX.Element | undefined;
                if (i === 0) {
                    serviceName = this.nameForServiceType(policiesAndService.service.serviceType, parsedBaseUrl.host);
                    summary = this.summaryForServiceType(policiesAndService.service.serviceType);
                }

                rows.push(
                    <tr key={internationalisedPolicy.url}>
                        <td className="mx_TermsDialog_service">{serviceName}</td>
                        <td className="mx_TermsDialog_summary">{summary}</td>
                        <td>
                            <ExternalLink rel="noreferrer noopener" target="_blank" href={internationalisedPolicy.url}>
                                {internationalisedPolicy.name}
                            </ExternalLink>
                        </td>
                        <td>
                            <TermsCheckbox
                                url={internationalisedPolicy.url}
                                onChange={this.onTermsCheckboxChange}
                                checked={Boolean(this.state.agreedUrls[internationalisedPolicy.url])}
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
                    if (lang === "version" || typeof terms[lang] === "string") continue;
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
                title={_t("terms|tos")}
                contentId="mx_Dialog_content"
                hasCancel={false}
            >
                <div id="mx_Dialog_content">
                    <p>{_t("terms|intro")}</p>

                    <table className="mx_TermsDialog_termsTable">
                        <tbody>
                            <tr className="mx_TermsDialog_termsTableHeader">
                                <th>{_t("terms|column_service")}</th>
                                <th>{_t("terms|column_summary")}</th>
                                <th>{_t("terms|column_document")}</th>
                                <th>{_t("action|accept")}</th>
                            </tr>
                            {rows}
                        </tbody>
                    </table>
                </div>

                <DialogButtons
                    primaryButton={_t("action|next")}
                    hasCancel={true}
                    onCancel={this.onCancelClick}
                    onPrimaryButtonClick={this.onNextClick}
                    primaryDisabled={!enableSubmit}
                />
            </BaseDialog>
        );
    }
}
