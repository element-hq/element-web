/*
Copyright 2024 New Vector Ltd.
Copyright 2019 Vector Creations Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type Device } from "matrix-js-sdk/src/matrix";
import { type GeneratedSas, type EmojiMapping } from "matrix-js-sdk/src/crypto-api";
import SasEmoji from "@matrix-org/spec/sas-emoji.json";

import { _t, getNormalizedLanguageKeys, getUserLanguage } from "../../../languageHandler";
import { PendingActionSpinner } from "../right_panel/EncryptionInfo";
import AccessibleButton from "../elements/AccessibleButton";

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
                ? _t("encryption|verification|sas_emoji_caption_self")
                : _t("encryption|verification|sas_emoji_caption_user");
        } else if (this.props.sas.decimal) {
            const numberBlocks = this.props.sas.decimal.map((num, i) => <span key={i}>{num}</span>);
            sasDisplay = <div className="mx_VerificationShowSas_decimalSas">{numberBlocks}</div>;
            sasCaption = this.props.isSelf
                ? _t("encryption|verification|sas_caption_self")
                : _t("encryption|verification|sas_caption_user");
        } else {
            return (
                <div>
                    {_t("encryption|verification|unsupported_method")}
                    <AccessibleButton kind="primary" onClick={this.props.onCancel}>
                        {_t("action|cancel")}
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
                text = _t("encryption|verification|waiting_other_device_details", {
                    deviceName: otherDevice.displayName,
                    deviceId: otherDevice.deviceId,
                });
            } else {
                text = _t("encryption|verification|waiting_other_device");
            }
            confirm = <p>{text}</p>;
        } else if (this.state.pending || this.state.cancelling) {
            let text;
            if (this.state.pending) {
                const { displayName } = this.props;
                text = _t("encryption|verification|waiting_other_user", { displayName });
            } else {
                text = _t("encryption|verification|cancelling");
            }
            confirm = <PendingActionSpinner text={text} />;
        } else {
            confirm = (
                <div className="mx_VerificationShowSas_buttonRow">
                    <AccessibleButton onClick={this.onDontMatchClick} kind="danger">
                        {_t("encryption|verification|sas_no_match")}
                    </AccessibleButton>
                    <AccessibleButton onClick={this.onMatchClick} kind="primary">
                        {_t("encryption|verification|sas_match")}
                    </AccessibleButton>
                </div>
            );
        }

        return (
            <div className="mx_VerificationShowSas">
                <p>{sasCaption}</p>
                {sasDisplay}
                <p>{this.props.isSelf ? "" : _t("encryption|verification|in_person")}</p>
                {confirm}
            </div>
        );
    }
}
