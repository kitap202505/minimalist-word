import { EventBus } from './eventBus.js';

export class EditorCore {
    constructor(containerElement) {
        this.container = containerElement;
        this.init();
    }

    init() {
        document.execCommand('defaultParagraphSeparator', false, 'p');
        this.rebindPages();
        this.updateStats();

        EventBus.on('format', (command) => this.formatText(command));
        EventBus.on('font-change', (font) => this.changeFont(font));
        EventBus.on('size-change', (size) => this.changeSize(size));
        EventBus.on('color-change', (color) => this.formatText('foreColor', color));
        EventBus.on('direction-change', (dir) => this.setDirection(dir));
        EventBus.on('page-size-change', (type) => this.changePageSize(type));
        EventBus.on('load-html', (html) => this.loadHtmlContent(html));
        EventBus.on('new-page', () => EventBus.emit('new-page-request'));
    }

    createNewDocument() {
        this.container.innerHTML = '';
        const newPage = this.createNewPageElement();
        this.container.appendChild(newPage);
        newPage.focus();
        this.rebindPages();
        this.updatePageNumbers();
        this.updateStats();
        EventBus.emit('content-changed', this.container.innerHTML);
    }

    createNewPageElement() {
        const newPage = document.createElement('div');
        newPage.className = 'page';
        newPage.setAttribute('contenteditable', 'true');
        
        const pageSizeSelect = document.getElementById('pageSizeSelect');
        const type = pageSizeSelect ? pageSizeSelect.value : 'fullscreen';

        if (type === 'fullscreen') {
            newPage.style.width = '95%';
            newPage.style.height = '1123px';
            newPage.style.padding = '60px 80px';
        } else if (type === 'a4') {
            newPage.style.width = '794px';
            newPage.style.height = '1123px';
            newPage.style.padding = '96px';
        } else if (type === 'a4-landscape') {
            newPage.style.width = '1123px';
            newPage.style.height = '794px';
            newPage.style.padding = '96px';
        } else if (type === 'letter') {
            newPage.style.width = '816px';
            newPage.style.height = '1056px';
            newPage.style.padding = '96px';
        }
        
        newPage.innerHTML = '<p><br></p>';
        return newPage;
    }

    loadHtmlContent(htmlContent) {
        this.container.innerHTML = '';
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent || '<p><br></p>';
        
        const blocks = Array.from(tempDiv.children);
        if (blocks.length === 0 && tempDiv.textContent.trim() !== '') {
            const p = document.createElement('p');
            p.textContent = tempDiv.textContent;
            blocks.push(p);
        }
        if (blocks.length === 0) {
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            blocks.push(p);
        }

        let currentPage = this.createNewPageElement();
        currentPage.innerHTML = '';
        this.container.appendChild(currentPage);

        blocks.forEach(block => {
            currentPage.appendChild(block);
            if (currentPage.scrollHeight > currentPage.clientHeight) {
                currentPage.removeChild(block);
                if (currentPage.children.length === 0) {
                    currentPage.appendChild(block);
                    currentPage = this.createNewPageElement();
                    currentPage.innerHTML = '';
                    this.container.appendChild(currentPage);
                } else {
                    currentPage = this.createNewPageElement();
                    currentPage.innerHTML = '';
                    this.container.appendChild(currentPage);
                    currentPage.appendChild(block);
                }
            }
        });

        if (this.container.querySelectorAll('.page').length === 0) {
            this.container.appendChild(this.createNewPageElement());
        }

        this.handlePageOverflow();
        this.rebindPages();
        this.updatePageNumbers();
        this.updateStats();
    }

    handlePageOverflow() {
        let pages = Array.from(this.container.querySelectorAll('.page'));

        for (let i = 0; i < pages.length; i++) {
            let page = pages[i];
            let safety = 0;

            while (page.scrollHeight > page.clientHeight && safety < 30) {
                safety++;

                if (page.children.length === 1) {
                    break;
                }

                let lastChild = page.lastElementChild;
                if (!lastChild) break;

                let nextPage = page.nextElementSibling;
                if (!nextPage || !nextPage.classList.contains('page')) {
                    nextPage = this.createNewPageElement();
                    nextPage.innerHTML = '';
                    if (page.nextElementSibling) {
                        this.container.insertBefore(nextPage, page.nextElementSibling);
                    } else {
                        this.container.appendChild(nextPage);
                    }
                }

                if ((lastChild.tagName === 'P' || lastChild.tagName === 'DIV') && lastChild.innerText) {
                    const words = lastChild.innerText.trim().split(/\s+/);
                    if (words.length > 1) {
                        this.splitAndMoveParagraph(lastChild, nextPage);
                        pages = Array.from(this.container.querySelectorAll('.page'));
                        continue;
                    }
                }

                nextPage.insertBefore(lastChild, nextPage.firstChild);
                pages = Array.from(this.container.querySelectorAll('.page'));
            }
        }
        this.cleanEmptyPages();
        this.updatePageNumbers();
    }

    splitAndMoveParagraph(pElement, nextPage) {
        const text = pElement.innerText || '';
        const words = text.split(/\s+/);

        if (words.length <= 1) {
            nextPage.insertBefore(pElement, nextPage.firstChild);
            return;
        }

        let newP = document.createElement(pElement.tagName || 'P');
        newP.style.cssText = pElement.style.cssText;
        
        let movedWords = [];
        const parentPage = pElement.closest('.page');

        while (words.length > 1 && parentPage.scrollHeight > parentPage.clientHeight) {
            movedWords.unshift(words.pop());
            pElement.innerText = words.join(" ");
        }

        newP.innerText = movedWords.join(" ");
        if (nextPage.firstChild) {
            nextPage.insertBefore(newP, nextPage.firstChild);
        } else {
            nextPage.appendChild(newP);
        }
    }

    cleanEmptyPages() {
        const pages = this.container.querySelectorAll('.page');
        const activeElement = document.activeElement;

        for (let i = 1; i < pages.length; i++) {
            let p = pages[i];
            const hasMarker = p.querySelector('#caret-marker');
            if (p.innerText.trim() === '' && !hasMarker && activeElement !== p) {
                p.remove();
            }
        }
    }

    saveCaretPosition() {
        const sel = window.getSelection();
        if (!sel.rangeCount) return null;
        const range = sel.getRangeAt(0);
        const marker = document.createElement('span');
        marker.id = 'caret-marker';
        marker.style.display = 'inline-block';
        marker.style.width = '0px';
        marker.style.height = '0px';
        marker.style.overflow = 'hidden';

        try {
            range.insertNode(marker);
            return marker;
        } catch (e) {
            return null;
        }
    }

    restoreCaretPosition() {
        const marker = document.getElementById('caret-marker');
        if (!marker) return;
        const page = marker.closest('.page');
        if (page) {
            page.focus();
            const range = document.createRange();
            range.setStartAfter(marker);
            range.collapse(true);

            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
        marker.remove();
    }

    rebindPages() {
        const pages = this.container.querySelectorAll('.page');
        pages.forEach(page => {
            page.oninput = () => {
                this.saveCaretPosition();
                this.handlePageOverflow();
                this.restoreCaretPosition();
                this.updateStats();
                EventBus.emit('content-changed', this.container.innerHTML);
            };
        });
    }

    updatePageNumbers() {
        const pages = this.container.querySelectorAll('.page');
        pages.forEach((page, index) => {
            page.setAttribute('data-page-no', index + 1);
            page.setAttribute('data-total-pages', pages.length);
        });
    }

    updateStats() {
        const pages = this.container.querySelectorAll('.page');
        let totalText = '';
        pages.forEach(p => totalText += (p.innerText || '') + '\n');

        const charCount = totalText.replace(/\n/g, '').trim().length;
        const wordCount = totalText.trim() === '' ? 0 : totalText.trim().split(/\s+/).filter(Boolean).length;
        
        EventBus.emit('stats-updated', {
            pages: pages.length,
            words: wordCount,
            chars: charCount
        });
    }

    formatText(command, value = null) {
        document.execCommand(command, false, value);
        const active = document.activeElement;
        if (active && active.classList.contains('page')) active.focus();
    }

    rangeIntersectsNode(range, node) {
        try {
            const nodeRange = document.createRange();
            nodeRange.selectNode(node);
            return range.compareBoundaryPoints(Range.END_TO_START, nodeRange) <= 0 &&
                   range.compareBoundaryPoints(Range.START_TO_END, nodeRange) >= 0;
        } catch (e) {
            return false;
        }
    }

    changeSize(size) {
        const sel = window.getSelection();
        if (!sel.rangeCount || sel.getRangeAt(0).collapsed) return;
        const range = sel.getRangeAt(0);

        const pages = Array.from(this.container.querySelectorAll('.page'));
        let modified = false;

        pages.forEach(page => {
            const elements = page.querySelectorAll('p, div, span, h1, h2, h3, h4, h5, h6');
            elements.forEach(el => {
                if (this.rangeIntersectsNode(range, el)) {
                    el.style.fontSize = size;
                    modified = true;
                }
            });
        });

        if (!modified) {
            document.execCommand('styleWithCSS', false, false);
            document.execCommand('fontSize', false, '7');
            this.container.querySelectorAll('font[size="7"]').forEach(el => {
                el.removeAttribute('size');
                el.style.fontSize = size;
            });
        }

        this.handlePageOverflow();
        this.updateStats();
        EventBus.emit('content-changed', this.container.innerHTML);
    }

    changeFont(font) {
        const sel = window.getSelection();
        if (!sel.rangeCount || sel.getRangeAt(0).collapsed) return;
        const range = sel.getRangeAt(0);

        const pages = Array.from(this.container.querySelectorAll('.page'));
        let modified = false;

        pages.forEach(page => {
            const elements = page.querySelectorAll('p, div, span, h1, h2, h3, h4, h5, h6');
            elements.forEach(el => {
                if (this.rangeIntersectsNode(range, el)) {
                    el.style.fontFamily = font;
                    modified = true;
                }
            });
        });

        if (!modified) {
            document.execCommand('styleWithCSS', false, true);
            document.execCommand('fontName', false, font);
        }

        this.handlePageOverflow();
        this.updateStats();
        EventBus.emit('content-changed', this.container.innerHTML);
    }

    setDirection(dir) {
        const sel = window.getSelection();
        if (!sel.anchorNode) return;
        let node = sel.anchorNode;
        if (node.nodeType === 3) node = node.parentNode;
        let block = node.closest('p, div, h1, h2, h3, h4, h5, h6');
        if (block) {
            block.style.direction = dir;
            block.style.textAlign = dir === 'rtl' ? 'right' : 'left';
            block.setAttribute('dir', dir);
        }
    }

    changePageSize(type) {
        const pages = Array.from(this.container.querySelectorAll('.page'));
        let allHtml = pages.map(p => p.innerHTML).join('<p><br></p>');

        this.container.innerHTML = '';

        let firstPage = this.createNewPageElement();
        if (type === 'fullscreen') {
            firstPage.style.width = '95%';
            firstPage.style.height = '1123px';
            firstPage.style.padding = '60px 80px';
        } else if (type === 'a4') { 
            firstPage.style.width = '794px'; 
            firstPage.style.height = '1123px'; 
            firstPage.style.padding = '96px'; 
        } else if (type === 'a4-landscape') { 
            firstPage.style.width = '1123px'; 
            firstPage.style.height = '794px'; 
            firstPage.style.padding = '96px'; 
        } else if (type === 'letter') { 
            firstPage.style.width = '816px'; 
            firstPage.style.height = '1056px'; 
            firstPage.style.padding = '96px'; 
        }
        
        this.container.appendChild(firstPage);
        firstPage.innerHTML = allHtml;
        
        this.handlePageOverflow();
        this.rebindPages();
        this.updateStats();
    }
}
