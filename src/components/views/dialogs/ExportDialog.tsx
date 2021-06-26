import React, { useState } from "react";
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

interface IProps extends IDialogProps {
    room: Room;
}

const ExportDialog: React.FC<IProps> = ({ room, onFinished }) => {
    const [exportFormat, setExportFormat] = useState("HTML");
    const [exportType, setExportType] = useState("TIMELINE");
    const [includeAttachments, setAttachments] = useState(false);
    const [numberOfMessages, setNumberOfMessages] = useState<number | null>();
    const [sizeLimit, setSizeLimit] = useState<number | null>(8);

    const onExportClick = async () => {
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
                value={numberOfMessages}
                label={_t("Number of messages")}
                onChange={(e) => {
                    setNumberOfMessages(parseInt(e.target.value));
                }}
                type="number"
            />
        );
    }

    const sizePostFix = (<span title={_t("MB")}>{_t("MB")}</span>);

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
            { MessageCount }

            <span className="mx_ExportDialog_subheading">
                {_t("Size Limit")}
            </span>

            <Field
                type="number"
                autoComplete="off"
                value={sizeLimit}
                postfixComponent={sizePostFix}
                onChange={(e) => setSizeLimit(e.target.value)}
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
