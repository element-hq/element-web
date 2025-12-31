/*
Copyright 2019-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { sortBy } from "lodash";
import { type EmptyObject } from "matrix-js-sdk/src/matrix";
import { Form, SettingsToggleInput } from "@vector-im/compound-web";

import { _t } from "../../../../../languageHandler";
import SettingsStore from "../../../../../settings/SettingsStore";
import { SettingLevel } from "../../../../../settings/SettingLevel";
import SdkConfig from "../../../../../SdkConfig";
import BetaCard from "../../../beta/BetaCard";
import SettingsFlag from "../../../elements/SettingsFlag";
import { type FeatureSettingKey, LabGroup, labGroupNames } from "../../../../../settings/Settings";
import { EnhancedMap } from "../../../../../utils/maps";
import { SettingsSection } from "../../shared/SettingsSection";
import { SettingsSubsection, SettingsSubsectionText } from "../../shared/SettingsSubsection";
import SettingsTab from "../SettingsTab";
import { CLAP_DEV_FLAGS, type ClapDevFlagKey } from "../../../../../settings/ClapDeveloperFlags";
import { useDeveloperFlag } from "../../../../../hooks/useSettings";

export const showLabsFlags = (): boolean => {
    return SdkConfig.get("show_labs_settings") || SettingsStore.getValue("developerMode");
};

/**
 * Individual toggle for a Clap developer flag
 */
const ClapDevFlagToggle: React.FC<{ flagKey: ClapDevFlagKey; description: string }> = ({ flagKey, description }) => {
    const enabled = useDeveloperFlag(flagKey);

    const handleChange = (evt: React.ChangeEvent<HTMLInputElement>): void => {
        const newValue = evt.target.checked;
        const currentFlags = SettingsStore.getValue("clapDeveloperFlags") ?? {};
        SettingsStore.setValue("clapDeveloperFlags", null, SettingLevel.DEVICE, {
            ...currentFlags,
            [flagKey]: newValue,
        });
    };

    return (
        <SettingsToggleInput
            name={`clap_dev_${flagKey}`}
            label={`${flagKey} - ${description}`}
            checked={enabled}
            onChange={handleChange}
        />
    );
};

export default class LabsUserSettingsTab extends React.Component<EmptyObject> {
    private readonly labs: FeatureSettingKey[];
    private readonly betas: FeatureSettingKey[];

    public constructor(props: EmptyObject) {
        super(props);

        const features = SettingsStore.getFeatureSettingNames();
        const [labs, betas] = features.reduce(
            (arr, f) => {
                arr[SettingsStore.getBetaInfo(f) ? 1 : 0].push(f as FeatureSettingKey);
                return arr;
            },
            [[], []] as [FeatureSettingKey[], FeatureSettingKey[]],
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
                <Form.Root
                    onSubmit={(evt) => {
                        evt.preventDefault();
                        evt.stopPropagation();
                    }}
                >
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

                    {SettingsStore.getValue("developerMode") && (
                        <SettingsSection heading="Clap Developer Flags">
                            <SettingsSubsectionText>
                                팀 개발자 전용 기능 플래그입니다. 로컬 스토리지에 저장되며 서버에 동기화되지 않습니다.
                            </SettingsSubsectionText>
                            <SettingsSubsection heading="기능 플래그">
                                {Object.entries(CLAP_DEV_FLAGS).map(([key, description]) => (
                                    <ClapDevFlagToggle
                                        key={key}
                                        flagKey={key as ClapDevFlagKey}
                                        description={description}
                                    />
                                ))}
                            </SettingsSubsection>
                        </SettingsSection>
                    )}
                </Form.Root>
            </SettingsTab>
        );
    }
}
