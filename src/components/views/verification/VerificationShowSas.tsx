/*
Copyright 2019 Vector Creations Ltd

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
import { Device } from "matrix-js-sdk/src/matrix";
import { GeneratedSas, EmojiMapping } from "matrix-js-sdk/src/crypto-api/verification";
import SasEmoji from "@matrix-org/spec/sas-emoji.json";

import { _t, getNormalizedLanguageKeys, getUserLanguage } from "../../../languageHandler";
import { PendingActionSpinner } from "../right_panel/EncryptionInfo";
import AccessibleButton from "../elements/AccessibleButton";
import { fixupColorFonts } from "../../../utils/FontManager";

interface IProps {
    pending?: boolean;
    displayName?: string; // required if pending is true

    /** Details of the other device involved in the verification, if known */
    otherDeviceDetails?: Device;

    onDone: () => void;
    onCancel: () => void;
    sas: GeneratedSas;
    isSelf?: boolean;
    inDialog?: boolean; // whether this component is being shown in a dialog and to use DialogButtons
}

interface IState {
    pending: boolean;
    cancelling?: boolean;
}

const SasEmojiMap = new Map<
    string, // lowercase
    {
        description: string;
        translations: {
            [normalizedLanguageKey: string]: string;
        };
    }
>(
    SasEmoji.map(({ description, translated_descriptions: translations }) => [
        description.toLowerCase(),
        {
            description,
            // Normalize the translation keys
            translations: Object.keys(translations).reduce<Record<string, string>>((o, k) => {
                for (const key of getNormalizedLanguageKeys(k)) {
                    o[key] = translations[k as keyof typeof translations]!;
                }
                return o;
            }, {}),
        },
    ]),
);

/**
 * Translate given EmojiMapping into the target locale
 * @param mapping - the given EmojiMapping to translate
 * @param locale - the BCP 47 locale to translate to, will fall back to English as the base locale for Matrix SAS Emoji.
 */
export function tEmoji(mapping: EmojiMapping, locale: string): string {
    const name = mapping[1];
    const emoji = SasEmojiMap.get(name.toLowerCase());
    if (!emoji) {
        console.warn("Emoji not found for translation", name);
        return name;
    }

    for (const key of getNormalizedLanguageKeys(locale)) {
        if (!!emoji.translations[key]) {
            return emoji.translations[key];
        }
    }

    return emoji.description;
}

export default class VerificationShowSas extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);

        this.state = {
            pending: false,
        };

        // As this component is also used before login (during complete security),
        // also make sure we have a working emoji font to display the SAS emojis here.
        // This is also done from LoggedInView.
        fixupColorFonts();
    }

    private onMatchClick = (): void => {
        this.setState({ pending: true });
        this.props.onDone();
    };

    private onDontMatchClick = (): void => {
        this.setState({ cancelling: true });
        this.props.onCancel();
    };

    public render(): React.ReactNode {
        const locale = getUserLanguage();

        let sasDisplay;
        let sasCaption;
        if (this.props.sas.emoji) {
            const emojiBlocks = this.props.sas.emoji.map((emoji, i) => (
                <div className="mx_VerificationShowSas_emojiSas_block" key={i}>
                    <div className="mx_VerificationShowSas_emojiSas_emoji">{emoji[0]}</div>
                    <div className="mx_VerificationShowSas_emojiSas_label">{tEmoji(emoji, locale)}</div>
                </div>
            ));
            sasDisplay = (
                <div className="mx_VerificationShowSas_emojiSas">
                    {emojiBlocks.slice(0, 4)}
                    <div className="mx_VerificationShowSas_emojiSas_break" />
                    {emojiBlocks.slice(4)}
                </div>
            );
            sasCaption = this.props.isSelf
                ? _t("Confirm the emoji below are displayed on both devices, in the same order:")
                : _t("Verify this user by confirming the following emoji appear on their screen.");
        } else if (this.props.sas.decimal) {
            const numberBlocks = this.props.sas.decimal.map((num, i) => <span key={i}>{num}</span>);
            sasDisplay = <div className="mx_VerificationShowSas_decimalSas">{numberBlocks}</div>;
            sasCaption = this.props.isSelf
                ? _t("Verify this device by confirming the following number appears on its screen.")
                : _t("Verify this user by confirming the following number appears on their screen.");
        } else {
            return (
                <div>
                    {_t("Unable to find a supported verification method.")}
                    <AccessibleButton kind="primary" onClick={this.props.onCancel}>
                        {_t("Cancel")}
                    </AccessibleButton>
                </div>
            );
        }

        let confirm;
        if (this.state.pending && this.props.isSelf) {
            let text;
            // device shouldn't be null in this situation but it can be, eg. if the device is
            // logged out during verification
            const otherDevice = this.props.otherDeviceDetails;
            if (otherDevice) {
                text = _t("Waiting for you to verify on your other device, %(deviceName)s (%(deviceId)s)…", {
                    deviceName: otherDevice.displayName,
                    deviceId: otherDevice.deviceId,
                });
            } else {
                text = _t("Waiting for you to verify on your other device…");
            }
            confirm = <p>{text}</p>;
        } else if (this.state.pending || this.state.cancelling) {
            let text;
            if (this.state.pending) {
                const { displayName } = this.props;
                text = _t("Waiting for %(displayName)s to verify…", { displayName });
            } else {
                text = _t("Cancelling…");
            }
            confirm = <PendingActionSpinner text={text} />;
        } else {
            confirm = (
                <div className="mx_VerificationShowSas_buttonRow">
                    <AccessibleButton onClick={this.onDontMatchClick} kind="danger">
                        {_t("They don't match")}
                    </AccessibleButton>
                    <AccessibleButton onClick={this.onMatchClick} kind="primary">
                        {_t("They match")}
                    </AccessibleButton>
                </div>
            );
        }

        return (
            <div className="mx_VerificationShowSas">
                <p>{sasCaption}</p>
                {sasDisplay}
                <p>
                    {this.props.isSelf
                        ? ""
                        : _t("To be secure, do this in person or use a trusted way to communicate.")}
                </p>
                {confirm}
            </div>
        );
    }
}
