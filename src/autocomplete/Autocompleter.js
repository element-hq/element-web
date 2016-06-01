import CommandProvider from './CommandProvider';

const COMPLETERS = [CommandProvider].map(completer => new completer());

export function getCompletions(query: String) {
    return COMPLETERS.map(completer => completer.getCompletions(query));
}
