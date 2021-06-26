import React from 'react';
import { Room } from 'matrix-js-sdk/src';
import { _t } from '../../../languageHandler';
import { IDialogProps } from './IDialogProps';
import BaseDialog from "./BaseDialog"
import DialogButtons from "../elements/DialogButtons";

interface IProps extends IDialogProps{
    room: Room;
}

export default class ExportDialog extends React.PureComponent<IProps> {
    onExportClick = async () => {
        const {
            default: exportConversationalHistory,
            exportFormats,
            exportTypes,
        } = await import("../../../utils/exportUtils/exportUtils");

        await exportConversationalHistory(
            this.props.room,
            exportFormats.PLAIN_TEXT,
            exportTypes.START_DATE,
            {
                startDate: parseInt(new Date("2021.05.20").getTime().toFixed(0)),
                attachmentsIncluded: true,
                maxSize: 7 * 1024 * 1024, // 7 MB
            },
        );
    };

    onCancel = () => {
        this.props.onFinished(false);
    };

    render() {
        return (
            <BaseDialog
                title={_t("Export Chat")}
                contentId='mx_Dialog_content'
                hasCancel={true}
                onFinished={this.props.onFinished}
                fixedWidth={false}
            >
                <div className="mx_Dialog_content" id='mx_Dialog_content'>
                    Export
                </div>
                <DialogButtons
                    primaryButton={_t('Export')}
                    onPrimaryButtonClick={this.onExportClick}
                    onCancel={this.onCancel}
                />
            </BaseDialog>
        );
    }
}
