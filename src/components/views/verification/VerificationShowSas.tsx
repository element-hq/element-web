/*
Copyright 2024 New Vector Ltd.
Copyright 2019 Vector Creations Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type FC } from "react";
import { type Device } from "matrix-js-sdk/src/matrix";
import { type GeneratedSas, type EmojiMapping } from "matrix-js-sdk/src/crypto-api";
import SasEmoji from "andybalaam-matrix-spec/sas-emoji.json";
import { Icon as Emoji00 } from "andybalaam-matrix-spec/sas-emoji/00.svg";
import { Icon as Emoji01 } from "andybalaam-matrix-spec/sas-emoji/01.svg";
import { Icon as Emoji02 } from "andybalaam-matrix-spec/sas-emoji/02.svg";
import { Icon as Emoji03 } from "andybalaam-matrix-spec/sas-emoji/03.svg";
import { Icon as Emoji04 } from "andybalaam-matrix-spec/sas-emoji/04.svg";
import { Icon as Emoji05 } from "andybalaam-matrix-spec/sas-emoji/05.svg";
import { Icon as Emoji06 } from "andybalaam-matrix-spec/sas-emoji/06.svg";
import { Icon as Emoji07 } from "andybalaam-matrix-spec/sas-emoji/07.svg";
import { Icon as Emoji08 } from "andybalaam-matrix-spec/sas-emoji/08.svg";
import { Icon as Emoji09 } from "andybalaam-matrix-spec/sas-emoji/09.svg";
import { Icon as Emoji10 } from "andybalaam-matrix-spec/sas-emoji/10.svg";
import { Icon as Emoji11 } from "andybalaam-matrix-spec/sas-emoji/11.svg";
import { Icon as Emoji12 } from "andybalaam-matrix-spec/sas-emoji/12.svg";
import { Icon as Emoji13 } from "andybalaam-matrix-spec/sas-emoji/13.svg";
import { Icon as Emoji14 } from "andybalaam-matrix-spec/sas-emoji/14.svg";
import { Icon as Emoji15 } from "andybalaam-matrix-spec/sas-emoji/15.svg";
import { Icon as Emoji16 } from "andybalaam-matrix-spec/sas-emoji/16.svg";
import { Icon as Emoji17 } from "andybalaam-matrix-spec/sas-emoji/17.svg";
import { Icon as Emoji18 } from "andybalaam-matrix-spec/sas-emoji/18.svg";
import { Icon as Emoji19 } from "andybalaam-matrix-spec/sas-emoji/19.svg";
import { Icon as Emoji20 } from "andybalaam-matrix-spec/sas-emoji/20.svg";
import { Icon as Emoji21 } from "andybalaam-matrix-spec/sas-emoji/21.svg";
import { Icon as Emoji22 } from "andybalaam-matrix-spec/sas-emoji/22.svg";
import { Icon as Emoji23 } from "andybalaam-matrix-spec/sas-emoji/23.svg";
import { Icon as Emoji24 } from "andybalaam-matrix-spec/sas-emoji/24.svg";
import { Icon as Emoji25 } from "andybalaam-matrix-spec/sas-emoji/25.svg";
import { Icon as Emoji26 } from "andybalaam-matrix-spec/sas-emoji/26.svg";
import { Icon as Emoji27 } from "andybalaam-matrix-spec/sas-emoji/27.svg";
import { Icon as Emoji28 } from "andybalaam-matrix-spec/sas-emoji/28.svg";
import { Icon as Emoji29 } from "andybalaam-matrix-spec/sas-emoji/29.svg";
import { Icon as Emoji30 } from "andybalaam-matrix-spec/sas-emoji/30.svg";
import { Icon as Emoji31 } from "andybalaam-matrix-spec/sas-emoji/31.svg";
import { Icon as Emoji32 } from "andybalaam-matrix-spec/sas-emoji/32.svg";
import { Icon as Emoji33 } from "andybalaam-matrix-spec/sas-emoji/33.svg";
import { Icon as Emoji34 } from "andybalaam-matrix-spec/sas-emoji/34.svg";
import { Icon as Emoji35 } from "andybalaam-matrix-spec/sas-emoji/35.svg";
import { Icon as Emoji36 } from "andybalaam-matrix-spec/sas-emoji/36.svg";
import { Icon as Emoji37 } from "andybalaam-matrix-spec/sas-emoji/37.svg";
import { Icon as Emoji38 } from "andybalaam-matrix-spec/sas-emoji/38.svg";
import { Icon as Emoji39 } from "andybalaam-matrix-spec/sas-emoji/39.svg";
import { Icon as Emoji40 } from "andybalaam-matrix-spec/sas-emoji/40.svg";
import { Icon as Emoji41 } from "andybalaam-matrix-spec/sas-emoji/41.svg";
import { Icon as Emoji42 } from "andybalaam-matrix-spec/sas-emoji/42.svg";
import { Icon as Emoji43 } from "andybalaam-matrix-spec/sas-emoji/43.svg";
import { Icon as Emoji44 } from "andybalaam-matrix-spec/sas-emoji/44.svg";
import { Icon as Emoji45 } from "andybalaam-matrix-spec/sas-emoji/45.svg";
import { Icon as Emoji46 } from "andybalaam-matrix-spec/sas-emoji/46.svg";
import { Icon as Emoji47 } from "andybalaam-matrix-spec/sas-emoji/47.svg";
import { Icon as Emoji48 } from "andybalaam-matrix-spec/sas-emoji/48.svg";
import { Icon as Emoji49 } from "andybalaam-matrix-spec/sas-emoji/49.svg";
import { Icon as Emoji50 } from "andybalaam-matrix-spec/sas-emoji/50.svg";
import { Icon as Emoji51 } from "andybalaam-matrix-spec/sas-emoji/51.svg";
import { Icon as Emoji52 } from "andybalaam-matrix-spec/sas-emoji/52.svg";
import { Icon as Emoji53 } from "andybalaam-matrix-spec/sas-emoji/53.svg";
import { Icon as Emoji54 } from "andybalaam-matrix-spec/sas-emoji/54.svg";
import { Icon as Emoji55 } from "andybalaam-matrix-spec/sas-emoji/55.svg";
import { Icon as Emoji56 } from "andybalaam-matrix-spec/sas-emoji/56.svg";
import { Icon as Emoji57 } from "andybalaam-matrix-spec/sas-emoji/57.svg";
import { Icon as Emoji58 } from "andybalaam-matrix-spec/sas-emoji/58.svg";
import { Icon as Emoji59 } from "andybalaam-matrix-spec/sas-emoji/59.svg";
import { Icon as Emoji60 } from "andybalaam-matrix-spec/sas-emoji/60.svg";
import { Icon as Emoji61 } from "andybalaam-matrix-spec/sas-emoji/61.svg";
import { Icon as Emoji62 } from "andybalaam-matrix-spec/sas-emoji/62.svg";
import { Icon as Emoji63 } from "andybalaam-matrix-spec/sas-emoji/63.svg";

import { _t, getNormalizedLanguageKeys, getUserLanguage } from "../../../languageHandler";
import { PendingActionSpinner } from "../right_panel/EncryptionInfo";
import AccessibleButton from "../elements/AccessibleButton";

const emojiImages: Record<string, FC> = {
    "Dog": Emoji00,
    "Cat": Emoji01,
    "Lion": Emoji02,
    "Horse": Emoji03,
    "Unicorn": Emoji04,
    "Pig": Emoji05,
    "Elephant": Emoji06,
    "Rabbit": Emoji07,
    "Panda": Emoji08,
    "Rooster": Emoji09,
    "Penguin": Emoji10,
    "Turtle": Emoji11,
    "Fish": Emoji12,
    "Octopus": Emoji13,
    "Butterfly": Emoji14,
    "Flower": Emoji15,
    "Tree": Emoji16,
    "Cactus": Emoji17,
    "Mushroom": Emoji18,
    "Globe": Emoji19,
    "Moon": Emoji20,
    "Cloud": Emoji21,
    "Fire": Emoji22,
    "Banana": Emoji23,
    "Apple": Emoji24,
    "Strawberry": Emoji25,
    "Corn": Emoji26,
    "Pizza": Emoji27,
    "Cake": Emoji28,
    "Heart": Emoji29,
    "Smiley": Emoji30,
    "Robot": Emoji31,
    "Hat": Emoji32,
    "Glasses": Emoji33,
    "Spanner": Emoji34,
    "Santa": Emoji35,
    "Thumbs Up": Emoji36,
    "Umbrella": Emoji37,
    "Hourglass": Emoji38,
    "Clock": Emoji39,
    "Gift": Emoji40,
    "Light Bulb": Emoji41,
    "Book": Emoji42,
    "Pencil": Emoji43,
    "Paperclip": Emoji44,
    "Scissors": Emoji45,
    "Lock": Emoji46,
    "Key": Emoji47,
    "Hammer": Emoji48,
    "Telephone": Emoji49,
    "Flag": Emoji50,
    "Train": Emoji51,
    "Bicycle": Emoji52,
    "Aeroplane": Emoji53,
    "Rocket": Emoji54,
    "Trophy": Emoji55,
    "Ball": Emoji56,
    "Guitar": Emoji57,
    "Trumpet": Emoji58,
    "Bell": Emoji59,
    "Anchor": Emoji60,
    "Headphones": Emoji61,
    "Folder": Emoji62,
    "Pin": Emoji63,
};

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
            const emojiBlocks = this.props.sas.emoji.map((emoji, i) => {
                const EmojiImage = emojiImages[emoji[1]];
                return (
                    <div className="mx_VerificationShowSas_emojiSas_block" key={i}>
                        <div className="mx_VerificationShowSas_emojiSas_emoji" aria-hidden={true}>
                            <EmojiImage />
                        </div>
                        <div className="mx_VerificationShowSas_emojiSas_label">{tEmoji(emoji, locale)}</div>
                    </div>
                );
            });
            sasDisplay = (
                <div className="mx_VerificationShowSas_emojiSas">
                    {emojiBlocks.slice(0, 4)}
                    <div className="mx_VerificationShowSas_emojiSas_break" />
                    {emojiBlocks.slice(4)}
                </div>
            );
            sasCaption = this.props.isSelf
                ? _t("encryption|verification|confirm_the_emojis")
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
                    <AccessibleButton onClick={this.onMatchClick} kind="primary">
                        {_t("encryption|verification|sas_match")}
                    </AccessibleButton>
                    <AccessibleButton onClick={this.onDontMatchClick} kind="secondary">
                        {_t("encryption|verification|sas_no_match")}
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
