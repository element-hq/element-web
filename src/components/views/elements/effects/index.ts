import {_t, _td} from "../../../../languageHandler";

export default [
    {
        emojis: ['🎊', '🎉'],
        msgType: 'nic.custom.confetti',
        command: 'confetti',
        description: () => _td("Sends the given message with confetti"),
        fallbackMessage: () => _t("sends confetti") + " 🎉",
    },
]
