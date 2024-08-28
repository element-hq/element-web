/*
    Copyright ROSBERG / VerjiTech
*/

import React from "react";
import classNames from "classnames";

// import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import AccessibleButton from "../elements/AccessibleButton";

interface IProps {
    // Whether this button is highlighted
    isHighlighted: boolean;
    // click handler
    onClick: () => void;
    // The badge to display above the icon
    badge?: React.ReactNode;

    // Button name
    name: string;
    // Button title
    title: string;
}

// TODO: replace this, the composer buttons and the right panel buttons with a unified
// representation
export default class MiscButton extends React.Component<IProps> {
    public constructor(props: IProps) {
        super(props);
        this.onClick = this.onClick.bind(this);
    }

    private onClick(): void {
        this.props.onClick();
    }

    public render(): React.ReactElement {
        const classes = classNames({
            mx_LegacyRoomHeader_button: true,
            mx_RightPanel_supportButton_highlight: this.props.isHighlighted,
            [`${this.props.name}`]: true,
        });

        return (
            <AccessibleButton
                aria-current={this.props.isHighlighted}
                role="button"
                title={this.props.title}
                className={classes}
                onClick={this.onClick}
            />
        );
    }
}
