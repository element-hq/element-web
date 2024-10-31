/*
Copyright 2019-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { sortBy } from "lodash";

import { _t } from "../../../../../languageHandler";
import SettingsStore from "../../../../../settings/SettingsStore";
import { SettingLevel } from "../../../../../settings/SettingLevel";
import SdkConfig from "../../../../../SdkConfig";
import BetaCard from "../../../beta/BetaCard";
import SettingsFlag from "../../../elements/SettingsFlag";
import { LabGroup, labGroupNames } from "../../../../../settings/Settings";
import { EnhancedMap } from "../../../../../utils/maps";
import { SettingsSection } from "../../shared/SettingsSection";
import SettingsSubsection, { SettingsSubsectionText } from "../../shared/SettingsSubsection";
import SettingsTab from "../SettingsTab";

export const showLabsFlags = (): boolean => {
    return SdkConfig.get("show_labs_settings") || SettingsStore.getValue("developerMode");
};

export default class LabsUserSettingsTab extends React.Component<{}> {
    private readonly labs: string[];
    private readonly betas: string[];

    public constructor(props: {}) {
        super(props);

        const features = SettingsStore.getFeatureSettingNames();
        const [labs, betas] = features.reduce(
            (arr, f) => {
                arr[SettingsStore.getBetaInfo(f) ? 1 : 0].push(f);
                return arr;
            },
            [[], []] as [string[], string[]],
        );

        this.labs = labs;
        this.betas = betas;

        if (!showLabsFlags()) {
            this.labs = [];
        }
    }

    public render(): React.ReactNode {
        let betaSection: JSX.Element | undefined;
        if (this.betas.length) {
            betaSection = (
                <>
                    {this.betas.map((f) => (
                        <BetaCard key={f} featureId={f} />
                    ))}
                </>
            );
        }

        let labsSections: JSX.Element | undefined;
        if (this.labs.length) {
            const groups = new EnhancedMap<LabGroup, JSX.Element[]>();
            this.labs.forEach((f) => {
                groups
                    .getOrCreate(SettingsStore.getLabGroup(f)!, [])
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
                        <SettingsSubsection
                            key={group}
                            data-testid={`labs-group-${group}`}
                            heading={_t(labGroupNames[group])}
                        >
                            {flags}
                        </SettingsSubsection>
                    ))}
                </>
            );
        }

        return (
            <SettingsTab>
                <SettingsSection heading={_t("labs|beta_section")}>
                    <SettingsSubsectionText>
                        {_t("labs|beta_description", { brand: SdkConfig.get("brand") })}
                    </SettingsSubsectionText>
                    {betaSection}
                </SettingsSection>

                {labsSections && (
                    <SettingsSection heading={_t("labs|experimental_section")}>
                        <SettingsSubsectionText>
                            {_t(
                                "labs|experimental_description",
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
                        </SettingsSubsectionText>
                        {labsSections}
                    </SettingsSection>
                )}
            </SettingsTab>
        );
    }
}
