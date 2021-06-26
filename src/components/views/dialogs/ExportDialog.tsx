import React, { useState } from "react";
import { Room } from "matrix-js-sdk/src";
import { _t } from "../../../languageHandler";
import { IDialogProps } from "./IDialogProps";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";
import Dropdown from "../elements/Dropdown";
import exportConversationalHistory, {
    exportFormats,
    exportTypes,
} from "../../../utils/exportUtils/exportUtils";

interface IProps extends IDialogProps {
    room: Room;
}

const ExportDialog: React.FC<IProps> = ({ room, onFinished }) => {
    const [format, setFormat] = useState("HTML");
    const onExportClick = async () => {
        await exportConversationalHistory(
            room,
            exportFormats.PLAIN_TEXT,
            exportTypes.START_DATE,
            {
                startDate: parseInt(
                    new Date("2021.05.20").getTime().toFixed(0),
                ),
                attachmentsIncluded: true,
                maxSize: 7 * 1024 * 1024, // 7 MB
            },
        );
    };

    const onCancel = () => {
        onFinished(false);
    };

    const options = Object.keys(exportFormats).map(key => {
        return <div key={key}>
            { exportFormats[key] }
        </div>
    })

    return (
        <BaseDialog
            title={_t("Export Chat")}
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

            <Dropdown
                onOptionChange={(key: string) => { setFormat(key) }}
                value={format}
                label={_t("Export formats")}
            >
                { options }
            </Dropdown>

            <DialogButtons
                primaryButton={_t("Export")}
                onPrimaryButtonClick={onExportClick}
                onCancel={onCancel}
            />
        </BaseDialog>
    );
};

export default ExportDialog;
