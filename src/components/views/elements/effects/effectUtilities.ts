export const containsEmoji = (content: { msgtype: string, body: string }, emojis: Array<string>): boolean => {
    return emojis.some((emoji) => content.body.includes(emoji));
}
