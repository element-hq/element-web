import React from "react";

export const generateCompletionDomId = (n: number): string => `mx_Autocomplete_Completion_${n}`;

export default class Autocomplete extends React.PureComponent {
    public constructor(props: {} | Readonly<{}>) {
        super(props);

        this.state = {
            // list of completionResults, each containing completions
            completions: [],

            // array of completions, so we can look up current selection by offset quickly
            completionList: [],

            // how far down the completion list we are (THIS IS 1-INDEXED!)
            selectionOffset: 1,

            // whether we should show completions if they're available
            shouldShowCompletions: true,

            hide: false,

            forceComplete: false,
        };
    }

    public render(): React.ReactNode {
        return null;
    }
}
