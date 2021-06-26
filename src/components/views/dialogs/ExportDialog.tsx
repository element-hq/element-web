import React, { useRef, useState } from "react";
import { Room } from "matrix-js-sdk/src";
import { _t } from "../../../languageHandler";
import { IDialogProps } from "./IDialogProps";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";
import Field from "../elements/Field";
import StyledRadioGroup from "../elements/StyledRadioGroup";
import StyledCheckbox from "../elements/StyledCheckbox";
import exportConversationalHistory, {
    exportFormats,
    exportTypes,
    textForFormat,
    textForType,
} from "../../../utils/exportUtils/exportUtils";
import { IFieldState, IValidationResult } from "../elements/Validation";

interface IProps extends IDialogProps {
    room: Room;
}

const ExportDialog: React.FC<IProps> = ({ room, onFinished }) => {
    const [exportFormat, setExportFormat] = useState("HTML");
    const [exportType, setExportType] = useState("TIMELINE");
    const [includeAttachments, setAttachments] = useState(false);
    const [numberOfMessages, setNumberOfMessages] = useState<number>(100);
    const [sizeLimit, setSizeLimit] = useState<number | null>(8);
    const [sizeLimitRef, messageCountRef] = [useRef<any>(), useRef<any>()];

    const onExportClick = async () => {
        const isValidSize = await sizeLimitRef.current.validate({
            focused: false,
        });
        if (!isValidSize) {
            sizeLimitRef.current.validate({ focused: true });
            return;
        }
        if (exportType === exportTypes.LAST_N_MESSAGES) {
            const isValidNumberOfMessages =
                await messageCountRef.current.validate({ focused: false });
            if (!isValidNumberOfMessages) {
                messageCountRef.current.validate({ focused: true });
                return;
            }
        }
        await exportConversationalHistory(
            room,
            exportFormats[exportFormat],
            exportTypes[exportType],
            {
                numberOfMessages,
                attachmentsIncluded: includeAttachments,
                maxSize: sizeLimit * 1024 * 1024,
            },
        );
    };

    const onValidateSize = async ({
        value,
    }: Pick<IFieldState, "value">): Promise<IValidationResult> => {
        const parsedSize = parseFloat(value);
        const min = 1;
        const max = 4000;

        if (isNaN(parsedSize)) {
            return { valid: false, feedback: _t("Size must be a number") };
        }

        if (!(min <= parsedSize && parsedSize <= max)) {
            return {
                valid: false,
                feedback: _t(
                    "Size can only be between %(min)s MB and %(max)s MB",
                    { min, max },
                ),
            };
        }

        return {
            valid: true,
            feedback: _t("Enter size between %(min)s MB and %(max)s MB", {
                min,
                max,
            }),
        };
    };

    const onValidateNumberOfMessages = async ({
        value,
    }: Pick<IFieldState, "value">): Promise<IValidationResult> => {
        const parsedSize = parseFloat(value);
        const min = 1;
        const max = 10 ** 8;

        if (isNaN(parsedSize)) {
            return {
                valid: false,
                feedback: _t("Number of messages must be a number"),
            };
        }

        if (!(min <= parsedSize && parsedSize <= max)) {
            return {
                valid: false,
                feedback: _t(
                    "Number of messages can only be between %(min)s and %(max)s",
                    { min, max },
                ),
            };
        }

        return {
            valid: true,
            feedback: _t("Enter a number between %(min)s and %(max)s", {
                min,
                max,
            }),
        };
    };

    const onCancel = () => {
        onFinished(false);
    };

    const exportFormatOptions = Object.keys(exportFormats).map((format) => ({
        value: format,
        label: textForFormat(format),
    }));

    const exportTypeOptions = Object.keys(exportTypes).map((type) => {
        return (
            <option key={type} value={type}>
                {textForType(type)}
            </option>
        );
    });
    let MessageCount = null;
    if (exportType === exportTypes.LAST_N_MESSAGES) {
        MessageCount = (
            <Field
                element="input"
                type="number"
                value={numberOfMessages}
                ref={messageCountRef}
                onValidate={onValidateNumberOfMessages}
                label={_t("Number of messages")}
                onChange={(e) => {
                    setNumberOfMessages(parseInt(e.target.value));
                }}
            />
        );
    }

    const sizePostFix = <span title={_t("MB")}>{_t("MB")}</span>;

    return (
        <BaseDialog
            title={_t("Export Chat")}
            className="mx_ExportDialog"
            contentId="mx_Dialog_content"
            hasCancel={true}
            onFinished={onFinished}
            fixedWidth={true}
        >
            <p>
                {_t(
                    "Select from the options below to export chats from your timeline",
                )}
            </p>

            <span className="mx_ExportDialog_subheading">{_t("Format")}</span>

            <StyledRadioGroup
                name="feedbackRating"
                value={exportFormat}
                onChange={(key) => setExportFormat(key)}
                definitions={exportFormatOptions}
            />

            <span className="mx_ExportDialog_subheading">{_t("Messages")}</span>

            <Field
                element="select"
                value={exportType}
                onChange={(e) => {
                    setExportType(e.target.value);
                }}
            >
                {exportTypeOptions}
            </Field>
            {MessageCount}

            <span className="mx_ExportDialog_subheading">
                {_t("Size Limit")}
            </span>

            <Field
                type="number"
                autoComplete="off"
                onValidate={onValidateSize}
                element="input"
                ref={sizeLimitRef}
                value={sizeLimit}
                postfixComponent={sizePostFix}
                onChange={(e) => setSizeLimit(parseInt(e.target.value))}
            />

            <StyledCheckbox
                checked={includeAttachments}
                onChange={(e) =>
                    setAttachments((e.target as HTMLInputElement).checked)
                }
            >
                {_t("Include Attachments")}
            </StyledCheckbox>

            <DialogButtons
                primaryButton={_t("Export")}
                onPrimaryButtonClick={onExportClick}
                onCancel={onCancel}
            />
        </BaseDialog>
    );
};

export default ExportDialog;
