/*
Copyright 2018-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useEffect, useState } from "react";
import { Globe } from "lucide-react";

import SdkConfig from "../../../SdkConfig";
import * as languageHandler from "../../../languageHandler";
import { getCurrentLanguage } from "../../../languageHandler";
import SettingsStore from "../../../settings/SettingsStore";
import PlatformPeg from "../../../PlatformPeg";
import { SettingLevel } from "../../../settings/SettingLevel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/Select";
import Spinner from "../elements/Spinner";

type Languages = Awaited<ReturnType<typeof languageHandler.getAllLanguagesWithLabels>>;

function onChange(newLang: string): void {
    if (getCurrentLanguage() !== newLang) {
        SettingsStore.setValue("language", null, SettingLevel.DEVICE, newLang);
        PlatformPeg.get()?.reload();
    }
}

interface IProps {
    disabled?: boolean;
}

export default function LanguageSelector({ disabled }: IProps): JSX.Element {
    const [languages, setLanguages] = useState<Languages | null>(null);
    const currentLanguage = getCurrentLanguage();

    useEffect(() => {
        languageHandler
            .getAllLanguagesWithLabels()
            .then((langs) => {
                langs.sort((a, b) => a.labelInTargetLanguage.localeCompare(b.labelInTargetLanguage));
                setLanguages(langs);
            })
            .catch(() => {
                setLanguages([
                    {
                        value: "en",
                        label: "English",
                        labelInTargetLanguage: "English",
                    },
                ]);
            });
    }, []);

    if (SdkConfig.get("disable_login_language_selector")) {
        return <div />;
    }

    if (languages === null) {
        return (
            <div className="flex justify-center py-4">
                <Spinner w={16} h={16} />
            </div>
        );
    }

    const currentLangLabel = languages.find((lang) => lang.value === currentLanguage)?.labelInTargetLanguage;

    return (
        <div className="flex justify-center py-4">
            <Select value={currentLanguage} onValueChange={onChange} disabled={disabled}>
                <SelectTrigger className="h-auto min-w-30 gap-2 border-none bg-transparent px-3 py-2 shadow-none hover:bg-black/5 focus:ring-0 focus:outline-none">
                    <Globe className="h-4 w-4 opacity-70" />
                    <SelectValue placeholder={currentLangLabel} />
                </SelectTrigger>
                <SelectContent className="z-1000 max-h-75 overflow-y-auto rounded-lg border border-gray-200 bg-white">
                    {languages.map((lang) => (
                        <SelectItem key={lang.value} value={lang.value}>
                            {lang.labelInTargetLanguage}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
