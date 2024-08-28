/*
    Copyright VerjiTech
*/

import React from "react";

import { _t } from "../../../languageHandler";
import MiscButton from "./MiscButton";
import { ActionPayload } from "../../../dispatcher/payloads";
// @ts-ignore
import toggleWidget from "../../structures/scripts/freshworks.js";

// Currently only misc, but should be defined if misc buttons will later be used together with other header kinds.
export enum HeaderKind {
    Misc = "misc",
}

interface IProps {}
interface IState {
    headerKind: HeaderKind;
}

abstract class Buttons extends React.Component<IProps, IState> {
    public constructor(props: IProps, kind: HeaderKind) {
        super(props);

        this.state = {
            headerKind: kind,
        };
    }

    protected abstract onAction(payload: ActionPayload): void;
    public abstract renderButtons(): JSX.Element[];

    public render(): React.ReactElement {
        return <div className="mx_MiscHeaderButtons">{this.renderButtons()}</div>;
        // return <div>
        //     {this.renderButtons()}
        // </div>;
    }
}

export default class MiscHeaderButtons extends Buttons {
    public constructor(props: IProps) {
        super(props, HeaderKind.Misc);
    }

    protected onAction(payload: ActionPayload): void {}
    public renderButtons(): React.ReactElement[] {
        return [
            <MiscButton
                key="roomSupportButton"
                // name="roomSupportButton"
                // name="mx_UserSettingsDialog_helpIcon"
                name="mx_RightPanel_supportButton"
                isHighlighted={false}
                title={_t("common|support")}
                onClick={() => supportRedirect()}
                // analytics={['Misc Header Button', 'Support Button', 'click']}
            />,
        ];
    }
}

const supportRedirect = (): void => {
    /* REDIRECT TO SUPPORT PAGE
    const newWindow = window.open("https://rosberg.no/hjelp", '_blank', 'noopener,noreferrer')
    if (newWindow)
        newWindow.opener = null
    */

    toggleWidget();
};
