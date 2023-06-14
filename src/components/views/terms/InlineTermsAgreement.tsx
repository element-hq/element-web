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

import { _t, pickBestLanguage } from "../../../languageHandler";
import { objectClone } from "../../../utils/objects";
import StyledCheckbox from "../elements/StyledCheckbox";
import AccessibleButton from "../elements/AccessibleButton";
import { ServicePolicyPair } from "../../../Terms";

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
                const language = pickBestLanguage(Object.keys(policy).filter((p) => p !== "version"));
                const renderablePolicy: Policy = {
                    checked: false,
                    url: policy[language].url,
                    name: policy[language].name,
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
                "Accept <policyLink /> to continue:",
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
                            {_t("Accept")}
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
                    {_t("Continue")}
                </AccessibleButton>
            </div>
        );
    }
}
