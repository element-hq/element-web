/*
Copyright 2026 Element contributors

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
*/

import React, { type ChangeEvent, useEffect, useRef, useState } from "react";

import { MatrixClientPeg } from "../../../MatrixClientPeg";
import AccessibleButton from "../elements/AccessibleButton";
import { SettingsSubsection } from "./shared/SettingsSubsection";
import {
    DEFAULT_SPARK_APPEARANCE,
    hasStoredSparkAppearance,
    loadStoredSparkAppearance,
    normaliseSparkAppearance,
    saveStoredSparkAppearance,
    SPARK_APPEARANCE_ACCOUNT_DATA,
    type SparkAppearanceSettings,
} from "../../../features/appearance/SparkAppearance";

const HEX_COLOUR = /^#[0-9a-f]{6}$/i;

const readAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
            typeof reader.result === "string"
                ? resolve(reader.result)
                : reject(new Error("无法读取聊天背景图片。"));
        reader.onerror = () =>
            reject(reader.error ?? new Error("无法读取聊天背景图片。"));
        reader.readAsDataURL(file);
    });

function ColourSetting({
    label,
    value,
    opacity,
    onChange,
}: {
    label: string;
    value: string;
    opacity: number;
    onChange: (colour: string, nextOpacity: number) => void;
}): JSX.Element {
    const [draft, setDraft] = useState(value.toUpperCase());

    useEffect(() => setDraft(value.toUpperCase()), [value]);

    const commitDraft = (): void => {
        if (HEX_COLOUR.test(draft)) {
            onChange(draft, opacity);
        } else {
            setDraft(value.toUpperCase());
        }
    };

    return (
        <label className="mx_SparkAppearanceCustomizer_colourSetting">
            <span>{label}</span>
            <span className="mx_SparkAppearanceCustomizer_colourControl">
                <input
                    type="color"
                    value={value}
                    onChange={(event) => onChange(event.target.value, opacity)}
                />
                <input
                    type="text"
                    value={draft}
                    maxLength={7}
                    spellCheck={false}
                    aria-label={`${label}十六进制颜色`}
                    onChange={(event) => setDraft(event.target.value)}
                    onBlur={commitDraft}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                    }}
                />
            </span>
            <span className="mx_SparkAppearanceCustomizer_opacityControl">
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={opacity}
                    onChange={(event) =>
                        onChange(value, Number(event.target.value))
                    }
                />
                <output>{opacity}%</output>
            </span>
        </label>
    );
}

/** Spark's colour, frosted glass and chat-background controls on Element's settings shell. */
export function SparkAppearanceCustomizer(): JSX.Element {
    const [settings, setSettings] = useState<SparkAppearanceSettings>(() => {
        const local = loadStoredSparkAppearance();
        // Keep an explicit local choice (which may include the local-only
        // background). A new device starts from Matrix account data instead.
        if (hasStoredSparkAppearance()) return local;
        const accountData = MatrixClientPeg.get()
            ?.getAccountData(SPARK_APPEARANCE_ACCOUNT_DATA)
            ?.getContent();
        return accountData ? normaliseSparkAppearance(accountData) : local;
    });
    const [backgroundError, setBackgroundError] = useState<string>();
    const fileInput = useRef<HTMLInputElement>(null);

    useEffect(() => {
        saveStoredSparkAppearance(settings);
        // Background data stays only on the current device. Matrix account data
        // is limited to the appearance values that are safe to sync.
        const { chatBackgroundDataUrl: _localOnlyBackground, ...accountData } =
            settings;
        void MatrixClientPeg.get()
            ?.setAccountData(SPARK_APPEARANCE_ACCOUNT_DATA, accountData)
            .catch(() => undefined);
    }, [settings]);

    const update = (partial: Partial<SparkAppearanceSettings>): void => {
        setSettings((current) => ({ ...current, ...partial }));
    };

    const onBackground = async (
        event: ChangeEvent<HTMLInputElement>
    ): Promise<void> => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
            setBackgroundError("请选择不超过 5 MB 的图片文件。 ");
            return;
        }
        try {
            update({ chatBackgroundDataUrl: await readAsDataUrl(file) });
            setBackgroundError(undefined);
        } catch (error) {
            setBackgroundError(
                error instanceof Error ? error.message : "聊天背景读取失败。"
            );
        }
    };

    const previewStyle = settings.chatBackgroundDataUrl
        ? {
              backgroundImage: `linear-gradient(rgb(15 23 42 / 22%), rgb(15 23 42 / 34%)), url("${settings.chatBackgroundDataUrl}")`,
          }
        : undefined;

    return (
        <SettingsSubsection>
            <section className="mx_SparkAppearanceCustomizer">
                <div className="mx_SparkAppearanceCustomizer_heading">
                    <div>
                        <h2>星火外观与聊天背景</h2>
                        <p>
                            颜色与界面风格立即生效并同步到
                            Matrix；聊天背景图片仅保存在当前设备。
                        </p>
                    </div>
                    <AccessibleButton
                        kind="secondary"
                        onClick={() => setSettings(DEFAULT_SPARK_APPEARANCE)}
                    >
                        恢复默认
                    </AccessibleButton>
                </div>

                <div
                    className="mx_SparkAppearanceCustomizer_styleChoices"
                    role="radiogroup"
                    aria-label="界面风格"
                >
                    <AccessibleButton
                        className={
                            settings.interfaceStyle === "classic"
                                ? "mx_SparkAppearanceCustomizer_selected"
                                : undefined
                        }
                        onClick={() => update({ interfaceStyle: "classic" })}
                        aria-pressed={settings.interfaceStyle === "classic"}
                    >
                        经典
                    </AccessibleButton>
                    <AccessibleButton
                        className={
                            settings.interfaceStyle === "frosted"
                                ? "mx_SparkAppearanceCustomizer_selected"
                                : undefined
                        }
                        onClick={() => update({ interfaceStyle: "frosted" })}
                        aria-pressed={settings.interfaceStyle === "frosted"}
                    >
                        玻璃磨砂
                    </AccessibleButton>
                </div>

                <div
                    className="mx_SparkAppearanceCustomizer_preview"
                    style={previewStyle}
                >
                    <div className="mx_SparkAppearanceCustomizer_previewHeader">
                        实时预览
                    </div>
                    <div
                        className="mx_SparkAppearanceCustomizer_previewBubble mx_SparkAppearanceCustomizer_previewBubble_other"
                        style={{
                            background: settings.otherBubbleColor,
                            opacity: settings.otherBubbleOpacity / 100,
                        }}
                    >
                        <b>Alice</b>
                        <br />
                        切换颜色、风格和背景后，这里会立即显示聊天气泡效果。
                    </div>
                    <div
                        className="mx_SparkAppearanceCustomizer_previewBubble mx_SparkAppearanceCustomizer_previewBubble_self"
                        style={{
                            background: settings.ownBubbleColor,
                            opacity: settings.ownBubbleOpacity / 100,
                        }}
                    >
                        <b>你</b>
                        <br />
                        恢复默认不会影响你的聊天数据。
                    </div>
                </div>

                <div className="mx_SparkAppearanceCustomizer_colourGrid">
                    <ColourSetting
                        label="主题色"
                        value={settings.accentColor}
                        opacity={settings.accentOpacity}
                        onChange={(accentColor, accentOpacity) =>
                            update({ accentColor, accentOpacity })
                        }
                    />
                    <ColourSetting
                        label="自己的气泡颜色"
                        value={settings.ownBubbleColor}
                        opacity={settings.ownBubbleOpacity}
                        onChange={(ownBubbleColor, ownBubbleOpacity) =>
                            update({ ownBubbleColor, ownBubbleOpacity })
                        }
                    />
                    <ColourSetting
                        label="他人的气泡颜色"
                        value={settings.otherBubbleColor}
                        opacity={settings.otherBubbleOpacity}
                        onChange={(otherBubbleColor, otherBubbleOpacity) =>
                            update({ otherBubbleColor, otherBubbleOpacity })
                        }
                    />
                </div>

                <div className="mx_SparkAppearanceCustomizer_background">
                    <div>
                        <b>聊天背景</b>
                        <p>
                            {settings.chatBackgroundDataUrl
                                ? "已启用，可随时移除。"
                                : "未启用。上传图片后仅影响当前设备。"}
                        </p>
                    </div>
                    <div>
                        <input
                            ref={fileInput}
                            className="mx_SparkAppearanceCustomizer_fileInput"
                            type="file"
                            accept="image/*"
                            onChange={(event) => void onBackground(event)}
                        />
                        <AccessibleButton
                            kind="primary"
                            onClick={() => fileInput.current?.click()}
                        >
                            上传背景图片
                        </AccessibleButton>
                        <AccessibleButton
                            kind="secondary"
                            disabled={!settings.chatBackgroundDataUrl}
                            onClick={() =>
                                update({ chatBackgroundDataUrl: undefined })
                            }
                        >
                            移除背景
                        </AccessibleButton>
                    </div>
                    {backgroundError && (
                        <span className="mx_SparkAppearanceCustomizer_error">
                            {backgroundError}
                        </span>
                    )}
                </div>
            </section>
        </SettingsSubsection>
    );
}
