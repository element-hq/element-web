/*
Copyright 2019 New Vector Ltd

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
import { sortBy } from "lodash";

import { _t } from "../../../../../languageHandler";
import SettingsStore from "../../../../../settings/SettingsStore";
import { SettingLevel } from "../../../../../settings/SettingLevel";
import SdkConfig from "../../../../../SdkConfig";
import BetaCard from "../../../beta/BetaCard";
import SettingsFlag from "../../../elements/SettingsFlag";
import { defaultWatchManager, LabGroup, labGroupNames } from "../../../../../settings/Settings";
import { EnhancedMap } from "../../../../../utils/maps";
import { arrayHasDiff } from "../../../../../utils/arrays";

interface State {
    labs: string[];
    betas: string[];
}

export default class LabsUserSettingsTab extends React.Component<{}, State> {
    private readonly features = SettingsStore.getFeatureSettingNames();

    public constructor(props: {}) {
        super(props);

        this.state = {
            betas: [],
            labs: [],
        };
    }

    public componentDidMount(): void {
        this.features.forEach((feature) => {
            defaultWatchManager.watchSetting(feature, null, this.onChange);
        });
        this.onChange();
    }

    public componentWillUnmount(): void {
        defaultWatchManager.unwatchSetting(this.onChange);
    }

    private onChange = (): void => {
        const features = SettingsStore.getFeatureSettingNames().filter((f) => SettingsStore.isEnabled(f));
        const [_labs, betas] = features.reduce(
            (arr, f) => {
                arr[SettingsStore.getBetaInfo(f) ? 1 : 0].push(f);
                return arr;
            },
            [[], []] as [string[], string[]],
        );

        const labs = SdkConfig.get("show_labs_settings") ? _labs : [];
        if (arrayHasDiff(labs, this.state.labs) || arrayHasDiff(betas, this.state.betas)) {
            this.setState({ labs, betas });
        }
    };

    public render(): React.ReactNode {
        let betaSection: JSX.Element | undefined;
        if (this.state.betas.length) {
            betaSection = (
                <div data-testid="labs-beta-section" className="mx_SettingsTab_section">
                    {this.state.betas.map((f) => (
                        <BetaCard key={f} featureId={f} />
                    ))}
                </div>
            );
        }

        let labsSections: JSX.Element | undefined;
        if (this.state.labs.length) {
            const groups = new EnhancedMap<LabGroup, JSX.Element[]>();
            this.state.labs.forEach((f) => {
                groups
                    .getOrCreate(SettingsStore.getLabGroup(f), [])
                    .push(<SettingsFlag level={SettingLevel.DEVICE} name={f} key={f} />);
            });

            groups
                .getOrCreate(LabGroup.Experimental, [])
                .push(<SettingsFlag key="lowBandwidth" name="lowBandwidth" level={SettingLevel.DEVICE} />);

            groups
                .getOrCreate(LabGroup.Analytics, [])
                .push(
                    <SettingsFlag
                        key="automaticErrorReporting"
                        name="automaticErrorReporting"
                        level={SettingLevel.DEVICE}
                    />,
                    <SettingsFlag
                        key="automaticDecryptionErrorReporting"
                        name="automaticDecryptionErrorReporting"
                        level={SettingLevel.DEVICE}
                    />,
                );

            labsSections = (
                <>
                    {sortBy(Array.from(groups.entries()), "0").map(([group, flags]) => (
                        <div className="mx_SettingsTab_section" key={group} data-testid={`labs-group-${group}`}>
                            <span className="mx_SettingsTab_subheading">{_t(labGroupNames[group])}</span>
                            {flags}
                        </div>
                    ))}
                </>
            );
        }

        return (
            <div className="mx_SettingsTab mx_LabsUserSettingsTab">
                <div className="mx_SettingsTab_heading">{_t("Upcoming features")}</div>
                <div className="mx_SettingsTab_subsectionText">
                    {_t(
                        "What's next for %(brand)s? " +
                            "Labs are the best way to get things early, " +
                            "test out new features and help shape them before they actually launch.",
                        { brand: SdkConfig.get("brand") },
                    )}
                </div>
                {betaSection}
                {labsSections && (
                    <>
                        <div className="mx_SettingsTab_heading">{_t("Early previews")}</div>
                        <div className="mx_SettingsTab_subsectionText">
                            {_t(
                                "Feeling experimental? " +
                                    "Try out our latest ideas in development. " +
                                    "These features are not finalised; " +
                                    "they may be unstable, may change, or may be dropped altogether. " +
                                    "<a>Learn more</a>.",
                                {},
                                {
                                    a: (sub) => {
                                        return (
                                            <a
                                                href="https://github.com/vector-im/element-web/blob/develop/docs/labs.md"
                                                rel="noreferrer noopener"
                                                target="_blank"
                                            >
                                                {sub}
                                            </a>
                                        );
                                    },
                                },
                            )}
                        </div>
                        {labsSections}
                    </>
                )}
            </div>
        );
    }
}
