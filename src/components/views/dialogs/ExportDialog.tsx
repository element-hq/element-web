/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../languageHandler";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";
import Field from "../elements/Field";
import StyledRadioGroup from "../elements/StyledRadioGroup";
import StyledCheckbox from "../elements/StyledCheckbox";
import {
    ExportFormat,
    type ExportFormatKey,
    ExportType,
    type ExportTypeKey,
    textForFormat,
    textForType,
} from "../../../utils/exportUtils/exportUtils";
import withValidation, { type IFieldState, type IValidationResult } from "../elements/Validation";
import HTMLExporter from "../../../utils/exportUtils/HtmlExport";
import JSONExporter from "../../../utils/exportUtils/JSONExport";
import PlainTextExporter from "../../../utils/exportUtils/PlainTextExport";
import { useStateCallback } from "../../../hooks/useStateCallback";
import type Exporter from "../../../utils/exportUtils/Exporter";
import Spinner from "../elements/Spinner";
import InfoDialog from "./InfoDialog";
import ChatExport from "../../../customisations/ChatExport";
import { validateNumberInRange } from "../../../utils/validate";

interface IProps {
    room: Room;
    onFinished(doExport?: boolean): void;
}

interface ExportConfig {
    exportFormat: ExportFormat;
    exportType: ExportType;
    numberOfMessages: number;
    sizeLimit: number;
    includeAttachments: boolean;
    setExportFormat?: Dispatch<SetStateAction<ExportFormat>>;
    setExportType?: Dispatch<SetStateAction<ExportType>>;
    setAttachments?: Dispatch<SetStateAction<boolean>>;
    setNumberOfMessages?: Dispatch<SetStateAction<number>>;
    setSizeLimit?: Dispatch<SetStateAction<number>>;
}

/**
 * Set up form state using "forceRoomExportParameters" or defaults
 * Form fields configured in ForceRoomExportParameters are not allowed to be edited
 * Only return change handlers for editable values
 */
const useExportFormState = (): ExportConfig => {
    const config = ChatExport.getForceChatExportParameters();

    const [exportFormat, setExportFormat] = useState(config.format ?? ExportFormat.Html);
    const [exportType, setExportType] = useState(config.range ?? ExportType.Timeline);
    const [includeAttachments, setAttachments] = useState(config.includeAttachments ?? false);
    const [numberOfMessages, setNumberOfMessages] = useState<number>(config.numberOfMessages ?? 100);
    const [sizeLimit, setSizeLimit] = useState<number>(config.sizeMb ?? 8);

    return {
        exportFormat,
        exportType,
        includeAttachments,
        numberOfMessages,
        sizeLimit,
        setExportFormat: !config.format ? setExportFormat : undefined,
        setExportType: !config.range ? setExportType : undefined,
        setNumberOfMessages: !config.numberOfMessages ? setNumberOfMessages : undefined,
        setSizeLimit: !config.sizeMb ? setSizeLimit : undefined,
        setAttachments: config.includeAttachments === undefined ? setAttachments : undefined,
    };
};

const ExportDialog: React.FC<IProps> = ({ room, onFinished }) => {
    const {
        exportFormat,
        exportType,
        includeAttachments,
        numberOfMessages,
        sizeLimit,
        setExportFormat,
        setExportType,
        setNumberOfMessages,
        setSizeLimit,
        setAttachments,
    } = useExportFormState();

    const [isExporting, setExporting] = useState(false);
    const sizeLimitRef = useRef<Field>(null);
    const messageCountRef = useRef<Field>(null);
    const [exportProgressText, setExportProgressText] = useState(_t("export_chat|processing"));
    const [displayCancel, setCancelWarning] = useState(false);
    const [exportCancelled, setExportCancelled] = useState(false);
    const [exportSuccessful, setExportSuccessful] = useState(false);
    const [exporter, setExporter] = useStateCallback<Exporter | null>(
        null,
        async (exporter: Exporter | null): Promise<void> => {
            await exporter?.export().then(() => {
                if (!exportCancelled) setExportSuccessful(true);
            });
        },
    );

    const startExport = async (): Promise<void> => {
        const exportOptions = {
            numberOfMessages,
            attachmentsIncluded: includeAttachments,
            maxSize: sizeLimit * 1024 * 1024,
        };
        switch (exportFormat) {
            case ExportFormat.Html:
                setExporter(new HTMLExporter(room, ExportType[exportType], exportOptions, setExportProgressText));
                break;
            case ExportFormat.Json:
                setExporter(new JSONExporter(room, ExportType[exportType], exportOptions, setExportProgressText));
                break;
            case ExportFormat.PlainText:
                setExporter(new PlainTextExporter(room, ExportType[exportType], exportOptions, setExportProgressText));
                break;
            default:
                logger.error("Unknown export format");
                return;
        }
    };

    const onExportClick = async (): Promise<void> => {
        const isValidSize =
            !setSizeLimit ||
            (await sizeLimitRef.current?.validate({
                focused: false,
            }));

        if (!isValidSize) {
            sizeLimitRef.current?.validate({ focused: true });
            return;
        }
        if (exportType === ExportType.LastNMessages) {
            const isValidNumberOfMessages = await messageCountRef.current?.validate({ focused: false });
            if (!isValidNumberOfMessages) {
                messageCountRef.current?.validate({ focused: true });
                return;
            }
        }
        setExporting(true);
        await startExport();
    };

    const validateSize = withValidation({
        rules: [
            {
                key: "required",
                test({ value, allowEmpty }) {
                    return allowEmpty || !!value;
                },
                invalid: () => {
                    const min = 1;
                    const max = 2000;
                    return _t("export_chat|enter_number_between_min_max", {
                        min,
                        max,
                    });
                },
            },
            {
                key: "number",
                test: ({ value }) => {
                    const parsedSize = parseInt(value!, 10);
                    return validateNumberInRange(1, 2000)(parsedSize);
                },
                invalid: () => {
                    const min = 1;
                    const max = 2000;
                    return _t("export_chat|size_limit_min_max", { min, max });
                },
            },
        ],
    });

    const onValidateSize = async (fieldState: IFieldState): Promise<IValidationResult> => {
        const result = await validateSize(fieldState);
        return result;
    };

    const validateNumberOfMessages = withValidation({
        rules: [
            {
                key: "required",
                test({ value, allowEmpty }) {
                    return allowEmpty || !!value;
                },
                invalid: () => {
                    const min = 1;
                    const max = 10 ** 8;
                    return _t("export_chat|enter_number_between_min_max", {
                        min,
                        max,
                    });
                },
            },
            {
                key: "number",
                test: ({ value }) => {
                    const parsedSize = parseInt(value!, 10);
                    return validateNumberInRange(1, 10 ** 8)(parsedSize);
                },
                invalid: () => {
                    const min = 1;
                    const max = 10 ** 8;
                    return _t("export_chat|num_messages_min_max", { min, max });
                },
            },
        ],
    });

    const onValidateNumberOfMessages = async (fieldState: IFieldState): Promise<IValidationResult> => {
        const result = await validateNumberOfMessages(fieldState);
        return result;
    };

    const onCancel = async (): Promise<void> => {
        if (isExporting) setCancelWarning(true);
        else onFinished(false);
    };

    const confirmCancel = async (): Promise<void> => {
        await exporter?.cancelExport();
        setExportCancelled(true);
        setExporting(false);
        setExporter(null);
    };

    const exportFormatOptions = Object.values(ExportFormat).map((format) => ({
        value: format,
        label: textForFormat(format),
    }));

    const exportTypeOptions = Object.values(ExportType).map((type) => {
        return (
            <option key={ExportType[type]} value={type}>
                {textForType(type)}
            </option>
        );
    });

    let messageCount: JSX.Element | undefined;
    if (exportType === ExportType.LastNMessages && setNumberOfMessages) {
        messageCount = (
            <Field
                id="message-count"
                element="input"
                type="number"
                value={numberOfMessages.toString()}
                ref={messageCountRef}
                onValidate={onValidateNumberOfMessages}
                label={_t("export_chat|num_messages")}
                onChange={(e) => {
                    setNumberOfMessages(parseInt(e.target.value));
                }}
            />
        );
    }

    const sizePostFix = <span>{_t("export_chat|size_limit_postfix")}</span>;

    if (exportCancelled) {
        // Display successful cancellation message
        return (
            <InfoDialog
                title={_t("export_chat|cancelled")}
                description={_t("export_chat|cancelled_detail")}
                hasCloseButton={true}
                onFinished={onFinished}
            />
        );
    } else if (exportSuccessful) {
        // Display successful export message
        return (
            <InfoDialog
                title={_t("export_chat|successful")}
                description={_t("export_chat|successful_detail")}
                hasCloseButton={true}
                onFinished={onFinished}
            />
        );
    } else if (displayCancel) {
        // Display cancel warning
        return (
            <BaseDialog
                title={_t("common|warning")}
                className="mx_ExportDialog"
                contentId="mx_Dialog_content"
                onFinished={onFinished}
                fixedWidth={true}
            >
                <p>{_t("export_chat|confirm_stop")}</p>
                <DialogButtons
                    primaryButton={_t("action|stop")}
                    primaryButtonClass="danger"
                    hasCancel={true}
                    cancelButton={_t("action|continue")}
                    onCancel={() => setCancelWarning(false)}
                    onPrimaryButtonClick={confirmCancel}
                />
            </BaseDialog>
        );
    } else {
        // Display export settings
        return (
            <BaseDialog
                title={isExporting ? _t("export_chat|exporting_your_data") : _t("export_chat|title")}
                className={`mx_ExportDialog ${isExporting && "mx_ExportDialog_Exporting"}`}
                contentId="mx_Dialog_content"
                hasCancel={true}
                onFinished={onFinished}
                fixedWidth={true}
            >
                {!isExporting ? <p>{_t("export_chat|select_option")}</p> : null}

                <div className="mx_ExportDialog_options">
                    {!!setExportFormat && (
                        <>
                            <span className="mx_ExportDialog_subheading">{_t("export_chat|format")}</span>

                            <StyledRadioGroup
                                name="exportFormat"
                                value={exportFormat}
                                onChange={(key: ExportFormatKey) => setExportFormat(ExportFormat[key])}
                                definitions={exportFormatOptions}
                            />
                        </>
                    )}

                    {!!setExportType && (
                        <>
                            <span className="mx_ExportDialog_subheading">{_t("export_chat|messages")}</span>

                            <Field
                                id="export-type"
                                element="select"
                                value={exportType}
                                onChange={(e) => {
                                    setExportType(ExportType[e.target.value as ExportTypeKey]);
                                }}
                            >
                                {exportTypeOptions}
                            </Field>
                            {messageCount}
                        </>
                    )}

                    {setSizeLimit && (
                        <>
                            <span className="mx_ExportDialog_subheading">{_t("export_chat|size_limit")}</span>

                            <Field
                                id="size-limit"
                                type="number"
                                autoComplete="off"
                                onValidate={onValidateSize}
                                element="input"
                                ref={sizeLimitRef}
                                value={sizeLimit.toString()}
                                postfixComponent={sizePostFix}
                                onChange={(e) => setSizeLimit(parseInt(e.target.value))}
                            />
                        </>
                    )}

                    {setAttachments && (
                        <>
                            <StyledCheckbox
                                className="mx_ExportDialog_attachments-checkbox"
                                id="include-attachments"
                                checked={includeAttachments}
                                onChange={(e) => setAttachments((e.target as HTMLInputElement).checked)}
                            >
                                {_t("export_chat|include_attachments")}
                            </StyledCheckbox>
                        </>
                    )}
                </div>
                {isExporting ? (
                    <div data-testid="export-progress" className="mx_ExportDialog_progress">
                        <Spinner w={24} h={24} />
                        <p>{exportProgressText}</p>
                        <DialogButtons
                            primaryButton={_t("action|cancel")}
                            primaryButtonClass="danger"
                            hasCancel={false}
                            onPrimaryButtonClick={onCancel}
                        />
                    </div>
                ) : (
                    <DialogButtons
                        primaryButton={_t("action|export")}
                        onPrimaryButtonClick={onExportClick}
                        onCancel={() => onFinished(false)}
                    />
                )}
            </BaseDialog>
        );
    }
};

export default ExportDialog;
