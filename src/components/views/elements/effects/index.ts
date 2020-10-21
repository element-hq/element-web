import {_t, _td} from "../../../../languageHandler";

type Effect = {
    emojis: Array<string>;
    msgType: string;
    command: string;
    description: () => string;
    fallbackMessage: () => string;
}

const effects: Array<Effect> = [
    {
        emojis: ['🎊', '🎉'],
        msgType: 'nic.custom.confetti',
        command: 'confetti',
        description: () => _td("Sends the given message with confetti"),
        fallbackMessage: () => _t("sends confetti") + " 🎉",
    },
];

export default effects;


