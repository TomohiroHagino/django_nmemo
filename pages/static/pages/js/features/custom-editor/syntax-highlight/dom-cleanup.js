// DOMクリーンアップ処理
export class DomCleanup {
    static cleanupBrTags(codeElement) {
        const brElements = codeElement.querySelectorAll('br');
        if (brElements.length === 0) return false;
        
        let hasChanges = false;
        
        brElements.forEach(br => {
            const parent = br.parentNode;
            const prevSibling = br.previousSibling;
            const nextSibling = br.nextSibling;
            
            let textNode;
            if (prevSibling && prevSibling.nodeType === Node.TEXT_NODE) {
                textNode = prevSibling;
                textNode.textContent += '\n';
                if (nextSibling && nextSibling.nodeType === Node.TEXT_NODE) {
                    textNode.textContent += nextSibling.textContent;
                    nextSibling.remove();
                }
                br.remove();
            } else if (nextSibling && nextSibling.nodeType === Node.TEXT_NODE) {
                textNode = nextSibling;
                textNode.textContent = '\n' + textNode.textContent;
                br.remove();
            } else {
                textNode = document.createTextNode('\n');
                parent.replaceChild(textNode, br);
            }
            
            hasChanges = true;
        });
        
        const nestedPre = codeElement.querySelector('pre');
        if (nestedPre) {
            const text = nestedPre.textContent;
            const textNode = document.createTextNode(text);
            nestedPre.parentNode.replaceChild(textNode, nestedPre);
            hasChanges = true;
        }
        
        return hasChanges;
    }
}
