/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

import { _t } from "../../../languageHandler";
import { objectClone } from "../../../utils/objects";
import StyledCheckbox from "../elements/StyledCheckbox";
import AccessibleButton from "../elements/AccessibleButton";
import { pickBestPolicyLanguage, type ServicePolicyPair } from "../../../Terms";

interface IProps {
    policiesAndServicePairs: ServicePolicyPair[];
    onFinished: (accepted: string[]) => void;
    agreedUrls: string[]; // array of URLs the user has accepted
    introElement: React.ReactNode;
}

interface IState {
    policies: Policy[];
    busy: boolean;
}

interface Policy {
    checked: boolean;
    url: string;
    name: string;
}

export default class InlineTermsAgreement extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);
        this.state = {
            policies: [],
            busy: false,
        };
    }

    public componentDidMount(): void {
        // Build all the terms the user needs to accept
        const policies: Policy[] = [];
        for (const servicePolicies of this.props.policiesAndServicePairs) {
            const availablePolicies = Object.values(servicePolicies.policies);
            for (const policy of availablePolicies) {
                const internationalisedPolicy = pickBestPolicyLanguage(policy);
                if (!internationalisedPolicy) continue;
                const renderablePolicy: Policy = {
                    checked: false,
                    url: internationalisedPolicy.url,
                    name: internationalisedPolicy.name,
                };
                policies.push(renderablePolicy);
            }
        }

        this.setState({ policies });
    }

    private togglePolicy = (index: number): void => {
        const policies = objectClone(this.state.policies);
        policies[index].checked = !policies[index].checked;
        this.setState({ policies });
    };

    private onContinue = (): void => {
        const hasUnchecked = !!this.state.policies.some((p) => !p.checked);
        if (hasUnchecked) return;

        this.setState({ busy: true });
        this.props.onFinished(this.state.policies.map((p) => p.url));
    };

    private renderCheckboxes(): React.ReactNode[] {
        const rendered: JSX.Element[] = [];
        for (let i = 0; i < this.state.policies.length; i++) {
            const policy = this.state.policies[i];
            const introText = _t(
                "terms|inline_intro_text",
                {},
                {
                    policyLink: () => {
                        return (
                            <a href={policy.url} rel="noreferrer noopener" target="_blank">
                                {policy.name}
                                <span className="mx_InlineTermsAgreement_link" />
                            </a>
                        );
                    },
                },
            );
            rendered.push(
                <div key={i} className="mx_InlineTermsAgreement_cbContainer">
                    <div>{introText}</div>
                    <div className="mx_InlineTermsAgreement_checkbox">
                        <StyledCheckbox onChange={() => this.togglePolicy(i)} checked={policy.checked}>
                            {_t("action|accept")}
                        </StyledCheckbox>
                    </div>
                </div>,
            );
        }
        return rendered;
    }

    public render(): React.ReactNode {
        const hasUnchecked = !!this.state.policies.some((p) => !p.checked);

        return (
            <div>
                {this.props.introElement}
                {this.renderCheckboxes()}
                <AccessibleButton
                    onClick={this.onContinue}
                    disabled={hasUnchecked || this.state.busy}
                    kind="primary_sm"
                >
                    {_t("action|continue")}
                </AccessibleButton>
            </div>
        );
    }
}
