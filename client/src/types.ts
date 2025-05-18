export function smartSplit(str: string, index: number) {
    const words = str.split(/\s+/);
    let currentPos = 0;

    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const wordStart = currentPos;
        const wordEnd = wordStart + word.length;

        if (index >= wordStart && index <= wordEnd) {
            const distanceToStart = index - wordStart;
            const distanceToEnd = wordEnd - index;

            if (distanceToStart < distanceToEnd) {
                // Split before the word
                return [
                    str.slice(0, wordStart).trim(),
                    str.slice(wordStart).trim()
                ];
            }
            return [
                str.slice(0, wordEnd).trim(),
                str.slice(wordEnd).trim()
            ];
        }

        currentPos = wordEnd + 1; // +1 to account for space
    }

    // If index is out of bounds, just return original string as-is
    return [str]
}